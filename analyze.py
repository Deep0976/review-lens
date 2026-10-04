"""Student Voice Copilot: data/reviews.json -> docs/insights.json

Pass 1: LLM proposes themes from a sample of reviews (clustering).
Pass 2: LLM tags every review with a theme, churn signal and an exact quote.
Pass 3: LLM turns the code-computed theme table into roadmap recommendations.

Guardrails: all counts are computed in code, never by the LLM; a quote is kept only
if it is an exact substring of its review; roadmap evidence ids must belong to the theme.
"""
import csv, json, os, random, re, time, urllib.error, urllib.request
from collections import Counter, defaultdict

MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
BATCH = int(os.getenv("BATCH", 100))  # free tier allows ~20 requests/day/model, so keep calls few
MIN_WORDS = 4
LOW_CONF = 10  # themes backed by fewer reviews are flagged low confidence
OTHER = "Other / unclear"
TAGS = "data/tags.json"  # cache so a rate-limited run resumes instead of restarting


def load_env():
    if os.path.exists(".env"):
        for line in open(".env"):
            k, _, v = line.strip().partition("=")
            if k and not k.startswith("#"):
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def llm(prompt):
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0,
                             # tagging is easy; default "high" thinking made 100-review batches time out
                             "thinkingConfig": {"thinkingLevel": os.getenv("THINKING", "low")}},
    }).encode()
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        data=body,
        headers={"Content-Type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]},
    )
    for attempt in range(6):
        try:
            r = json.load(urllib.request.urlopen(req, timeout=180))
            return json.loads(r["candidates"][0]["content"]["parts"][0]["text"])
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 503) or attempt == 5:
                raise RuntimeError(f"Gemini {e.code}: {e.read().decode()[:300]}")
            print(f"  Gemini {e.code}, retry {attempt + 1}")
        except (json.JSONDecodeError, KeyError, TimeoutError) as e:
            if attempt == 5:
                raise
            print(f"  {type(e).__name__}, retry {attempt + 1}")
        time.sleep(5 * 2 ** attempt)


def norm(s):
    return re.sub(r"\s+", " ", s).strip().casefold()


def verify_quote(quote, text):
    return bool(quote) and len(quote.split()) >= 2 and norm(quote) in norm(text)


def discover_themes(revs):
    sample = random.Random(42).sample(revs, min(200, len(revs)))
    lines = "\n".join(f"- [{r['app']}, {r['rating']}★] {r['text']}" for r in sample)
    out = llm(f"""You are a product manager analysing Play Store reviews of Indian edtech apps
(JEE/NEET/school prep). Many reviews are Hinglish or have spelling mistakes.

Propose 10-14 themes that cover these reviews. Rules:
- Each theme must be narrow enough that ONE team could own the fix. Split broad buckets:
  not "App performance" but "Video buffering in classes", "Crashes / force close", "Slow loading / login";
  not "Bad support" but "Refund not processed", "No reply from support".
- Generic praise ("nice app", "best teachers") is one theme at most.
- Include positive themes (what students value) as well as pain points.
- Themes must not overlap.

Return JSON: {{"themes": [{{"name": "...", "description": "one line: what belongs here"}}]}}

Reviews:
{lines}""")
    return out["themes"] + [{"name": OTHER, "description": "Does not fit any theme or is too vague"}]


def tag_reviews(revs, themes):
    current = {r["id"] for r in revs}
    tags = json.load(open(TAGS)) if os.path.exists(TAGS) else {}
    tags = {k: v for k, v in tags.items() if k in current}  # drop reviews no longer in reviews.json
    names = {t["name"] for t in themes}
    if tags and any(t["theme"] not in names for t in tags.values()):
        tags = {}  # themes changed since the cache was written
    todo = [r for r in revs if r["id"] not in tags]
    theme_list = "\n".join(f"- {t['name']}: {t['description']}" for t in themes)
    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        lines = "\n".join(json.dumps({"id": r["id"], "rating": r["rating"], "text": r["text"]}, ensure_ascii=False) for r in batch)
        out = llm(f"""Tag each Play Store review of an Indian edtech app.

Themes (use the exact name):
{theme_list}

For every review return:
- theme: the single best theme name from the list
- sentiment: "pos", "neg" or "mixed"
- churn: true only if the student says they will uninstall / have uninstalled, want a refund,
  are cancelling, switching to another app, or call it a waste of money. Otherwise false.
- quote: the shortest EXACT phrase copied character-for-character from the review that shows the theme.
  Do not translate, fix spelling or paraphrase.

Return JSON: {{"results": [{{"id": "...", "theme": "...", "sentiment": "...", "churn": false, "quote": "..."}}]}}

Reviews (JSON lines):
{lines}""")
        ids = {r["id"] for r in batch}
        for t in out["results"]:
            if t.get("id") in ids:
                t["theme"] = t.get("theme") if t.get("theme") in names else OTHER
                tags[t["id"]] = t
        json.dump(tags, open(TAGS, "w"), ensure_ascii=False)
        print(f"tagged {min(i + BATCH, len(todo))}/{len(todo)}")
    return tags


