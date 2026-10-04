// Small helpers shared by the extension pages.
import { COMPARE_SCHEMA, analysisPrompt, analysisSchema, comparePrompt, llm, slim } from "./analysis.js";

export const SERVER = "https://review-lens-app.netlify.app"; // Netlify proxy in front of the Cloudflare Worker (see proxy/)

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const settings = () => chrome.storage.local.get({ apiKey: "", model: "gemini-flash-lite-latest" });

// Random id so the free server can apply a per-install daily limit without any login
async function installId() {
  let { installId: id } = await chrome.storage.local.get("installId");
  if (!id) await chrome.storage.local.set({ installId: (id = crypto.randomUUID()) });
  return id;
}

// Own key -> call Gemini directly (unlimited). No key -> free hosted tier. Returns { out, left }.
export async function ask(kind, payload) {
  const s = await settings();
  if (s.apiKey) {
    const out = kind === "analyze"
      ? await llm(analysisPrompt(payload), s, analysisSchema(payload))
      : await llm(comparePrompt(slim(payload)), s, COMPARE_SCHEMA);
    return { out };
  }
  const body = { installId: await installId(), kind, ...(kind === "analyze" ? { page: payload } : { analyses: slim(payload) }) };
  let r;
  try {
    r = await fetch(SERVER, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw Object.assign(new Error("Can't reach the Review Lens server."), { code: "offline" });
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || `Review Lens server error (${r.status}).`), { code: d.code || "ai_error" });
  if (d.left !== undefined) await chrome.storage.local.set({ quota: { left: d.left, day: new Date().toDateString() } });
  return d;
}

// Link that opens the source page scrolled to and highlighting the quote (Chrome text fragments)
// (first ~10 words only: long or formatted comments rarely match as a whole)
export const quoteLink = (url, quote) =>
  `${url.split("#")[0]}#:~:text=${encodeURIComponent(quote.replace(/…$/, "").split(/\s+/).slice(0, 10).join(" ")).replace(/-/g, "%2D")}`;

export function toggleRows(root) {
  root.querySelectorAll("tr.theme").forEach(row => {
    const toggle = () => { const q = row.nextElementSibling; q.hidden = !q.hidden; row.setAttribute("aria-expanded", !q.hidden); };
    row.addEventListener("click", toggle);
    row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  });
}
