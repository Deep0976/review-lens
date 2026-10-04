// Shared view helpers for report, compare and settings (same design system).
export const svg = (paths, size = 18, w = 1.9) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
export const check = size => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="var(--pos)"/><path d="m8 12.5 2.6 2.5L16 9.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const LOGO = `<div class="logo" aria-hidden="true"><i></i><i></i><i></i></div>`;
export const PLAY = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 5 3.5z"/></svg>';

export function topBar(crumb) {
  return `<header class="bar"><a href="compare.html" style="display:contents">${LOGO}</a><div class="brand">Review Lens</div>${crumb ? `<div class="crumb">/ <b>${crumb}</b></div>` : ""}<div class="spacer"></div><span id="slot"></span></header>`;
}

const SITES = [["play.google.com", "Google Play"], ["youtube.com", "YouTube"], ["reddit.com", "Reddit"], ["amazon.", "Amazon"], ["flipkart.com", "Flipkart"],
  ["apps.apple.com", "App Store"], ["trustpilot.com", "Trustpilot"], ["quora.com", "Quora"], ["g2.com", "G2"], ["myntra.com", "Myntra"], ["nykaa.com", "Nykaa"]];
export const siteOf = url => {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return (SITES.find(([d]) => h.includes(d)) || [, h])[1];
  } catch { return ""; }
};

// dd|mm|yyyy, h:mm am (older reports stored just "dd|mm|yyyy")
export const when = (created, withTime = true) => {
  const d = new Date(created);
  if (isNaN(d)) return created || "";
  const p = n => String(n).padStart(2, "0");
  const date = `${p(d.getDate())}|${p(d.getMonth() + 1)}|${d.getFullYear()}`;
  return withTime ? `${date}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }).toLowerCase()}` : date;
};
export const pct = (n, total) => Math.round((n / (total || 1)) * 100);
export const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
export const initial = s => (String(s || "?").trim()[0] || "?").toUpperCase();

export const sums = a => a.themes.reduce((s, t) => ({ pos: s.pos + t.pos, mixed: s.mixed + t.mixed, neg: s.neg + t.neg }), { pos: 0, mixed: 0, neg: 0 });

// The verdict is counted, never generated: majority sentiment decides the word
export function toneOf(a) {
  const s = sums(a);
  const tone = s.neg / a.total >= 0.5 ? "neg" : s.pos / a.total >= 0.5 ? "pos" : "mix";
  const word = { neg: "Mostly negative", pos: "Mostly positive", mix: "Mixed reviews" }[tone];
  const main = tone === "pos" ? [pct(s.pos, a.total), "positive"] : [pct(s.neg, a.total), "negative"];
  return { s, tone, word, main };
}

export const sentBar = s => [[s.pos, "var(--pos)"], [s.mixed, "var(--mix)"], [s.neg, "var(--neg)"]]
  .filter(([n]) => n).map(([n, c]) => `<i style="flex:${n} 0 0;background:${c}"></i>`).join("");

export function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}
