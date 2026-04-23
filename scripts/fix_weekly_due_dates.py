"""Backfill weekly quests: set due_date to this Sunday."""
import datetime
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.firestore_service import FirestoreQuestService
from google.cloud.firestore_v1.base_query import FieldFilter

credential_setting = (
    os.getenv("FIREBASE_SERVICE_ACCOUNT") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
)
credential_path = None
if credential_setting:
    candidate = Path(credential_setting)
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    credential_path = str(candidate)

svc = FirestoreQuestService(
    project_id=os.getenv("GOOGLE_CLOUD_PROJECT") or None,
    credential_path=credential_path,
)

today = datetime.date.today()
days_to_sunday = (6 - today.weekday()) % 7 or 7
this_sunday = (today + datetime.timedelta(days=days_to_sunday)).isoformat()
print(f"This Sunday: {this_sunday}")

docs = svc.db.collection("quests").where(filter=FieldFilter("is_active", "==", True)).stream()
updated = 0
for doc in docs:
    d = doc.to_dict() or {}
    if d.get("category") == "weekly":
        doc.reference.set({"due_date": this_sunday}, merge=True)
        updated += 1
        print(f"  updated: {d.get('title')} -> {this_sunday}")

print(f"Done. {updated} weekly quests updated.")
