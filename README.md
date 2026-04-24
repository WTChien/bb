# Love Quest - Chiikawa 任務與獎勵系統

可愛 RPG 風格的任務板，支援使用者任務挑戰、獎勵兌換、管理員審核與營運工具。

部署於 [babyquest.gradaide.xyz](https://babyquest.gradaide.xyz)

## 技術堆疊

### 前端
- 原生 `HTML5`
- 原生 `CSS3`
- 原生 `JavaScript (ES2020+)`

### 後端
- `Python 3.12`
- `FastAPI 0.115`
- `Uvicorn`
- `Pydantic`
- `openpyxl`

### 資料層
- `Google Cloud Firestore`
- `firebase_admin`

### 部署
- `Render` (Web Service, Free tier)

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
- 最近刪除紀錄（可還原）
- 管理員派發禮物與送禮歷史
- 每日日記（拜訪地點、備註、連結完成任務）
- 活動行程管理（含自動公告與點數倍率）
- 許願清單（商品連結、兌換狀態）
- 扭蛋系統（銅/銀/金箱，含保底機制）
- Excel 匯入任務與活動行程

## 專案結構

```text
app/
  main.py               # FastAPI 應用程式與所有 API 路由
  firestore_service.py  # Firestore 資料存取層
static/
  index.html
  styles.css
  app.js
  react/
    GachaChestSystem.jsx
img/
  proofs/               # 任務完成照片上傳目錄
scripts/                # 管理員批次工具腳本
requirements.txt
render.yaml
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

2. 設定 Firestore 憑證（三選一，優先順序由高到低）

**a. 指定憑證檔案路徑 (推薦本機開發)**

```powershell
$env:FIREBASE_SERVICE_ACCOUNT="./bb-chiikawa-firebase-adminsdk-fbsvc-2fd1d436ef.json"
```

**b. 貼上 JSON 字串 (Render 環境變數)**

```
FIREBASE_CREDENTIAL_JSON={"type":"service_account",...}
```

**c. Secret File (Render Secret Files)**

將憑證上傳至 `/etc/secrets/firebase-service-account.json`，或以 `FIREBASE_SERVICE_ACCOUNT_FILE` 指定路徑。

選填專案 ID：

```powershell
$env:GOOGLE_CLOUD_PROJECT="your-project-id"
```

3. 啟動伺服器

```bash
uvicorn app.main:app --reload --lifespan off
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
- `POST /api/quests/{quest_id}/promote`
- `POST /api/quests/{quest_id}/demote`
- `POST /api/quests/batch-delete`
- `POST /api/quests/delete-all`
- `GET /api/quests/deleted-recent`
- `POST /api/quests/deleted-recent/{log_id}/restore`
- `DELETE /api/quests/deleted-recent/{log_id}`
- `DELETE /api/quests/deleted-recent/all`

### 任務承接與審核
- `POST /api/quests/{quest_id}/accept/{user_id}`
- `POST /api/quests/{quest_id}/abandon/{user_id}`
- `POST /api/quests/{quest_id}/submit/{user_id}`
- `POST /api/quests/{quest_id}/complete/{user_id}`
- `GET /api/quest-submissions`
- `POST /api/quest-submissions/{user_id}/{quest_id}/review`

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
- `PUT /api/rewards/{reward_id}`
- `DELETE /api/rewards/{reward_id}`
- `POST /api/rewards/{reward_id}/claim/{user_id}`
- `GET /api/claims`
- `GET /api/claims/{user_id}`
- `POST /api/claims/{user_id}/{reward_id}/status`
- `POST /api/category-bonus/{category}/{user_id}`

### 禮物盒
- `POST /api/giftbox/send`
- `GET /api/giftbox/{user_id}`
- `POST /api/giftbox/{user_id}/{mail_id}/claim`
- `POST /api/giftbox/{user_id}/claim-all`
- `POST /api/giftbox/{user_id}/mark-all-read`
- `POST /api/giftbox/{user_id}/delete-read`
- `GET /api/giftbox-history`

### 公告
- `GET /api/announcements`
- `POST /api/announcements`
- `DELETE /api/announcements/{announcement_id}`

### 扭蛋
- `GET /api/gacha/pity/{user_id}`
- `GET /api/gacha/overview/{user_id}`
- `POST /api/gacha/draw/{user_id}`
- `POST /api/gacha/pity/reset/{user_id}`

### 每日日記
- `GET /api/daily-journals/{user_id}`
- `GET /api/daily-journal/{user_id}`
- `POST /api/daily-journal/{user_id}`

### 活動行程
- `GET /api/event-schedules`
- `POST /api/event-schedules`
- `DELETE /api/event-schedules/{event_id}`
- `POST /api/event-schedules/import-xlsx`

### 許願清單
- `GET /api/wishes`
- `POST /api/wishes`
- `PATCH /api/wishes/{wish_id}/fulfill`
- `DELETE /api/wishes/{wish_id}`

### 其他
- `GET /api/progress/{user_id}`
- `GET /api/completed-quests/{user_id}`
- `POST /api/uploads/reward-image`
- `POST /api/uploads/proof-image`
- `GET /api/template/quests-events.xlsx`
- `GET /api/template/event-quests.xlsx`
- `POST /api/quests/import-xlsx`
- `GET /health`