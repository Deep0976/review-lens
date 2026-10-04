// Report page, built from the "Report Final" design: analysing state, result, and empty/error states.
import { MAX_CHARS, fitItems, tally } from "./analysis.js";
import { ask, esc, quoteLink, settings } from "./ui.js";
import { LOGO, PLAY, check, pct, plural, siteOf, svg, toast, toneOf, topBar, when } from "./view.js";

const root = document.getElementById("root");
const EXAMPLE = "https://play.google.com/store/apps/details?id=com.unacademyapp&hl=en_IN";

// Theme tile icons from the design: bug, phone, headset, graduation cap, rupee, question
const TICON = {
  bug: '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
  phone: '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
  support: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  learn: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  money: '<path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/>',
  other: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
};
const themeIcon = name =>
  /^other\b/i.test(name) ? "other"
  : /call|spam|sales|market|promot|harass|counsel/i.test(name) ? "phone"
  : /support|customer service|helpdesk|response|reply|ticket/i.test(name) ? "support"
  : /pric|refund|fee|money|₹|billing|subscription|cost|afford|payment|expensive|value/i.test(name) ? "money"
  : /teach|educator|faculty|content|course|lecture|study|material|mentor|learn/i.test(name) ? "learn"
  : /crash|bug|glitch|lag|app|perform|load|buffer|video|technical|update|stab/i.test(name) ? "bug"
  : "other";

// Empty and error states from the design: [icon, tone, title, body, primary, secondary, foot, meter]
const SICON = {
  search: '<path d="m13.5 8.5-5 5"/><path d="m8.5 8.5 5 5"/><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  busy: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  wifi: '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
};
const STATES = {
  "no-opinions": ["search", "neutral", "No reviews or comments found", "Scroll down or click “Load more” so the comments are on the page, or select just the reviews and click the icon again.", ["Back to the page", "back"], ["Try again", "retry"], "Works best on Play Store, YouTube, Amazon and Reddit."],
  "not-readable": ["lock", "neutral", "Review Lens can’t read this page", "Browser pages like New Tab and Settings are closed to extensions. Open a review page, like an app on Play Store, and click the icon there.", ["Try an example page", "example"], ["Close tab", "close"], "Shortcut: Alt+Shift+R"],
  "daily-limit": ["clock", "warn", "You’ve used today’s 5 free analyses", "Add your own free Gemini key in Settings for unlimited use, or come back tomorrow.", ["Add free Gemini key", "key"], ["Open saved reports", "saved"], "Free analyses reset at midnight (India time).", true],
  "service-busy": ["busy", "warn", "Review Lens is busy right now", "Today’s shared free capacity is used up. Add your own free Gemini key for unlimited use, or try again tomorrow.", ["Add free Gemini key", "key"], ["Try later", "close"], "Getting a key takes about a minute."],
  offline: ["wifi", "neutral", "Can’t reach the Review Lens server", "Your network may be blocking it, which often happens on college Wi-Fi. Try mobile data, or add your own key.", ["Retry", "retry"], ["Add your own key", "key"], "A phone hotspot usually works when campus Wi-Fi doesn’t."],
  "ai-error": ["alert", "err", "The AI service had a hiccup", "Please try again in a minute.", ["Retry", "retry"], ["Back to the page", "back"], "If it keeps happening, check Settings."],
  expired: ["clock", "neutral", "This report has expired", "Click the Review Lens icon on the page again to run a fresh analysis.", ["Open saved reports", "saved"], ["Close tab", "close"], "Shortcut: Alt+Shift+R"],
};
const closeTab = () => chrome.tabs.getCurrent(t => t && chrome.tabs.remove(t.id));
const ACTIONS = {
  back: tabId => (tabId ? chrome.tabs.update(tabId, { active: true }).then(closeTab, closeTab) : closeTab()),
  retry: () => location.reload(),
  example: () => chrome.tabs.create({ url: EXAMPLE }),
  close: closeTab,
  key: () => chrome.runtime.openOptionsPage(),
  saved: () => { location.href = "compare.html"; },
};


