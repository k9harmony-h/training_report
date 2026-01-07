import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
from openai import OpenAI
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# --- 設定読み込み ---
load_dotenv()
print("--- DEBUG ENV START ---")
print(f"SUPABASE_URL: {os.getenv('SUPABASE_URL')}")
print("--- DEBUG ENV END ---")
app = FastAPI()

# CORS設定（LIFFなどの外部フロントエンドからアクセスできるようにする）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境ではLIFFのURLに限定することを推奨
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 環境変数の取得
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# クライアント初期化
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# --- プロンプト定義 ---
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

# --- データモデル ---
class ChatRequest(BaseModel):
    user_id: str
    message: str

# --- ヘルパー関数: 犬情報の抽出 ---
def extract_dog_info(text: str):
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
    return None

# --- メイン処理エンドポイント ---
@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    user_id = request.user_id
    user_msg = request.message
    
    # 1. ユーザー登録確認 (profiles)
    try:
        supabase.table("profiles").upsert({"user_id": user_id}).execute()
    except Exception as e:
        print(f"Profile upsert error: {e}")

    # 2. 犬の登録確認
    dog_data = supabase.table("dogs").select("*").eq("user_id", user_id).execute()
    dogs = dog_data.data
    
    system_prompt = ""
    
    if not dogs:
        # --- A. 未登録の場合（登録モード）---
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
            
            system_prompt = CONSULTATION_SYSTEM_PROMPT.format(dog_info=str(new_dog))
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"（システム通知: ユーザーが犬の情報 {new_dog} を入力しました。登録を受け付けたと伝えてください。）\n\nユーザーの発言: {user_msg}"}
            ]
        else:
            system_prompt = REGISTRATION_SYSTEM_PROMPT
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg}
            ]
    else:
        # --- B. 登録済みの場合（相談モード）---
        dog = dogs[0]
        dog_info_str = f"名前:{dog.get('name')}, 犬種:{dog.get('breed')}, 年齢:{dog.get('age')}, 性別:{dog.get('gender')}"
        system_prompt = CONSULTATION_SYSTEM_PROMPT.format(dog_info=dog_info_str)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg}
        ]

    # 3. OpenAIで返信生成
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        max_tokens=500
    )
    ai_reply = response.choices[0].message.content

    # 4. ログ保存
    supabase.table("chat_logs").insert([
        {"user_id": user_id, "message": user_msg, "sender": "user"},
        {"user_id": user_id, "message": ai_reply, "sender": "ai"}
    ]).execute()

    # 5. 【重要】レスポンスとして返す（LINE APIは叩かない）
    return {"reply": ai_reply}