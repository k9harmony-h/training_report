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
    GAS_URL: 'https://script.google.com/macros/s/AKfycbyJ2j7iNeojVPB8SeRozbh9WIqH0CLkwb8Q67300WK2ydsxt8nKdZmLbNQq1Wuu9zX0/exec',

    // 管理機能用APIキー (admin.htmlで使用)
    ADMIN_KEY: 'k9_secret_key_2025',

    // Square決済設定 (Sandbox)
    SQUARE: {
        APP_ID: 'sandbox-sq0idb-gCSIUTwd9ZQ7QtByBHz7uQ',
        LOCATION_ID: 'L9DXQ4GQKFNZV'
    }
};
