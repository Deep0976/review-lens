// node extension/test.mjs              -> guardrail checks (no network)
// node extension/test.mjs page1.json…  -> also runs live analysis + comparison on saved {title,url,text} pages
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { ANALYSIS_SCHEMA, COMPARE_SCHEMA, OTHER, analysisPrompt, comparePrompt, isVerified, llm, mergeCompare, norm, tally } from "./analysis.js";

assert(isVerified("Refund  TAKES weeks", norm("my refund takes weeks to arrive")));
assert(!isVerified("refund is slow", norm("my refund takes weeks to arrive"))); // paraphrase rejected
assert(!isVerified("refund", norm("refund refund")));                           // one word isn't evidence
assert(!isVerified(null, "anything"));

const page = { title: "t", url: "u", text: "PW teachers are great. App crashes daily on my phone. Refund took 3 months!" };
const a = tally({
  themes: [{ name: "Crashes" }, { name: "Teachers" }],
  opinions: [
    { theme: "Crashes", sentiment: "neg", quote: "App crashes daily" },
    { theme: "Crashes", sentiment: "neg", quote: "app crashes daily" },          // duplicate, counted once
    { theme: "Teachers", sentiment: "pos", quote: "teachers are great" },
    { theme: "Refunds", sentiment: "neg", quote: "Refund took 3 months" },       // unknown theme -> Other
    { theme: "Teachers", sentiment: "pos", quote: "best teachers in India" },    // hallucinated -> dropped
  ],
}, page);
assert.equal(a.total, 3);
assert.equal(a.dropped, 1);
assert.equal(a.neg, 2);
assert.deepEqual(a.themes.map(t => [t.name, t.count]), [["Crashes", 1], ["Teachers", 1], [OTHER, 1]]);

const b = { total: 4, themes: [{ name: "Lag", count: 3, neg: 3 }, { name: "Price", count: 1, neg: 0 }] };
const m = mergeCompare({
  common: [{ name: "App stability" }],
  mapping: [{ source: 0, theme: "Crashes", common: "App stability" }, { source: 1, theme: "Lag", common: "App stability" }],
}, [a, b]);
const row = m.rows.find(r => r.name === "App stability");
assert.deepEqual(row.cells.map(c => c.count), [1, 3]);
assert.equal(row.cells[1].share, 0.75);
const other = m.rows.find(r => r.name === OTHER); // unmapped themes are kept in Other, never lost
assert.deepEqual(other.cells.map(c => c.count), [2, 1]);
console.log("guardrails ok");

const files = process.argv.slice(2);
if (files.length) {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const opts = { apiKey: env.match(/^GEMINI_API_KEY=(.*)$/m)[1].trim(), model: process.env.MODEL || "gemini-flash-lite-latest" };
  const results = [];
  for (const f of files) {
    const p = JSON.parse(readFileSync(f, "utf8"));
    p.text = p.text.slice(0, 80000);
    const t0 = Date.now();
    const r = { id: f, url: p.url, title: p.title, created: "test", ...tally(await llm(analysisPrompt(p), opts, ANALYSIS_SCHEMA), p) };
    results.push(r);
    if (process.env.DUMP) writeFileSync(process.env.DUMP, JSON.stringify(results));
    console.log(`\n${r.subject} — ${r.total} opinions, ${r.dropped} dropped, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    r.summary.forEach(s => console.log("  •", s));
    r.themes.forEach(t => console.log(`  ${String(t.count).padStart(3)}  ${t.name}  (neg ${t.neg})  e.g. "${t.quotes[0].quote}"`));
  }
  if (results.length > 1) {
    const c = mergeCompare(await llm(comparePrompt(results), opts, COMPARE_SCHEMA), results);
    console.log("\nCOMPARE");
    c.differences.forEach(d => console.log("  •", d));
    c.rows.forEach(r => console.log("  ", r.name.padEnd(40), r.cells.map(x => `${Math.round(x.share * 100)}%`.padStart(5)).join(" ")));
  }
}
