"""
Delete all existing rewards then insert 5 clean test rewards via local API.
Run from repo root: python scripts/fix_rewards.py
"""
import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"


def api_get(path):
    req = urllib.request.Request(f"{BASE}{path}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def api_post(path, payload):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  HTTP {e.code} error body: {body}")
        raise


def api_delete(path):
    req = urllib.request.Request(f"{BASE}{path}", method="DELETE")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    # 1. 取得所有現有獎勵並刪除
    existing = api_get("/api/rewards")
    print(f"找到 {len(existing)} 筆現有獎勵，開始刪除...")
    for r in existing:
        rid = r.get("id")
        if rid:
            try:
                api_delete(f"/api/rewards/{rid}")
                print(f"  已刪除: {rid}")
            except Exception as e:
                print(f"  刪除失敗 {rid}: {e}")

    # 2. 新增 5 筆乾淨獎勵
    rewards = [
        {
            "title": "吉伊兔兔抱枕",
            "description": "軟綿綿吉伊抱枕一顆，睡前專用必備。",
            "cost_points": 25,
            "image_path": "/img/nobg_chii.png?v=2",
        },
        {
            "title": "小八貓貓吊飾",
            "description": "出門包包掛一個，幸運值 +1！",
            "cost_points": 35,
            "image_path": "/img/nobg_ha_cheer.png?v=2",
        },
        {
            "title": "烏薩奇冒險徽章",
            "description": "限定冒險徽章，活動時段分數加成。",
            "cost_points": 45,
            "image_path": "/img/nobg_3.png?v=2",
        },
        {
            "title": "勇者點心券",
            "description": "完成任務後兌換甜點，心情大提升。",
            "cost_points": 18,
            "image_path": "/img/nobg_3_nice.png?v=2",
        },
        {
            "title": "愛心寶箱",
            "description": "每周限定寶箱，開啟有驚喜！",
            "cost_points": 60,
            "image_path": "/img/nobg_lion.png?v=2",
        },
    ]

    print("開始新增獎勵...")
    for r in rewards:
        result = api_post("/api/rewards", r)
        print(f"  新增成功: {result.get('title')} (id: {result.get('id')})")

    print("完成！")


if __name__ == "__main__":
    main()
