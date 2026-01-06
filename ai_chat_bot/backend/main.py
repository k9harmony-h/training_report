import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

# === 1. 環境変数の読み込み ===
current_dir = Path(__file__).resolve().parent
env_path = current_dir / '.env'
if not env_path.exists():
    env_path = current_dir.parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

# === 2. OpenAIの設定だけ確認 ===
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OpenAIのAPIキーが見つかりません！.envを確認してください。")

# === 3. アプリ初期化 ===
app = FastAPI()

# HTMLからのアクセス許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

openai_client = OpenAI(api_key=OPENAI_API_KEY)

# 4. データ形式
class ChatRequest(BaseModel):
    user_id: str
    message: str

# 5. チャット機能 (DB機能を除外したシンプル版)
@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        print(f"DEBUG: 受信メッセージ -> {req.message}")

        # A. ユーザー情報は一旦「仮」で固定します
        dog_info = "【テスト中】犬種:柴犬, 年齢:3歳, 悩み:テスト中"

        # B. システムプロンプト
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
        
        print(f"DEBUG: AI回答 -> {ai_text}")

        # D. ログ保存は一旦スキップ (ここがエラーの原因だったため)
        # supabase.table("chat_logs").insert(...) 

        return {"reply": ai_text}

    except Exception as e:
        # ターミナルに詳しいエラーを表示させる
        print(f"CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)