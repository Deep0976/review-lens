// New users land on the welcome/how-to page (no key needed).
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.tabs.create({ url: "options.html?welcome=1" });
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
  // never keep the user waiting too long: YouTube loads ~20 comments per step, so it gets longer to reach 300
  const deadline = Date.now() + (/(youtube|instagram|x|twitter|linkedin)\.com$/.test(host) || location.pathname.startsWith("/maps") ? 35000 : host.endsWith("flipkart.com") ? 25000 : 15000);

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
  const visible = e => (e.checkVisibility ? e.checkVisibility() : !!e.getClientRects().length);
  const clickMore = re => $$("button, faceplate-partial button, a.morecomments a").filter(b => re.test(b.innerText || "")).slice(0, 8).forEach(b => b.click());

  try {
    let site, heading, comments, total, extra = "";
    if (host.endsWith("youtube.com")) {
      site = "YouTube";
      // pause the video while loading (scrolling can trigger autoplay), resume afterwards
      const video = document.querySelector("video.html5-main-video, video");
      const wasPlaying = video && !video.paused;
      video?.pause();
      // a screen at a time until comments start loading, then jump to the bottom for each next batch of ~20
      const n = () => $$("ytd-comment-thread-renderer").length;
      await loadMore(n, () => (n() ? scrollTo(0, document.documentElement.scrollHeight) : scrollBy(0, innerHeight * 1.5)), 300, { wait: 700, patience: 5 }); // measured: 300 comments in ~32s
      if (wasPlaying) video.play().catch(() => {});
      total = (document.querySelector("ytd-comments-header-renderer #count")?.innerText.match(/[\d,]+/) || [])[0];
      badge.remove();
      heading = texts("ytd-watch-metadata h1, h1.ytd-watch-metadata")[0] || document.title;
      comments = texts("ytd-comment-thread-renderer #content-text, ytd-comment-view-model #content-text");
    } else if (/(^|\.)amazon\./.test(host)) {
      site = "Amazon";
      await loadMore(() => $$('[data-hook="review"]').length, toBottom, 50, { patience: 2 });
      badge.remove();
      heading = document.querySelector("#productTitle")?.innerText.trim() || document.title;
      comments = $$('[data-hook="review"]').map(r => {
        const q = h => r.querySelector(h)?.innerText.trim() || "";
        const stars = (q('[data-hook="review-star-rating"], [data-hook="cmps-review-star-rating"]').match(/^[\d.]+/) || [""])[0];
        const title = q('[data-hook="reviewTitle"], [data-hook="review-title"]').replace(/^[\d.]+ out of 5 stars\s*/, "");
        const text = q('[data-hook="reviewText"], [data-hook="review-body"]');
        return [stars && `${stars}★`, title, text].filter(Boolean).join(" · ");
      }).filter(t => t.length > 3);
      if (comments.length < 10) extra = " For more, sign in to Amazon, click “See more reviews” and run Review Lens on that page.";
    } else if (host.endsWith("flipkart.com") && /\/(p|product-reviews)\//.test(location.pathname) && new URLSearchParams(location.search).get("pid")) {
      site = "Flipkart";
      // Review pages embed the full reviews as data (10 per page, no "...more" cut-off), so fetch them directly
      const base = location.pathname.replace("/p/", "/product-reviews/") + "?pid=" + new URLSearchParams(location.search).get("pid");
      const pageReviews = async (sort, n) => {
        const html = await (await fetch(`${base}&page=${n}&sortOrder=${sort}`, { credentials: "include" })).text();
        const state = [...new DOMParser().parseFromString(html, "text/html").querySelectorAll("script")].map(x => x.textContent).find(t => t.includes("__INITIAL_STATE__"));
        if (!state) return [];
        const out = [];
        const walk = o => { if (!o || typeof o !== "object") return; if (o.type === "ProductReviewValue") return void out.push(o); for (const k in o) walk(o[k]); };
        walk(JSON.parse(state.slice(state.indexOf("{"), state.lastIndexOf("}") + 1)));
        return out;
      };
      // Flipkart serves ~10 pages per sort order; "most helpful" + "most recent" gives ~200 different reviews
      // without tilting sentiment (a "negative first" order would)
      const seen = new Set(), found = [];
      for (const sort of ["MOST_HELPFUL", "MOST_RECENT"]) {
        for (let n = 1; n <= 10 && found.length < 300 && Date.now() < deadline; n++) {
          let batch;
          try { batch = (await pageReviews(sort, n)).filter(r => !seen.has(r.id) && seen.add(r.id)); } catch { break; }
          if (batch.length < 3) break; // this order has run out (later pages repeat a featured review)
          found.push(...batch);
          show(found.length);
        }
      }
      badge.remove();
      heading = document.querySelector("h1")?.innerText.trim() || document.title;
      const ratings = (document.body.innerText.match(/([\d,]+)\s+ratings/) || [])[1];
      comments = found.map(r => [r.rating && `${r.rating}★`, r.title, String(r.text || "").trim()].filter(Boolean).join(" · ")).filter(t => t.length > 3);
      extra = `${ratings ? ` Product has ${ratings} ratings.` : ""} Mix of the most helpful and most recent reviews; some quotes are on the Flipkart review pages, not this one.`;
    } else if (/(^|\.)google\.[a-z.]+$/.test(host) && location.pathname.startsWith("/maps")) {
      site = "Google Maps";
      // open the place's Reviews tab if it isn't open yet
      $$('button[role="tab"]').find(b => /reviews/i.test(b.innerText || b.getAttribute("aria-label") || "") && b.getAttribute("aria-selected") !== "true")?.click();
      await sleep(1500);
      const ids = () => new Set($$("[data-review-id]").map(e => e.getAttribute("data-review-id"))).size;
      const panel = () => { let e = $$("[data-review-id]")[0]?.parentElement; while (e && !(e.scrollHeight > e.clientHeight + 50 && /(auto|scroll)/.test(getComputedStyle(e).overflowY))) e = e.parentElement; return e; };
      await loadMore(ids, () => { const p = panel(); if (p) p.scrollTop = p.scrollHeight; }, 300, { wait: 900, patience: 5 });
      // expand long reviews ("More" only opens text, it changes nothing)
      $$("[data-review-id] button").filter(b => /^more$/i.test(b.innerText.trim())).forEach(b => b.click());
      await sleep(400);
      badge.remove();
      heading = document.querySelector("h1")?.innerText.trim() || document.title;
      total = (($$("button").map(b => b.getAttribute("aria-label") || b.innerText).find(t => /^[\d,]+ reviews$/i.test(t || "")) || "").match(/[\d,]+/) || [])[0];
      const seen = new Set();
      comments = $$("[data-review-id]").map(r => {
        const id = r.getAttribute("data-review-id");
        const text = r.querySelector(".wiI7pd")?.innerText.trim(); // the reviewer's text (comes before any owner reply)
        if (!text || seen.has(id)) return "";
        seen.add(id);
        const stars = (r.querySelector('[role="img"][aria-label*="star"]')?.getAttribute("aria-label") || "").match(/^\d/)?.[0];
        return `${stars ? `${stars}★ · ` : ""}${text}`;
      }).filter(Boolean);
      if (/limited view/i.test(document.body.innerText)) extra = " Google shows only a few reviews when you are signed out: sign in to Google and run it again for the full list.";
    } else if (/(^|\.)(x|twitter)\.com$/.test(host) && /\/status\/\d+/.test(location.pathname)) {
      site = "X";
      // X keeps only on-screen posts in the page, so collect replies while scrolling
      const got = new Map();
      const collect = () => $$('article[data-testid="tweet"]').forEach(a => {
        const t = a.querySelector('[data-testid="tweetText"]')?.innerText.trim();
        const link = a.querySelector('a[href*="/status/"] time')?.closest("a")?.getAttribute("href");
        if (t && link && !got.has(link)) got.set(link, t);
      });
      const mainId = location.pathname.match(/status\/(\d+)/)[1];
      await loadMore(() => (collect(), got.size), () => {
        $$('[role="button"]').filter(b => /^show (more )?replies$|^show additional replies/i.test(b.innerText.trim())).slice(0, 2).forEach(b => b.click());
        scrollBy(0, innerHeight * 1.5);
      }, 301, { wait: 1000, patience: 5 });
      collect();
      badge.remove();
      const mainKey = [...got.keys()].find(k => k.includes(mainId));
      heading = got.get(mainKey) || document.title;
      comments = [...got].filter(([k]) => k !== mainKey).map(([, t]) => t);
      total = (document.querySelector('[data-testid="reply"]')?.getAttribute("aria-label")?.match(/[\d,]+/) || [])[0];
    } else if (host.endsWith("linkedin.com")) {
      site = "LinkedIn";
      // a comment = the block around its Reply button; its text is the "expandable-text-box" inside it
      const blocks = () => $$("button").filter(b => /^reply$/i.test((b.getAttribute("aria-label") || b.innerText).trim())).map(b => {
        let e = b;
        for (let i = 0; i < 10 && e; i++) { e = e.parentElement; if (e?.querySelector('[data-testid="expandable-text-box"]')) return e; }
        return null;
      }).filter(Boolean);
      await loadMore(() => blocks().length, () => {
        $$("button").filter(b => /load more comments|show more comments|see more comments/i.test(b.innerText)).slice(0, 2).forEach(b => b.click());
        toBottom();
      }, 300, { wait: 1200, patience: 4 });
      $$('[data-testid="expandable-text-button"]').forEach(b => b.click()); // "...more" only reveals text
      await sleep(500);
      badge.remove();
      heading = $$('[data-testid="expandable-text-box"]')[0]?.innerText.trim() || document.title;
      comments = [...new Set(blocks().map(b => b.querySelector('[data-testid="expandable-text-box"]')?.innerText.trim()).filter(Boolean))];
      if (comments.length < 3) extra = " To read a post's comments, open that single post (click its time stamp) and run Review Lens there.";
    } else if (host.endsWith("quora.com")) {
      site = "Quora";
      // an answer or post = the largest block that holds just one Upvote button
      const items = () => [...new Set($$('button[aria-label="Upvote"]').map(u => {
        let e = u, best = null;
        while (e.parentElement && e.parentElement.querySelectorAll('[aria-label*="pvote" i]').length <= 2) { e = e.parentElement; best = e; }
        return best;
      }).filter(Boolean))];
      await loadMore(() => items().length, toBottom, 100, { wait: 1200, patience: 3 });
      $$("div,span").filter(e => e.children.length === 0 && /^\(more\)$/i.test(e.innerText.trim())).forEach(m => m.click());
      await sleep(1200);
      badge.remove();
      heading = document.querySelector("h1")?.innerText.trim() || document.title;
      // keep sentences; drop buttons, counts and short labels
      comments = items().map(e => e.innerText.split("\n").map(l => l.trim()).filter(l => l.length >= 25
        && !/^(Upvote|Share|Follow|Reply|Comment)/i.test(l) && !/^[\d.,]+K?\s*(upvotes?|comments?|shares?|views?)?$/i.test(l)).join(" ")).filter(t => t.length > 30);
    } else if (host.endsWith("instagram.com")) {
      site = "Instagram";
      // a comment = the block around its "Reply" button that has the username link and a timestamp
      const blocks = () => $$('[role="button"], button').filter(b => b.innerText.trim() === "Reply").map(b => {
        let e = b;
        for (let i = 0; i < 8 && e; i++) { e = e.parentElement; if (e?.querySelector('a[href^="/"]') && e.querySelector("time")) return e; }
        return null;
      }).filter(Boolean);
      // more comments load when the spinner at the bottom of the comments panel comes into view
      await loadMore(() => blocks().length, () => {
        document.querySelector('svg[aria-label="Load more comments"]')?.closest('[role="button"], button')?.click();
        document.querySelector('svg[aria-label="Loading..."]')?.scrollIntoView({ block: "end" });
      }, 300, { wait: 900, patience: 5 });
      badge.remove();
      const meta = n => document.querySelector(`meta[${n}]`)?.content || "";
      heading = meta('property="og:title"') || document.title;
      total = (meta('name="description"').match(/([\d,.]+K?) comments/) || [])[1];
      // keep only the comment text: drop username, time, "Edited", like counts, Reply / replies links
      comments = blocks().map(e => {
        const user = e.querySelector('a[href^="/"]')?.innerText.trim(), time = e.querySelector("time")?.innerText.trim();
        return e.innerText.split("\n").map(l => l.trim()).filter(l => l && l !== user && l !== time
          && !/^·?\s*Edited$/i.test(l) && !/^\d+\s*[smhdwy]\b/.test(l) && !/^[\d,.]+K?\s+likes?$/i.test(l)
          && !/^(Reply|See translation|Hide replies)$/i.test(l) && !/^View (all )?[\d,]+ repl/i.test(l)).join(" ").replace(/^·\s*/, "");
      }).filter(Boolean);
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
          const found = [];
          const walk = list => (list || []).forEach(c => {
            if (c.kind !== "t1") return; // "more" stubs are skipped
            if (c.data.body && !["[deleted]", "[removed]"].includes(c.data.body)) found.push([c.data.score || 0, c.data.body.trim()]);
            walk(c.data.replies?.data?.children);
          });
          walk(tree.data.children);
          // analysis takes up to 300, so put the most-upvoted first (stable sort keeps thread order for ties)
          comments = found.sort((a, b) => b[0] - a[0]).map(([, body]) => body);
          if (comments.length > 300) extra = " The 300 most-upvoted were analysed.";
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
      const openDialogs = () => $$("[role='dialog'], dialog[open]").filter(d => visible(d) && d.innerText.length > 500);
      if (seeAll && !openDialogs().some(d => d.innerText.length > 1000)) { seeAll.click(); await sleep(1500); }
      const dialog = openDialogs().sort((a, b) => b.innerText.length - a.innerText.length)[0];
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
      return { ...base, text: `${heading}\n\nComments:\n\n${comments.join("\n\n---\n\n")}`, items: comments, note: `Loaded and read ${comments.length}${total ? ` of ${total}` : ""} ${site} ${/Amazon|Flipkart|Maps/.test(site) ? "reviews" : site === "X" ? "replies" : site === "Quora" ? "answers and posts" : "comments"}${total ? " (most relevant first)" : ""}${how}.${extra}` };
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
