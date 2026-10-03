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

## Evals

`analyze.py` writes `data/eval_sample.csv` (100 random reviews). Fill `human_theme` / `human_churn`, then run
`.venv/bin/python eval.py` for theme accuracy, churn precision/recall and the most common confusions.
`test_analyze.py` checks the attribution and counting guardrails.
