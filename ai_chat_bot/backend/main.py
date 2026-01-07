import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from openai import OpenAI
from dotenv import load_dotenv

# === 1. 環境変数の読み込み ===
current_dir = Path(__file__).resolve().parent
env_path = current_dir / '.env'
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

# クライアント初期化
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

# === 5. HTMLを表示する機能 ===
@app.get("/", response_class=HTMLResponse)
async def read_root():
    html_path = current_dir.parent / "frontend" / "chat.html"
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "<h1>Error: HTML file not found on server</h1>"

# === 6. チャット機能 ===
@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        # ID確認用コマンド
        if req.message == "id":
            return {"reply": req.user_id}

        # A. ユーザー情報取得
        user_data = supabase.table("profiles").select("*").eq("user_id", req.user_id).execute()
        
        dog_info = "情報なし(新規)"
        
        # ★★★ 修正箇所1: プロフィールがない場合、自動作成する ★★★
        # これを行わないと、外部キー制約がある場合にログ保存でエラーになります
        if not user_data.data:
            try:
                # 最低限のIDだけ登録
                supabase.table("profiles").insert({"user_id": req.user_id}).execute()
                print(f"新規ユーザー登録: {req.user_id}")
            except Exception as create_err:
                print(f"プロフィール作成エラー(無視): {create_err}")
        else:
            # プロフィールがある場合は情報を取得
            p = user_data.data[0]
            dog_info = f"犬種:{p.get('dog_breed','?')}, 年齢:{p.get('dog_age','?')}, 悩み:{p.get('issues','?')}"

        # B. AI生成
        system_prompt = f"""
        あなたはプロのドッグトレーナーです。以下の犬の情報を前提に回答してください。
        【対象の犬】 {dog_info}
        回答ルール: 300文字以内。共感的に。
        """

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.message}
            ]
        )
        ai_text = response.choices[0].message.content

        # C. ログ保存
        # ★★★ 修正箇所2: if文を削除し、必ず保存するように変更 ★★★
        try:
            supabase.table("chat_logs").insert({
                "user_id": req.user_id,
                "question": req.message,
                "ai_answer": ai_text
            }).execute()
        except Exception as log_err:
            print(f"ログ保存エラー: {log_err}")
            # ログ保存失敗でもチャット自体は止めないようにログ出力のみにする

        return {"reply": ai_text}

    except Exception as e:
        print(f"ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)