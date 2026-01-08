# HTML/CSS/JS 分離リファクタリング計画

## 📋 目的
HTMLファイルからインラインCSSとJavaScriptを分離し、外部ファイルとして読み込む形に変更する。
現在の動作を保ちながら、保守性とパフォーマンスを向上させる。

---

## 🎯 作業方針

### 原則
1. **1ファイルずつ確実に** - 一度に複数ファイルを変更しない
2. **バックアップ必須** - 各ステップ前にバックアップ
3. **動作確認しながら** - 各ステップ後に動作確認
4. **段階的な移行** - CSS → JavaScript の順で分離
5. **ロールバック可能** - 問題があればすぐに戻せる

---

## 📁 作業対象ファイルの優先順位

### Phase 1: 優先度最高（最も影響が大きい）
1. ✅ **index.html** - ホームページ（1400行以上のインラインコード）

### Phase 2: 高優先度
2. ✅ **reservation.html** - 予約ページ（複雑なロジック）
3. ✅ **diagnosis.html** - 診断ページ（外部ライブラリ使用）
4. ✅ **history.html** - 履歴ページ

### Phase 3: 中優先度
5. ✅ **medical.html** - 医療手帳
6. ✅ **admin.html** - 管理画面
7. ✅ **heritage.html** - ストーリーページ

### Phase 4: 低優先度
8. ✅ **presentation.html** - プレゼン資料（静的）

---

## 🛠️ 作業手順（index.html を例に）

### ステップ1: 事前準備
```bash
# バックアップ作成（推奨）
cp index.html index.html.backup
cp -r css/ css.backup/
cp -r js/ js.backup/
```

### ステップ2: CSS分離

#### 2-1. 既存CSSファイルの確認
- `css/style.css` が既に存在するか確認
- 既存のスタイルと重複していないか確認

#### 2-2. CSS抽出と分離
1. `index.html`の`<style>`タグ内のCSSを抽出
2. `css/home.css`（新規作成）に移動
3. 既存の`css/style.css`と重複があれば統合
4. `index.html`に`<link rel="stylesheet" href="css/home.css">`を追加
5. `<style>`タグを削除

#### 2-3. 動作確認
- ブラウザで表示確認
- スタイルが正しく適用されているか確認

### ステップ3: JavaScript分離

#### 3-1. JavaScript抽出と分離
1. `index.html`の`<script>`タグ内のJavaScriptを抽出
2. 既存の`js/home.js`があるか確認
3. `js/home.js`に統合（既存のコードとマージ）
4. `index.html`に`<script src="js/config.js"></script>`を追加（必要に応じて）
5. `index.html`に`<script src="js/common.js"></script>`を追加（必要に応じて）
6. `index.html`に`<script src="js/home.js"></script>`を追加（bodyの最後）
7. `<script>`タグ（インライン）を削除

#### 3-2. 依存関係の整理
- `js/config.js`（設定）
- `js/common.js`（共通関数）
- `js/home.js`（ページ固有ロジック）

**読み込み順序:**
```html
<head>
  <!-- 外部ライブラリ -->
  <script src="..."></script>
  
  <!-- 設定ファイル（最初に読み込む） -->
  <script src="js/config.js"></script>
</head>
<body>
  <!-- ... HTML ... -->
  
  <!-- 共通関数（次に読み込む） -->
  <script src="js/common.js"></script>
  <!-- ページ固有（最後に読み込む） -->
  <script src="js/home.js"></script>
</body>
```

#### 3-3. 動作確認
- すべての機能が正常に動作するか確認
- コンソールエラーがないか確認
- LIFF認証が正常に動作するか確認

### ステップ4: クリーンアップ
1. 未使用のコード削除
2. コメントの整理
3. インデント・フォーマット統一

---

## 📐 ファイル構造（完成形）

```
training_report/
├── index.html              # HTMLのみ（外部ファイル読み込み）
├── css/
│   ├── style.css          # 共通スタイル
│   ├── home.css           # index.html用スタイル
│   ├── reservation.css    # reservation.html用スタイル
│   └── ...                # その他のページ用CSS
├── js/
│   ├── config.js          # 設定（全ページ共通）
│   ├── common.js          # 共通関数（全ページ共通）
│   ├── home.js            # index.html用ロジック
│   ├── reservation.js     # reservation.html用ロジック
│   └── ...                # その他のページ用JS
└── ...
```

---

## ⚠️ 注意事項

### 1. インラインスクリプトの扱い
**問題:** `<head>`内の即座に実行されるスクリプト
```html
<script>
  // リダイレクト処理など、即座に実行が必要なコード
  (function() {
    if (new URLSearchParams(window.location.search).get('page') === 'medical') {
      window.location.replace('medical.html'); 
    }
  })();
</script>
```

**解決策:**
- このようなコードは外部ファイルに移しても、`defer`や`async`属性を使わない
- または、HTMLの`<head>`内に最小限のコードとして残す（この場合のみ）

### 2. DOMContentLoaded の扱い
**問題:** `window.onload`やDOMContentLoadedイベントのタイミング

**解決策:**
- 外部JSファイルでは`DOMContentLoaded`イベントを使用
- `window.onload`を使っている場合は、スクリプトを`<body>`の最後に配置

### 3. グローバル変数の管理
**問題:** 複数のスクリプトタグ間で変数を共有している場合

**解決策:**
- グローバル変数は`window`オブジェクトに明示的に割り当て
- または、名前空間パターンを使用

---

## ✅ チェックリスト（各ファイルごと）

### CSS分離チェック
- [ ] すべてのスタイルが外部CSSファイルに移動
- [ ] `<style>`タグが完全に削除されている
- [ ] CSSファイルが正しく読み込まれている
- [ ] スタイルが正しく適用されている
- [ ] レスポンシブデザインが崩れていない

### JavaScript分離チェック
- [ ] すべてのスクリプトが外部JSファイルに移動
- [ ] `<script>`タグ（インライン）が削除されている
- [ ] 外部JSファイルが正しい順序で読み込まれている
- [ ] すべての機能が正常に動作する
- [ ] コンソールエラーがない
- [ ] LIFF認証が正常に動作する
- [ ] API呼び出しが正常に動作する

---

## 🔄 ロールバック手順

もし問題が発生した場合：

```bash
# バックアップから復元
cp index.html.backup index.html
cp css.backup/style.css css/style.css  # 既存ファイルを上書きした場合
```

---

## 📊 進捗管理

| ファイル | CSS分離 | JS分離 | 動作確認 | 完了 |
|---------|---------|--------|----------|------|
| index.html | ⬜ | ⬜ | ⬜ | ⬜ |
| reservation.html | ⬜ | ⬜ | ⬜ | ⬜ |
| diagnosis.html | ⬜ | ⬜ | ⬜ | ⬜ |
| history.html | ⬜ | ⬜ | ⬜ | ⬜ |
| medical.html | ⬜ | ⬜ | ⬜ | ⬜ |
| admin.html | ⬜ | ⬜ | ⬜ | ⬜ |
| heritage.html | ⬜ | ⬜ | ⬜ | ⬜ |
| presentation.html | ⬜ | ⬜ | ⬜ | ⬜ |

---

## 🚀 実装開始

まずは`index.html`から開始し、1つずつ確実に進めていきます。

**次のステップ:**
1. `index.html`のバックアップ作成
2. CSS抽出と`css/home.css`作成
3. JavaScript抽出と`js/home.js`統合
4. 動作確認

準備ができ次第、作業を開始します。


