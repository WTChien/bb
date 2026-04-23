from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.firestore_service import FirestoreQuestService


class QuestCreate(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=240)
    points: int = Field(ge=1, le=999)
    difficulty: str = Field(default="easy", pattern="^(easy|medium|hard)$")
    published_date: str = Field(default="", pattern=r"^$|^\d{4}-\d{2}-\d{2}$")
    due_date: str = Field(default="", pattern=r"^$|^\d{4}-\d{2}-\d{2}$")


class QuestUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=240)
    points: int = Field(ge=1, le=999)
    difficulty: str = Field(default="easy", pattern="^(easy|medium|hard)$")
    published_date: str = Field(default="", pattern=r"^$|^\d{4}-\d{2}-\d{2}$")
    due_date: str = Field(default="", pattern=r"^$|^\d{4}-\d{2}-\d{2}$")


class RewardCreate(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=240)
    cost_points: int = Field(ge=1, le=9999)
    image_path: str = Field(default="")


class ClaimStatusUpdate(BaseModel):
    status: str = Field(pattern="^(claimed|delivered|completed)$")


class CategoryBonusClaim(BaseModel):
    quest_ids: list[str] = Field(min_length=1)
    bonus_points: int = Field(ge=1, le=9999)


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1, max_length=400)
    ann_type: str = Field(default="system", pattern="^(system|event)$")
    event_time: str = Field(default="", max_length=80)


class QuestProofSubmit(BaseModel):
    image_path: str = Field(min_length=1)


class QuestReviewUpdate(BaseModel):
    approved: bool
    review_note: str = Field(default="", max_length=240)


class GiftboxSendCreate(BaseModel):
    user_id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1, max_length=400)
    attachment_title: str = Field(default="", max_length=80)
    attachment_description: str = Field(default="", max_length=240)
    attachment_image_path: str = Field(default="", max_length=240)


class GiftboxDeleteReadRequest(BaseModel):
    force: bool = False


class QuestBatchDeleteRequest(BaseModel):
    quest_ids: list[str] = Field(min_length=1)


class QuestTemplateCreate(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=240)
    points: int = Field(ge=1, le=999)
    difficulty: str = Field(default="easy", pattern="^(easy|medium|hard)$")
    category: str = Field(default="other", pattern="^(daily|weekly|event|other)$")
    due_days: int = Field(default=7, ge=0, le=365)


class QuestRefreshSettingsUpdate(BaseModel):
    daily_count: int = Field(ge=0, le=30)
    weekly_count: int = Field(ge=0, le=30)


load_dotenv()
project_root = Path(__file__).resolve().parents[1]
credential_setting = os.getenv("FIREBASE_SERVICE_ACCOUNT") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
credential_path: str | None = None
if credential_setting:
    candidate = Path(credential_setting)
    if not candidate.is_absolute():
        candidate = project_root / candidate
    credential_path = str(candidate)

service = FirestoreQuestService(
    project_id=os.getenv("GOOGLE_CLOUD_PROJECT") or None,
    credential_path=credential_path,
)

app = FastAPI(title="Love Quest", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=project_root / "static"), name="static")
app.mount("/img", StaticFiles(directory=project_root / "img"), name="img")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(project_root / "static" / "index.html")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/quests")
def list_quests() -> list[dict]:
    return service.get_quests()


@app.post("/api/quests")
def create_quest(payload: QuestCreate) -> dict:
    return service.create_quest(payload.model_dump())


@app.put("/api/quests/{quest_id}")
def update_quest(quest_id: str, payload: QuestUpdate) -> dict:
    result = service.update_quest(quest_id=quest_id, payload=payload.model_dump())
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail={"message": result.get("message", "任務更新失敗")})
    return result


@app.delete("/api/quests/{quest_id}")
def delete_quest(quest_id: str) -> dict:
    result = service.deactivate_quest(quest_id=quest_id)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail={"message": result.get("message", "任務刪除失敗")})
    return result


@app.post("/api/quests/batch-delete")
def batch_delete_quests(payload: QuestBatchDeleteRequest) -> dict:
    return service.batch_deactivate_quests(payload.quest_ids)


@app.post("/api/quests/delete-all")
def delete_all_quests() -> dict:
    return service.deactivate_all_quests()


