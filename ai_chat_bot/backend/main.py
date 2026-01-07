import os
import json
import requests
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates # テンプレートエンジン
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
import google.generativeai as genai
from dotenv import load_dotenv

# --- パス・環境変数設定 ---
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
ENV_PATH = PROJECT_ROOT / ".env"

# ★デバッグ用: パス確認 (ここを追加・修正)★
print(f"DEBUG: Checking .env path: {ENV_PATH}")
print(f"DEBUG: File exists?: {ENV_PATH.exists()}")

# .envの読み込み (override=True を追加)
load_dotenv(dotenv_path=ENV_PATH, override=True)

# 設定値の取得
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
LINE_CHANNEL_ID = os.getenv("LINE_CHANNEL_ID")
LIFF_ID = os.getenv("LIFF_ID")

# ★デバッグ用: 値確認★
print("----------- CONFIG DEBUG -----------")
print(f"LIFF_ID: {LIFF_ID}")
print("------------------------------------")

app = FastAPI()

# --- CORS設定 ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 初期化 ---
supabase: Client = create_client(SUPABASE_URL or "", SUPABASE_KEY or "")

if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

# テンプレートエンジンの設定 (frontendディレクトリを指定)
templates = Jinja2Templates(directory=str(FRONTEND_DIR))

# --- プロンプト定義 (省略なし) ---
CONSULTATION_SYSTEM_PROMPT = """
あなたは犬の行動学に精通したプロのドッグトレーナーです。以下の犬の情報を前提に回答してください。
【対象の犬】 {dog_info}
回答ルール: 300文字以内。共感的に。
"""
REGISTRATION_SYSTEM_PROMPT = """
あなたは「K9 Harmony」の受付アシスタントです。
ユーザーはまだ犬のプロフィールを登録していません。
親しみやすく挨拶し、以下の4点を聞き出してください。
1. ワンちゃんの名前
2. 犬種
3. 年齢
4. 性別
"""

# --- リクエストモデル変更 ---
# user_idを生で送るのは危険なため、id_tokenを受け取る
class ChatRequest(BaseModel):
    id_token: str
    message: str

# --- Helper: LINE ID Token検証 ---
def verify_line_token(id_token: str) -> str:
    """
    LINEプラットフォームにIDトークンを送信し、正当性を検証する。
    成功すれば user_id (sub) を返す。失敗すればエラー。
    """
    try:
        response = requests.post(
            "https://api.line.me/oauth2/v2.1/verify",
            data={
                "id_token": id_token,
                "client_id": LINE_CHANNEL_ID
            },
            timeout=5
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid ID Token")
            
        data = response.json()
        return data["sub"] # これが本物のUser ID
    except Exception as e:
        print(f"Auth Error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
        # --- Helper: LINE ID Token検証 (修正版) ---
def verify_line_token(id_token: str) -> str:
    try:
        # デバッグ: 送信前の値を確認
        # print(f"Debug: Verifying token with Channel ID: {LINE_CHANNEL_ID}") 

        response = requests.post(
            "https://api.line.me/oauth2/v2.1/verify",
            data={
                "id_token": id_token,
                "client_id": LINE_CHANNEL_ID
            },
            timeout=5
        )
        
        if response.status_code != 200:
            # ★★★ ここが重要: LINEからの本当のエラー理由をログに出す ★★★
            print(f"LINE Auth Failed! Status: {response.status_code}")
            print(f"LINE Response: {response.text}") 
            raise HTTPException(status_code=401, detail=f"LINE Auth Failed: {response.text}")
            
        data = response.json()
        return data["sub"]
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"System Error in Auth: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

# --- Helper: Gemini ---
def extract_dog_info(text: str):
    # (既存ロジックと同じ)
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = f"""
        ユーザー入力: "{text}"
        タスク: 名前, 犬種, 年齢, 性別を抽出してJSONのみ出力。
        キー: name, breed, age, gender (不明はnull)
        """
        response = model.generate_content(prompt)
        cleaned = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned)
    except:
        return None

# --- API Endpoints ---

# フロントエンド配信 (テンプレートを使用してLIFF_IDを注入)
@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    if not (FRONTEND_DIR / "chat.html").exists():
        raise HTTPException(404, detail="chat.html not found")
    
    # chat.html内の {{ liff_id }} を環境変数の値に置き換えて配信
    return templates.TemplateResponse("chat.html", {"request": request, "liff_id": LIFF_ID})


@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # 1. セキュリティチェック (IDトークンからUser IDを特定)
    user_id = verify_line_token(request.id_token)
    user_msg = request.message
    
    # 2. DB処理 (以下、既存ロジックを流用しつつuser_idを使用)
    try:
        # プロフィールがなければ作成
        supabase.table("profiles").upsert({"user_id": user_id}).execute()
        res = supabase.table("dogs").select("*").eq("user_id", user_id).execute()
        dogs = res.data
    except Exception as e:
        print(f"DB Error: {e}")
        dogs = []

    ai_reply = "エラーが発生しました。"

    # 3. Gemini処理
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        if not dogs:
            # 登録モード
            extracted = extract_dog_info(user_msg)
            if extracted and (extracted.get("name") or extracted.get("breed")):
                new_dog = {
                    "user_id": user_id,
                    "name": extracted.get("name"),
                    "breed": extracted.get("breed"),
                    "age": extracted.get("age"),
                    "gender": extracted.get("gender")
                }
                # None除去
                new_dog = {k: v for k, v in new_dog.items() if v is not None}
                supabase.table("dogs").insert(new_dog).execute()
                
                sys_prompt = CONSULTATION_SYSTEM_PROMPT.format(dog_info=str(new_dog))
                full_prompt = f"{sys_prompt}\n\n(システム: 登録完了報告)\nユーザー: {user_msg}"
            else:
                full_prompt = f"{REGISTRATION_SYSTEM_PROMPT}\n\nユーザー: {user_msg}"
        else:
            # 相談モード
            dog = dogs[0]
            dog_info_str = f"名前:{dog.get('name')}, 犬種:{dog.get('breed')}, 年齢:{dog.get('age')}"
            sys_prompt = CONSULTATION_SYSTEM_PROMPT.format(dog_info=dog_info_str)
            full_prompt = f"{sys_prompt}\n\nユーザー: {user_msg}"

        resp = model.generate_content(full_prompt)
        ai_reply = resp.text

    except Exception as e:
        print(f"Gemini Error: {e}")
        ai_reply = "申し訳ありません、システムエラーが発生しました。"

    # 4. ログ保存 (スキーマ不一致は次回修正。まずはInsertできるように)
    # ※ 仮対応: sender形式で保存
    try:
        supabase.table("chat_logs").insert([
            {"user_id": user_id, "message": user_msg, "sender": "user"},
            {"user_id": user_id, "message": ai_reply, "sender": "ai"}
        ]).execute()
    except Exception as e:
        print(f"Log Error: {e}")

    return {"reply": ai_reply}