from analyze import OTHER, aggregate, verify_quote

assert verify_quote("live class  BUFFERING", "Bhai live class buffering bahut hoti hai")
assert not verify_quote("classes keep lagging", "Bhai live class buffering bahut hoti hai")  # paraphrase rejected
assert not verify_quote("", "anything")
assert not verify_quote("bhai", "bhai bhai")  # single word is not evidence

revs = [
    {"id": "a", "app": "PW", "rating": 1, "date": "2026-10-01", "thumbs": 3, "text": "refund nahi mila, uninstalling"},
    {"id": "b", "app": "ALLEN", "rating": 2, "date": "2026-10-01", "thumbs": 0, "text": "refund process is slow"},
    {"id": "c", "app": "PW", "rating": 5, "date": "2026-10-01", "thumbs": 0, "text": "nice teachers here"},
]
tags = {
    "a": {"theme": "Refunds", "sentiment": "neg", "churn": True, "quote": "refund nahi mila"},
    "b": {"theme": "Refunds", "sentiment": "neg", "churn": False, "quote": "refunds are slow"},  # hallucinated
    "c": {"theme": OTHER, "sentiment": "pos", "churn": False, "quote": "nice teachers"},
}
rows, bad = aggregate(revs, tags)
ref = rows[0]
assert ref["name"] == "Refunds" and ref["count"] == 2 and ref["churn"] == 1
assert ref["by_app"] == {"PW": 1, "ALLEN": 1} and ref["avg_rating"] == 1.5
assert [q["id"] for q in ref["quotes"]] == ["a"] and bad == 1
assert ref["confidence"] == "low" and rows[-1]["name"] == OTHER
print("ok")
