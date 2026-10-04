// Pure logic shared by the extension pages and test.mjs (no chrome.* APIs here).
// Guardrails: counts are computed in code, never by the LLM; a quote is kept only if it is
// an exact (whitespace/case-insensitive) substring of the text the model was given.

export const MAX_CHARS = 80000; // ~20k tokens; keeps one call fast and inside free-tier limits
export const OTHER = "Other / unclear";

export const norm = s => s.replace(/\s+/g, " ").trim().toLowerCase();
export const isVerified = (quote, normText) =>
  typeof quote === "string" && quote.trim().split(/\s+/).length >= 2 && normText.includes(norm(quote));

const S = type => ({ type });
const obj = (properties) => ({ type: "OBJECT", properties, required: Object.keys(properties) });
const arr = items => ({ type: "ARRAY", items });
// Structured output: without a schema, lighter models occasionally return malformed JSON
export const ANALYSIS_SCHEMA = obj({
  subject: S("STRING"),
  summary: arr(S("STRING")),
  themes: arr(obj({ name: S("STRING"), description: S("STRING") })),
  opinions: arr(obj({ theme: S("STRING"), sentiment: { type: "STRING", enum: ["pos", "neg", "mixed"] }, quote: S("STRING") })),
});
// Numbered-comments mode: the model only labels each comment (tiny output), so it can cover hundreds
export const ITEMS_SCHEMA = obj({
  subject: S("STRING"),
  summary: arr(S("STRING")),
  themes: arr(obj({ name: S("STRING"), description: S("STRING") })),
  labels: arr(obj({ i: S("INTEGER"), t: S("INTEGER"), s: { type: "STRING", enum: ["pos", "neg", "mixed"] } })),
});
export const MAX_ITEMS = 300;
export const analysisSchema = page => (page.items?.length ? ITEMS_SCHEMA : ANALYSIS_SCHEMA);

// Keep whole comments, at most MAX_ITEMS and MAX_CHARS in total
export function fitItems(items) {
  const out = [];
  let chars = 0;
  for (const c of items || []) {
    if (typeof c !== "string" || !c.trim()) continue;
    const t = c.trim().slice(0, 1000);
    if (out.length >= MAX_ITEMS || chars + t.length > MAX_CHARS) break;
    out.push(t);
    chars += t.length;
  }
  return out;
}

export const COMPARE_SCHEMA = obj({
  common: arr(obj({ name: S("STRING"), description: S("STRING") })),
  mapping: arr(obj({ source: S("INTEGER"), theme: S("STRING"), common: S("STRING") })),
  differences: arr(S("STRING")),
});

export async function llm(prompt, { apiKey, model }, responseSchema) {
  const generationConfig = { responseMimeType: "application/json", responseSchema, temperature: 0 };
  if (model.startsWith("gemini-3")) generationConfig.thinkingConfig = { thinkingLevel: "low" };
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
    });
    if (r.ok) {
      const d = await r.json();
      try {
        return JSON.parse(d.candidates[0].content.parts[0].text);
      } catch (e) {
        if (attempt >= 1) throw new Error("Gemini returned an unreadable answer twice. Try again, or pick another model in Settings.");
        continue;
      }
    }
    const body = await r.text();
    // code "fallover": this model can't serve today, so the server tries the next one
    if ((r.status === 429 && body.includes("PerDay")) || r.status === 404)
      throw Object.assign(new Error(`Daily free-tier limit reached for ${model}. Try tomorrow or pick another model in Settings.`), { code: "fallover" });
    if (r.status === 400 && body.includes("API key")) throw new Error("Gemini rejected the API key. Check it in Settings.");
    if (![429, 500, 503].includes(r.status) || attempt === 2) throw new Error(`Gemini ${r.status}: ${body.slice(0, 200)}`);
    await new Promise(res => setTimeout(res, 5000 * 2 ** attempt));
  }
}

export const itemsPrompt = page => `Below are ${page.items.length} numbered comments or reviews from a web page.
Title: ${page.title}
URL: ${page.url}

1. Group them into 4-10 themes. Each theme must be specific enough to act on
   ("Refund takes weeks", not "Bad service"). Comments may be Hinglish, sarcastic or jokes.
2. Label EVERY comment, from 0 to ${page.items.length - 1}: i = comment number, t = theme number
   (0-based index into your themes list), s = sentiment ("pos", "neg" or "mixed").
   Put spam, off-topic and one-word comments in an "Other / off-topic" theme rather than skipping them.
3. summary: 3-5 short bullets on what people say overall. Do not state counts or percentages.
4. subject: what is being discussed or reviewed, in a few words.

Return JSON: {"subject": "...", "summary": ["..."], "themes": [{"name": "...", "description": "..."}],
"labels": [{"i": 0, "t": 2, "s": "neg"}]}

Comments:
${page.items.map((c, i) => `[${i}] ${c.replace(/\s+/g, " ")}`).join("\n")}`;

export const analysisPrompt = page => page.items?.length ? itemsPrompt(page) : `Below is text copied from a web page.
Title: ${page.title}
URL: ${page.url}

It may contain reviews, comments, forum answers or posts, mixed with menus, ads and boilerplate.

1. Find every individual opinion (a review, comment, answer or reply). Ignore navigation, ads,
   the site's own marketing copy, and usernames/dates on their own.
2. Group the opinions into 4-10 themes. Each theme must be specific enough to act on
   ("Refund takes weeks", not "Bad service"). Use the opinions' language, which may be Hinglish.
3. For each opinion give: theme (exact name), sentiment ("pos", "neg" or "mixed"), and quote:
   the shortest EXACT span copied character-for-character from the text that shows the point.
   Never translate, fix spelling, or paraphrase the quote. At most 150 opinions.
4. summary: 3-5 short bullets on what people say overall. Do not state counts or percentages.
5. subject: what is being discussed or reviewed, in a few words.

Return JSON: {"subject": "...", "summary": ["..."], "themes": [{"name": "...", "description": "..."}],
"opinions": [{"theme": "...", "sentiment": "neg", "quote": "..."}]}
If there are no opinions, return "opinions": [].

Page text:
${page.text}`;

