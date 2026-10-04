import { settings } from "./ui.js";

const f = document.getElementById("f");
// Optional gitignored key.local.json next to the extension, so the key never has to be typed in
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
  await chrome.storage.local.set({ apiKey: f.key.value.trim(), model: f.model.value.trim() });
  document.getElementById("ok").textContent = "Saved. Open any review page and click the Review Lens icon.";
});
