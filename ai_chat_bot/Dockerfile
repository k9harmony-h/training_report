# 1. Pythonの公式イメージを使う
FROM python:3.11-slim

# 2. ログがすぐに表示されるようにする設定
ENV PYTHONUNBUFFERED=True

# 3. 作業ディレクトリを作成
ENV APP_HOME=/app
WORKDIR $APP_HOME

# 4. 必要なファイルをコピーする
# (backendフォルダとfrontendフォルダ、requirements.txtをコピー)
COPY backend ./backend
COPY frontend ./frontend

# 5. ライブラリをインストール
# (backend/requirements.txt の場所を指定)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 6. アプリを起動する
# (Cloud Runは環境変数 PORT でポート番号を指定してくるのでそれを使う)
CMD exec uvicorn backend.main:app --host 0.0.0.0 --port $PORT