@app.get("/api/quests/deleted-recent")
def list_recent_deleted_quests() -> list[dict]:
    return service.get_recent_deleted_quests()


@app.get("/api/quest-templates")
def list_quest_templates() -> list[dict]:
    return service.get_quest_templates()


@app.post("/api/quest-templates")
def create_quest_template(payload: QuestTemplateCreate) -> dict:
    return service.create_quest_template(payload.model_dump())


@app.delete("/api/quest-templates/{template_id}")
def delete_quest_template(template_id: str) -> dict:
    return service.deactivate_quest_template(template_id)


@app.post("/api/quest-templates/{template_id}/spawn")
def spawn_quest_from_template(template_id: str) -> dict:
    result = service.spawn_quest_from_template(template_id)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail={"message": result.get("message", "任務建立失敗")})
    return result


@app.get("/api/quest-refresh-settings")
def get_quest_refresh_settings() -> dict:
    return service.get_quest_refresh_settings()


@app.post("/api/quest-refresh-settings")
def update_quest_refresh_settings(payload: QuestRefreshSettingsUpdate) -> dict:
    return service.update_quest_refresh_settings(payload.model_dump())


@app.post("/api/quests/refresh-from-db")
def refresh_quests_from_db() -> dict:
    return service.refresh_quests_from_templates()


@app.get("/api/rewards")
def list_rewards() -> list[dict]:
    return service.get_rewards()


@app.post("/api/rewards")
def create_reward(payload: RewardCreate) -> dict:
    return service.create_reward(payload.model_dump())


@app.delete("/api/rewards/{reward_id}")
def delete_reward(reward_id: str) -> dict:
    result = service.deactivate_reward(reward_id=reward_id)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail={"message": result.get("message", "獎勵刪除失敗")})
    return result


@app.post("/api/uploads/reward-image")
def upload_reward_image(file: UploadFile = File(...)) -> dict[str, str]:
    if not file.filename:
        raise HTTPException(status_code=400, detail={"message": "請選擇圖片"})

    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail={"message": "只接受圖片檔案"})

    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        raise HTTPException(status_code=400, detail={"message": "圖片格式僅支援 png/jpg/jpeg/webp/gif"})

    upload_dir = project_root / "img" / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    saved_name = f"reward_{uuid.uuid4().hex}{suffix}"
    saved_path = upload_dir / saved_name
    with saved_path.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    return {"image_path": f"/img/uploads/{saved_name}"}


@app.post("/api/uploads/proof-image")
def upload_proof_image(file: UploadFile = File(...)) -> dict[str, str]:
    if not file.filename:
        raise HTTPException(status_code=400, detail={"message": "請選擇圖片"})

    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail={"message": "只接受圖片檔案"})

    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        raise HTTPException(status_code=400, detail={"message": "圖片格式僅支援 png/jpg/jpeg/webp/gif"})

    upload_dir = project_root / "img" / "proofs"
    upload_dir.mkdir(parents=True, exist_ok=True)

    saved_name = f"proof_{uuid.uuid4().hex}{suffix}"
    saved_path = upload_dir / saved_name
    with saved_path.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    return {"image_path": f"/img/proofs/{saved_name}"}


@app.get("/api/progress/{user_id}")
def get_progress(user_id: str) -> dict:
    return service.get_progress(user_id)


@app.post("/api/quests/{quest_id}/accept/{user_id}")
def accept_quest(quest_id: str, user_id: str) -> dict:
    result = service.accept_quest(user_id=user_id, quest_id=quest_id)
    if not result.ok:
        raise HTTPException(status_code=400, detail={"message": result.message})
    return {"message": result.message}


@app.post("/api/quests/{quest_id}/abandon/{user_id}")
def abandon_quest(quest_id: str, user_id: str) -> dict:
    result = service.abandon_quest(user_id=user_id, quest_id=quest_id)
    if not result.ok:
        raise HTTPException(status_code=400, detail={"message": result.message})
    return {"message": result.message}


@app.post("/api/quests/{quest_id}/submit/{user_id}")
def submit_quest(quest_id: str, user_id: str, payload: QuestProofSubmit) -> dict:
    result = service.submit_quest_proof(
        user_id=user_id,
        quest_id=quest_id,
        image_path=payload.image_path,
    )
    if not result.ok:
        raise HTTPException(status_code=400, detail={"message": result.message})
    return {"message": result.message}


