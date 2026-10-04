// Icon click: grab the page's text (or the user's selection) and open a report tab that analyses it.
chrome.action.onClicked.addListener(async tab => {
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!apiKey) return chrome.runtime.openOptionsPage();

  let page;
  try {
    [{ result: page }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selection = getSelection().toString().trim();
        return { title: document.title, url: location.href, selection: !!selection, text: selection || document.body.innerText };
      },
    });
  } catch {
    page = { title: tab.title, url: tab.url, error: "Chrome doesn't let extensions read this page (for example chrome:// pages or the Web Store)." };
  }
  const id = crypto.randomUUID();
  await chrome.storage.session.set({ [id]: page });
  chrome.tabs.create({ url: `report.html?id=${id}`, index: tab.index + 1 });
});