const themeMap = out => new Map(
  [...(out.themes || []), { name: OTHER, description: "Did not fit a theme" }]
    .map(t => [t.name, { name: t.name, description: t.description || "", count: 0, pos: 0, neg: 0, mixed: 0, quotes: [] }]),
);
const isOther = name => /^other\b/i.test(name); // "Other / unclear" or the model's own "Other / off-topic" go last
const sentimentOf = s => (["pos", "neg", "mixed"].includes(s) ? s : "mixed");

function finish(out, page, themes, dropped) {
  const list = [...themes.values()].filter(t => t.count)
    .sort((a, b) => isOther(a.name) - isOther(b.name) || b.count - a.count);
  return {
    subject: out.subject || page.title,
    summary: out.summary || [],
    themes: list,
    total: list.reduce((s, t) => s + t.count, 0),
    neg: list.reduce((s, t) => s + t.neg, 0),
    dropped,
  };
}

// Numbered comments: labels point at real comments by index, so every quote is genuine by construction
function tallyItems(out, page) {
  const themes = themeMap(out);
  const names = (out.themes || []).map(t => t.name);
  const seen = new Set();
  let dropped = 0;
  for (const l of out.labels || []) {
    const c = page.items[l.i];
    if (!Number.isInteger(l.i) || c === undefined || seen.has(l.i)) { dropped++; continue; }
    seen.add(l.i);
    const t = themes.get(themes.has(names[l.t]) ? names[l.t] : OTHER);
    const sentiment = sentimentOf(l.s);
    t.count++;
    t[sentiment]++;
    t.quotes.push({ quote: c.length > 300 ? c.slice(0, 300) + "…" : c, sentiment });
  }
  return { ...finish(out, page, themes, dropped), labelled: seen.size, of: page.items.length };
}

export function tally(out, page) {
  if (page.items?.length) return tallyItems(out, page);
  const text = norm(page.text);
  const themes = themeMap(out);
  const seen = new Set();
  let dropped = 0;
  for (const o of out.opinions || []) {
    if (!isVerified(o.quote, text)) { dropped++; continue; }
    const key = norm(o.quote);
    if (seen.has(key)) continue; // same quote returned twice
    seen.add(key);
    const sentiment = sentimentOf(o.sentiment);
    const t = themes.get(themes.has(o.theme) ? o.theme : OTHER);
    t.count++;
    t[sentiment]++;
    t.quotes.push({ quote: o.quote.trim(), sentiment });
  }
  return finish(out, page, themes, dropped);
}

export const comparePrompt = analyses => `You are comparing what people say on ${analyses.length} web pages.
Each source below has its own themes with exact opinion counts.

Map every source theme to ONE shared theme so the sources can be compared side by side.
Use 4-12 shared themes, specific enough to act on. Then write 3 short bullets on the most
important differences between the sources. Refer to each source by its subject (e.g. "Unacademy"),
never as "Source 0". You may cite the counts given; do not invent numbers.

Return JSON: {"common": [{"name": "...", "description": "..."}],
"mapping": [{"source": 0, "theme": "exact source theme name", "common": "exact shared theme name"}],
"differences": ["..."]}

Sources:
${JSON.stringify(analyses.map((a, i) => ({
  source: i, subject: a.subject, opinions: a.total,
  themes: a.themes.map(t => ({ theme: t.name, description: t.description, count: t.count, negative: t.neg })),
})))}`;

// Just the fields comparePrompt needs (drops quotes), capped so a request stays small
export const slim = analyses => analyses.slice(0, 4).map(a => ({
  subject: String(a.subject || "").slice(0, 120),
  total: Number(a.total) || 0,
  themes: (a.themes || []).slice(0, 15).map(t => ({
    name: String(t.name || "").slice(0, 120), description: String(t.description || "").slice(0, 300),
    count: Number(t.count) || 0, neg: Number(t.neg) || 0,
  })),
}));

export function mergeCompare(out, analyses) {
  const names = [...new Set([...(out.common || []).map(c => c.name), OTHER])];
  const map = new Map((out.mapping || []).map(m => [`${m.source}|${m.theme}`, m.common]));
  const rows = new Map(names.map(n => [n, analyses.map(() => ({ count: 0, neg: 0 }))]));
  analyses.forEach((a, i) => a.themes.forEach(t => {
    const c = map.get(`${i}|${t.name}`);
    const cell = rows.get(rows.has(c) ? c : OTHER)[i]; // unmapped themes land in Other, never vanish
    cell.count += t.count;
    cell.neg += t.neg;
  }));
  const share = (cells) => cells.reduce((s, c, i) => s + c.count / (analyses[i].total || 1), 0);
  const list = [...rows].filter(([, cells]) => cells.some(c => c.count))
    .map(([name, cells]) => ({ name, cells: cells.map((c, i) => ({ ...c, share: c.count / (analyses[i].total || 1) })) }))
    .sort((a, b) => (a.name === OTHER) - (b.name === OTHER) || share(b.cells) - share(a.cells));
  return { rows: list, differences: out.differences || [] };
}
