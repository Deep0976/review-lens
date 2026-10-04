// New users land on the welcome/how-to page (no key needed).
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.runtime.openOptionsPage();
});

// Icon click: load more reviews on the page, grab its text (or the user's selection), open a report tab.
chrome.action.onClicked.addListener(async tab => {
  let page;
  try {
    [{ result: page }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extract });
  } catch {
    page = { title: tab.title || "This page", url: tab.url || "", error: "Review Lens can't read this page. Browser pages like New Tab, Settings or the Web Store are off limits to extensions. Open a review page, a Reddit thread or a YouTube video and click the icon again." };
  }
  const id = crypto.randomUUID();
  page.tabId = tab.id; // so "Back to the page" can return there
  await chrome.storage.session.set({ [id]: page });
  chrome.tabs.create({ url: `report.html?id=${id}`, index: tab.index + 1 });
});

// Runs inside the page, so it must be self-contained.
async function extract() {
  const base = { title: document.title, url: location.href };
  const selection = getSelection().toString().trim();
  if (selection) return { ...base, text: selection, note: "Analysed your selection." };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $$ = sel => [...document.querySelectorAll(sel)];
  const texts = sel => $$(sel).map(e => e.innerText.trim()).filter(Boolean);
  const host = location.hostname;
  const startY = scrollY;
  const deadline = Date.now() + 15000; // never keep the user waiting more than ~15s

  const badge = document.createElement("div");
  badge.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;background:#2a78d6;color:#fff;font:600 14px system-ui,sans-serif;padding:10px 14px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.3)";
  const show = n => { badge.textContent = `Review Lens: loading reviews… ${n ? `${n} found` : ""}`; };
  show(0);
  document.body.append(badge);

  // Repeat `step` until `count` stops growing (`patience` times in a row), reaches `target`, or time runs out.
  const loadMore = async (count, step, target, { wait = 1200, patience = 2, label = true } = {}) => {
    let last = -1, stalls = 0;
    while (Date.now() < deadline && stalls < patience) {
      const n = count();
      show(label ? n : 0);
      if (n >= target) break;
      stalls = n === last ? stalls + 1 : 0;
      last = n;
      step();
      await sleep(wait);
    }
  };
  const toBottom = () => scrollTo(0, document.documentElement.scrollHeight);
  // only "load more"-style buttons, so we never click anything that changes data
  const clickMore = re => $$("button, faceplate-partial button, a.morecomments a").filter(b => re.test(b.innerText || "")).slice(0, 8).forEach(b => b.click());

  try {
    let site, heading, comments;
    if (host.endsWith("youtube.com")) {
      site = "YouTube";
      // YouTube loads comments only as they scroll into view, so go a screen at a time
      await loadMore(() => $$("ytd-comment-thread-renderer").length, () => scrollBy(0, innerHeight * 1.5), 100, { wait: 1500, patience: 4 });
      badge.remove();
      heading = texts("ytd-watch-metadata h1, h1.ytd-watch-metadata")[0] || document.title;
      comments = texts("ytd-comment-thread-renderer #content-text, ytd-comment-view-model #content-text");
    } else if (host.endsWith("reddit.com")) {
      site = "Reddit";
      // Best source: the thread's own JSON (whole comment tree, no scrolling, no fragile selectors)
      const thread = location.pathname.match(/^\/r\/[^/]+\/comments\/[^/]+/);
      var redditWhy = thread ? "" : "not a thread page"; // shown in the report so failures are diagnosable
      if (thread) {
        try {
          const res = await fetch(`${thread[0]}.json?limit=500&depth=10&raw_json=1`, { credentials: "include" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const [post, tree] = await res.json();
          const p = post.data.children[0].data;
          heading = [p.title, p.selftext].filter(Boolean).join("\n\n");
          comments = [];
          const walk = list => (list || []).forEach(c => {
            if (c.kind !== "t1") return; // "more" stubs are skipped
            if (c.data.body && !["[deleted]", "[removed]"].includes(c.data.body)) comments.push(c.data.body.trim());
            walk(c.data.replies?.data?.children);
          });
          walk(tree.data.children);
          show(comments.length);
        } catch (e) { comments = []; redditWhy = e.message.slice(0, 60); }
      }
      if (!comments?.length) {
        // Fallback: read the page (new Reddit "shreddit" and old.reddit.com)
        await loadMore(() => $$("shreddit-comment, .comment").length,
          () => { clickMore(/more repl|more comment|load more/i); toBottom(); }, 150);
        heading = [...texts("shreddit-post h1, h1[slot='title'], .link .title a.title").slice(0, 1),
                   ...texts("shreddit-post div[slot='text-body'], .link .usertext-body .md").slice(0, 1)].join("\n\n") || document.title;
        comments = texts("shreddit-comment [slot='comment'], [id$='-comment-rtjson-content'], .comment .usertext-body .md");
      }
      badge.remove();
    } else {
      // Open the full reviews list if the page has one (e.g. Play Store "See all reviews")
      const seeAll = $$("button, a, [role='button']").find(b => /^\s*see all reviews\s*$/i.test(b.innerText || ""));
      if (seeAll && !$$("[role='dialog']").some(d => d.innerText.length > 1000)) { seeAll.click(); await sleep(1500); }
      const dialog = $$("[role='dialog'], dialog[open]").filter(d => d.innerText.length > 500).sort((a, b) => b.innerText.length - a.innerText.length)[0];
      if (dialog) {
        const scroller = [dialog, ...dialog.querySelectorAll("*")].find(e => e.scrollHeight > e.clientHeight + 50 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
        if (scroller) await loadMore(() => dialog.innerText.length, () => { scroller.scrollTop = scroller.scrollHeight; }, 80000, { label: false }); // 80000 = MAX_CHARS the analysis reads
        badge.remove();
        return { ...base, text: dialog.innerText.trim(), note: "Opened and read the full reviews list." };
      }
      await loadMore(() => document.body.innerText.length, toBottom, 80000, { label: false });
      badge.remove();
    }
    if (site && comments.length >= 3) {
      const how = site === "Reddit" && redditWhy ? ` (from the page; Reddit's data feed failed: ${redditWhy})` : "";
      return { ...base, text: `${heading}\n\nComments:\n\n${comments.join("\n\n---\n\n")}`, items: comments, note: `Loaded and read ${comments.length} ${site} comments${how}.` };
    }
    return {
      ...base, text: document.body.innerText,
      note: site ? `Read the whole page: only ${comments.length} ${site} comments were found${site === "Reddit" && redditWhy ? ` (Reddit's data feed failed: ${redditWhy})` : ""}.` : "",
      hint: site ? `Only ${comments.length} ${site} comments could be loaded. If the video or thread has comments, scroll to them and click the icon again.` : "",
    };
  } finally {
    badge.remove();
    if (!host.endsWith("play.google.com")) scrollTo(0, startY); // put the page back where the user was
  }
}
