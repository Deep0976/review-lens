# Review Lens: UI/UX design brief

Everything a designer needs to redesign the Review Lens browser extension. Current screens are in
`store/1-report.png` to `store/4-settings.png` for reference only; nothing here is final.

---

## 1. What it is (one line)

**Review Lens turns the reviews and comments on any web page into clear themes, a short summary and verified
quotes, in one click, and lets you compare pages side by side.**

## 2. Who it's for

| Persona | Situation | What they want |
|---|---|---|
| **Student / shopper** (primary for launch) | Choosing a coaching app, a course, a phone, a product | "Is this worth it? What do people actually complain about?" in 30 seconds, without reading 200 reviews |
| **Product manager / founder** | Researching their own app or a competitor | Pain points with counts and real quotes they can paste into a doc or deck |
| **Creator / researcher** | Reading YouTube or Reddit comments | What the audience thinks, grouped, with the strongest quotes |

Most users are on **college Wi-Fi or mobile data in India**, on a **laptop**, using **Chrome or Brave**, and are
not technical. Many reviews are **Hinglish** (Hindi in Latin script), with emoji and spelling mistakes.

## 3. Core promise and principles

1. **One click, no setup.** No sign-up and no API key. 5 free analyses a day.
2. **Trust through evidence.** Every theme is backed by real quotes. Any quote the AI invents is dropped, and
   each quote can open the original comment on the page. This is the product's differentiator: the design should
   make "this is real, you can check it" obvious.
3. **Counts are facts, the summary is AI.** Numbers (opinions, themes, % negative) are calculated by code; the
   summary and comparison bullets are AI-written. The UI should visually separate the two.
4. **Fast to scan.** Answer "what's good, what's bad, how bad" above the fold.

## 4. The user journey

```
Install → Welcome page → Open a review page → Click icon / Alt+Shift+R
        → In-page "loading reviews" badge (up to 15s) → Report opens (new tab, 10-40s analysing)
        → Read themes, expand quotes, "open on page"
        → (optional) analyse a 2nd page → Compare → Key differences + side-by-side themes
```

## 5. Surfaces to design

### 5.1 Toolbar icon
- Lives in the browser toolbar (users must **pin** it from the puzzle-piece menu; worth teaching on the welcome page).
- Current icon: blue rounded square, white speech bubble, three bars of decreasing length (= opinions grouped
  into themes). Sizes needed: 16, 32, 48, 128 px. Must read at 16 px.
- Tooltip: "Analyze reviews on this page (Alt+Shift+R)".
- Clicking it starts the flow immediately (there is no popup menu today; see 9.1 for options).

### 5.2 In-page loading badge (shown on the website itself)
- Appears top-right **on top of the user's page** (YouTube, Play Store, Reddit…) while reviews auto-load.
- Duration: 2-15 seconds.
- Content: "Review Lens: loading reviews… 42 found" (count shown on YouTube/Reddit; just "loading reviews…" elsewhere).
- What happens behind it: the page scrolls by itself, Play Store's "See all reviews" popup opens by itself,
  Reddit's "more replies" get clicked.
- Must work on any website's background (light and dark sites), never block the page, and look trustworthy.
- Nice to have: a progress feel, a cancel (×), and an "Analyse now" to stop loading early.

### 5.3 Report page (main screen, opens in a new tab)

**States to design:**

| State | When | Content |
|---|---|---|
| Analysing | 10-40s after the tab opens | "Read 60 YouTube comments. Analysing 7,000 characters…" Needs a good waiting experience (skeleton, steps, tip) |
| Result | Success | See below |
| No opinions found | Page had no reviews | "No reviews or comments found" plus tips (scroll, select text) |
| Not readable | Browser page like New Tab or Settings | "Review Lens can't read this page… open a review page" |
| Daily limit reached | 6th analysis of the day | "You've used today's 5 free analyses. Add your own free Gemini key in Settings for unlimited use, or come back tomorrow." |
| Service busy / capacity used | Global cap or AI quota hit | Similar message, suggests own key or tomorrow |
| Network blocked / offline | Server unreachable | "Can't reach the Review Lens server… try mobile data, or add your own key" |
| AI error | Rare | "The AI service had a hiccup. Please try again in a minute." Needs a Retry button |

**Result content (real example, Unacademy on Play Store):**
- **Header:** subject the AI detected ("Unacademy app") plus a link to the source page title
  ("Unacademy: Learn & Crack Exams – Apps on Google Play").
- **4 headline numbers:** `80` opinions found · `6` themes · `84%` negative · `99%` quotes verified on page.
- **Source note:** "Opened and read the full reviews list." / "Loaded and read 60 YouTube comments." /
  "Analysed your selection."
- **Free-tier counter:** "4 free analyses left today" (only when not using own key).
- **AI summary:** 3-5 bullets, for example:
  - Users praise the quality of educators and overall teaching methods.
  - Many customers complain about aggressive sales calls and spam before purchasing.
  - Customer support is frequently described as unresponsive and unhelpful after payment.
