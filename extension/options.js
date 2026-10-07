// Settings / welcome page: plan, how to use, optional own Gemini key, shortcut and data.
import { llm } from "./analysis.js";
import { esc, settings } from "./ui.js";
import { check, plural, svg, toast, topBar } from "./view.js";

const root = document.getElementById("root");
const FREE = 5;
const MODELS = [["gemini-flash-lite-latest", "Flash-Lite · fast (default)"], ["gemini-3-flash-preview", "Gemini 3 Flash · sharper themes"], ["gemini-2.5-flash", "Gemini 2.5 Flash"]];
const ICON = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-2.93 1.41-1.41M17.66 6.34l1.41-1.41M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  kbd: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
  data: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
};
const tileIcon = p => `<div class="ticon mix" style="--tc:var(--brand-ink)">${svg(p)}</div>`;

// Developer convenience: a gitignored key.local.json next to the extension is imported once
const { devKeyImported } = await chrome.storage.local.get("devKeyImported");
if (!devKeyImported && !(await settings()).apiKey) {
  try {
    const { apiKey } = await (await fetch("key.local.json")).json();
    if (apiKey) await chrome.storage.local.set({ apiKey, devKeyImported: true });
  } catch {}
}

async function plan() {
  const { apiKey, model } = await settings();
  const { quota } = await chrome.storage.local.get("quota");
  if (apiKey) {
    return `<div class="kicker" style="--tone:var(--pos);--tone-ink:var(--pos-ink)"><i></i>Your plan</div>
      <div class="plan-big">Unlimited ${check(24)}</div>
      <div class="fine" style="padding:0">Using your own Gemini key with ${esc((MODELS.find(([id]) => id === model) || [, model])[1])}. Analyses go straight from your browser to Google.</div>`;
  }
  const left = quota?.day === new Date().toDateString() ? quota.left : FREE;
  return `<div class="kicker" style="--tone:var(--brand);--tone-ink:var(--brand-ink)"><i></i>Your plan · Free</div>
    <div class="plan-big">${left} of ${FREE} left today</div>
    <div class="segs5" role="img" aria-label="${left} of ${FREE} free analyses left">${Array.from({ length: FREE }, (_, i) => `<i class="${i < left ? "on" : ""}"></i>`).join("")}</div>
    <div class="fine" style="padding:0">No sign-up needed. Free analyses reset at midnight (India time). Want more? Add your own free key below.</div>`;
}

