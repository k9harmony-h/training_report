// heritage.gs

/**
 * HeritageページのHTMLを生成して返す関数
 * main.gs の doGet() から呼ばれることを想定
 * * @param {Object} params - URLパラメータやユーザー情報を含むオブジェクト
 * @return {HtmlOutput}
 */
function createHeritagePage(params) {
  // 1. テンプレートファイル (heritage.html) を読み込む
  const template = HtmlService.createTemplateFromFile('heritage');

  // 2. main.gs から渡されたデータをテンプレート変数にセット
  // もしデータがない場合はデフォルト値を設定（エラー回避）
  template.ownerName = params.ownerName || "オーナー様";
  template.dogName = params.dogName || "愛犬";

  // 3. 評価(Evaluate)してHTML化
  // XFrameOptionsMode.ALLOWALL はLINEブラウザ等での表示に必要
  return template.evaluate()
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setTitle('K9 Heritage')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}