/**
 * ============================================================================
 * K9 Harmony - Frontend Configuration
 * ============================================================================
 * フロントエンド用の設定ファイル
 * 最終更新: 2026-01-08
 */

const FRONTEND_CONFIG = {
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LIFF設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LIFF: {
    LIFF_ID: '2008546673-MJY7j3ox'
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GAS API設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  API: {
    // 本番環境ではこのURLを実際のGAS WebアプリURLに置き換え
    BASE_URL: 'https://script.google.com/macros/s/AKfycby-QIf4K6z5MHgVZYUiR-WTxRjAsivLvOp8TAFH4vTm5E3ebjA7cyf7yzHdAend8D0pJw/exec',
    TIMEOUT: 30000 // 30秒
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Square Web Payments SDK設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SQUARE: {
    // Sandbox環境
    SANDBOX: {
      APPLICATION_ID: 'sandbox-sq0idb-gCSIUTwd9ZQ7QtByBHz7uQ',
      LOCATION_ID: 'L9DXQ4GQKFNZV'
    },
    // Production環境（本番切り替え時に使用）
    PRODUCTION: {
      APPLICATION_ID: 'sq0idp-Be2C7nNqHdTLuPmOieTTdQ',
      LOCATION_ID: 'LP7Q98MRY63VH'
    },
    // 現在の環境（'sandbox' または 'production'）
    ENVIRONMENT: 'sandbox'
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Lottieアニメーション設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LOTTIE: {
    LOADING_DOG: 'https://lottie.host/f0ca8a13-dc48-4a0c-9c3f-6efc6f5e0e84/w5c5W0oGn9.json'
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // UI設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  UI: {
    ANIMATION_DURATION: 300, // ms
    TOAST_DURATION: 3000,    // ms
    MAX_ADVANCE_DAYS: 60,    // 予約可能な最大日数
    BUSINESS_HOURS: {
      START: 9,  // 9:00
      END: 18    // 18:00
    }
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // エラーメッセージ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ERROR_MESSAGES: {
    LIFF_INIT_FAILED: 'LINEアプリの初期化に失敗しました。',
    NOT_LOGGED_IN: 'ログインが必要です。',
    API_ERROR: 'サーバーとの通信に失敗しました。',
    NETWORK_ERROR: 'ネットワークエラーが発生しました。',
    PAYMENT_ERROR: '決済処理に失敗しました。',
    VALIDATION_ERROR: '入力内容を確認してください。',
    SLOT_LOCKED: 'この予約枠は既に他の方が選択中です。',
    UNKNOWN_ERROR: '予期しないエラーが発生しました。'
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 成功メッセージ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SUCCESS_MESSAGES: {
    RESERVATION_CREATED: '予約が完了しました！',
    PAYMENT_SUCCESS: '決済が完了しました。',
    SLOT_LOCKED: '予約枠を確保しました。'
  }
};

/**
 * 現在のSquare環境設定を取得
 */
function getCurrentSquareConfig() {
  const env = FRONTEND_CONFIG.SQUARE.ENVIRONMENT;
  return FRONTEND_CONFIG.SQUARE[env.toUpperCase()];
}

/**
 * APIエンドポイントURLを生成
 */
function getApiUrl(action, params = {}) {
  const url = new URL(FRONTEND_CONFIG.API.BASE_URL);
  url.searchParams.append('action', action);
  
  Object.keys(params).forEach(key => {
    url.searchParams.append(key, params[key]);
  });
  
  return url.toString();
}