- **Themes list**, sorted by count, with "Other / unclear" last. Each theme has:
  - name ("Technical glitches and app performance"), one-line description
  - opinions count (33), share of all opinions (41%), negative count (29)
  - sentiment split bar: positive / mixed / negative (e.g. 3 / 1 / 29)
  - a "low confidence" flag is possible for tiny themes
  - **expand** to read verified quotes. Each quote: the text, sentiment label, "open on page ↗"
    (opens the source scrolled to and highlighting that comment)
- **Trust note:** "1 quote the AI returned was not found on the page and dropped. Counts are computed from verified quotes."
- **Footer actions:** Compare with other pages · Settings · date analysed.

**Data limits to design for:** 1-150 opinions; 1-10 themes; theme names up to ~60 characters; quotes from 2 words
to ~400 characters, including Hinglish and emoji; the summary always has 3-5 bullets.

### 5.4 Compare page
- **Picker:** list of the last 20 analyses (subject, opinion count, date, page title), pick 2-4, "Compare" button.
- **Loading:** "Lining up themes… 10-30 seconds."
- **Result:**
  - **Key differences** (AI-written, 3 bullets), e.g. "Unacademy received 13 opinions about aggressive sales calls
    and spam, whereas PW had none and focused on pricing instead."
  - **Side-by-side table:** rows = shared themes (4-12), columns = 2-4 pages. Each cell: share % of that page's
    opinions, count, negatives, e.g. "17% · 13 (13 neg)", with a bar. "–" when a page has none.
  - Pages are color-coded consistently (up to 4 colors).
- Errors: same set as the report (limit, network, AI error).

### 5.5 Welcome / Settings page
- Opens automatically on install. Also reachable from reports and the extension menu.
- Sections:
  1. "Review Lens is ready. No sign-up needed. You get 5 free analyses every day."
  2. How to use (4 steps): open a page → click icon / Alt+Shift+R (pin it!) → read themes and quotes → compare.
  3. **Optional:** unlimited use with your own free Gemini key (password field, model field, Save, link to
     aistudio.google.com/apikey). Saved message differs for "own key" vs "free daily".
  4. Privacy line plus a link to the privacy policy.
- Opportunity: a short visual or GIF of the flow; a "try it on this example page" button.

## 6. Behaviours and constraints the design must respect

- **Chrome extension surfaces:** toolbar icon, popup (small window that closes when you click away), new tab
  pages (current report/compare/settings), side panel (opens beside the page; Chrome supports it, Brave support is
  uncertain), and content injected into the page (the loading badge).
- Analysis takes **10-40 seconds**; auto-loading takes up to **15 seconds** before that. Waiting UX matters.
- Results are saved locally (last 20); reopening a report is instant.
- Light **and** dark mode (follows the system). The current palette uses blue `#2a78d6`, sentiment blue
  positive / grey mixed / red negative, and up to 4 categorical colors for compare.
- Accessibility: keyboard navigation (theme rows expand with Enter/Space), sentiment never shown by color alone
  (labels plus counts), readable at 200% zoom, works at narrow widths.
- Needs to look credible next to big brands: it shows up on YouTube, Play Store and Amazon.

## 7. Content and tone

- Plain, friendly, short. Talk like a smart friend, not a dashboard.
- Always say what to do next in errors.
- Distinguish **"AI summary"** from **verified counts and quotes**.
- Indian context: ₹, Hinglish quotes, JEE/NEET examples.

## 8. Success metrics the design should move

- **Activation:** % of installs that complete a first analysis (target > 60%).
- **Time to first insight:** under 45s from click.
- **Trust:** % of users who expand quotes or click "open on page".
- **Retention:** analyses per user per week; % who use Compare.
- **Upgrade signal:** % who hit the daily limit (→ own key or a future paid tier).

## 9. Open design questions (your call)

1. **Where should results appear?** New tab (today), side panel beside the page, or a popup preview with
   "open full report"? The side panel keeps context but may not work in Brave.
2. Should the toolbar click open a small **popup** first (Analyse this page · Recent · Compare · Settings)?
3. **Report hierarchy:** lead with "Verdict" (good vs bad), with the top 3 pain points as cards, or keep the table?
4. **Sharing:** export as an image, copy as text, or share a link (useful for PMs and students in WhatsApp groups)?
5. **History:** a "Recent analyses" screen beyond the compare picker?
6. **Onboarding:** an interactive first run on a sample page?

## 10. Screens to deliver

1. Toolbar icon (16/32/48/128) + pinned state
2. In-page loading badge (light site, dark site)
3. Report: analysing state
4. Report: full result (light + dark), with one theme expanded
5. Report: empty, not-readable, limit-reached, offline, error states
6. Compare: picker, loading, result (2 pages and 4 pages)
7. Welcome/Settings: free mode, own-key mode, saved confirmation
8. (If chosen) popup menu and/or side panel versions
9. Chrome Web Store assets: 4 screenshots at 1280×800 and an optional 440×280 promo tile
