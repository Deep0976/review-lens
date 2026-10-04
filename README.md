# Student Voice Copilot

Turns Play Store reviews of Indian edtech apps (PW, Vedantu, Unacademy, ALLEN) into themes, churn signals
and a ranked roadmap. Every insight links back to the exact review it came from.

## Run

```bash
uv venv && uv pip install -r requirements.txt
cp .env.example .env            # add a free key from https://aistudio.google.com/apikey
.venv/bin/python scrape.py      # -> data/reviews.json (PER_APP=500 by default)
.venv/bin/python analyze.py     # -> docs/insights.json
python3 -m http.server -d docs  # open http://localhost:8000
```

## How it works

1. **Cluster:** Gemini proposes 8-12 actionable themes from a 200-review sample (`data/themes.json`; delete it to re-cluster).
2. **Tag:** each review gets a theme, sentiment, churn flag and an exact quote (cached in `data/tags.json`, so a rate-limited run resumes).
3. **Recommend:** Gemini drafts the top 5 roadmap items from the theme table.

## Guardrails

- All counts are computed in code, never by the LLM.
- A quote is shown only if it's an exact substring of its review. The attribution rate is shown on the dashboard.
- Roadmap evidence ids must belong to the cited theme. Recommendations without valid evidence are marked low confidence.
- Themes backed by fewer than 10 reviews are flagged low confidence.

## Review Lens (Chrome extension)

The same idea on any page: click the icon on a Reddit thread, Quora answer, Play Store, Amazon or G2 page and get
themes, an AI summary and quotes verified against the page. Select some text first to analyse only that part.
Every analysis is saved, so you can compare 2-4 pages side by side (e.g. PW vs Unacademy threads).

**Install:** open `chrome://extensions` (or `brave://extensions`), turn on **Developer mode**, click
**Load unpacked** and pick the `extension/` folder. No sign-up or key needed: 5 free analyses a day.
Shortcut: **Alt+Shift+R**. Store package: `extension/build.sh` builds `dist/review-lens-<version>.zip`.

- Same guardrails as the dashboard: counts come from code, quotes must appear on the page, and each quote has an
  "open on page" link that scrolls to and highlights it.
- On YouTube and Reddit it reads only the comments (scroll to load them first).
- `node extension/test.mjs` checks the guardrails; pass saved `{title,url,text}` JSON files to also run a live analysis.

### Free tier server

```
extension -> review-lens-app.netlify.app (proxy/) -> review-lens.deep0976.workers.dev (worker/) -> Gemini
```

- `worker/` is a Cloudflare Worker holding the Gemini key as a secret. It builds the prompts itself (so it can't be
  used as a general AI proxy), allows 5 analyses per install per day and 200 per day in total, and falls back across
  free Gemini models. Deploy: `cd worker && npx wrangler deploy`.
- `proxy/` is a one-line Netlify rewrite in front of it, because `*.workers.dev` is blocked on some college and ISP
  networks. Deploy: `cd proxy && npx netlify-cli deploy --prod --dir .`
- Users who add their own Gemini key in Settings skip the server entirely.

## Evals

`analyze.py` writes `data/eval_sample.csv` (100 random reviews). Fill `human_theme` / `human_churn`, then run
`.venv/bin/python eval.py` for theme accuracy, churn precision/recall and the most common confusions.
`test_analyze.py` checks the attribution and counting guardrails.
