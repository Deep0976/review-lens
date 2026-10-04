// Compare page: pick 2-4 saved reports, AI lines up their themes, shares are counted in code.
import { mergeCompare } from "./analysis.js";
import { ask, esc } from "./ui.js";
import { initial, pct, plural, sentBar, siteOf, svg, toast, toneOf, topBar, when } from "./view.js";

const root = document.getElementById("root");
const EXAMPLE = "https://play.google.com/store/apps/details?id=com.unacademyapp&hl=en_IN";
const MAX = 4;
const AI_BADGE = `<span class="ai-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z"/></svg>Written by AI</span>`;
const TICK = svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 13, 3);
const { analyses = [] } = await chrome.storage.local.get("analyses");
const preselect = new URLSearchParams(location.search).get("with");

function page() {
  root.innerHTML = `${topBar("Compare")}<main class="wrap" style="gap:36px">
    <div class="page-h"><h1>Compare pages</h1><p>Pick 2 to 4 saved reports. AI lines up their themes; every share is counted from verified opinions.</p></div>
    ${analyses.length < 2 ? empty() : picker()}
    <div id="out" style="display:flex;flex-direction:column;gap:36px"></div>
  </main>`;
  document.getElementById("slot").outerHTML = `<a class="btn" href="options.html" style="text-decoration:none">Settings</a>`;
  if (analyses.length < 2) {
    document.getElementById("example").addEventListener("click", () => chrome.tabs.create({ url: EXAMPLE }));
    return;
  }
  const rows = [...root.querySelectorAll(".pick-row")];
  const go = document.getElementById("go"), count = document.getElementById("count");
  const update = changed => {
    let on = rows.filter(r => r.querySelector("input").checked);
    if (on.length > MAX && changed) { changed.checked = false; toast(`Pick at most ${MAX} reports.`); on = on.filter(r => r.querySelector("input") !== changed); }
    rows.forEach(r => r.classList.toggle("on", r.querySelector("input").checked));
    count.textContent = on.length ? `${plural(on.length, "report")} selected${on.length < 2 ? " · pick at least 2" : ""}` : "Pick 2 to 4 reports";
    go.disabled = on.length < 2;
  };
  rows.forEach(r => r.querySelector("input").addEventListener("change", e => update(e.target)));
  update();
  go.addEventListener("click", () => run(rows.filter(r => r.querySelector("input").checked).map(r => analyses[+r.dataset.i])));
}

function empty() {
  return `<div class="empty">
    <div class="state-icon neutral">${svg('<rect width="8" height="14" x="2" y="5" rx="2"/><rect width="8" height="14" x="14" y="5" rx="2"/><path d="M12 9v6"/>', 20, 2)}</div>
    <h2 style="margin:0;font-size:20px;font-weight:600;letter-spacing:-0.015em">Analyse at least two pages to compare</h2>
    <p>Open a review page and click the Review Lens icon. Every report is saved here, so you can line up two apps, products or threads.</p>
    <div class="actions"><button class="btn primary lg" id="example">Try an example page</button></div>
    <div class="fine">${analyses.length ? "1 report saved so far." : "No reports saved yet."} Shortcut: <span class="kbd">Alt+Shift+R</span></div>
  </div>`;
}

function picker() {
  return `<section class="sec"><div class="sec-h"><h2>Saved reports</h2><small>${plural(analyses.length, "report")} on this device</small></div>
    <div class="group">${analyses.map((a, i) => {
      const t = toneOf(a), site = siteOf(a.url);
      return `<label class="pick-row" data-i="${i}">
        <input type="checkbox" ${a.id === preselect ? "checked" : ""} aria-label="Compare ${esc(a.subject)}"><span class="box" aria-hidden="true">${TICK}</span>
        <div class="tile-sm" aria-hidden="true">${esc(initial(a.subject))}</div>
        <div style="min-width:0"><div class="pick-title">${esc(a.subject)}</div>
          <div class="pick-meta">${site ? `<span>${esc(site)}</span><span class="dot-sep">·</span>` : ""}<span>${plural(a.total, "opinion")}</span>${a.created ? `<span class="dot-sep">·</span><span>${esc(when(a.created, false))}</span>` : ""}</div></div>
        <div class="pick-side"><span class="pill ${t.tone}">${t.word} · ${t.main[0]}%</span><a href="report.html?id=${encodeURIComponent(a.id)}">Open</a></div>
      </label>`;
    }).join("")}</div>
    <div class="dock"><span class="fine" id="count">Pick 2 to 4 reports</span><button class="btn primary lg" id="go" disabled>Compare</button></div>
  </section>`;
}

const ERRORS = {
  daily_limit: ["You’ve used today’s 5 free analyses", "Comparing uses one analysis. Add your own free Gemini key for unlimited use, or come back tomorrow.", "Add free Gemini key", "key"],
  busy: ["Review Lens is busy right now", "Today’s shared free capacity is used up. Add your own free Gemini key, or try again tomorrow.", "Add free Gemini key", "key"],
  offline: ["Can’t reach the Review Lens server", "Your network may be blocking it, which often happens on college Wi-Fi. Try mobile data, or add your own key.", "Retry", "retry"],
};

