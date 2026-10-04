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
    if (r.status === 429 && body.includes("PerDay")) throw new Error(`Daily free-tier limit reached for ${model}. Try tomorrow or pick another model in Settings.`);
    if (r.status === 400 && body.includes("API key")) throw new Error("Gemini rejected the API key. Check it in Settings.");
    if (![429, 500, 503].includes(r.status) || attempt === 2) throw new Error(`Gemini ${r.status}: ${body.slice(0, 200)}`);
    await new Promise(res => setTimeout(res, 5000 * 2 ** attempt));
  }
}

export const analysisPrompt = page => `Below is text copied from a web page.
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

export function tally(out, page) {
  const text = norm(page.text);
  const themes = new Map(
    [...(out.themes || []), { name: OTHER, description: "Did not fit a theme" }]
      .map(t => [t.name, { name: t.name, description: t.description || "", count: 0, pos: 0, neg: 0, mixed: 0, quotes: [] }]),
  );
  const seen = new Set();
  let dropped = 0;
  for (const o of out.opinions || []) {
    if (!isVerified(o.quote, text)) { dropped++; continue; }
    const key = norm(o.quote);
    if (seen.has(key)) continue; // same quote returned twice
    seen.add(key);
    const sentiment = ["pos", "neg", "mixed"].includes(o.sentiment) ? o.sentiment : "mixed";
    const t = themes.get(themes.has(o.theme) ? o.theme : OTHER);
    t.count++;
    t[sentiment]++;
    t.quotes.push({ quote: o.quote.trim(), sentiment });
  }
  const list = [...themes.values()].filter(t => t.count)
    .sort((a, b) => (a.name === OTHER) - (b.name === OTHER) || b.count - a.count);
  return {
    subject: out.subject || page.title,
    summary: out.summary || [],
    themes: list,
    total: list.reduce((s, t) => s + t.count, 0),
    neg: list.reduce((s, t) => s + t.neg, 0),
    dropped,
  };
}

export const comparePrompt = analyses => `You are comparing what people say on ${analyses.length} web pages.
Each source below has its own themes with exact opinion counts.

Map every source theme to ONE shared theme so the sources can be compared side by side.
Use 4-12 shared themes, specific enough to act on. Then write 3 short bullets on the most
important differences between the sources. You may cite the counts given; do not invent numbers.

Return JSON: {"common": [{"name": "...", "description": "..."}],
"mapping": [{"source": 0, "theme": "exact source theme name", "common": "exact shared theme name"}],
"differences": ["..."]}

Sources:
${JSON.stringify(analyses.map((a, i) => ({
  source: i, subject: a.subject, opinions: a.total,
  themes: a.themes.map(t => ({ theme: t.name, description: t.description, count: t.count, negative: t.neg })),
})))}`;

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
