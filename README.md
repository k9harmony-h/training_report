# K9 Harmony - 予約システム

出張型ドッグトレーニングサービス「K9 Harmony」のLINE予約システム

## フォルダ構成

```
training_report/
├── public/                    # Cloudflare Pages デプロイ用
│   ├── index.html             # 予約画面（メイン）
│   ├── mypage.html            # マイページ
│   ├── css/
│   │   ├── common.css         # 共通スタイル
│   │   └── reservation.css    # 予約画面スタイル
│   ├── js/
│   │   ├── config.js          # 開発用設定
│   │   ├── config.production.js # 本番用設定
│   │   ├── liff-handler.js    # LIFF SDK管理
│   │   ├── api-client.js      # GAS API通信
│   │   ├── reservation.js     # 予約ロジック
│   │   └── mypage.js          # マイページロジック
│   └── assets/
│       └── K9_logoFull.png    # ロゴ画像
│
├── gas/                       # Google Apps Script バックエンド
│   ├── appsscript.json
│   ├── Main.js
│   ├── ReservationService.js
│   ├── SquareService.js
│   └── ...（36ファイル）
│
├── .gitignore
└── README.md
```

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | HTML / CSS / JavaScript |
| 認証 | LINE LIFF SDK |
| 決済 | Square Web Payments SDK |
| バックエンド | Google Apps Script |
| データ | Google Spreadsheet |
| ホスティング | Cloudflare Pages |
| プロキシ | Cloudflare Workers |

## 機能一覧

### 予約画面 (index.html)
- 犬・コース・トレーナー選択
- カレンダーから日時選択
- 出張費自動計算
- Square決済（カード/QUICPay/iD/交通系IC/現金）
- 予約確認

### マイページ (mypage.html)
- 今後の予約一覧
- 過去の予約履歴
- 予約キャンセル

## セットアップ

### 1. 開発環境

```bash
# ローカルサーバー起動
cd public
python3 -m http.server 8000

# アクセス: http://localhost:8000
```

### 2. 本番デプロイ（Cloudflare Pages）

```bash
# 本番用設定に切り替え
cp public/js/config.production.js public/js/config.js

# Cloudflare Pages へデプロイ
# 1. Cloudflare Dashboard → Pages → Create
# 2. GitHubリポジトリ連携
# 3. Build settings:
#    - Build command: (空欄)
#    - Build output directory: public
```

### 3. LIFF設定

LINE Developers Console:
1. LIFF アプリを選択
2. Endpoint URL: `https://your-domain.pages.dev/`

### 4. GAS管理

```bash
cd gas
clasp login
clasp push    # GASへアップロード
clasp deploy  # デプロイ
```

## 環境切り替え

| 環境 | 設定ファイル | DEBUG |
|---|---|---|
| 開発 | `config.js` | `true` |
| 本番 | `config.production.js` | `false` |

## テスト用カード（Square Sandbox）

| カード番号 | CVV | 郵便番号 | 結果 |
|---|---|---|---|
| 4111 1111 1111 1111 | 111 | 11111 | 成功 |
| 4000 0000 0000 0002 | 111 | 11111 | 失敗 |

有効期限: 未来の任意の日付

## 連絡先

**K9 Harmony -Paws & People Cultural Lab-**
- 住所: 〒174-0063 東京都板橋区前野町6-55-1
- TEL: 070-9043-1109

---

最終更新: 2026-01-26
