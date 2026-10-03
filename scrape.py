"""Pull the newest Play Store reviews for Indian edtech apps -> data/reviews.json"""
import json, os
from google_play_scraper import reviews, Sort

APPS = {
    "PW": "xyz.penpencil.physicswala",
    "Vedantu": "com.vedantu.app",
    "Unacademy": "com.unacademyapp",
    "ALLEN": "digital.allen.study",
}
PER_APP = int(os.getenv("PER_APP", 500))

out = []
for name, pid in APPS.items():
    rows, _ = reviews(pid, lang="en", country="in", sort=Sort.NEWEST, count=PER_APP)
    for r in rows:
        out.append({
            "id": r["reviewId"],
            "app": name,
            "rating": r["score"],
            "date": r["at"].strftime("%Y-%m-%d"),
            "thumbs": r["thumbsUpCount"],
            "version": r["reviewCreatedVersion"],
            "text": (r["content"] or "").strip(),
        })
    print(f"{name}: {len(rows)} reviews")

os.makedirs("data", exist_ok=True)
json.dump(out, open("data/reviews.json", "w"), ensure_ascii=False, indent=1)
print(f"saved {len(out)} -> data/reviews.json")
