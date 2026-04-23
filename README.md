# Love Quest - Chiikawa 任務與獎勵系統

可愛 RPG 風格的任務板，支援使用者任務挑戰、獎勵兌換、管理員審核與營運工具。

## 技術堆疊

### 前端
- 原生 `HTML5`
- 原生 `CSS3`
- 原生 `JavaScript (ES2020+)`

### 後端
- `Python 3`
- `FastAPI`
- `Pydantic`

### 資料層
- `Google Cloud Firestore`
- `firebase_admin`

## 主要功能

- 任務清單分類、排序、篩選與截止倒數
- 任務承接、提交完成照片、管理員審核
- 分類任務獎勵金領取
- 獎勵商城兌換與兌換歷史
- 禮物盒（附件領取、批次已讀、批次刪除）
- 公告欄（系統/活動）
- 管理員任務工具
- 多選刪除任務、刪除全部任務
- 任務資料庫（Template）新增/搜尋/指派
- 每日與每週刷新數量設定
- 最近刪除紀錄
- 管理員派發禮物與送禮歷史

## 專案結構

```text
app/
  main.py
  firestore_service.py
static/
  index.html
  styles.css
  app.js
img/
scripts/
requirements.txt
run.bat
run.sh
```

## 安裝與啟動

1. 建立虛擬環境並安裝依賴

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

2. 設定 Firestore 憑證 (PowerShell)

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:/your-path/service-account.json"
```

選填專案 ID：

```powershell
$env:GOOGLE_CLOUD_PROJECT="your-project-id"
```

3. 啟動伺服器

```bash
uvicorn app.main:app --reload
```

或使用：

```bash
run.bat
```

開啟：`http://127.0.0.1:8000`

## 常用 API

### 任務
- `GET /api/quests`
- `POST /api/quests`
- `PUT /api/quests/{quest_id}`
- `DELETE /api/quests/{quest_id}`
- `POST /api/quests/batch-delete`
- `POST /api/quests/delete-all`
- `GET /api/quests/deleted-recent`

### 任務資料庫與刷新
- `GET /api/quest-templates`
- `POST /api/quest-templates`
- `DELETE /api/quest-templates/{template_id}`
- `POST /api/quest-templates/{template_id}/spawn`
- `GET /api/quest-refresh-settings`
- `POST /api/quest-refresh-settings`
- `POST /api/quests/refresh-from-db`

### 獎勵與兌換
- `GET /api/rewards`
- `POST /api/rewards`
- `POST /api/rewards/{reward_id}/claim/{user_id}`
- `GET /api/claims`
- `GET /api/claims/{user_id}`

### 禮物盒
- `POST /api/giftbox/send`
- `GET /api/giftbox/{user_id}`
- `POST /api/giftbox/{user_id}/{mail_id}/claim`
- `POST /api/giftbox/{user_id}/claim-all`
- `POST /api/giftbox/{user_id}/mark-all-read`
- `POST /api/giftbox/{user_id}/delete-read`
- `GET /api/giftbox-history`