def aggregate(revs, tags):
    by_id = {r["id"]: r for r in revs}
    themes = defaultdict(lambda: {"count": 0, "by_app": Counter(), "ratings": [], "churn": 0, "neg": 0, "quotes": []})
    bad_quotes = 0
    for rid, t in tags.items():
        r = by_id.get(rid)
        if not r:
            continue
        th = themes[t["theme"]]
        th["count"] += 1
        th["by_app"][r["app"]] += 1
        th["ratings"].append(r["rating"])
        th["churn"] += bool(t.get("churn"))
        th["neg"] += t.get("sentiment") == "neg"
        if verify_quote(t.get("quote", ""), r["text"]):
            th["quotes"].append({"id": rid, "app": r["app"], "rating": r["rating"], "date": r["date"],
                                 "thumbs": r["thumbs"], "quote": t["quote"], "text": r["text"], "churn": bool(t.get("churn"))})
        else:
            bad_quotes += 1
    rows = []
    for name, th in themes.items():
        th["quotes"].sort(key=lambda q: (-q["thumbs"], q["rating"]))
        rows.append({
            "name": name, "count": th["count"], "by_app": dict(th["by_app"]),
            "avg_rating": round(sum(th["ratings"]) / len(th["ratings"]), 2),
            "churn": th["churn"], "neg_share": round(th["neg"] / th["count"], 2),
            "confidence": "low" if th["count"] < LOW_CONF else "ok",
            "quotes": th["quotes"],
        })
    rows.sort(key=lambda x: (x["name"] == OTHER, -x["count"]))
    return rows, bad_quotes


def recommend(rows):
    table = [{"theme": r["name"], "reviews": r["count"], "by_app": r["by_app"], "avg_rating": r["avg_rating"],
              "churn_mentions": r["churn"], "neg_share": r["neg_share"],
              "evidence": [{"id": q["id"], "app": q["app"], "quote": q["quote"]} for q in r["quotes"][:8]]}
             for r in rows if r["name"] != OTHER]
    out = llm(f"""You are a senior PM at an Indian edtech company. Below is a theme table computed from
Play Store reviews of PW, Vedantu, Unacademy and ALLEN. Counts are exact; do not invent numbers.

Recommend the top 5 roadmap items, ranked by (reviews affected x severity x churn risk).
Pain points come first; use positive themes only if they reveal a gap a competitor can exploit.
For each item cite 2-4 evidence ids, taken ONLY from that theme's evidence list.

Return JSON: {{"recommendations": [{{"title": "...", "theme": "exact theme name", "problem": "1-2 lines citing the counts",
"proposal": "what to build or change", "metric": "how we would know it worked", "evidence_ids": ["..."]}}]}}

Theme table:
{json.dumps(table, ensure_ascii=False)}""")
    by_theme = {r["name"]: r for r in rows}
    recs = []
    for rec in out["recommendations"]:
        th = by_theme.get(rec.get("theme"))
        if not th:
            continue  # guardrail: recommendation must map to a real theme
        valid = {q["id"] for q in th["quotes"]}
        rec["evidence_ids"] = [i for i in rec.get("evidence_ids", []) if i in valid]
        rec["confidence"] = th["confidence"] if rec["evidence_ids"] else "low"
        recs.append(rec)
    return recs


def write_eval_sample(revs, tags, path="data/eval_sample.csv", n=100):
    if os.path.exists(path):
        return  # never overwrite human labels
    picked = random.Random(7).sample([r for r in revs if r["id"] in tags], min(n, len(tags)))
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "app", "rating", "text", "pred_theme", "pred_churn", "human_theme", "human_churn"])
        for r in picked:
            t = tags[r["id"]]
            w.writerow([r["id"], r["app"], r["rating"], r["text"], t["theme"], t.get("churn", False), "", ""])


def main():
    load_env()
    if not os.getenv("GEMINI_API_KEY"):
        raise SystemExit("Set GEMINI_API_KEY in .env (free key: https://aistudio.google.com/apikey)")
    allrevs = json.load(open("data/reviews.json"))
    revs = [r for r in allrevs if len(r["text"].split()) >= MIN_WORDS]

    if os.path.exists("data/themes.json"):
        themes = json.load(open("data/themes.json"))  # delete to re-cluster
    else:
        themes = discover_themes(revs)
        json.dump(themes, open("data/themes.json", "w"), ensure_ascii=False, indent=1)
    print("themes:", [t["name"] for t in themes])

    tags = tag_reviews(revs, themes)
    rows, bad_quotes = aggregate(revs, tags)
    recs = recommend(rows)
    write_eval_sample(revs, tags)

    apps = defaultdict(list)
    for r in allrevs:
        apps[r["app"]].append(r["rating"])
    insights = {
        "model": MODEL,
        "updated": time.strftime("%d|%m|%Y"),
        "date_range": [min(r["date"] for r in allrevs), max(r["date"] for r in allrevs)],
        "total_reviews": len(allrevs),
        "skipped_short": len(allrevs) - len(revs),
        "analyzed": len(tags),
        "quote_attribution_rate": round(1 - bad_quotes / max(len(tags), 1), 3),
        "churn_reviews": sum(bool(t.get("churn")) for t in tags.values()),
        "apps": {a: {"reviews": len(v), "avg_rating": round(sum(v) / len(v), 2)} for a, v in apps.items()},
        "themes": rows,
        "recommendations": recs,
    }
    os.makedirs("docs", exist_ok=True)
    json.dump(insights, open("docs/insights.json", "w"), ensure_ascii=False, indent=1)
    print(f"done: {len(rows)} themes, {len(recs)} recs, attribution {insights['quote_attribution_rate']:.1%} -> docs/insights.json")


if __name__ == "__main__":
    main()
