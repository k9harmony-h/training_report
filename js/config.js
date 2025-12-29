/**
 * js/config.js
 * アプリケーション全体の設定ファイル
 * 最終更新: 2025-12-29
 */
const Config = {
    // LINE Developersコンソールで取得したLIFF ID
    LIFF_ID: '2008546673-MJY7j3ox',

    // デプロイしたGoogle Apps ScriptのウェブアプリURL
    // ※必ず末尾が /exec で終わるものを使用してください
    GAS_URL: 'https://script.google.com/macros/s/AKfycbzWkpA6bvAETxV34lE05e5SSW34CvjoxOH6K8V9oSAGMCZbUR7ar6g84FcHihICsK2F/exec',

    // 管理機能用APIキー (admin.htmlで使用)
    ADMIN_KEY: 'k9_secret_key_2025',

    // Square決済設定 (Sandbox)
    SQUARE: {
        APP_ID: 'sandbox-sq0idb-gCSIUTwd9ZQ7QtByBHz7uQ',
        LOCATION_ID: 'L9DXQ4GQKFNZV'
    }
};
