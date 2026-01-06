import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse # ← 追加
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from openai import OpenAI
from dotenv import load_dotenv

# === 1. 環境変数の読み込み ===
current_dir = Path(__file__).resolve().parent
env_path = current_dir / '.env'
if not env_path.exists():
    env_path = current_dir.parent / '.env'

if env_path.exists():
    load_dotenv(dotenv_path=env_path)

# === 2. 設定値の取得 ===
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# === 3. アプリ初期化 ===
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# クライアント初期化 (エラーハンドリング付き)
supabase: Client = None
openai_client = None
try:
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    if OPENAI_API_KEY:
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
except Exception as e:
    print(f"Client Init Error: {e}")

# === 4. データ形式 ===
class ChatRequest(BaseModel):
    user_id: str
    message: str

# === 5. HTMLを表示する機能 (ここが追加部分！) ===
@app.get("/", response_class=HTMLResponse)
async def read_root():
    # frontend/chat.html の場所を探して読み込む
    html_path = current_dir.parent / "frontend" / "chat.html"
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "<h1>Error: HTML file not found</h1>"

# === 6. チャット機能 ===
@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        if not supabase or not openai_client:
            raise HTTPException(status_code=500, detail="Server config error")

        # A. ユーザー情報取得
        user_data = supabase.table("profiles").select("*").eq("user_id", req.user_id).execute()
        
        dog_info = "情報なし(新規)"
        if user_data.data:
            p = user_data.data[0]
            dog_info = f"犬種:{p.get('dog_breed','?')}, 年齢:{p.get('dog_age','?')}, 悩み:{p.get('issues','?')}"

        # B. プロンプト
        system_prompt = f"""
        あなたはプロのドッグトレーナーです。以下の犬の情報を前提に回答してください。
        【対象の犬】 {dog_info}
        回答ルール: 300文字以内。共感的に。
        """

        # C. AI生成
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.message}
            ]
        )
        ai_text = response.choices[0].message.content

        # D. ログ保存
        if user_data.data:
            supabase.table("chat_logs").insert({
                "user_id": req.user_id,
                "question": req.message,
                "ai_answer": ai_text
            }).execute()

        return {"reply": ai_text}

    except Exception as e:
        print(f"ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)