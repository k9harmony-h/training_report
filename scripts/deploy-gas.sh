#!/bin/bash
# ==============================================================================
# K9 Harmony - GAS デプロイスクリプト
# ==============================================================================
# 使用方法: ./scripts/deploy-gas.sh "デプロイの説明"
# 例: ./scripts/deploy-gas.sh "予約APIのバグ修正"
#
# このスクリプトは以下を自動的に実行します:
# 1. clasp push - GASにコードをアップロード
# 2. clasp deploy - 新しいデプロイメントを作成
# 3. Cloudflare Worker の GAS URLを更新
# 4. wrangler deploy - Workerを再デプロイ
# ==============================================================================

set -e  # エラー時に停止

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ベースディレクトリ
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
GAS_DIR="$BASE_DIR/gas"
CLOUDFLARE_DIR="$BASE_DIR/cloudflare"

# 引数チェック
DESCRIPTION="${1:-Auto deploy $(date +%Y-%m-%d_%H:%M)}"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}K9 Harmony GAS デプロイ開始${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Step 1: clasp push
echo -e "${YELLOW}[1/4] GASにコードをプッシュ中...${NC}"
cd "$GAS_DIR"
clasp push
echo -e "${GREEN}✓ clasp push 完了${NC}"
echo ""

# Step 2: clasp deploy
echo -e "${YELLOW}[2/4] 新しいデプロイメントを作成中...${NC}"
DEPLOY_OUTPUT=$(clasp deploy -d "$(date +%Y.%m.%d) - $DESCRIPTION" 2>&1)
echo "$DEPLOY_OUTPUT"

# デプロイメントIDを抽出
NEW_DEPLOY_ID=$(echo "$DEPLOY_OUTPUT" | grep -oE 'AKfycb[a-zA-Z0-9_-]+' | head -1)

if [ -z "$NEW_DEPLOY_ID" ]; then
    echo -e "${RED}✗ デプロイメントIDの取得に失敗しました${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 新しいデプロイメント: $NEW_DEPLOY_ID${NC}"
echo ""

# Step 3: Worker URLを更新
echo -e "${YELLOW}[3/4] Cloudflare Worker のGAS URLを更新中...${NC}"
cd "$CLOUDFLARE_DIR"

# 現在のデプロイメントIDを取得
OLD_DEPLOY_ID=$(grep -oE 'AKfycb[a-zA-Z0-9_-]+' worker.js | head -1)
echo "  旧ID: $OLD_DEPLOY_ID"
echo "  新ID: $NEW_DEPLOY_ID"

# URLを置換
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|$OLD_DEPLOY_ID|$NEW_DEPLOY_ID|g" worker.js
else
    # Linux
    sed -i "s|$OLD_DEPLOY_ID|$NEW_DEPLOY_ID|g" worker.js
fi

echo -e "${GREEN}✓ worker.js 更新完了${NC}"
echo ""

# Step 4: Workerをデプロイ
echo -e "${YELLOW}[4/4] Cloudflare Worker をデプロイ中...${NC}"
npx wrangler deploy worker.js --name k9-harmony-ppcl --compatibility-date $(date +%Y-%m-%d)
echo -e "${GREEN}✓ Worker デプロイ完了${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}全てのデプロイが完了しました！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "新しいGASデプロイメントID: $NEW_DEPLOY_ID"
echo ""
echo -e "${YELLOW}次のステップ:${NC}"
echo "1. 動作確認を行ってください"
echo "2. git add/commit/push で変更をコミットしてください"
