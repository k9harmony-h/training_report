import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from openai import OpenAI
from dotenv import load_dotenv

# === 1. 環境変数の読み込み ===
current_dir = Path(__file__).resolve().parent
env_path = current_dir / '.env'

# どこにあっても見つける
if not env_path.exists():
    env_path = current_dir.parent / '.env'

if env_path.exists():
    load_dotenv(dotenv_path=env_path)
    print("DEBUG: .env Loaded")
else:
    print("ERROR: .env Not Found")

# === 2. 設定値の取得 ===
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY]):
    raise ValueError("環境変数が足りません。.envを確認してください。")

# === 3. アプリ初期化 ===
app = FastAPI()

# HTMLからのアクセス許可 (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
except Exception as e:
    print(f"Client Init Error: {e}")

# 4. データ形式
class ChatRequest(BaseModel):
    user_id: str
    message: str

# 5. チャット機能 (完全版)
@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        print(f"DEBUG: User={req.user_id}, Msg={req.message}")

        # A. ユーザー情報(犬のカルテ)を取得
        user_data = supabase.table("profiles").select("*").eq("user_id", req.user_id).execute()
        
        dog_info = "情報なし(新規ユーザー)"
        if user_data.data:
            p = user_data.data[0]
            # データが存在すればその情報をセット
            dog_info = f"犬種:{p.get('dog_breed', '不明')}, 年齢:{p.get('dog_age', '不明')}, 悩み:{p.get('issues', 'なし')}"
        else:
            print("DEBUG: ユーザー情報が見つかりません。デフォルト対応します。")

        # B. システムプロンプト作成
        system_prompt = f"""
        あなたはプロのドッグトレーナーです。以下の犬の情報を前提に回答してください。
        【対象の犬】 {dog_info}
        
        回答のルール:
        1. 飼い主の不安に寄り添う共感的な口調で話すこと。
        2. 「血」「痙攣」などの単語がある場合は、すぐに病院へ行くよう促すこと。
        3. 300文字以内で簡潔に答えること。
        """

        # C. OpenAIに回答生成を依頼
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.message}
            ]
        )
        ai_text = response.choices[0].message.content

        # D. 会話ログをDBに保存
        # ※ユーザー登録がないと外部キーエラーになる可能性があるため、データがある場合のみ保存
        if user_data.data:
            log_data = {
                "user_id": req.user_id,
                "question": req.message,
                "ai_answer": ai_text
            }
            supabase.table("chat_logs").insert(log_data).execute()
            print("DEBUG: 会話ログを保存しました。")

        return {"reply": ai_text}

    except Exception as e:
        print(f"ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)