@app.get("/api/quest-submissions")
def list_quest_submissions() -> list[dict]:
    return service.get_quest_submissions()


@app.post("/api/quest-submissions/{user_id}/{quest_id}/review")
def review_quest_submission(user_id: str, quest_id: str, payload: QuestReviewUpdate) -> dict:
    result = service.review_quest_submission(
        user_id=user_id,
        quest_id=quest_id,
        approved=payload.approved,
        review_note=payload.review_note,
    )
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail={"message": result.get("message", "審核失敗")})
    return result


@app.post("/api/quests/{quest_id}/complete/{user_id}")
def complete_quest(quest_id: str, user_id: str) -> dict:
    result = service.complete_quest(user_id=user_id, quest_id=quest_id)
    if not result.ok:
        raise HTTPException(status_code=400, detail={"message": result.message, "points": result.points})
    return {"message": result.message, "points": result.points}


@app.post("/api/rewards/{reward_id}/claim/{user_id}")
def claim_reward(reward_id: str, user_id: str) -> dict:
    result = service.claim_reward(user_id=user_id, reward_id=reward_id)
    if not result.ok:
        raise HTTPException(status_code=400, detail={"message": result.message, "points": result.points})
    return {"message": result.message, "points": result.points}


@app.get("/api/claims")
def list_claims() -> list[dict]:
    return service.get_claims()


@app.get("/api/claims/{user_id}")
def list_claims_by_user(user_id: str) -> list[dict]:
    return service.get_claims_by_user(user_id)


@app.post("/api/claims/{user_id}/{reward_id}/status")
def update_claim_status(user_id: str, reward_id: str, payload: ClaimStatusUpdate) -> dict:
    result = service.update_claim_status(user_id=user_id, reward_id=reward_id, status=payload.status)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail={"message": result.get("message", "更新失敗")})
    return result


@app.post("/api/category-bonus/{category}/{user_id}")
def claim_category_bonus(category: str, user_id: str, payload: CategoryBonusClaim) -> dict:
    result = service.claim_category_bonus(
        user_id=user_id,
        category=category,
        quest_ids=payload.quest_ids,
        bonus_points=payload.bonus_points,
    )
    if not result.ok:
        raise HTTPException(status_code=400, detail={"message": result.message})
    return {"message": result.message, "points": result.points}


@app.get("/api/announcements")
def list_announcements() -> list[dict]:
    return service.get_announcements()


@app.post("/api/announcements")
def create_announcement(payload: AnnouncementCreate) -> dict:
    return service.create_announcement(payload.model_dump())


@app.delete("/api/announcements/{announcement_id}")
def delete_announcement(announcement_id: str) -> dict:
    result = service.delete_announcement(announcement_id=announcement_id)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail={"message": result.get("message", "刪除失敗")})
    return result


@app.post("/api/giftbox/send")
def send_giftbox_mail(payload: GiftboxSendCreate) -> dict:
    return service.create_giftbox_mail(payload.model_dump())


@app.get("/api/giftbox/{user_id}")
def list_giftbox_mails(user_id: str) -> list[dict]:
    return service.get_giftbox_mails(user_id)


@app.post("/api/giftbox/{user_id}/{mail_id}/claim")
def claim_giftbox_attachment(user_id: str, mail_id: str) -> dict:
    result = service.claim_giftbox_attachment(user_id=user_id, mail_id=mail_id)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail={"message": result.get("message", "領取失敗")})
    return result


@app.post("/api/giftbox/{user_id}/claim-all")
def claim_all_giftbox_attachments(user_id: str) -> dict:
    return service.claim_all_giftbox_attachments(user_id)


@app.post("/api/giftbox/{user_id}/mark-all-read")
def mark_all_giftbox_read(user_id: str) -> dict:
    return service.mark_all_giftbox_read(user_id)


@app.post("/api/giftbox/{user_id}/delete-read")
def delete_read_giftbox_mails(user_id: str, payload: GiftboxDeleteReadRequest) -> dict:
    return service.delete_read_giftbox_mails(user_id=user_id, force=payload.force)


@app.get("/api/giftbox-history")
def list_giftbox_history() -> list[dict]:
    return service.get_giftbox_send_history()
