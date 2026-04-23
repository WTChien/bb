@echo off
setlocal

cd /d %~dp0

if not exist .venv (
  echo [INFO] Creating virtual environment...
  python -m venv .venv
)

echo [INFO] Activating virtual environment...
call .venv\Scripts\activate.bat
if errorlevel 1 (
  echo [ERROR] Failed to activate .venv
  exit /b 1
)

if "%FIREBASE_SERVICE_ACCOUNT%"=="" (
  if exist serviceAccountKey.json set "FIREBASE_SERVICE_ACCOUNT=serviceAccountKey.json"
)

if "%FIREBASE_SERVICE_ACCOUNT%"=="" (
  if exist firebase-service-account.json set "FIREBASE_SERVICE_ACCOUNT=firebase-service-account.json"
)

if "%FIREBASE_SERVICE_ACCOUNT%"=="" (
  for %%F in (*firebase*adminsdk*.json) do (
    if not defined FIREBASE_SERVICE_ACCOUNT set "FIREBASE_SERVICE_ACCOUNT=%%F"
  )
)

if not "%FIREBASE_SERVICE_ACCOUNT%"=="" (
  echo [INFO] Using Firebase service account: %FIREBASE_SERVICE_ACCOUNT%
)

echo [INFO] Installing dependencies...
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 exit /b 1

echo [INFO] Starting server at http://127.0.0.1:8000
.venv\Scripts\python.exe -m uvicorn app.main:app --reload
