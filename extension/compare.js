import { mergeCompare } from "./analysis.js";
import { ask, esc } from "./ui.js";

const list = document.getElementById("list");
const go = document.getElementById("go");
const hint = document.getElementById("hint");
const out = document.getElementById("out");
const { analyses = [] } = await chrome.storage.local.get("analyses");

list.innerHTML = analyses.length ? analyses.map((a, i) => `
  <label class="pick"><input type="checkbox" value="${i}">
    <span><b>${esc(a.subject)}</b> · ${a.total} opinions · ${esc(a.created)}<br><span class="note">${esc(a.title)}</span></span>
  </label>`).join("")
  : '<p class="note">Nothing analysed yet. Open a review page and click the Review Lens icon.</p>';

const picked = () => [...list.querySelectorAll("input:checked")].map(c => analyses[+c.value]);
list.addEventListener("change", () => {
  const n = picked().length;
  go.disabled = n < 2 || n > 4;
  hint.textContent = n > 4 ? "Pick at most 4." : "";
});

go.addEventListener("click", async () => {
  const sel = picked();
  go.disabled = true;
  out.innerHTML = '<p class="status card">Lining up themes… 10-30 seconds.</p>';
  try {
    render(sel, mergeCompare((await ask("compare", sel)).out, sel));
  } catch (e) {
    out.innerHTML = `<p class="status card">${esc(e.message)}</p>`;
  }
  go.disabled = false;
});

function render(sel, { rows, differences }) {
  const color = i => `var(--s${i + 1})`;
  const max = Math.max(...rows.flatMap(r => r.cells.map(c => c.share)));
  out.innerHTML = `
    <h2>Key differences <span class="note">(AI-written)</span></h2>
    <div class="card"><ul class="summary">${differences.map(d => `<li>${esc(d)}</li>`).join("")}</ul></div>
    <h2>Themes side by side</h2>
    <p class="note">Bars show each theme's share of that page's opinions, so pages with more comments don't dominate.</p>
    <div class="card" style="overflow-x:auto">
      <div class="legend">${sel.map((a, i) => `<span><i style="background:${color(i)}"></i>${esc(a.subject)} (${a.total})</span>`).join("")}</div>
      <table>
        <thead><tr><th>Theme</th>${sel.map((a, i) => `<th><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color(i)}"></i> ${esc(a.subject)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(r => `<tr><td>${esc(r.name)}</td>${r.cells.map((c, i) => `
          <td class="cell">${c.count ? `${Math.round(c.share * 100)}% · ${c.count}${c.neg ? ` (${c.neg} neg)` : ""}
            <div class="bar" style="width:${(c.share / max) * 100}%"><span style="flex:1;background:${color(i)}"></span></div>` : "–"}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}
