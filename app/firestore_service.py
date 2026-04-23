from __future__ import annotations

import os
import random
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from dataclasses import dataclass
from typing import Any

TZ_TAIPEI = timezone(timedelta(hours=8))

def _today_taipei() -> str:
    """Return today's date in Asia/Taipei (UTC+8) as YYYY-MM-DD string."""
    return datetime.now(tz=TZ_TAIPEI).date().isoformat()

import firebase_admin
from firebase_admin import credentials as fb_credentials
from google.cloud import firestore
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from google.cloud.firestore_v1.base_query import FieldFilter


@dataclass
class ActionResult:
    ok: bool
    message: str
    points: int


class FirestoreQuestService:
    def __init__(
        self,
        project_id: str | None = None,
        credential_path: str | None = None,
        credential_dict: dict | None = None,
    ) -> None:
        self.project_root = Path(__file__).resolve().parents[1]
        resolved_credential_path: str | None = None

        # Priority 1: credential dict (from env var JSON string on Render)
        if credential_dict:
            if not firebase_admin._apps:
                firebase_admin.initialize_app(fb_credentials.Certificate(credential_dict))
            self.db = firestore.Client.from_service_account_info(
                credential_dict,
                project=project_id,
            )
            return

        # Priority 2: credential file path (local dev)
        if credential_path:
            path = Path(credential_path).expanduser()
            if path.exists():
                resolved_credential_path = str(path.resolve())
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = resolved_credential_path
                if not firebase_admin._apps:
                    firebase_admin.initialize_app(fb_credentials.Certificate(resolved_credential_path))

        if resolved_credential_path:
            self.db = firestore.Client.from_service_account_json(
                resolved_credential_path,
                project=project_id,
            )
        else:
            self.db = firestore.Client(project=project_id) if project_id else firestore.Client()

    def get_quests(self, include_future: bool = False) -> list[dict[str, Any]]:
        docs = (
            self.db.collection("quests")
            .where(filter=FieldFilter("is_active", "==", True))
            .stream()
        )
        today = _today_taipei()
        quests = []
        for doc in docs:
            item = doc.to_dict()
            published_date = str(item.get("published_date") or "")
            if not include_future and published_date and published_date > today:
                continue
            item["id"] = doc.id
            quests.append(item)
        # sort: sort_order desc (higher = shown first), then published_date desc
        quests.sort(key=lambda q: str(q.get("published_date") or ""), reverse=True)
        quests.sort(key=lambda q: int(q.get("sort_order") or 0), reverse=True)
        return quests

    @staticmethod
    def _compute_due_date(category: str, published_date: str, explicit_due: str) -> str:
        """Return the appropriate due_date string.
        - weekly quests: end of the current week (Sunday 23:59 → represented as that Sunday's date)
        - daily quests: same as published_date (today)
        - others: use explicit_due if given, else published_date
        """
        if category == "weekly":
            today = datetime.now(tz=TZ_TAIPEI).date()
            # weekday(): Monday=0, Sunday=6 → days until Sunday
            days_to_sunday = (6 - today.weekday()) % 7
            if days_to_sunday == 0:
                days_to_sunday = 7  # if today IS Sunday, go to next Sunday
            return (today + timedelta(days=days_to_sunday)).isoformat()
        if explicit_due:
            return explicit_due
        if category == "daily":
            return published_date
        return published_date

    def create_quest(self, payload: dict[str, Any]) -> dict[str, Any]:
        category = payload.get("category", "other")
        raw_published = str(payload.get("published_date") or "").strip()
        if raw_published:
            published_date = raw_published
        elif category in ("event", "other"):
            published_date = ""
        else:
            published_date = _today_taipei()
        due_date = self._compute_due_date(category, published_date, payload.get("due_date") or "")
        data = {
            "title": payload["title"],
            "description": payload["description"],
            "points": payload["points"],
            "difficulty": payload.get("difficulty", "easy"),
            "category": category,
            "published_date": published_date,
            "due_date": due_date,
            "sort_order": int(payload.get("sort_order") or 0),
            "is_active": True,
            "created_at": SERVER_TIMESTAMP,
            "updated_at": SERVER_TIMESTAMP,
        }
        ref = self.db.collection("quests").document()
        ref.set(data)
        data["id"] = ref.id
        return data

    def update_quest(self, quest_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        ref = self.db.collection("quests").document(quest_id)
        snapshot = ref.get()
        if not snapshot.exists:
            return {"ok": False, "message": "任務不存在"}

        category = payload.get("category", "other")
        raw_published = str(payload.get("published_date") or "").strip()
        if raw_published:
            published_date = raw_published
        elif category in ("event", "other"):
            published_date = ""
        else:
            published_date = _today_taipei()
        due_date = self._compute_due_date(category, published_date, payload.get("due_date") or "")
        ref.set(
            {
                "title": payload["title"],
                "description": payload["description"],
                "points": payload["points"],
                "difficulty": payload.get("difficulty", "easy"),
                "category": category,
                "published_date": published_date,
                "due_date": due_date,
                "updated_at": SERVER_TIMESTAMP,
            },
            merge=True,
        )
        return {"ok": True, "message": "任務更新成功", "id": quest_id}

    def set_quest_sort_order(self, quest_id: str, sort_order: int) -> dict[str, Any]:
        ref = self.db.collection("quests").document(quest_id)
        if not ref.get().exists:
            return {"ok": False, "message": "任務不存在"}
        ref.set({"sort_order": sort_order, "updated_at": SERVER_TIMESTAMP}, merge=True)
        return {"ok": True, "message": "排序已更新"}

    def deactivate_quest(self, quest_id: str) -> dict[str, Any]:
        ref = self.db.collection("quests").document(quest_id)
        snapshot = ref.get()
        if not snapshot.exists:
            return {"ok": False, "message": "任務不存在"}

        self._record_deleted_quest(snapshot.to_dict() or {}, quest_id, reason="manual")
        ref.set({"is_active": False, "updated_at": SERVER_TIMESTAMP}, merge=True)
        return {"ok": True, "message": "任務已刪除", "id": quest_id}

    def _record_deleted_quest(self, quest: dict[str, Any], quest_id: str, reason: str) -> None:
        ref = self.db.collection("deleted_quests_log").document()
        ref.set(
            {
                "quest_id": quest_id,
                "title": quest.get("title", ""),
                "description": quest.get("description", ""),
                "difficulty": quest.get("difficulty", "easy"),
                "points": int(quest.get("points", 0)),
                "template_id": quest.get("template_id", ""),
                "reason": reason,
                "deleted_at": SERVER_TIMESTAMP,
            }
        )

    def batch_deactivate_quests(self, quest_ids: list[str]) -> dict[str, Any]:
        deleted_count = 0
        for quest_id in quest_ids:
            result = self.deactivate_quest(quest_id)
            if result.get("ok"):
                deleted_count += 1
        return {"ok": True, "message": f"已刪除 {deleted_count} 筆任務", "deleted_count": deleted_count}

    def deactivate_all_quests(self) -> dict[str, Any]:
        docs = (
            self.db.collection("quests")
            .where(filter=FieldFilter("is_active", "==", True))
            .stream()
        )
        ids = [doc.id for doc in docs]
        return self.batch_deactivate_quests(ids)

    def get_recent_deleted_quests(self) -> list[dict[str, Any]]:
        docs = self.db.collection("deleted_quests_log").stream()
        items: list[dict[str, Any]] = []
        for doc in docs:
            item = doc.to_dict() or {}
            item["id"] = doc.id
            items.append(item)
        items.sort(key=lambda d: str(d.get("deleted_at", "")), reverse=True)
        return items[:50]

    def restore_deleted_quest(self, log_id: str) -> dict[str, Any]:
        log_ref = self.db.collection("deleted_quests_log").document(log_id)
        log_snap = log_ref.get()
        if not log_snap.exists:
            return {"ok": False, "message": "刪除紀錄不存在"}
        log_data = log_snap.to_dict() or {}
        quest_id = log_data.get("quest_id", "")
        if quest_id:
            quest_ref = self.db.collection("quests").document(quest_id)
            quest_snap = quest_ref.get()
            if quest_snap.exists:
                quest_ref.set({"is_active": True, "updated_at": SERVER_TIMESTAMP}, merge=True)
        log_ref.delete()
        return {"ok": True, "message": "任務已回復"}

    def permanently_delete_deleted_quest(self, log_id: str) -> dict[str, Any]:
        log_ref = self.db.collection("deleted_quests_log").document(log_id)
        if not log_ref.get().exists:
            return {"ok": False, "message": "刪除紀錄不存在"}
        log_ref.delete()
        return {"ok": True, "message": "已永久刪除"}

    def permanently_delete_all_deleted_quests(self) -> dict[str, Any]:
        docs = list(self.db.collection("deleted_quests_log").stream())
        for doc in docs:
            doc.reference.delete()
        return {"ok": True, "message": f"已清除 {len(docs)} 筆刪除紀錄", "count": len(docs)}

    def get_quest_templates(self) -> list[dict[str, Any]]:
        docs = (
            self.db.collection("quest_templates")
            .where(filter=FieldFilter("is_active", "==", True))
            .stream()
        )
        items: list[dict[str, Any]] = []
        for doc in docs:
            item = doc.to_dict() or {}
            item["id"] = doc.id
            items.append(item)
        items.sort(key=lambda t: str(t.get("created_at", "")), reverse=True)
        return items

    def create_quest_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        ref = self.db.collection("quest_templates").document()
        data = {
            "title": payload["title"],
            "description": payload["description"],
            "points": int(payload["points"]),
            "difficulty": payload.get("difficulty", "easy"),
            "category": payload.get("category", "other"),
            "due_days": int(payload.get("due_days", 7)),
            "is_active": True,
            "created_at": SERVER_TIMESTAMP,
            "updated_at": SERVER_TIMESTAMP,
        }
        ref.set(data)
        return {"ok": True, "id": ref.id, "message": "任務資料庫新增成功"}

    def deactivate_quest_template(self, template_id: str) -> dict[str, Any]:
        template_ref = self.db.collection("quest_templates").document(template_id)
        if not template_ref.get().exists:
            return {"ok": False, "message": "任務資料不存在"}

        template_ref.set({"is_active": False, "updated_at": SERVER_TIMESTAMP}, merge=True)

        quest_docs = (
            self.db.collection("quests")
            .where(filter=FieldFilter("template_id", "==", template_id))
            .where(filter=FieldFilter("is_active", "==", True))
            .stream()
        )
        removed = 0
        for doc in quest_docs:
            quest = doc.to_dict() or {}
            self._record_deleted_quest(quest, doc.id, reason="template_deleted")
            doc.reference.set({"is_active": False, "updated_at": SERVER_TIMESTAMP}, merge=True)
            removed += 1

        return {"ok": True, "message": f"任務資料已刪除，並移除 {removed} 筆玩家任務", "removed_count": removed}

    def spawn_quest_from_template(self, template_id: str) -> dict[str, Any]:
        template_ref = self.db.collection("quest_templates").document(template_id)
        snapshot = template_ref.get()
        if not snapshot.exists:
            return {"ok": False, "message": "任務資料不存在"}
        template = snapshot.to_dict() or {}
        if not template.get("is_active", True):
            return {"ok": False, "message": "任務資料已停用"}

        category_prefix = {
            "daily": "每日",
            "weekly": "每週",
            "event": "活動",
            "other": "其他",
        }.get(str(template.get("category", "other")), "其他")

        published = _today_taipei()
        due_days = int(template.get("due_days", 7))
        today_dt = datetime.now(tz=TZ_TAIPEI).date()
        due = (today_dt + timedelta(days=max(0, due_days))).isoformat()

        quest_ref = self.db.collection("quests").document()
        quest_ref.set(
            {
                "title": f"{category_prefix}：{template.get('title', '')}",
                "description": template.get("description", ""),
                "points": int(template.get("points", 0)),
                "difficulty": template.get("difficulty", "easy"),
                "published_date": published,
                "due_date": due,
                "template_id": template_id,
                "is_active": True,
                "created_at": SERVER_TIMESTAMP,
                "updated_at": SERVER_TIMESTAMP,
            }
        )
        return {"ok": True, "message": "已從資料庫新增任務", "id": quest_ref.id}

    def get_quest_refresh_settings(self) -> dict[str, Any]:
        ref = self.db.collection("meta").document("quest_refresh_settings")
        snap = ref.get()
        data = snap.to_dict() if snap.exists else {}
        return {
            "daily_count": int(data.get("daily_count", 5)),
            "weekly_count": int(data.get("weekly_count", 10)),
        }

    def update_quest_refresh_settings(self, payload: dict[str, Any]) -> dict[str, Any]:
        ref = self.db.collection("meta").document("quest_refresh_settings")
        ref.set(
            {
                "daily_count": int(payload.get("daily_count", 5)),
                "weekly_count": int(payload.get("weekly_count", 10)),
                "updated_at": SERVER_TIMESTAMP,
            },
            merge=True,
        )
        return {"ok": True, "message": "任務刷新設定已更新"}

    def refresh_quests_from_templates(self) -> dict[str, Any]:
        settings = self.get_quest_refresh_settings()
        daily_count = int(settings.get("daily_count", 5))
        weekly_count = int(settings.get("weekly_count", 10))

        templates = self.get_quest_templates()
        daily = [t for t in templates if str(t.get("category", "")) == "daily"]
        weekly = [t for t in templates if str(t.get("category", "")) == "weekly"]

        picks: list[dict[str, Any]] = []
        if daily and daily_count > 0:
            picks.extend(random.sample(daily, k=min(daily_count, len(daily))))
        if weekly and weekly_count > 0:
            picks.extend(random.sample(weekly, k=min(weekly_count, len(weekly))))

        created = 0
        for t in picks:
            result = self.spawn_quest_from_template(str(t.get("id", "")))
            if result.get("ok"):
                created += 1

        return {"ok": True, "message": f"已刷新任務 {created} 筆", "created_count": created}

    def deactivate_reward(self, reward_id: str) -> dict[str, Any]:
        ref = self.db.collection("rewards").document(reward_id)
        if not ref.get().exists:
            return {"ok": False, "message": "獎勵不存在"}
        ref.set({"is_active": False}, merge=True)
        return {"ok": True, "message": "獎勵已刪除", "id": reward_id}

    def update_reward(self, reward_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        ref = self.db.collection("rewards").document(reward_id)
        snapshot = ref.get()
        if not snapshot.exists:
            return {"ok": False, "message": "獎勵不存在"}

        ref.set(
            {
                "title": payload["title"],
                "description": payload["description"],
                "cost_points": int(payload["cost_points"]),
                "image_path": payload.get("image_path", ""),
                "updated_at": SERVER_TIMESTAMP,
            },
            merge=True,
        )
        return {"ok": True, "message": "獎勵更新成功", "id": reward_id}

    def get_announcements(self) -> list[dict[str, Any]]:
        docs = (
            self.db.collection("announcements")
            .where(filter=FieldFilter("is_active", "==", True))
            .stream()
        )
        items: list[dict[str, Any]] = []
        for doc in docs:
            item = doc.to_dict()
            item["id"] = doc.id
            items.append(item)
        items.sort(key=lambda a: str(a.get("created_at", "")), reverse=True)
        return items

    def create_announcement(self, payload: dict[str, Any]) -> dict[str, Any]:
        data: dict[str, Any] = {
            "title": payload["title"],
            "content": payload["content"],
            "ann_type": payload.get("ann_type", "system"),
            "event_time": payload.get("event_time", ""),
            "is_active": True,
            "created_at": SERVER_TIMESTAMP,
        }
        ref = self.db.collection("announcements").document()
        ref.set(data)
        data["id"] = ref.id
        return data

    def delete_announcement(self, announcement_id: str) -> dict[str, Any]:
        ref = self.db.collection("announcements").document(announcement_id)
        if not ref.get().exists:
            return {"ok": False, "message": "公告不存在"}
        ref.set({"is_active": False}, merge=True)
        return {"ok": True, "message": "公告已刪除"}

    def get_rewards(self) -> list[dict[str, Any]]:
        docs = (
            self.db.collection("rewards")
            .where(filter=FieldFilter("is_active", "==", True))
            .stream()
        )
        rewards = []
        for doc in docs:
            item = doc.to_dict()
            item["id"] = doc.id
            rewards.append(item)
        rewards.sort(key=lambda r: r.get("cost_points", 0))
        return rewards

    def get_claims(self) -> list[dict[str, Any]]:
        docs = self.db.collection_group("claimed_rewards").stream()
        claims = []
        for doc in docs:
            item = doc.to_dict()
            item["id"] = doc.id
            item["reward_id"] = doc.id
            # Path format: users/{user_id}/claimed_rewards/{reward_id}
            path_parts = doc.reference.path.split("/")
            if len(path_parts) >= 2:
                item["user_id"] = path_parts[1]
            claims.append(item)

        status_order = {"claimed": 0, "delivered": 1, "completed": 2}
        claims.sort(
            key=lambda c: (
                status_order.get(c.get("status", "claimed"), 0),
                str(c.get("claimed_at", "")),
            )
        )
        return claims

    def get_claims_by_user(self, user_id: str) -> list[dict[str, Any]]:
        docs = (
            self.db.collection("users")
            .document(user_id)
            .collection("claimed_rewards")
            .stream()
        )
        claims: list[dict[str, Any]] = []
        for doc in docs:
            item = doc.to_dict() or {}
            item["id"] = doc.id
            item["reward_id"] = doc.id
            item["user_id"] = user_id
            claims.append(item)

        status_order = {"claimed": 0, "delivered": 1, "completed": 2}
        claims.sort(
            key=lambda c: (
                status_order.get(c.get("status", "claimed"), 0),
                str(c.get("claimed_at", "")),
            )
        )
        return claims

    def create_reward(self, payload: dict[str, Any]) -> dict[str, Any]:
        title = payload["title"]
        description = payload["description"]
        cost_points = payload["cost_points"]
        image_path = payload.get("image_path", "")
        ref = self.db.collection("rewards").document()
        ref.set({
            "title": title,
            "description": description,
            "cost_points": cost_points,
            "image_path": image_path,
            "is_active": True,
            "created_at": SERVER_TIMESTAMP,
        })
        return {
            "id": ref.id,
            "title": title,
            "description": description,
            "cost_points": cost_points,
            "image_path": image_path,
            "is_active": True,
        }

    def _stats_ref(self, user_id: str):
        return self.db.collection("users").document(user_id).collection("meta").document("stats")

    def _extract_iso_date(self, value: Any) -> str:
        if isinstance(value, datetime):
            return value.date().isoformat()
        if hasattr(value, "date") and callable(getattr(value, "date", None)):
            try:
                return value.date().isoformat()
            except Exception:
                return ""
        if isinstance(value, str) and len(value) >= 10:
            return value[:10]
        return ""

    def _completed_quest_doc_to_item(self, doc, fallback_date: str = "") -> dict[str, Any]:
        data = doc.to_dict() or {}
        completed_date = self._extract_iso_date(data.get("completed_at")) or fallback_date
        return {
            "quest_id": doc.id,
            "title": str(data.get("title", "")),
            "points_awarded": int(data.get("points_awarded", 0)),
            "completed_date": completed_date,
        }

    def get_completed_quests_by_date(self, user_id: str, log_date: str) -> list[dict[str, Any]]:
        docs = (
            self.db.collection("users")
            .document(user_id)
            .collection("completed_quests")
            .stream()
        )
        items: list[dict[str, Any]] = []
        for doc in docs:
            item = self._completed_quest_doc_to_item(doc)
            if item.get("completed_date") == log_date:
                items.append(item)
        items.sort(key=lambda x: str(x.get("title", "")))
        return items

    def get_daily_journal(self, user_id: str, log_date: str) -> dict[str, Any]:
        ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("daily_logs")
            .document(log_date)
        )
        snapshot = ref.get()
        if not snapshot.exists:
            return {
                "log_date": log_date,
                "visited_place": "",
                "note": "",
                "completed_quests": [],
                "completed_quest_ids": [],
            }

        data = snapshot.to_dict() or {}
        completed_quests = data.get("completed_quests", [])
        completed_ids = [str(item.get("quest_id", "")) for item in completed_quests if item.get("quest_id")]
        return {
            "log_date": str(data.get("log_date", log_date)),
            "visited_place": str(data.get("visited_place", "")),
            "note": str(data.get("note", "")),
            "completed_quests": completed_quests,
            "completed_quest_ids": completed_ids,
        }

    def upsert_daily_journal(self, user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        log_date = str(payload.get("log_date", "")).strip()
        if not log_date:
            return {"ok": False, "message": "日期不可為空"}

        selected_ids = [str(qid) for qid in payload.get("completed_quest_ids", []) if str(qid).strip()]
        selected_set = set(selected_ids)

        completed_docs = (
            self.db.collection("users")
            .document(user_id)
            .collection("completed_quests")
            .stream()
        )

        completed_quests: list[dict[str, Any]] = []
        for doc in completed_docs:
            if selected_set and doc.id not in selected_set:
                continue
            item = self._completed_quest_doc_to_item(doc, fallback_date=log_date)
            if item.get("completed_date") != log_date:
                continue
            completed_quests.append(item)

        completed_quests.sort(key=lambda x: str(x.get("title", "")))

        ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("daily_logs")
            .document(log_date)
        )
        ref.set(
            {
                "log_date": log_date,
                "visited_place": str(payload.get("visited_place", "")).strip(),
                "note": str(payload.get("note", "")).strip(),
                "completed_quests": completed_quests,
                "updated_at": SERVER_TIMESTAMP,
                "created_at": SERVER_TIMESTAMP,
            },
            merge=True,
        )

        return {
            "ok": True,
            "message": "每日日誌已儲存",
            "log_date": log_date,
            "visited_place": str(payload.get("visited_place", "")).strip(),
            "note": str(payload.get("note", "")).strip(),
            "completed_quests": completed_quests,
            "completed_quest_ids": [item.get("quest_id", "") for item in completed_quests],
        }

    # ── Event Schedules ──────────────────────────────────────────────────

    def get_event_schedules(self) -> list[dict[str, Any]]:
        docs = (
            self.db.collection("event_schedules")
            .where(filter=FieldFilter("is_active", "==", True))
            .stream()
        )
        items: list[dict[str, Any]] = []
        for doc in docs:
            item = doc.to_dict() or {}
            item["id"] = doc.id
            items.append(item)
        items.sort(key=lambda e: str(e.get("start_date", "")), reverse=True)
        return items

    def create_event_schedule(self, payload: dict[str, Any]) -> dict[str, Any]:
        data: dict[str, Any] = {
            "title": payload["title"],
            "description": payload.get("description", ""),
            "start_date": payload["start_date"],
            "end_date": payload["end_date"],
            "point_multiplier": float(payload.get("point_multiplier", 1.0)),
            "announcement_title": payload.get("announcement_title", ""),
            "announcement_content": payload.get("announcement_content", ""),
            "announcement_event_time": payload.get("announcement_event_time", ""),
            "auto_announce": bool(payload.get("auto_announce", True)),
            "is_active": True,
            "created_at": SERVER_TIMESTAMP,
            "updated_at": SERVER_TIMESTAMP,
        }
        ref = self.db.collection("event_schedules").document()
        ref.set(data)

        ann_id: str | None = None
        if payload.get("auto_announce", True) and payload.get("announcement_title", "").strip():
            ann_ref = self.db.collection("announcements").document()
            event_time = (
                payload.get("announcement_event_time", "").strip()
                or f"{payload['start_date']} ～ {payload['end_date']}"
            )
            ann_ref.set({
                "title": payload["announcement_title"],
                "content": payload.get("announcement_content", "") or payload.get("description", ""),
                "ann_type": "event",
                "event_time": event_time,
                "is_active": True,
                "created_at": SERVER_TIMESTAMP,
            })
            ann_id = ann_ref.id

        return {
            "ok": True,
            "message": "活動排程已建立" + ("，公告已推播" if ann_id else ""),
            "id": ref.id,
            "announcement_id": ann_id,
        }

    def delete_event_schedule(self, event_id: str) -> dict[str, Any]:
        ref = self.db.collection("event_schedules").document(event_id)
        if not ref.get().exists:
            return {"ok": False, "message": "活動不存在"}
        ref.set({"is_active": False, "updated_at": SERVER_TIMESTAMP}, merge=True)
        return {"ok": True, "message": "活動排程已刪除"}

    # ── Wish Pool ──────────────────────────────────────────────

    def get_wishes(self, user_id: str | None = None) -> list[dict[str, Any]]:
        """Return wishes. If user_id given, return only that user's wishes; else all active."""
        query = self.db.collection("wishes").where(filter=FieldFilter("is_active", "==", True))
        if user_id:
            query = query.where(filter=FieldFilter("user_id", "==", user_id))
        docs = query.stream()
        items: list[dict[str, Any]] = []
        for doc in docs:
            item = doc.to_dict() or {}
            item["id"] = doc.id
            items.append(item)
        items.sort(key=lambda w: str(w.get("created_at", "")), reverse=True)
        return items

    def create_wish(self, user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        data: dict[str, Any] = {
            "user_id": user_id,
            "url": payload["url"],
            "item_name": payload.get("item_name", "").strip(),
            "note": payload.get("note", "").strip(),
            "is_fulfilled": False,
            "is_active": True,
            "created_at": SERVER_TIMESTAMP,
        }
        ref = self.db.collection("wishes").document()
        ref.set(data)
        return {"ok": True, "message": "許願成功！🌠", "id": ref.id}

    def fulfill_wish(self, wish_id: str) -> dict[str, Any]:
        ref = self.db.collection("wishes").document(wish_id)
        if not ref.get().exists:
            return {"ok": False, "message": "許願不存在"}
        ref.set({"is_fulfilled": True, "updated_at": SERVER_TIMESTAMP}, merge=True)
        return {"ok": True, "message": "已標記為已達成 ✨"}

    def delete_wish(self, wish_id: str) -> dict[str, Any]:
        ref = self.db.collection("wishes").document(wish_id)
        if not ref.get().exists:
            return {"ok": False, "message": "許願不存在"}
        ref.set({"is_active": False, "updated_at": SERVER_TIMESTAMP}, merge=True)
        return {"ok": True, "message": "許願已刪除"}

    def get_progress(self, user_id: str) -> dict[str, Any]:
        stats_snapshot = self._stats_ref(user_id).get()
        stats = stats_snapshot.to_dict() if stats_snapshot.exists else {}

        accepted_docs = (
            self.db.collection("users")
            .document(user_id)
            .collection("accepted_quests")
            .stream()
        )
        quest_states: dict[str, str] = {}
        for doc in accepted_docs:
            item = doc.to_dict()
            quest_states[doc.id] = str(item.get("status", "accepted"))

        completed_docs = (
            self.db.collection("users")
            .document(user_id)
            .collection("completed_quests")
            .stream()
        )
        completed_ids = [doc.id for doc in completed_docs]

        claimed_docs = (
            self.db.collection("users")
            .document(user_id)
            .collection("claimed_rewards")
            .stream()
        )
        claimed_ids = [doc.id for doc in claimed_docs]

        category_bonus_docs = (
            self.db.collection("users")
            .document(user_id)
            .collection("category_bonuses")
            .stream()
        )
        claimed_category_bonuses = [doc.id for doc in category_bonus_docs]

        return {
            "points": int(stats.get("points", 0)),
            "completed_count": int(stats.get("completed_count", 0)),
            "claimed_count": int(stats.get("claimed_count", 0)),
            "completed_quest_ids": completed_ids,
            "claimed_reward_ids": claimed_ids,
            "claimed_category_bonuses": claimed_category_bonuses,
            "quest_states": quest_states,
        }

    def claim_category_bonus(
        self, user_id: str, category: str, quest_ids: list[str], bonus_points: int
    ) -> ActionResult:
        bonus_ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("category_bonuses")
            .document(category)
        )
        stats_ref = self._stats_ref(user_id)
        transaction = self.db.transaction()

        @firestore.transactional
        def _transaction_body(transaction_obj):
            bonus_snapshot = bonus_ref.get(transaction=transaction_obj)
            if bonus_snapshot.exists:
                return ActionResult(False, "此區塊獎勵已領取", 0)

            for quest_id in quest_ids:
                completed_ref = (
                    self.db.collection("users")
                    .document(user_id)
                    .collection("completed_quests")
                    .document(quest_id)
                )
                if not completed_ref.get(transaction=transaction_obj).exists:
                    return ActionResult(False, "尚有任務未完成，無法領取區塊獎勵", 0)

            stats_snapshot = stats_ref.get(transaction=transaction_obj)
            stats = stats_snapshot.to_dict() if stats_snapshot.exists else {}
            current_points = int(stats.get("points", 0))
            new_points = current_points + bonus_points

            transaction_obj.set(
                bonus_ref,
                {
                    "category": category,
                    "bonus_points": bonus_points,
                    "claimed_at": SERVER_TIMESTAMP,
                },
            )
            transaction_obj.set(stats_ref, {"points": new_points}, merge=True)
            return ActionResult(True, f"區塊獎勵領取成功！獲得 {bonus_points} 點", new_points)

        return _transaction_body(transaction)

    def accept_quest(self, user_id: str, quest_id: str) -> ActionResult:
        quest_ref = self.db.collection("quests").document(quest_id)
        accepted_ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("accepted_quests")
            .document(quest_id)
        )
        completed_ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("completed_quests")
            .document(quest_id)
        )

        transaction = self.db.transaction()

        @firestore.transactional
        def _transaction_body(transaction_obj):
            quest_snapshot = quest_ref.get(transaction=transaction_obj)
            if not quest_snapshot.exists:
                return ActionResult(False, "任務不存在", 0)

            quest = quest_snapshot.to_dict()
            if not quest.get("is_active", True):
                return ActionResult(False, "任務已停用", 0)

            completed_snapshot = completed_ref.get(transaction=transaction_obj)
            if completed_snapshot.exists:
                return ActionResult(False, "任務已完成", 0)

            accepted_snapshot = accepted_ref.get(transaction=transaction_obj)
            if accepted_snapshot.exists:
                current_status = str((accepted_snapshot.to_dict() or {}).get("status", "accepted"))
                if current_status in {"accepted", "submitted"}:
                    return ActionResult(False, "任務已承接", 0)

            transaction_obj.set(
                accepted_ref,
                {
                    "quest_id": quest_id,
                    "title": quest.get("title", ""),
                    "description": quest.get("description", ""),
                    "points": int(quest.get("points", 0)),
                    "status": "accepted",
                    "accepted_at": SERVER_TIMESTAMP,
                    "updated_at": SERVER_TIMESTAMP,
                },
                merge=True,
            )
            return ActionResult(True, "任務承接成功", 0)

        return _transaction_body(transaction)

    def abandon_quest(self, user_id: str, quest_id: str) -> ActionResult:
        accepted_ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("accepted_quests")
            .document(quest_id)
        )
        snapshot = accepted_ref.get()
        if not snapshot.exists:
            return ActionResult(False, "尚未承接任務", 0)

        data = snapshot.to_dict() or {}
        if data.get("status") == "approved":
            return ActionResult(False, "此任務已核准完成，無法放棄", 0)

        accepted_ref.delete()
        return ActionResult(True, "已放棄任務", 0)

    def submit_quest_proof(self, user_id: str, quest_id: str, image_path: str) -> ActionResult:
        accepted_ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("accepted_quests")
            .document(quest_id)
        )
        submission_ref = self.db.collection("quest_submissions").document(f"{user_id}__{quest_id}")

        accepted_snapshot = accepted_ref.get()
        if not accepted_snapshot.exists:
            return ActionResult(False, "請先承接任務", 0)

        accepted = accepted_snapshot.to_dict() or {}
        current_status = str(accepted.get("status", "accepted"))
        if current_status not in {"accepted", "rejected"}:
            return ActionResult(False, "目前任務狀態無法送審", 0)

        update_data = {
            "status": "submitted",
            "proof_image_path": image_path,
            "submitted_at": SERVER_TIMESTAMP,
            "updated_at": SERVER_TIMESTAMP,
        }
        accepted_ref.set(update_data, merge=True)
        submission_ref.set(
            {
                "user_id": user_id,
                "quest_id": quest_id,
                "title": accepted.get("title", ""),
                "description": accepted.get("description", ""),
                "points": int(accepted.get("points", 0)),
                "proof_image_path": image_path,
                "status": "submitted",
                "submitted_at": SERVER_TIMESTAMP,
                "updated_at": SERVER_TIMESTAMP,
            },
            merge=True,
        )
        return ActionResult(True, "已提交完成照片，等待管理員審核", 0)

    def get_quest_submissions(self) -> list[dict[str, Any]]:
        docs = self.db.collection("quest_submissions").stream()
        submissions = []
        for doc in docs:
            item = doc.to_dict()
            proof_path = str(item.get("proof_image_path", ""))
            if proof_path.startswith("/img/"):
                local_rel = proof_path.removeprefix("/")
                local_path = self.project_root / local_rel.replace("/", os.sep)
                if not local_path.exists():
                    item["proof_image_path"] = ""
            item["id"] = doc.id
            submissions.append(item)

        status_order = {"submitted": 0, "rejected": 1, "approved": 2}
        submissions.sort(
            key=lambda s: (
                status_order.get(str(s.get("status", "submitted")), 9),
                str(s.get("updated_at", "")),
            )
        )
        return submissions

    def review_quest_submission(
        self,
        user_id: str,
        quest_id: str,
        approved: bool,
        review_note: str = "",
    ) -> dict[str, Any]:
        accepted_ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("accepted_quests")
            .document(quest_id)
        )
        completed_ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("completed_quests")
            .document(quest_id)
        )
        submission_ref = self.db.collection("quest_submissions").document(f"{user_id}__{quest_id}")
        stats_ref = self._stats_ref(user_id)

        transaction = self.db.transaction()

        @firestore.transactional
        def _transaction_body(transaction_obj):
            accepted_snapshot = accepted_ref.get(transaction=transaction_obj)
            if not accepted_snapshot.exists:
                return {"ok": False, "message": "找不到承接任務紀錄"}

            accepted = accepted_snapshot.to_dict() or {}
            if str(accepted.get("status", "")) != "submitted":
                return {"ok": False, "message": "任務目前不在待審核狀態"}

            submission_snapshot = submission_ref.get(transaction=transaction_obj)
            if not submission_snapshot.exists:
                return {"ok": False, "message": "找不到送審紀錄"}

            if not approved:
                reject_data = {
                    "status": "rejected",
                    "review_note": review_note,
                    "reviewed_at": SERVER_TIMESTAMP,
                    "updated_at": SERVER_TIMESTAMP,
                }
                transaction_obj.set(accepted_ref, reject_data, merge=True)
                transaction_obj.set(submission_ref, reject_data, merge=True)
                return {"ok": True, "message": "已退回任務，等待重新提交", "status": "rejected"}

            completed_snapshot = completed_ref.get(transaction=transaction_obj)
            stats_snapshot = stats_ref.get(transaction=transaction_obj)
            stats = stats_snapshot.to_dict() if stats_snapshot.exists else {}
            current_points = int(stats.get("points", 0))

            if completed_snapshot.exists:
                return {"ok": False, "message": "任務已核准過"}

            award = int(accepted.get("points", 0))
            new_points = current_points + award

            transaction_obj.set(
                completed_ref,
                {
                    "title": accepted.get("title", ""),
                    "points_awarded": award,
                    "completed_at": SERVER_TIMESTAMP,
                },
            )
            transaction_obj.set(
                stats_ref,
                {
                    "points": new_points,
                    "completed_count": int(stats.get("completed_count", 0)) + 1,
                },
                merge=True,
            )

            approve_data = {
                "status": "approved",
                "review_note": review_note,
                "reviewed_at": SERVER_TIMESTAMP,
                "updated_at": SERVER_TIMESTAMP,
            }
            transaction_obj.set(accepted_ref, approve_data, merge=True)
            transaction_obj.set(submission_ref, approve_data, merge=True)

            return {
                "ok": True,
                "message": "任務審核通過，已發放獎勵金",
                "status": "approved",
                "points": new_points,
            }

        return _transaction_body(transaction)

    def complete_quest(self, user_id: str, quest_id: str) -> ActionResult:
        quest_ref = self.db.collection("quests").document(quest_id)
        completed_ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("completed_quests")
            .document(quest_id)
        )
        stats_ref = self._stats_ref(user_id)

        transaction = self.db.transaction()

        @firestore.transactional
        def _transaction_body(transaction_obj):
            quest_snapshot = quest_ref.get(transaction=transaction_obj)
            if not quest_snapshot.exists:
                return ActionResult(False, "任務不存在", 0)

            quest = quest_snapshot.to_dict()
            if not quest.get("is_active", True):
                return ActionResult(False, "任務已停用", 0)

            completed_snapshot = completed_ref.get(transaction=transaction_obj)
            stats_snapshot = stats_ref.get(transaction=transaction_obj)
            stats = stats_snapshot.to_dict() if stats_snapshot.exists else {}
            current_points = int(stats.get("points", 0))

            if completed_snapshot.exists:
                return ActionResult(False, "此任務已完成過", current_points)

            award = int(quest.get("points", 0))
            new_points = current_points + award

            transaction_obj.set(
                completed_ref,
                {
                    "title": quest.get("title", ""),
                    "points_awarded": award,
                    "completed_at": SERVER_TIMESTAMP,
                },
            )
            transaction_obj.set(
                stats_ref,
                {
                    "points": new_points,
                    "completed_count": int(stats.get("completed_count", 0)) + 1,
                },
                merge=True,
            )

            return ActionResult(True, "任務完成，已獲得點數", new_points)

        return _transaction_body(transaction)

    def claim_reward(self, user_id: str, reward_id: str) -> ActionResult:
        reward_ref = self.db.collection("rewards").document(reward_id)
        claimed_ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("claimed_rewards")
            .document(reward_id)
        )
        claim_log_ref = self.db.collection("reward_claims").document(f"{user_id}__{reward_id}")
        stats_ref = self._stats_ref(user_id)

        transaction = self.db.transaction()

        @firestore.transactional
        def _transaction_body(transaction_obj):
            reward_snapshot = reward_ref.get(transaction=transaction_obj)
            if not reward_snapshot.exists:
                return ActionResult(False, "獎勵不存在", 0)

            reward = reward_snapshot.to_dict()
            if not reward.get("is_active", True):
                return ActionResult(False, "獎勵已停用", 0)

            claimed_snapshot = claimed_ref.get(transaction=transaction_obj)
            stats_snapshot = stats_ref.get(transaction=transaction_obj)
            stats = stats_snapshot.to_dict() if stats_snapshot.exists else {}
            current_points = int(stats.get("points", 0))

            if claimed_snapshot.exists:
                return ActionResult(False, "此獎勵已兌換過", current_points)

            cost = int(reward.get("cost_points", 0))
            if current_points < cost:
                return ActionResult(False, "點數不足", current_points)

            new_points = current_points - cost
            transaction_obj.set(
                claimed_ref,
                {
                    "user_id": user_id,
                    "reward_id": reward_id,
                    "title": reward.get("title", ""),
                    "description": reward.get("description", ""),
                    "cost_points": cost,
                    "image_path": reward.get("image_path", ""),
                    "status": "claimed",
                    "claimed_at": SERVER_TIMESTAMP,
                    "updated_at": SERVER_TIMESTAMP,
                },
            )
            transaction_obj.set(
                claim_log_ref,
                {
                    "user_id": user_id,
                    "reward_id": reward_id,
                    "title": reward.get("title", ""),
                    "description": reward.get("description", ""),
                    "cost_points": cost,
                    "image_path": reward.get("image_path", ""),
                    "status": "claimed",
                    "claimed_at": SERVER_TIMESTAMP,
                    "updated_at": SERVER_TIMESTAMP,
                },
            )
            transaction_obj.set(
                stats_ref,
                {
                    "points": new_points,
                    "claimed_count": int(stats.get("claimed_count", 0)) + 1,
                },
                merge=True,
            )

            return ActionResult(True, "獎勵兌換成功", new_points)

        return _transaction_body(transaction)

    def update_claim_status(self, user_id: str, reward_id: str, status: str) -> dict[str, Any]:
        if status not in {"claimed", "delivered", "completed"}:
            return {"ok": False, "message": "狀態不合法"}

        claimed_ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("claimed_rewards")
            .document(reward_id)
        )
        claim_log_ref = self.db.collection("reward_claims").document(f"{user_id}__{reward_id}")

        claimed_snapshot = claimed_ref.get()
        if not claimed_snapshot.exists:
            return {"ok": False, "message": "找不到該兌換紀錄"}

        update_data = {"status": status, "updated_at": SERVER_TIMESTAMP}
        claimed_ref.set(update_data, merge=True)
        claim_log_ref.set(update_data, merge=True)

        return {"ok": True, "message": "狀態更新成功", "status": status}

    def create_giftbox_mail(self, payload: dict[str, Any]) -> dict[str, Any]:
        user_id = str(payload.get("user_id", "")).strip()
        if not user_id:
            return {"ok": False, "message": "使用者不可為空"}

        points = max(0, int(payload.get("points", 0) or 0))

        data = {
            "user_id": user_id,
            "title": str(payload.get("title", "")).strip(),
            "content": str(payload.get("content", "")).strip(),
            "is_read": False,
            "points": points,
            "points_claimed": False,
            "is_deleted": False,
            "created_at": SERVER_TIMESTAMP,
            "updated_at": SERVER_TIMESTAMP,
        }
        ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("giftbox_mails")
            .document()
        )
        ref.set(data)

        history_ref = self.db.collection("giftbox_send_history").document()
        history_ref.set(
            {
                "user_id": user_id,
                "title": data["title"],
                "content": data["content"],
                "points": points,
                "created_at": SERVER_TIMESTAMP,
            }
        )
        return {"ok": True, "id": ref.id, "message": "點數信件已送出"}

    def get_giftbox_send_history(self) -> list[dict[str, Any]]:
        docs = self.db.collection("giftbox_send_history").stream()
        items: list[dict[str, Any]] = []
        for doc in docs:
            item = doc.to_dict() or {}
            item["id"] = doc.id
            items.append(item)
        items.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        return items[:100]

    def get_giftbox_mails(self, user_id: str) -> list[dict[str, Any]]:
        docs = (
            self.db.collection("users")
            .document(user_id)
            .collection("giftbox_mails")
            .where(filter=FieldFilter("is_deleted", "==", False))
            .stream()
        )
        mails: list[dict[str, Any]] = []
        for doc in docs:
            item = doc.to_dict() or {}
            item["id"] = doc.id
            mails.append(item)
        mails.sort(key=lambda m: str(m.get("created_at", "")), reverse=True)
        return mails

    def claim_giftbox_attachment(self, user_id: str, mail_id: str) -> dict[str, Any]:
        mail_ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("giftbox_mails")
            .document(mail_id)
        )
        stats_ref = self._stats_ref(user_id)

        transaction = self.db.transaction()

        @firestore.transactional
        def _transaction_body(transaction_obj):
            mail_snapshot = mail_ref.get(transaction=transaction_obj)
            if not mail_snapshot.exists:
                return {"ok": False, "message": "找不到信件"}

            mail = mail_snapshot.to_dict() or {}
            if bool(mail.get("is_deleted", False)):
                return {"ok": False, "message": "信件已刪除"}
            points = int(mail.get("points", 0) or 0)
            if points <= 0:
                return {"ok": False, "message": "此信件沒有點數"}
            if bool(mail.get("points_claimed", False)):
                return {"ok": False, "message": "點數已領取"}

            stats_snapshot = stats_ref.get(transaction=transaction_obj)
            stats = stats_snapshot.to_dict() or {} if stats_snapshot.exists else {}
            current_points = int(stats.get("points", 0))
            new_points = current_points + points

            transaction_obj.set(stats_ref, {"points": new_points}, merge=True)
            transaction_obj.set(
                mail_ref,
                {
                    "is_read": True,
                    "points_claimed": True,
                    "updated_at": SERVER_TIMESTAMP,
                },
                merge=True,
            )
            return {"ok": True, "message": f"已領取 +{points} 點", "points": new_points}

        return _transaction_body(transaction)

    def claim_all_giftbox_attachments(self, user_id: str) -> dict[str, Any]:
        mails = self.get_giftbox_mails(user_id)
        target_ids = [
            str(m.get("id", ""))
            for m in mails
            if int(m.get("points", 0) or 0) > 0 and not bool(m.get("points_claimed", False))
        ]
        claimed = 0
        total_points = 0
        for mail_id in target_ids:
            result = self.claim_giftbox_attachment(user_id=user_id, mail_id=mail_id)
            if result.get("ok"):
                claimed += 1
        return {"ok": True, "message": f"已領取 {claimed} 封信件的點數", "claimed_count": claimed}

    def mark_all_giftbox_read(self, user_id: str) -> dict[str, Any]:
        docs = (
            self.db.collection("users")
            .document(user_id)
            .collection("giftbox_mails")
            .where(filter=FieldFilter("is_deleted", "==", False))
            .stream()
        )
        count = 0
        for doc in docs:
            doc.reference.set({"is_read": True, "updated_at": SERVER_TIMESTAMP}, merge=True)
            count += 1
        return {"ok": True, "message": f"已標記 {count} 封信件為已讀", "updated_count": count}

    def delete_read_giftbox_mails(self, user_id: str, force: bool = False) -> dict[str, Any]:
        docs = (
            self.db.collection("users")
            .document(user_id)
            .collection("giftbox_mails")
            .where(filter=FieldFilter("is_deleted", "==", False))
            .where(filter=FieldFilter("is_read", "==", True))
            .stream()
        )

        refs = []
        unclaimed_attachment_count = 0
        for doc in docs:
            item = doc.to_dict() or {}
            refs.append(doc.reference)
            has_attachment = bool(item.get("has_attachment", False))
            claimed = bool(item.get("attachment_claimed", False))
            if has_attachment and not claimed:
                unclaimed_attachment_count += 1

        if unclaimed_attachment_count > 0 and not force:
            return {
                "ok": False,
                "needs_confirm": True,
                "message": f"尚有 {unclaimed_attachment_count} 個附件未領取，確定要刪除嗎？",
                "unclaimed_attachment_count": unclaimed_attachment_count,
            }

        deleted = 0
        for ref in refs:
            ref.set({"is_deleted": True, "updated_at": SERVER_TIMESTAMP}, merge=True)
            deleted += 1
        return {"ok": True, "message": f"已刪除 {deleted} 封已讀信件", "deleted_count": deleted}
