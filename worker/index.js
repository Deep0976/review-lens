// Review Lens free tier: the extension sends page text here, this Worker calls Gemini with a hidden key.
// It builds the prompts itself (so it can't be used as a general AI proxy) and returns the raw model
// JSON; quote verification and counting still happen in the extension, against the page text.
import { COMPARE_SCHEMA, MAX_CHARS, analysisPrompt, analysisSchema, comparePrompt, fitItems, llm, slim } from "../extension/analysis.js";

const MODELS = ["gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-3-flash-preview"]; // cheapest first
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };
const json = (body, status = 200) => new Response(JSON.stringify(body, null, 2), { status, headers: { ...CORS, "content-type": "application/json" } });
const dayIST = (ago = 0) => new Date(Date.now() + 5.5 * 3600e3 - ago * 86400e3).toISOString().slice(0, 10); // days start at midnight India time
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

// every KV key under a prefix (KV lists 1000 at a time)
async function listAll(kv, prefix) {
  const keys = [];
  let cursor;
  do {
    const page = await kv.list({ prefix, cursor });
    keys.push(...page.keys);
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return keys;
}

// Owner-only usage numbers: open /stats?key=STATS_KEY
async function stats(env) {
  const [installs, emails, ...active] = await Promise.all([
    listAll(env.LIMITS, "i:"), listAll(env.LIMITS, "e:"),
    ...Array.from({ length: 7 }, (_, i) => listAll(env.LIMITS, `a:${dayIST(i)}:`)),
  ]);
  return {
    totalUsers: installs.length,
    activeToday: active[0].length,
    activeLast7Days: Object.fromEntries(active.map((k, i) => [dayIST(i), k.length])),
    freeAnalysesToday: Number(await env.LIMITS.get(`g:${dayIST()}`)) || 0,
    emails: emails.map(k => k.metadata).sort((a, b) => (b.at > a.at ? 1 : -1)),
  };
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method === "GET" && new URL(req.url).pathname === "/stats") {
      const key = new URL(req.url).searchParams.get("key");
      return env.STATS_KEY && key === env.STATS_KEY ? json(await stats(env)) : json({ error: "Not allowed" }, 403);
    }
    if (req.method !== "POST") return json({ error: "Review Lens server. POST only." }, 405);

    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
    const { installId, kind } = body;
    if (!/^[0-9a-f-]{36}$/.test(installId || "")) return json({ error: "Bad request" }, 400);

    // Once a day the extension says "this install is in use": only the random install ID, no page text
    // ponytail: ~2 KV writes per user per day; the free plan allows 1000 writes/day, move to D1 past ~300 daily users
    if (kind === "ping") {
      const ttl = { expirationTtl: 40 * 86400 };
      await Promise.all([
        env.LIMITS.put(`a:${dayIST()}:${installId}`, "1", ttl),
        env.LIMITS.get(`i:${installId}`).then(seen => seen || env.LIMITS.put(`i:${installId}`, dayIST())),
      ]);
      return json({ ok: true });
    }
    // Optional email the user typed in Settings (empty = remove it)
    if (kind === "subscribe") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) { await env.LIMITS.delete(`e:${installId}`); return json({ ok: true }); }
      if (email.length > 254 || !EMAIL.test(email)) return json({ error: "That doesn't look like an email address." }, 400);
      await env.LIMITS.put(`e:${installId}`, "", { metadata: { email, at: new Date().toISOString() } });
      return json({ ok: true });
    }

    let prompt, schema;
    if (kind === "analyze" && typeof body.page?.text === "string" && body.page.text.trim()) {
      const p = body.page;
      const page = { title: String(p.title || "").slice(0, 300), url: String(p.url || "").slice(0, 1000), text: p.text.slice(0, MAX_CHARS), items: Array.isArray(p.items) ? fitItems(p.items) : [] };
      prompt = analysisPrompt(page);
      schema = analysisSchema(page);
    } else if (kind === "compare" && Array.isArray(body.analyses) && body.analyses.length >= 2) {
      prompt = comparePrompt(slim(body.analyses));
      schema = COMPARE_SCHEMA;
    } else {
      return json({ error: "Bad request" }, 400);
    }

    const PER_USER = Number(env.PER_USER) || 5; // free analyses per install per day
    const GLOBAL = Number(env.GLOBAL) || 200;   // hard daily cap for everyone, so the bill can't run away
    // ponytail: KV counters aren't atomic, so a burst can slightly overshoot the limits; use a Durable Object if that matters
    const day = dayIST(); // daily limits reset at midnight India time
    const userKey = `u:${day}:${installId}`, globalKey = `g:${day}`;
    const [used, total] = (await Promise.all([env.LIMITS.get(userKey), env.LIMITS.get(globalKey)])).map(Number);
    if (used >= PER_USER) return json({ code: "daily_limit", error: `You've used today's ${PER_USER} free analyses. Add your own free Gemini key in Settings for unlimited use, or come back tomorrow.` }, 429);
    if (total >= GLOBAL) return json({ code: "busy", error: "Review Lens has used up today's free analyses for everyone. Add your own free Gemini key in Settings to keep going, or try again tomorrow." }, 429);

    // any failure moves on to the next model; only "every model is out of quota" counts as busy
    let hiccup = false;
    for (const model of MODELS) {
      try {
        const out = await llm(prompt, { apiKey: env.GEMINI_API_KEY, model }, schema);
        const ttl = { expirationTtl: 2 * 86400 };
        await Promise.all([env.LIMITS.put(userKey, String(used + 1), ttl), env.LIMITS.put(globalKey, String(total + 1), ttl)]);
        return json({ out, left: PER_USER - used - 1 });
      } catch (e) {
        console.error(`${model}: ${e.message}`); // visible in "npx wrangler tail"; never sent to users
        if (e.code !== "fallover") hiccup = true;
      }
    }
    if (hiccup) return json({ code: "ai_error", error: "The AI service had a hiccup. Please try again in a minute." }, 502);
    return json({ code: "busy", error: "Today's free AI capacity is used up. Add your own free Gemini key in Settings, or try again tomorrow." }, 503);
  },
};
