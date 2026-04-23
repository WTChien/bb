"""一次性腳本：新增女友專屬任務清單 (2026-04-24)"""
import os
from pathlib import Path
import sys

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.firestore_service import FirestoreQuestService  # noqa: E402


TODAY = "2026-04-24"

QUESTS = [
    # ── 每日任務 ──────────────────────────────────────────────
    dict(
        title="每日：早安自拍",
        description="早上起床拍一張可愛的自拍照說早安 ☀️",
        points=8, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：自信美美照",
        description="拍下今天畫好眼線、開心完妝的樣子！只要妳打扮得自己開心，寶寶看了就跟著開心 😍",
        points=10, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：OOTD 穿搭分享",
        description="拍下今天出門的穿搭給寶寶看 👗（滿足男友想看女友的心）",
        points=10, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：吃早餐",
        description="記得吃早餐，顧好胃！🍳",
        points=5, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：吃午餐",
        description="準時吃飯，要有飽足感喔！🍱",
        points=5, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：午餐紀錄",
        description="拍下午餐吃了什麼，或是一張午餐自拍照 🍱",
        points=5, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：吃晚餐",
        description="晚餐報備，一起分享今天吃了什麼 🍽️",
        points=5, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：快樂吃生魚片",
        description="家裡又吃生魚片啦！拍下萬惡的生魚片照片跟寶寶分享妳的快樂 🍣",
        points=10, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：順暢噗噗",
        description="腸胃健康很重要！有噗噗就給獎勵 💩",
        points=5, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：喝水達標",
        description="每天喝滿 1500cc～2000cc 的水 💧",
        points=10, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：補充保健食品",
        description="乖乖吞維他命、益生菌或膠原蛋白 💊",
        points=5, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：吃點水果",
        description="補充維他命C，吃一份水果 🍎",
        points=10, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：睡前保養",
        description="確實卸除眼線、洗臉擦乳液，保養天生麗質的漂亮臉蛋 ✨",
        points=10, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：早早睡覺",
        description="在晚上 12:00 前躺平睡覺 🛌",
        points=15, difficulty="medium", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：家人時光",
        description="跟家人聊聊天，關心彼此 🏠",
        points=10, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：稱讚寶寶",
        description="每天發掘並告訴寶寶一個優點或感謝的事 🥰",
        points=10, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：適度放鬆",
        description="看看 YT、Netflix，放空一下腦袋 📺",
        points=5, difficulty="easy", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：主動奔向寶寶",
        description="沒一起上課的日子，願意花時間搭車/騎車來找我（補貼車馬費）🏃‍♀️",
        points=40, difficulty="hard", category="daily", published_date=TODAY,
    ),
    dict(
        title="每日：乖乖一起上課",
        description="禮拜一、二準時一起去上課，不遲到、不翹課 🎒",
        points=15, difficulty="medium", category="daily", published_date=TODAY,
    ),

    # ── 成長與挑戰任務（可每日達成） ──────────────────────────
    dict(
        title="挑戰：運動流汗",
        description="跑步、瑜珈、健身房等，每次持續 30 分鐘以上 💦",
        points=40, difficulty="medium", category="daily", published_date=TODAY,
    ),
    dict(
        title="挑戰：用功讀書",
        description="專心閱讀、學習新事物或準備考試（可按小時計算）📚",
        points=40, difficulty="medium", category="daily", published_date=TODAY,
    ),
    dict(
        title="挑戰：技能練習",
        description="練習特定技能（例如畫畫、語言、樂器等）🎨",
        points=30, difficulty="medium", category="daily", published_date=TODAY,
    ),
    dict(
        title="挑戰：忍住沒剁手",
        description="今天克制住了購物慾，沒有亂買不必要的東西 👛",
        points=20, difficulty="easy", category="daily", published_date=TODAY,
    ),

    # ── 每週任務 ──────────────────────────────────────────────
    dict(
        title="每週：跟寶寶親親",
        description="每週的親密接觸，充滿愛意的 Kiss 😘",
        points=20, difficulty="easy", category="weekly", published_date=TODAY,
    ),
    dict(
        title="每週：跟寶寶喇喇",
        description="深情熱吻時間 🔥",
        points=50, difficulty="medium", category="weekly", published_date=TODAY,
    ),
    dict(
        title="每週：專屬約會",
        description="一起出門看電影、吃飯或踏青 👫",
        points=100, difficulty="hard", category="weekly", published_date=TODAY,
    ),
    dict(
        title="每週：專心吃飯不滑手機",
        description="約會吃飯時，雙方都不滑手機，專注陪伴對方一頓飯的時間 🍽️",
        points=30, difficulty="medium", category="weekly", published_date=TODAY,
    ),
    dict(
        title="每週：遠距電影院",
        description="沒見面的晚上，挑一部劇或電影，掛著電話/開著同步一起看 🍿",
        points=50, difficulty="medium", category="weekly", published_date=TODAY,
    ),
    dict(
        title="每週：點一首歌給寶寶",
        description="分享一首這週很喜歡的歌，或是聽了會想到對方的歌給寶寶聽 🎵",
        points=15, difficulty="easy", category="weekly", published_date=TODAY,
    ),
    dict(
        title="每週：朋友聚會",
        description="跟朋友出去玩，保持良好的社交生活 🎉",
        points=50, difficulty="medium", category="weekly", published_date=TODAY,
    ),
    dict(
        title="每週：閨蜜談心",
        description="跟好朋友聊聊天、Update 近況 💬",
        points=20, difficulty="easy", category="weekly", published_date=TODAY,
    ),
    dict(
        title="每週：環境打掃",
        description="整理房間、洗衣服或打掃家裡（依辛苦程度給予）🧹",
        points=75, difficulty="hard", category="weekly", published_date=TODAY,
    ),
    dict(
        title="每週：嘗試新鮮事",
        description="比如去一家沒吃過的餐廳，或看一部沒接觸過的電影類型 🌟",
        points=50, difficulty="medium", category="weekly", published_date=TODAY,
    ),

    # ── 特殊 / 成就任務 ───────────────────────────────────────
    dict(
        title="成就：經期乖乖照顧自己",
        description="生理期期間不喝冰的、好好熱敷休息（為期一週）🩸",
        points=150, difficulty="hard", category="other", published_date=TODAY,
    ),
    dict(
        title="成就：一起發掘新地點",
        description="由女友主動規劃並帶路的一次半日遊行程 🗺️",
        points=200, difficulty="hard", category="other", published_date=TODAY,
    ),
    dict(
        title="成就：連續七天早睡",
        description="達成連續一週都在 12 點前睡覺的成就！👑",
        points=100, difficulty="hard", category="other", published_date=TODAY,
    ),
    dict(
        title="成就：成熟溝通不冷戰",
        description="吵架或意見不合時，能好好說出感受，不冷戰、順利和好 🤝",
        points=200, difficulty="hard", category="other", published_date=TODAY,
    ),
    dict(
        title="成就：手寫的專屬浪漫",
        description="突然收到女友親筆寫的卡片或小紙條，滿滿的心意勝過一切 💌",
        points=200, difficulty="hard", category="other", published_date=TODAY,
    ),
    dict(
        title="成就：專屬貼身按摩師",
        description="見面的時候，看寶寶太累了主動幫忙按摩肩頸或背部 15 分鐘 💆‍♀️",
        points=150, difficulty="hard", category="other", published_date=TODAY,
    ),
]


def main() -> None:
    load_dotenv(ROOT_DIR / ".env")

    credential_setting = (
        os.getenv("FIREBASE_SERVICE_ACCOUNT") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    )
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

    print(f"共 {len(QUESTS)} 筆任務，開始新增...")
    for i, q in enumerate(QUESTS, 1):
        service.create_quest(q)
        print(f"  [{i:02d}/{len(QUESTS)}] ✓ {q['title']} ({q['points']} 點)")

    print(f"\n✅ 完成！已新增 {len(QUESTS)} 筆女友專屬任務。")


if __name__ == "__main__":
    main()
