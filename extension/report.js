import { MAX_CHARS, tally } from "./analysis.js";
import { ask, esc, quoteLink, toggleRows } from "./ui.js";

const out = document.getElementById("out");
const status = msg => { out.innerHTML = `<p class="status card">${esc(msg)}</p>`; };
const SENT = [["pos", "Positive"], ["mixed", "Mixed"], ["neg", "Negative"]];

async function main() {
  const id = new URLSearchParams(location.search).get("id");
  let { analyses = [] } = await chrome.storage.local.get("analyses");
  let a = analyses.find(x => x.id === id);
  let left;

  if (!a) {
    const page = (await chrome.storage.session.get(id))[id];
    if (!page) return status("This report has expired. Click the Review Lens icon on the page again.");
    header(page);
    if (page.error) return status(page.error);
    const truncated = page.text.length > MAX_CHARS;
    page.text = page.text.slice(0, MAX_CHARS);
    status(`${page.note || "Reading the page."} Analysing ${page.text.length.toLocaleString()} characters… this takes 10-40 seconds.`);
    try {
      const res = await ask("analyze", page);
      left = res.left;
      a = { id, url: page.url, title: page.title, note: page.note, truncated,
            created: new Date().toLocaleDateString("en-GB").replaceAll("/", "|"),
            ...tally(res.out, page) };
    } catch (e) {
      return status(e.message);
    }
    if (!a.total) return status(page.hint || "No reviews or comments found. Tip: scroll or click \"load more\" so the comments are on the page, or select just the reviews and click the icon again.");
    analyses = [a, ...analyses].slice(0, 20); // keep the last 20 for comparison
    await chrome.storage.local.set({ analyses });
    await chrome.storage.session.remove(id);
  }
  header(a);
  render(a, left);
}

function header(p) {
  document.getElementById("title").textContent = p.subject || p.title;
  document.getElementById("source").innerHTML = p.url?.startsWith("http") ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title || p.url)}</a>` : "";
  document.title = `Review Lens: ${p.subject || p.title}`;
}

function render(a, left) {
  const max = Math.max(...a.themes.map(t => t.count));
  const pct = n => Math.round((n / a.total) * 100) + "%";
  out.innerHTML = `
    <div class="kpis">
      <div class="card kpi"><b>${a.total}</b><span>opinions found</span></div>
      <div class="card kpi"><b>${a.themes.length}</b><span>themes</span></div>
      <div class="card kpi"><b>${pct(a.neg)}</b><span>negative</span></div>
      <div class="card kpi"><b>${Math.round((a.total / (a.total + a.dropped)) * 100)}%</b><span>quotes verified on page</span></div>
    </div>
    <h2>AI summary</h2>
    <div class="card"><ul class="summary">${a.summary.map(s => `<li>${esc(s)}</li>`).join("")}</ul></div>
    <h2>Themes</h2>
    <p class="note">${a.note ? esc(a.note) + " " : ""}${a.truncated ? "Long page: only the first part was analysed. " : ""}${a.dropped ? `${a.dropped} quotes the AI returned were not found on the page and were dropped. ` : ""}Counts are computed from verified quotes. Click a theme to read them.${left !== undefined ? ` <b>${left} free ${left === 1 ? "analysis" : "analyses"} left today.</b>` : ""}</p>
    <div class="card">
      <div class="legend">${SENT.map(([k, l]) => `<span><i style="background:var(--${k})"></i>${l}</span>`).join("")}</div>
      <table>
        <thead><tr><th>Theme</th><th class="num">Opinions</th><th class="num hide-sm">Share</th><th class="num">Negative</th></tr></thead>
        <tbody>${a.themes.map(t => `
          <tr class="theme" tabindex="0" aria-expanded="false">
            <td>${esc(t.name)}<div class="desc">${esc(t.description)}</div>
              <div class="bar" style="width:${(t.count / max) * 100}%">${SENT.filter(([k]) => t[k]).map(([k, l]) =>
                `<span title="${l}: ${t[k]}" style="flex:${t[k]};background:var(--${k})"></span>`).join("")}</div></td>
            <td class="num">${t.count}</td><td class="num hide-sm">${pct(t.count)}</td><td class="num">${t.neg}</td>
          </tr>
          <tr class="quotes" hidden><td colspan="4">${t.quotes.map(q => `
            <blockquote>“${esc(q.quote)}”<small>${SENT.find(([k]) => k === q.sentiment)[1]} · <a href="${esc(quoteLink(a.url, q.quote))}" target="_blank" rel="noopener">open on page ↗</a></small></blockquote>`).join("")}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
    <p class="note" style="margin-top:16px">Analysed ${esc(a.created)} · <a href="compare.html">Compare with other pages →</a> · <a href="options.html">Settings</a></p>`;
  toggleRows(out);
}

main();
