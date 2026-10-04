// New users land on the welcome/how-to page (no key needed).
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.runtime.openOptionsPage();
});

// Icon click: grab the page's text (or the user's selection) and open a report tab that analyses it.
chrome.action.onClicked.addListener(async tab => {
  let page;
  try {
    [{ result: page }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extract });
  } catch {
    page = { title: tab.title || "This page", url: tab.url || "", error: "Review Lens can't read this page. Browser pages like New Tab, Settings or the Web Store are off limits to extensions. Open a review page, a Reddit thread or a YouTube video and click the icon again." };
  }
  const id = crypto.randomUUID();
  await chrome.storage.session.set({ [id]: page });
  chrome.tabs.create({ url: `report.html?id=${id}`, index: tab.index + 1 });
});

// Runs inside the page, so it must be self-contained.
function extract() {
  const base = { title: document.title, url: location.href };
  const selection = getSelection().toString().trim();
  if (selection) return { ...base, text: selection, note: "Analysed your selection." };

  const texts = sel => [...document.querySelectorAll(sel)].map(e => e.innerText.trim()).filter(Boolean);
  const host = location.hostname;
  let site, heading, comments;
  if (host.endsWith("youtube.com")) {
    site = "YouTube";
    heading = texts("ytd-watch-metadata h1, h1.ytd-watch-metadata")[0] || document.title;
    comments = texts("ytd-comment-thread-renderer #content-text, ytd-comment-view-model #content-text");
  } else if (host.endsWith("reddit.com")) {
    site = "Reddit";
    // new Reddit (shreddit) and old.reddit.com
    heading = [...texts("shreddit-post h1, h1[slot='title'], .link .title a.title").slice(0, 1),
               ...texts("shreddit-post div[slot='text-body'], .link .usertext-body .md").slice(0, 1)].join("\n\n") || document.title;
    comments = texts("shreddit-comment div[slot='comment'], .comment .usertext-body .md");
  }
  if (site && comments.length >= 3) {
    return { ...base, text: `${heading}\n\nComments:\n\n${comments.join("\n\n---\n\n")}`, note: `Read ${comments.length} ${site} comments.` };
  }
  // An open popup full of text (e.g. Play Store "See all reviews") is what the user is looking at
  const dialog = [...document.querySelectorAll("[role='dialog'], dialog[open]")]
    .map(e => e.innerText.trim()).filter(t => t.length > 1000).sort((a, b) => b.length - a.length)[0];
  if (dialog) return { ...base, text: dialog, note: "Read the open reviews popup." };
  return {
    ...base, text: document.body.innerText,
    hint: site ? `Only ${comments.length} ${site} comments were loaded. Scroll down until comments appear (on Reddit, click "more replies"), then click the icon again.` : "",
  };
}
