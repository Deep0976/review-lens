import { settings } from "./ui.js";

const f = document.getElementById("f");
const s = await settings();
f.key.value = s.apiKey;
f.model.value = s.model;
f.addEventListener("submit", async e => {
  e.preventDefault();
  await chrome.storage.local.set({ apiKey: f.key.value.trim(), model: f.model.value.trim() });
  document.getElementById("ok").textContent = "Saved. Open any review page and click the Review Lens icon.";
});
