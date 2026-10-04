// Review Lens free tier: the extension sends page text here, this Worker calls Gemini with a hidden key.
// It builds the prompts itself (so it can't be used as a general AI proxy) and returns the raw model
// JSON; quote verification and counting still happen in the extension, against the page text.
import { ANALYSIS_SCHEMA, COMPARE_SCHEMA, MAX_CHARS, analysisPrompt, comparePrompt, llm, slim } from "../extension/analysis.js";

const MODELS = ["gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-3-flash-preview"]; // cheapest first
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return json({ error: "Review Lens server. POST only." }, 405);

    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
    const { installId, kind } = body;
    if (!/^[0-9a-f-]{36}$/.test(installId || "")) return json({ error: "Bad request" }, 400);

    let prompt, schema;
    if (kind === "analyze" && typeof body.page?.text === "string" && body.page.text.trim()) {
      const p = body.page;
      prompt = analysisPrompt({ title: String(p.title || "").slice(0, 300), url: String(p.url || "").slice(0, 1000), text: p.text.slice(0, MAX_CHARS) });
      schema = ANALYSIS_SCHEMA;
    } else if (kind === "compare" && Array.isArray(body.analyses) && body.analyses.length >= 2) {
      prompt = comparePrompt(slim(body.analyses));
      schema = COMPARE_SCHEMA;
    } else {
      return json({ error: "Bad request" }, 400);
    }

    const PER_USER = Number(env.PER_USER) || 5; // free analyses per install per day
    const GLOBAL = Number(env.GLOBAL) || 200;   // hard daily cap for everyone, so the bill can't run away
    // ponytail: KV counters aren't atomic, so a burst can slightly overshoot the limits; use a Durable Object if that matters
    const day = new Date().toISOString().slice(0, 10);
    const userKey = `u:${day}:${installId}`, globalKey = `g:${day}`;
    const [used, total] = (await Promise.all([env.LIMITS.get(userKey), env.LIMITS.get(globalKey)])).map(Number);
    if (used >= PER_USER) return json({ error: `You've used today's ${PER_USER} free analyses. Add your own free Gemini key in Settings for unlimited use, or come back tomorrow.` }, 429);
    if (total >= GLOBAL) return json({ error: "Review Lens has used up today's free analyses for everyone. Add your own free Gemini key in Settings to keep going, or try again tomorrow." }, 429);

    for (const model of MODELS) {
      try {
        const out = await llm(prompt, { apiKey: env.GEMINI_API_KEY, model }, schema);
        const ttl = { expirationTtl: 2 * 86400 };
        await Promise.all([env.LIMITS.put(userKey, String(used + 1), ttl), env.LIMITS.put(globalKey, String(total + 1), ttl)]);
        return json({ out, left: PER_USER - used - 1 });
      } catch (e) {
        if (e.code !== "fallover") return json({ error: "The AI service had a hiccup. Please try again in a minute." }, 502);
      }
    }
    return json({ error: "Today's free AI capacity is used up. Add your own free Gemini key in Settings, or try again tomorrow." }, 503);
  },
};
