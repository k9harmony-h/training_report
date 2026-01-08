# HTML/CSS/JS 分離 - 実行ガイド

## 🎯 作業の進め方（推奨アプローチ）

### 方法A: 段階的移行（推奨・安全）

**メリット:**
- 各ステップで動作確認が可能
- 問題があればすぐにロールバック可能
- リスクが最小限

**手順:**
1. **Step 1:** CSSのみを分離 → 動作確認
2. **Step 2:** JavaScriptのみを分離 → 動作確認
3. **Step 3:** クリーンアップ

---

### 方法B: 一括移行（効率的）

**メリット:**
- 作業時間が短い
- 一度に完了できる

**デメリット:**
- 問題が発生した場合の原因特定が困難
- ロールバック時に全てを戻す必要がある

**推奨:** 経験豊富な場合は方法Bも可能ですが、安全を優先するなら方法A

---

## 📝 具体的な作業手順（方法A - 段階的移行）

### 【Phase 1】事前準備

```bash
# バックアップディレクトリ作成
mkdir -p backup/$(date +%Y%m%d)
cp index.html backup/$(date +%Y%m%d)/
cp -r css backup/$(date +%Y%m%d)/
cp -r js backup/$(date +%Y%m%d)/
```

---

### 【Phase 2】CSS分離（約15分）

#### 2-1. CSS抽出
1. `index.html`の28行目（`<style>`）から422行目（`</style>`）までをコピー
2. 内容を`css/home.css`として保存
3. `<style>`タグと`</style>`タグは除外

#### 2-2. HTML修正
1. `index.html`の`<head>`内、既存のCSS読み込みの後に以下を追加:
   ```html
   <link rel="stylesheet" href="css/home.css">
   ```

2. `<style>...</style>`タグ（28-422行目）を削除

#### 2-3. 動作確認チェックリスト
- [ ] ページが正常に表示される
- [ ] スタイルが正しく適用されている
- [ ] レスポンシブデザインが崩れていない
- [ ] アニメーションが正常に動作する
- [ ] モーダルが正常に表示される

**問題がなければ次のPhaseへ**

---

### 【Phase 3】JavaScript分離（約30分）

#### 3-1. JavaScript抽出準備
1. `index.html`内の`<script>`タグを確認
   - `<head>`内の即座実行スクリプト（5-11行目）→ これは残す
   - `<body>`末尾の大きなスクリプト（603-1452行目）→ これを分離

#### 3-2. 既存ファイルとの統合
1. `js/home.js`の既存内容を確認
2. `index.html`のJavaScriptを`js/home.js`に統合
   - 重複している関数は統合
   - 依存関係を確認

#### 3-3. 依存関係の整理

**読み込み順序（重要）:**
```html
<head>
  <!-- 外部ライブラリ -->
  <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/medium-zoom/dist/medium-zoom.min.js"></script>
  
  <!-- 設定ファイル（最初に読み込む） -->
  <script src="js/config.js"></script>
  
  <!-- 即座実行スクリプト（必要に応じて残す） -->
  <script>
    // [System] リダイレクト処理など
    (function() {
      if (new URLSearchParams(window.location.search).get('page') === 'medical') {
        window.location.replace('medical.html'); 
      }
    })();
  </script>
</head>

<body>
  <!-- HTML内容 -->
  
  <!-- 共通関数（次に読み込む） -->
  <script src="js/common.js"></script>
  
  <!-- ページ固有ロジック（最後に読み込む） -->
  <script src="js/home.js"></script>
</body>
```

#### 3-4. HTML修正
1. `index.html`の`<body>`末尾（603行目以降）の`<script>`タグを削除
2. 上記の読み込み順序で`<script>`タグを追加

#### 3-5. 動作確認チェックリスト
- [ ] ページが正常に読み込まれる
- [ ] LIFF認証が正常に動作する
- [ ] データ取得が正常に動作する
- [ ] チャートが正常に表示される
- [ ] マイルストーン機能が正常に動作する
- [ ] モーダルが正常に表示される
- [ ] 画像読み込みが正常に動作する
- [ ] コンソールエラーがない

**問題がなければ次のPhaseへ**

---

### 【Phase 4】クリーンアップ（約10分）

#### 4-1. 未使用コードの削除
- コメントアウトされたコードを削除
- 重複コードを削除

#### 4-2. コメント整理
- セクションごとにコメントを整理
- 関数の説明コメントを追加

#### 4-3. フォーマット統一
- インデントを統一
- セミコロンの使用を統一

---

## ⚠️ 注意すべきポイント

### 1. 即座実行スクリプトの扱い
`<head>`内の以下のようなスクリプトは残します：

```html
<script>
  // リダイレクト処理など、ページ読み込み前に実行が必要なコード
  (function() {
    if (new URLSearchParams(window.location.search).get('page') === 'medical') {
      window.location.replace('medical.html'); 
    }
  })();
</script>
```

**理由:** 外部ファイルに移動すると、HTMLの読み込みが完了するまで実行されない可能性があるため

### 2. グローバル変数の管理
複数のスクリプトファイルで共有する変数は、`window`オブジェクトに明示的に割り当て：

```javascript
// js/common.js
window.currentUserId = null;

// js/home.js
window.currentUserId = profile.userId;
```

または、名前空間パターンを使用：

```javascript
// js/common.js
window.K9App = window.K9App || {};
K9App.currentUserId = null;
```

### 3. イベントリスナーのタイミング
- `window.onload`を使用している場合 → `<body>`末尾に配置
- `DOMContentLoaded`を使用している場合 → どの位置でもOK（ただし外部ファイル内で使用）

---

## 🔄 ロールバック手順

### 問題が発生した場合

#### CSS分離で問題が発生
```bash
# バックアップから復元
cp backup/YYYYMMDD/index.html index.html
```

#### JavaScript分離で問題が発生
```bash
# バックアップから復元
cp backup/YYYYMMDD/index.html index.html
cp backup/YYYYMMDD/js/home.js js/home.js  # 既存ファイルを変更した場合
```

---

## 📊 進捗チェックリスト

### index.html 分離作業
- [ ] Phase 1: バックアップ作成
- [ ] Phase 2: CSS分離
  - [ ] css/home.css作成
  - [ ] index.htmlから<style>タグ削除
  - [ ] 外部CSS読み込み追加
  - [ ] 動作確認完了
- [ ] Phase 3: JavaScript分離
  - [ ] js/home.js統合
  - [ ] index.htmlから<script>タグ削除
  - [ ] 外部JS読み込み追加
  - [ ] 動作確認完了
- [ ] Phase 4: クリーンアップ完了

---

## 🚀 次のステップ

`index.html`の分離が完了したら：

1. **動作確認を十分に行う**
2. **Gitコミット**（問題なければ）
3. **次のファイル（reservation.html等）に進む**

準備ができ次第、作業を開始します！