function showState(key, page = {}) {
  const [icon, tone, title, body, [p, pa], [s, sa], foot, meter] = STATES[key];
  document.title = `Review Lens: ${title}`;
  root.innerHTML = `${topBar()}<main class="state">
    <div class="state-icon ${tone}">${svg(SICON[icon], 20, 2)}</div>
    <h1>${title}</h1><p>${body}</p>
    ${meter ? '<div class="meter" aria-label="5 of 5 used"><i></i><i></i><i></i><i></i><i></i></div>' : ""}
    <div class="actions"><button class="btn primary lg" data-a="${pa}">${p}</button><button class="btn ghost lg" data-a="${sa}">${s}</button></div>
    <div class="fine">${foot}</div></main>`;
  root.querySelectorAll("[data-a]").forEach(b => b.addEventListener("click", () => ACTIONS[b.dataset.a](page.tabId)));
}

function showAnalysing(page) {
  const site = siteOf(page.url);
  const n = page.items?.length;
  document.title = "Review Lens: Analysing…";
  root.innerHTML = `${topBar("Reports / Analysing…")}<main class="an-grid">
    <div style="display:flex;flex-direction:column;gap:20px;min-width:0">
      <section class="panel" aria-live="polite">
        <div class="an-title"><div style="flex:1"><h1>${n ? `Analysing ${n} ${esc(site)} comments` : "Analysing this page"}</h1>
          <div class="fine" style="padding:0;margin-top:2px">Usually 10–40 seconds. You can switch tabs while this runs.</div></div>
          <div class="timer" id="timer">0:00</div></div>
        <div class="track"><i></i></div>
        <div class="steps">
          <div class="step">${check(18)}<b>${n ? `Read ${n} comments` : "Read the page"}</b><span>${page.text.length.toLocaleString()} characters</span></div>
          <div class="step"><div class="spin"></div><b>Grouping into themes</b><span>AI is reading</span></div>
          <div class="step todo"><div class="ring"></div><b>Checking quotes on page</b><span>Removes anything invented</span></div>
          <div class="step todo"><div class="ring"></div><b>Counting opinions</b><span>Per theme and sentiment</span></div>
        </div>
      </section>
      <div class="panel" aria-hidden="true" style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:24px">
        <div style="display:flex;flex-direction:column;gap:12px"><div class="sk" style="width:120px;height:10px"></div><div class="sk" style="width:240px;height:26px"></div><div class="sk" style="height:8px"></div><div class="sk" style="width:60%;height:10px"></div></div>
        <div style="display:flex;flex-direction:column;gap:14px;justify-content:center"><div class="sk" style="height:14px"></div><div class="sk" style="height:14px"></div><div class="sk" style="height:14px"></div></div>
      </div>
      <div aria-hidden="true" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div class="panel" style="display:flex;flex-direction:column;gap:12px"><div class="sk" style="width:130px;height:12px"></div><div class="sk" style="height:10px"></div><div class="sk" style="width:80%;height:10px"></div></div>
        <div class="panel" style="display:flex;flex-direction:column;gap:12px"><div class="sk" style="width:110px;height:12px"></div><div class="sk" style="height:10px"></div><div class="sk" style="width:70%;height:10px"></div></div>
      </div>
    </div>
    <aside style="display:flex;flex-direction:column;gap:16px">
      <div class="tip"><small>While you wait</small><b>Every quote links back to the real comment</b><span>Click “Open on page” in your report and Review Lens scrolls the original page to that comment and highlights it.</span></div>
      <div class="panel" style="padding:16px 18px;display:flex;flex-direction:column;gap:8px"><b>Source</b>
        <div style="font-size:13px;color:var(--ink-2);line-height:1.5">${esc(page.title)}${site ? ` · ${esc(site)}` : ""}</div>
        ${page.note ? `<div class="fine" style="padding:0">${esc(page.note)}</div>` : ""}</div>
    </aside></main>`;
  const t0 = Date.now(), el = document.getElementById("timer");
  const tick = setInterval(() => {
    if (!document.body.contains(el)) return clearInterval(tick);
    const s = Math.floor((Date.now() - t0) / 1000);
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, 1000);
}

function stateFor(e) {
  return { daily_limit: "daily-limit", busy: "service-busy", fallover: "service-busy", offline: "offline" }[e.code] || "ai-error";
}

async function main() {
  const id = new URLSearchParams(location.search).get("id");
  let { analyses = [] } = await chrome.storage.local.get("analyses");
  let a = analyses.find(x => x.id === id);
  if (a) return render(a);

  const page = (await chrome.storage.session.get(id))[id];
  if (!page) return showState("expired");
  if (page.error) return showState("not-readable", page);
  const truncated = page.items?.length ? fitItems(page.items).length < page.items.length : page.text.length > MAX_CHARS;
  page.text = page.text.slice(0, MAX_CHARS);
  if (page.items?.length) page.items = fitItems(page.items);
  showAnalysing(page);
  try {
    const res = await ask("analyze", page);
    a = { id, url: page.url, title: page.title, note: page.note, truncated, created: new Date().toISOString(), ...tally(res.out, page) };
  } catch (e) {
    console.warn("Review Lens:", e);
    return showState(stateFor(e), page);
  }
  if (!a.total) return showState("no-opinions", page);
  analyses = [a, ...analyses].slice(0, 20); // keep the last 20 for comparison
  await chrome.storage.local.set({ analyses });
  await chrome.storage.session.remove(id);
  render(a);
}

function verdict(a, s, pains, likes) {
  const t = toneOf(a), tone = t.tone, word = t.word + ".";
  const parts = {
    neg: [`${s.neg} of ${a.total} opinions are negative.`, pains[0] && `Biggest complaint: ${pains[0].name}.`],
    pos: [`${s.pos} of ${a.total} opinions are positive.`, likes[0] && `Most praised: ${likes[0].name}.`],
    mix: [`${s.pos} positive and ${s.neg} negative out of ${a.total} opinions.`, pains[0] && `Biggest complaint: ${pains[0].name}.`],
  }[tone].filter(Boolean).join(" ");
  const main = t.main;
  // donut: positive, mixed, negative with thin card-colored gaps between present segments
  let at = 0;
  const stops = [];
  for (const [n, c] of [[s.pos, "var(--pos)"], [s.mixed, "var(--mix)"], [s.neg, "var(--neg)"]]) {
    if (!n) continue;
    const end = at + (n / a.total) * 100;
    stops.push(`${c} ${at}% ${Math.max(at, end - 0.6)}%`, `var(--card) ${Math.max(at, end - 0.6)}% ${end}%`);
    at = end;
  }
  return { tone, word, parts, main, conic: `conic-gradient(${stops.join(",")})` };
}

function asText(a, s, pains, likes, v, verified) {
  const lines = [`Review Lens: ${a.subject}`, `${v.word} ${v.parts}`, `${a.total} opinions · ${a.themes.length} themes · ${verified}% of quotes verified on the page`, `Source: ${a.url}`, ""];
  if (pains.length) lines.push("Biggest complaints:", ...pains.map((p, i) => `${i + 1}. ${p.name} (${p.neg} negative)${p.q ? ` — “${p.q.quote}”` : ""}`), "");
  if (likes.length) lines.push("What people like:", ...likes.map((p, i) => `${i + 1}. ${p.name} (${p.pos} positive)${p.q ? ` — “${p.q.quote}”` : ""}`), "");
  if (a.summary.length) lines.push("Summary (written by AI):", ...a.summary.map(x => `- ${x}`), "");
  lines.push("All themes:", ...a.themes.map(t => `- ${t.name}: ${t.count} (${t.neg} negative)`));
  return lines.join("\n");
}

async function render(a) {
  const s = toneOf(a).s;
  const real = a.themes.filter(t => !/^other\b/i.test(t.name));
  const pains = real.filter(t => t.neg).sort((x, y) => y.neg - x.neg).slice(0, 3).map(t => ({ ...t, q: t.quotes.find(q => q.sentiment === "neg") || t.quotes[0] }));
  const likes = real.filter(t => t.pos).sort((x, y) => y.pos - x.pos).slice(0, 2).map(t => ({ ...t, q: t.quotes.find(q => q.sentiment === "pos") || t.quotes[0] }));
  const v = verdict(a, s, pains, likes);
  const verified = pct(a.total, a.total + a.dropped);
  const site = siteOf(a.url);
  const { apiKey } = await settings();
  const { quota } = await chrome.storage.local.get("quota");
  const showQuota = !apiKey && quota?.day === new Date().toDateString();
  const open = (url, quote) => `<a href="${esc(quoteLink(url, quote))}" target="_blank" rel="noopener">Open on page ↗</a>`;
  const SENT = { neg: ["Negative", "var(--neg-ink)", "var(--neg)"], pos: ["Positive", "var(--pos-ink)", "var(--pos)"], mixed: ["Mixed", "var(--ink-2)", "var(--mix)"] };
  const quote = q => `<div class="q"><div class="q-text">${esc(q.quote)}</div><div class="q-meta">
      <div class="q-sent" style="color:${SENT[q.sentiment][1]}"><span class="sw" style="width:7px;height:7px;background:${SENT[q.sentiment][2]}"></span>${SENT[q.sentiment][0]}</div>
      <div class="q-found">${check(12)}Found on page</div>${open(a.url, q.quote)}</div></div>`;
  const rankList = (list, kind, n) => `<div class="group">${list.map((p, i) => `
      <div class="rank-row"><div class="rank ${kind}">${i + 1}</div><div class="rank-body">
        <div class="rank-title"><span>${esc(p.name)}</span><b class="${kind}">${p[n]}</b></div>
        ${p.q ? `<div class="rank-quote">“${esc(p.q.quote)}”</div>${kind === "neg" ? `<div class="small-link">${open(a.url, p.q.quote)}</div>` : ""}` : ""}
      </div></div>`).join("")}</div>`;
  const notes = [a.note, a.of && `Grouped ${a.labelled} of the ${a.of} comments analysed.`, a.truncated && (a.of ? "Very long thread: the first comments were analysed." : "Long page: only the first part was analysed."),
    a.dropped ? `${a.dropped} ${a.dropped === 1 ? "quote the AI returned was" : "quotes the AI returned were"} not found on the page and dropped.` : "",
    "Counts are computed from verified quotes."].filter(Boolean).join(" ");

  document.title = `Review Lens: ${a.subject}`;
  root.innerHTML = `${topBar()}
  <main class="wrap">
    <div class="head"><div class="tile-lg" aria-hidden="true">${esc((a.subject || "?").trim()[0].toUpperCase())}</div>
      <div style="min-width:0"><h1>${esc(a.subject)}</h1>
        <div class="meta">${site ? `<span class="chip">${site === "Google Play" ? PLAY : ""}${esc(site)}</span>` : ""}
          ${a.url?.startsWith("http") ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title || a.url)} ↗</a>` : ""}
          ${a.created ? `<span class="dot-sep">·</span><span>${esc(when(a.created))}</span>` : ""}</div></div></div>

    <section class="verdict ${v.tone}" aria-label="Verdict">
      <div class="donut" style="background:${v.conic}" role="img" aria-label="${v.main[0]}% ${v.main[1]}"><div><b>${v.main[0]}%</b><span>${v.main[1]}</span></div></div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <div class="kicker"><i></i>Verdict</div>
        <div class="big">${v.word}</div>
        <div class="lede">${esc(v.parts)}</div>
      </div>
      <div class="legend">
        <div><span class="sw" style="background:var(--pos)"></span><b>${s.pos}</b> positive</div>
        <div><span class="sw" style="background:var(--mix)"></span><b>${s.mixed}</b> mixed</div>
        <div><span class="sw" style="background:var(--neg)"></span><b>${s.neg}</b> negative</div>
      </div>
      <div class="stats">
        <div><b>${a.total}</b><span>opinions found</span></div>
        <div><b>${a.themes.length}</b><span>themes</span></div>
        <div><b>${verified}%${check(20)}</b><span>quotes verified on the page</span></div>
      </div>
    </section>

    ${pains.length ? `<section class="sec"><div class="sec-h"><h2>Biggest complaints</h2><small>negative opinions</small></div>${rankList(pains, "neg", "neg")}</section>` : ""}
    ${likes.length ? `<section class="sec"><div class="sec-h"><h2>What people like</h2><small>positive opinions</small></div>${rankList(likes, "pos", "pos")}</section>` : ""}

    ${a.summary.length ? `<section class="sec"><div class="sec-h"><h2>Summary <span class="ai-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z"/></svg>Written by AI</span></h2></div>
      <div class="ai-box">${a.summary.map(x => `<div>${esc(x)}</div>`).join("")}</div>
      <div class="fine">Generated from the verified quotes. Every number on this page is counted, not generated.</div></section>` : ""}

    <section class="sec"><div class="sec-h"><h2>All themes</h2><small>Click a theme to read its quotes</small></div>
      <div class="group">${a.themes.map((t, i) => {
        const tone = t.neg > t.pos ? "neg" : t.pos > t.neg ? "pos" : "mix";
        const segs = [[t.pos, "var(--pos)"], [t.mixed, "var(--mix)"], [t.neg, "var(--neg)"]].filter(([n]) => n).map(([n, c]) => `<i style="flex:${n} 0 0;background:${c}"></i>`).join("");
        return `<div class="theme">
          <div class="theme-row" role="button" tabindex="0" aria-expanded="${i === 0}" aria-controls="q${i}">
            <div class="ticon ${tone}">${svg(TICON[themeIcon(t.name)])}</div>
            <div style="min-width:0"><div class="tname">${esc(t.name)}${t.count < 3 && a.total >= 20 ? '<span class="low">Low confidence</span>' : ""}</div>${t.description ? `<div class="tdesc">${esc(t.description)}</div>` : ""}</div>
            <div class="tbar"><div class="segs">${segs}</div><div class="tsub">${t.neg} negative · ${pct(t.count, a.total)}%</div></div>
            <div class="tcount">${t.count}</div>
            <svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--mix)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
          </div>
          <div class="quotes" id="q${i}" ${i === 0 ? "" : "hidden"}>${t.quotes.slice(0, 4).map(quote).join("")}
            ${t.quotes.length > 4 ? `<button class="link small-link" data-more="${i}" style="text-align:left;padding:4px 2px 0">Show all ${t.quotes.length} quotes</button>` : ""}</div>
        </div>`;
      }).join("")}</div>
      <div class="fine">${esc(notes)}</div></section>

    <footer class="foot"><span class="fine">Saved on this device</span>
      <button class="link" id="copy">Copy as text</button><a href="compare.html">Recent analyses</a><a href="options.html">Settings</a></footer>
  </main>`;

  document.getElementById("slot").outerHTML = `${showQuota ? `<span class="quota">${plural(quota.left, "free analysis", "free analyses")} left today</span>` : ""}
    <button class="btn" id="share">${svg('<path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M20 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5"/>', 14, 1.8)}Share</button>
    <a class="btn primary" href="compare.html?with=${encodeURIComponent(a.id)}" style="text-decoration:none">Compare…</a>`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(asText(a, s, pains, likes, v, verified)); toast("Copied. Paste it into WhatsApp, a doc or an email."); }
    catch { toast("Couldn't copy. Try again."); }
  };
  document.getElementById("copy").addEventListener("click", copy);
  document.getElementById("share").addEventListener("click", copy);
  root.querySelectorAll(".theme-row").forEach(row => {
    const toggle = () => {
      const q = document.getElementById(row.getAttribute("aria-controls"));
      q.hidden = !q.hidden;
      row.setAttribute("aria-expanded", String(!q.hidden));
    };
    row.addEventListener("click", toggle);
    row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  });
  root.querySelectorAll("[data-more]").forEach(b => b.addEventListener("click", () => {
    const t = a.themes[b.dataset.more];
    b.parentElement.innerHTML = t.quotes.map(quote).join("");
  }));
}

main();
