// Small helpers shared by the extension pages.
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const settings = () => chrome.storage.local.get({ apiKey: "", model: "gemini-flash-lite-latest" });

// Link that opens the source page scrolled to and highlighting the quote (Chrome text fragments)
export const quoteLink = (url, quote) =>
  `${url.split("#")[0]}#:~:text=${encodeURIComponent(quote).replace(/-/g, "%2D")}`;

export function toggleRows(root) {
  root.querySelectorAll("tr.theme").forEach(row => {
    const toggle = () => { const q = row.nextElementSibling; q.hidden = !q.hidden; row.setAttribute("aria-expanded", !q.hidden); };
    row.addEventListener("click", toggle);
    row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  });
}