async function run(sel) {
  const out = document.getElementById("out");
  out.innerHTML = `<section class="panel" aria-live="polite" style="display:flex;align-items:center;gap:14px">
    <div class="spin"></div><div style="flex:1"><b style="font-weight:600">Lining up themes across ${sel.length} reports…</b><div class="fine" style="padding:0">Usually 10–30 seconds.</div></div><div class="timer" id="t">0:00</div></section>`;
  out.scrollIntoView({ behavior: "smooth", block: "start" });
  const t0 = Date.now(), el = document.getElementById("t");
  const tick = setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, 1000);
  try {
    const res = await ask("compare", sel);
    result(sel, mergeCompare(res.out, sel));
  } catch (e) {
    console.warn("Review Lens:", e);
    const [title, body, label, action] = ERRORS[e.code === "fallover" ? "busy" : e.code] || ["The AI service had a hiccup", "Please try again in a minute.", "Retry", "retry"];
    out.innerHTML = `<div class="empty"><div class="state-icon ${action === "key" ? "warn" : "neutral"}">${svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>', 20, 2)}</div>
      <h2 style="margin:0;font-size:20px;font-weight:600">${title}</h2><p>${body}</p>
      <div class="actions"><button class="btn primary lg" id="err">${label}</button></div></div>`;
    document.getElementById("err").addEventListener("click", () => (action === "key" ? chrome.runtime.openOptionsPage() : run(sel)));
  } finally {
    clearInterval(tick);
  }
}

function result(sel, { rows, differences }) {
  const n = sel.length, cols = `minmax(0,1.3fr) repeat(${n},minmax(0,1fr))`;
  const max = Math.max(...rows.flatMap(r => r.cells.map(c => c.share)), 0.01);
  const out = document.getElementById("out");
  out.innerHTML = `
    <section class="sec"><div class="sec-h"><h2>Head to head</h2><small>verdicts are counted</small></div>
      <div class="h2h" style="grid-template-columns:repeat(${n},minmax(0,1fr))">${sel.map((a, i) => {
        const t = toneOf(a);
        return `<div class="h2h-card" style="--c:var(--c${i + 1})">
          <div class="h2h-top"><div class="tile-sm" aria-hidden="true">${esc(initial(a.subject))}</div><div style="min-width:0"><div class="h2h-name">${esc(a.subject)}</div><div class="fine" style="padding:0">${esc(siteOf(a.url))}</div></div></div>
          <div class="h2h-verdict ${t.tone}">${t.word}</div>
          <div class="sent">${sentBar(t.s)}</div>
          <div class="fine" style="padding:0">${t.s.pos} positive · ${t.s.neg} negative · ${plural(a.total, "opinion")}</div>
        </div>`;
      }).join("")}</div></section>
    ${differences.length ? `<section class="sec"><div class="sec-h"><h2>Key differences ${AI_BADGE}</h2></div>
      <div class="ai-box">${differences.map(d => `<div>${esc(d)}</div>`).join("")}</div></section>` : ""}
    <section class="sec"><div class="sec-h"><h2>Themes side by side</h2><small>share of each page’s opinions</small></div>
      <div class="group">
        <div class="cmp-row" style="grid-template-columns:${cols};padding-bottom:6px"><div class="cmp-head" style="padding:0">Theme</div>
          ${sel.map((a, i) => `<div class="cmp-head" style="padding:0;display:flex;align-items:center;gap:6px;min-width:0"><span class="sw" style="background:var(--c${i + 1})"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.subject)}</span></div>`).join("")}</div>
        ${rows.map(r => {
          // highlight a leader only when it's clearly ahead (5+ points), not on a 42% vs 43% wobble
          const [top, second = 0] = r.cells.map(c => c.share).sort((x, y) => y - x);
          const leader = top - second >= 0.05;
          return `<div class="cmp-row" style="grid-template-columns:${cols}"><div style="font-weight:600;font-size:15px">${esc(r.name)}</div>
            ${r.cells.map((c, i) => c.count ? `<div class="cmp-cell" style="--c:var(--c${i + 1})"><b class="${leader && c.share === top ? "lead" : ""}">${pct(c.share, 1)}%</b>
              <div class="cmp-bar"><i style="width:${(c.share / max) * 100}%"></i></div><small>${plural(c.count, "opinion")}${c.neg ? ` · ${c.neg} negative` : ""}</small></div>`
              : `<div class="cmp-cell"><b style="color:var(--mix)">–</b><small>not mentioned</small></div>`).join("")}
          </div>`;
        }).join("")}
      </div>
      <div class="fine">Shares are each page’s share of its own opinions, so a busy thread doesn’t drown out a quiet one. AI matches the themes; the numbers are counted.</div>
    </section>
    <footer class="foot"><span class="fine">Comparisons aren’t saved. Copy it to keep it.</span><button class="link" id="copyc">Copy as text</button></footer>`;
  document.getElementById("copyc").addEventListener("click", async () => {
    const lines = [`Review Lens comparison: ${sel.map(a => a.subject).join(" vs ")}`, "",
      ...sel.map(a => { const t = toneOf(a); return `${a.subject}: ${t.word} (${t.main[0]}% ${t.main[1]}, ${a.total} opinions)`; }), "",
      ...(differences.length ? ["Key differences (written by AI):", ...differences.map(d => `- ${d}`), ""] : []),
      "Themes (share of each page's opinions):", ...rows.map(r => `- ${r.name}: ${r.cells.map((c, i) => `${sel[i].subject} ${c.count ? pct(c.share, 1) + "%" : "–"}`).join(" | ")}`)];
    try { await navigator.clipboard.writeText(lines.join("\n")); toast("Copied. Paste it into WhatsApp, a doc or an email."); }
    catch { toast("Couldn't copy. Try again."); }
  });
  out.scrollIntoView({ behavior: "smooth", block: "start" });
}

page();