async function render() {
  const s = await settings();
  const { analyses = [] } = await chrome.storage.local.get("analyses");
  const models = MODELS.some(([id]) => id === s.model) ? MODELS : [...MODELS, [s.model, s.model]];
  root.innerHTML = `${topBar("Settings")}<main class="wrap" style="max-width:720px;gap:36px">
    ${new URLSearchParams(location.search).has("welcome") ? '<div class="page-h"><h1>Review Lens is ready</h1><p>No sign-up, no key. Open any page with reviews and click the icon: you get 5 free analyses every day.</p></div>' : '<div class="page-h"><h1>Settings</h1><p>Review Lens works without sign-up. Add your own key only if you want unlimited analyses.</p></div>'}

    <section class="plan" id="plan">${await plan()}</section>

    <section class="sec"><div class="sec-h"><h2>How to use</h2></div>
      <div class="group">
        <div class="set-row"><div class="num">1</div><div><b>Open a page with reviews</b><small>A Play Store app, Amazon, Flipkart or Google Maps reviews, a YouTube video, a Reddit thread, an X post, a LinkedIn post or a Quora page.</small></div><span></span></div>
        <div class="set-row"><div class="num">2</div><div><b>Click the Review Lens icon</b><small>Or press the shortcut. Pin the icon from the puzzle-piece menu so it’s always visible.</small></div><span class="kbd">Alt+Shift+R</span></div>
        <div class="set-row"><div class="num">3</div><div><b>Let it load the reviews</b><small>It opens “See all reviews”, scrolls YouTube comments and reads whole Reddit threads for you.</small></div><span></span></div>
        <div class="set-row"><div class="num">4</div><div><b>Read the verdict, then compare</b><small>Every quote opens the original comment. Analyse two pages to compare them side by side.</small></div><a href="compare.html">Compare</a></div>
      </div></section>

    <section class="sec"><div class="sec-h"><h2>Your own Gemini key</h2><small>optional · unlimited use</small></div>
      <form class="form" id="f" autocomplete="off">
        <div class="field"><label for="key">API key</label>
          <div class="input-wrap"><input id="key" type="password" spellcheck="false" placeholder="Paste your key, or leave empty for free analyses" value="${esc(s.apiKey)}">
            <button type="button" class="btn" id="show" aria-pressed="false">Show</button></div>
          <small>Free from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>, about a minute. Stored only in this browser and sent only to Google.</small></div>
        <div class="field"><label for="model">Model</label>
          <div class="input-wrap"><select id="model">${models.map(([id, label]) => `<option value="${esc(id)}" ${id === s.model ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></div>
          <small>Used only with your own key. Each model has its own free daily limit at Google.</small></div>
        <div class="form-actions"><button class="btn primary lg" type="submit">Save</button><button class="btn ghost lg" type="button" id="test">Test key</button>
          ${s.apiKey ? '<button class="link danger" type="button" id="remove">Remove key</button>' : ""}<span id="msg" aria-live="polite"></span></div>
      </form></section>

    <section class="sec"><div class="sec-h"><h2>Appearance, shortcut and data</h2></div>
      <div class="group">
        <div class="set-row">${tileIcon(ICON.sun)}<div><b>Theme</b><small>Light is the default. System follows your computer's setting.</small></div>
          <div class="seg" role="radiogroup" aria-label="Theme">${["light", "dark", "system"].map(t => `<button type="button" role="radio" data-theme-opt="${t}" aria-checked="${document.documentElement.dataset.theme === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div></div>
        <div class="set-row">${tileIcon(ICON.kbd)}<div><b>Keyboard shortcut</b><small>Runs Review Lens on the current page.</small></div>
          <div style="display:flex;gap:12px;align-items:center"><span class="kbd">Alt+Shift+R</span><button class="link" id="shortcuts">Change</button></div></div>
        <div class="set-row">${tileIcon(ICON.data)}<div><b>Saved reports</b><small>${plural(analyses.length, "report")} on this device, used for Compare. Only the last 20 are kept.</small></div>
          ${analyses.length ? '<button class="link danger" id="clear">Clear</button>' : "<span></span>"}</div>
        <div class="set-row">${tileIcon(ICON.shield)}<div><b>Privacy</b><small>Pages are read only when you click the icon. The text is analysed by Google Gemini and isn’t stored.</small></div>
          <a href="https://deep0976.github.io/review-lens/privacy.html" target="_blank" rel="noopener">Policy ↗</a></div>
      </div></section>

    <footer class="foot"><span class="fine">Review Lens v${chrome.runtime.getManifest().version}</span><a href="compare.html">Saved reports</a></footer>
  </main>`;
  document.getElementById("slot").outerHTML = `<a class="btn" href="compare.html" style="text-decoration:none">Compare</a>`;
  wire();
}

function wire() {
  const f = document.getElementById("f"), key = f.querySelector("#key"), msg = document.getElementById("msg");
  const say = (text, ok) => { msg.className = ok ? "status-ok" : "status-err"; msg.innerHTML = ok ? `${check(14)}${esc(text)}` : esc(text); };
  document.getElementById("show").addEventListener("click", e => {
    const showing = key.type === "text";
    key.type = showing ? "password" : "text";
    e.target.textContent = showing ? "Show" : "Hide";
    e.target.setAttribute("aria-pressed", String(!showing));
  });
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const apiKey = key.value.trim();
    await chrome.storage.local.set({ apiKey, model: f.querySelector("#model").value });
    toast(apiKey ? "Saved. You now have unlimited analyses." : "Saved. Using the free daily analyses.");
    render();
  });
  document.getElementById("test").addEventListener("click", async () => {
    const apiKey = key.value.trim();
    if (!apiKey) return say("Paste a key first.", false);
    say("Testing…", true);
    try {
      await llm('Return JSON {"ok": true}', { apiKey, model: f.querySelector("#model").value });
      say("Key works. Click Save to use it.", true);
    } catch (e) {
      say(e.message, false);
    }
  });
  document.getElementById("remove")?.addEventListener("click", async () => {
    await chrome.storage.local.set({ apiKey: "" });
    toast("Key removed. Using the free daily analyses.");
    render();
  });
  document.querySelectorAll("[data-theme-opt]").forEach(b => b.addEventListener("click", () => {
    const t = b.dataset.themeOpt;
    try { localStorage.setItem("rl-theme", t); } catch {}
    document.documentElement.dataset.theme = t;
    document.querySelectorAll("[data-theme-opt]").forEach(x => x.setAttribute("aria-checked", String(x === b)));
  }));
  document.getElementById("shortcuts").addEventListener("click", () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" }));
  document.getElementById("clear")?.addEventListener("click", async () => {
    if (!confirm("Delete all saved reports on this device? This can’t be undone.")) return;
    await chrome.storage.local.set({ analyses: [] });
    toast("Saved reports cleared.");
    render();
  });
}

render();
