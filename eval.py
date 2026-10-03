"""Score the AI's tags against your hand labels in data/eval_sample.csv.

Fill human_theme (exact theme name) and human_churn (true/false) for each row, then run this.
"""
import csv
from collections import Counter

rows = [r for r in csv.DictReader(open("data/eval_sample.csv")) if r["human_theme"].strip()]
if not rows:
    raise SystemExit("No hand labels yet: fill human_theme / human_churn in data/eval_sample.csv")

truthy = lambda s: s.strip().lower() in ("true", "1", "yes", "y")
theme_ok = sum(r["pred_theme"] == r["human_theme"].strip() for r in rows)
tp = sum(truthy(r["pred_churn"]) and truthy(r["human_churn"]) for r in rows)
fp = sum(truthy(r["pred_churn"]) and not truthy(r["human_churn"]) for r in rows)
fn = sum(not truthy(r["pred_churn"]) and truthy(r["human_churn"]) for r in rows)

print(f"labelled rows:    {len(rows)}")
print(f"theme accuracy:   {theme_ok / len(rows):.0%}")
print(f"churn precision:  {tp / (tp + fp):.0%}" if tp + fp else "churn precision:  n/a (no predicted churn)")
print(f"churn recall:     {tp / (tp + fn):.0%}" if tp + fn else "churn recall:     n/a (no labelled churn)")
print("\nmost common mistakes (AI -> you):")
for (p, h), n in Counter((r["pred_theme"], r["human_theme"].strip()) for r in rows if r["pred_theme"] != r["human_theme"].strip()).most_common(5):
    print(f"  {n}x  {p}  ->  {h}")
