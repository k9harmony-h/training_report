import os
import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from openai import OpenAI
from dotenv import load_dotenv

# ==========================================
# 1. パスと環境変数の堅牢な設定 (根本修正)
# ==========================================

# このファイル (backend/main.py) の場所を基準にパスを特定
# backend_dir = .../ai_chat_bot/backend
BACKEND_DIR = Path(__file__).resolve().parent

# project_root = .../ai_chat_bot
PROJECT_ROOT = BACKEND_DIR.parent

# frontend_dir = .../ai_chat_bot/frontend
FRONTEND_DIR = PROJECT_ROOT / "frontend"

# .envのパス
ENV_PATH = PROJECT_ROOT / ".env"

# .env読み込み
load_dotenv(dotenv_path=ENV_PATH)

# デバッグ用ログ（Cloud Run起動時にパス構成が正しいか出力）
print(f"--- SERVER CONFIG ---")
print(f"ROOT: {PROJECT_ROOT}")
print(f"FRONTEND: {FRONTEND_DIR}")
print(f"ENV: {ENV_PATH}")
print(f"---------------------")

app = FastAPI()

# ==========================================
# 2. 基本設定 (CORS / Client)
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("WARNING: Supabase credentials not found in .env")

supabase: Client = create_client(SUPABASE_URL or "", SUPABASE_KEY or "")
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# ==========================================
# 3. AIロジック & API定義
# ==========================================

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

def extract_dog_info(text: str):
    try:
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "ユーザーの入力から犬の情報（名前, 犬種, 年齢, 性別）を抽出してJSONで返してください。不明な場合はnullにしてください。"},
                {"role": "user", "content": text}
            ],
            functions=[{
                "name": "save_dog_profile",
                "description": "犬のプロフィール情報を保存する",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "breed": {"type": "string"},
                        "age": {"type": "string"},
                        "gender": {"type": "string"}
                    }
                }
            }],
            function_call="auto"
        )
        message = completion.choices[0].message
        if message.function_call and message.function_call.name == "save_dog_profile":
            return json.loads(message.function_call.arguments)
    except Exception as e:
        print(f"Extract Info Error: {e}")
    return None

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    user_id = request.user_id
    user_msg = request.message
    
    # プロフィール同期
    try:
        supabase.table("profiles").upsert({"user_id": user_id}).execute()
    except Exception as e:
        print(f"Profile Error: {e}")

    # 犬情報取得
    dogs = []
    try:
        res = supabase.table("dogs").select("*").eq("user_id", user_id).execute()
        dogs = res.data
    except Exception as e:
        print(f"Dog Fetch Error: {e}")

    system_prompt = ""
    messages = []

    # 分岐ロジック
    if not dogs:
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
            
            system_prompt = CONSULTATION_SYSTEM_PROMPT.format(dog_info=str(new_dog))
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"（システム通知: 登録完了 {new_dog}。ユーザーに伝えてください）\nユーザー: {user_msg}"}
            ]
        else:
            system_prompt = REGISTRATION_SYSTEM_PROMPT
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg}
            ]
    else:
        dog = dogs[0]
        dog_info_str = f"名前:{dog.get('name')}, 犬種:{dog.get('breed')}, 年齢:{dog.get('age')}, 性別:{dog.get('gender')}"
        system_prompt = CONSULTATION_SYSTEM_PROMPT.format(dog_info=dog_info_str)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg}
        ]

    # 返信生成
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=500
        )
        ai_reply = response.choices[0].message.content
    except Exception as e:
        ai_reply = "申し訳ありません。エラーが発生しました。"
        print(f"OpenAI Error: {e}")

    # ログ保存
    try:
        supabase.table("chat_logs").insert([
            {"user_id": user_id, "message": user_msg, "sender": "user"},
            {"user_id": user_id, "message": ai_reply, "sender": "ai"}
        ]).execute()
    except Exception as e:
        print(f"Log Error: {e}")

    return {"reply": ai_reply}


# ==========================================
# 4. フロントエンド配信 (根本修正)
# ==========================================

# (A) ルートアクセス '/' への対応
# index.html ではなく chat.html を明示的に返す
@app.get("/")
async def read_index():
    chat_html_path = FRONTEND_DIR / "chat.html"
    index_html_path = FRONTEND_DIR / "index.html"
    
    if chat_html_path.exists():
        return FileResponse(chat_html_path)
    elif index_html_path.exists():
        return FileResponse(index_html_path)
    else:
        raise HTTPException(status_code=404, detail=f"Frontend file not found. Checked: {chat_html_path}")

# (B) その他の静的ファイル (JS/CSSなどがあればここから配信)
# フォルダが存在する場合のみマウントする
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR)), name="frontend")