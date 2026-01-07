import os
import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
import google.generativeai as genai
from dotenv import load_dotenv

# --- パス設定 (絶対パス) ---
# このファイルの親ディレクトリ(backend)を取得
BACKEND_DIR = Path(__file__).resolve().parent
# プロジェクトルート(ai_chat_bot)を取得
PROJECT_ROOT = BACKEND_DIR.parent
# 関連パスの定義
FRONTEND_DIR = PROJECT_ROOT / "frontend"
ENV_PATH = PROJECT_ROOT / ".env"

# .envの読み込み
load_dotenv(dotenv_path=ENV_PATH)

app = FastAPI()

# --- CORS設定 ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- クライアント初期化 ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Supabase接続
supabase: Client = create_client(SUPABASE_URL or "", SUPABASE_KEY or "")

# Gemini接続
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
else:
    print("CRITICAL: GOOGLE_API_KEY is missing.")

# --- プロンプト ---
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

class ChatRequest(BaseModel):
    user_id: str
    message: str

# --- Geminiヘルパー関数 ---
def extract_dog_info(text: str):
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

# --- APIエンドポイント ---
@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    user_id = request.user_id
    user_msg = request.message
    
    # DB同期
    try:
        supabase.table("profiles").upsert({"user_id": user_id}).execute()
        res = supabase.table("dogs").select("*").eq("user_id", user_id).execute()
        dogs = res.data
    except:
        dogs = []

    ai_reply = "エラーが発生しました。"

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
                new_dog = {k: v for k, v in new_dog.items() if v is not None}
                supabase.table("dogs").insert(new_dog).execute()
                
                sys_prompt = CONSULTATION_SYSTEM_PROMPT.format(dog_info=str(new_dog))
                full_prompt = f"{sys_prompt}\n\n(システム: 登録完了報告)\nユーザー: {user_msg}"
            else:
                full_prompt = f"{REGISTRATION_SYSTEM_PROMPT}\n\nユーザー: {user_msg}"
        else:
            # 相談モード
            dog = dogs[0]
            dog_info_str = f"名前:{dog.get('name')}, 犬種:{dog.get('breed')}, 年齢:{dog.get('age')}, 性別:{dog.get('gender')}"
            sys_prompt = CONSULTATION_SYSTEM_PROMPT.format(dog_info=dog_info_str)
            full_prompt = f"{sys_prompt}\n\nユーザー: {user_msg}"

        resp = model.generate_content(full_prompt)
        ai_reply = resp.text

    except Exception as e:
        print(f"Error: {e}")
        ai_reply = "システムエラーです。"

    # ログ保存
    try:
        supabase.table("chat_logs").insert([
            {"user_id": user_id, "message": user_msg, "sender": "user"},
            {"user_id": user_id, "message": ai_reply, "sender": "ai"}
        ]).execute()
    except:
        pass

    return {"reply": ai_reply}

# --- フロントエンド配信 ---
@app.get("/")
async def read_index():
    targets = ["chat.html", "index.html"]
    for filename in targets:
        path = FRONTEND_DIR / filename
        if path.exists():
            return FileResponse(path)
    # ファイルが見つからない場合
    raise HTTPException(404, detail=f"Frontend not found in {FRONTEND_DIR}")

if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR)), name="frontend")