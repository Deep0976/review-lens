# Chrome Web Store listing: Review Lens

Copy each field into https://chrome.google.com/webstore/devconsole

## Package
Upload: `dist/review-lens-1.1.0.zip` (rebuild any time with `extension/build.sh`; it refuses to ship key.local.json)

## Store listing tab

**Name:** Review Lens

**Summary (132 chars max):**
Click on any review, Reddit or Quora page to get AI themes, a summary and verified quotes. Compare pages side by side.

**Category:** Tools (alternative: Productivity)

**Language:** English

**Description:**
```
Stop scrolling through hundreds of reviews. Review Lens reads the reviews and comments on the page you're on and turns them into clear themes, in one click.

WHAT YOU GET
• Themes: opinions grouped into specific, actionable themes like "Refund takes weeks" or "App crashes on tablets", with counts and a positive/mixed/negative split.
• AI summary: 3-5 bullets on what people are saying overall.
• Verified quotes: every quote is checked against the page. If the AI invents a quote, it's dropped, and "open on page" jumps straight to the original comment.
• Compare: analyse 2-4 pages (two apps, two products, two Reddit threads) and see their themes side by side, as a share of each page's opinions.

WORKS ON
Google Play and App Store reviews, Amazon, Flipkart, Myntra and Nykaa reviews, Trustpilot, G2, Capterra, TripAdvisor, Reddit threads, YouTube comments, Quora answers, and most pages with comments.
Tip: select some text first to analyse only that part.

HOW TO USE
1. Install. No sign-up, no API key: you get 5 free analyses every day.
2. Open a review page, Reddit thread or YouTube video (scroll to load comments).
3. Click the Review Lens icon or press Alt+Shift+R.
Power users: add your own free Gemini key in Settings for unlimited analyses.

PRIVATE BY DESIGN
• Reads a page only when you click the icon.
• The text is analysed by Google Gemini and is never stored. No accounts, no tracking.
• Your results stay in your browser.

Built for product managers, founders, researchers and shoppers who want the signal, not the noise.
```

**Screenshots (1280x800):** upload in this order
1. `store/1-report.png`: AI summary and themes for an app's reviews
2. `store/2-themes.png`: verified quotes behind a theme
3. `store/3-compare.png`: two apps compared side by side
4. `store/4-settings.png`: welcome page, no sign-up needed

**Store icon (128x128):** `extension/icons/icon128.png`

**Official URL / Homepage:** https://github.com/Deep0976/student-voice-copilot

**Support URL:** https://github.com/Deep0976/student-voice-copilot/issues

## Privacy tab

**Single purpose:**
Summarise the reviews and comments on the current web page into themes, an overview and verified quotes, and compare those summaries across pages.

**Permission justifications:**
- `activeTab`: read the current tab's text, only after the user clicks the extension icon or presses its shortcut.
- `scripting`: run a one-off function in the current tab on click to collect its visible text or comments.
- `storage`: keep a random install ID (for the free daily limit), the optional own Gemini key, settings and the last 20 analyses in the browser.
- Host permission `https://generativelanguage.googleapis.com/*`: if the user adds their own key, send the page text directly to Google's Gemini API.
- (No permission needed for the free-tier server: it allows cross-origin requests.)

**Remote code:** No, I am not using remote code. (All JavaScript ships in the package; Gemini returns JSON data only.)

**Data usage, tick:**
- [x] Website content (the text of the page the user chooses to analyse)
- [x] Authentication information (only if the user adds their own Gemini key; stored locally)
- Everything else: leave unticked.

**Certify all three:**
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://deep0976.github.io/student-voice-copilot/privacy.html

## Distribution tab
- Visibility: **Public** (or **Unlisted** first, to test the store install with friends before going public)
- Regions: All regions
- Pricing: Free
