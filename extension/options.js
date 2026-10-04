import { settings } from "./ui.js";

const f = document.getElementById("f");
// Developer convenience: a gitignored key.local.json next to the extension is picked up automatically
if (!(await settings()).apiKey) {
  try {
    const { apiKey } = await (await fetch("key.local.json")).json();
    if (apiKey) await chrome.storage.local.set({ apiKey });
  } catch {}
}
const s = await settings();
f.key.value = s.apiKey;
f.model.value = s.model;
f.addEventListener("submit", async e => {
  e.preventDefault();
  const apiKey = f.key.value.trim();
  await chrome.storage.local.set({ apiKey, model: f.model.value.trim() });
  document.getElementById("ok").textContent = apiKey ? "Saved. Using your own key (unlimited)." : "Saved. Using the free daily analyses.";
});
