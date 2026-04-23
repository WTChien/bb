import os
from pathlib import Path
import sys

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.firestore_service import FirestoreQuestService


def main() -> None:
    load_dotenv(ROOT_DIR / ".env")

    credential_setting = os.getenv("FIREBASE_SERVICE_ACCOUNT") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    credential_path = None
    if credential_setting:
        candidate = Path(credential_setting)
        if not candidate.is_absolute():
            candidate = ROOT_DIR / candidate
        credential_path = str(candidate)

    service = FirestoreQuestService(
        project_id=os.getenv("GOOGLE_CLOUD_PROJECT") or None,
        credential_path=credential_path,
    )

    quests = [
        # 每日任務
        dict(title="每日：早安自拍", description="每天早上傳一張可愛自拍照", points=5, difficulty="easy", published_date="2026-04-23"),
        dict(title="每日：運動打卡", description="每天運動30分鐘並拍照", points=8, difficulty="medium", published_date="2026-04-23"),
        dict(title="每日：喝水提醒", description="每天喝足2000cc水並拍照", points=6, difficulty="easy", published_date="2026-04-23"),
        dict(title="每日：閱讀10頁", description="每天閱讀10頁書並拍照", points=7, difficulty="medium", published_date="2026-04-23"),
        dict(title="每日：晚安語音", description="每天錄一段晚安語音", points=5, difficulty="easy", published_date="2026-04-23"),
        # 每週任務
        dict(title="每週：整理房間", description="每週整理一次房間並拍照", points=15, difficulty="medium", published_date="2026-04-21"),
        dict(title="每週：運動五天", description="一週內運動五天並拍照", points=20, difficulty="hard", published_date="2026-04-21"),
        dict(title="每週：閱讀一本書", description="每週閱讀一本書並心得", points=18, difficulty="hard", published_date="2026-04-21"),
        dict(title="每週：家人聚餐", description="每週與家人聚餐並合照", points=12, difficulty="medium", published_date="2026-04-21"),
        dict(title="每週：學習新技能", description="每週學習一項新技能", points=16, difficulty="medium", published_date="2026-04-21"),
        # 活動任務
        dict(title="活動：生日驚喜", description="幫對方準備生日驚喜", points=30, difficulty="hard", published_date="2026-05-01"),
        dict(title="活動：節日合照", description="節日一起拍合照", points=20, difficulty="medium", published_date="2026-05-01"),
        dict(title="活動：情侶運動會", description="參加情侶運動會", points=25, difficulty="hard", published_date="2026-05-01"),
        dict(title="活動：手作禮物", description="親手做一份禮物送對方", points=22, difficulty="hard", published_date="2026-05-01"),
        dict(title="活動：旅行紀錄", description="一起去旅行並寫紀錄", points=28, difficulty="hard", published_date="2026-05-01"),
    ]

    for q in quests:
        service.create_quest(q)
    print("15個任務已新增")


if __name__ == "__main__":
    main()