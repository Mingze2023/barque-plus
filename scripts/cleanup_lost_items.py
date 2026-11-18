"""
Deletes Lost Items older than 14 days from Firestore, for good.

Run by the daily GitHub Action. It signs in to Firebase with a service
account key stored as the GitHub secret FIREBASE_SERVICE_ACCOUNT (see
SETUP.md, Part L). Without that secret it does nothing; the website still
hides old entries on its own.
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

MAX_AGE_DAYS = 14


def main():
    key = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "").strip()
    if not key:
        print("No FIREBASE_SERVICE_ACCOUNT secret yet, so old lost items weren't deleted. (See SETUP.md, Part L.)")
        return 0
    try:
        info = json.loads(key)
    except json.JSONDecodeError:
        print("The FIREBASE_SERVICE_ACCOUNT secret isn't valid JSON. Paste the whole key file, including { and }.")
        return 1

    import firebase_admin
    from firebase_admin import credentials, firestore

    firebase_admin.initialize_app(credentials.Certificate(info))
    db = firestore.client()
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)

    items = db.collection("lostItems")
    try:
        from google.cloud.firestore_v1.base_query import FieldFilter
        query = items.where(filter=FieldFilter("createdAt", "<", cutoff))
    except ImportError:   # older library
        query = items.where("createdAt", "<", cutoff)
    old = list(query.stream())
    for start in range(0, len(old), 400):
        batch = db.batch()
        for doc in old[start:start + 400]:
            batch.delete(doc.reference)
        batch.commit()
    print(f"Deleted {len(old)} lost item(s) older than {MAX_AGE_DAYS} days.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
