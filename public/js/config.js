/**
 * ============================================================================
 * K9 Harmony - Configuration
 * ============================================================================
 * アプリケーション全体の設定
 * 最終更新: 2026-01-26
 * 変更内容: ERROR_MESSAGES, ASSETS, UI.TOAST_DURATION 追加
 * バージョン: v2.0.0
 */

const CONFIG = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // バージョン情報
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VERSION: 'v2026.01.26',
  BUILD_DATE: '2026-01-26',
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // デバッグ設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DEBUG: {
    ENABLED: true,              // 本番環境では false に設定
    LOG_API_CALLS: true,        // API呼び出しをログに記録
    LOG_LIFF_EVENTS: true,      // LIFFイベントをログに記録
    LOG_UI_EVENTS: true,        // UI操作をログに記録
    LOG_PERFORMANCE: true       // パフォーマンス測定をログに記録
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // API設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  API: {
    // Cloudflare Workers プロキシ経由（CORS対応）
    GAS_URL: 'https://k9-harmony-ppcl.k9-harmony-ppcl.workers.dev',
    // 直接GAS（参考用・CORS非対応）
    // GAS_URL: 'https://script.google.com/macros/s/AKfycbya1cNbUgl_-iNlvk0RXOMeiL2ziQBeNyhPdEafZWoK7jk9cFKFA07AM0QiscJ80zZtiQ/exec',
    TIMEOUT: 30000,             // タイムアウト（ミリ秒）
    RETRY_COUNT: 3,             // リトライ回数
    RETRY_DELAY: 1000           // リトライ間隔（ミリ秒）
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LIFF設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LIFF: {
    ID: '2008546673-MJY7j3ox'
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Square設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SQUARE: {
    APP_ID: 'sq0idp-Be2C7nNqHdTLuPmOieTTdQ',      // Production App ID
    LOCATION_ID: 'LP7Q98MRY63VH',                 // Production Location ID
    SDK_URL: 'https://web.squarecdn.com/v1/square.js'  // Production SDK
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 事務所所在地（出張費計算用）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  OFFICE: {
    LAT: 35.7665,    // 緯度
    LNG: 139.6936,   // 経度
    ADDRESS: '東京都板橋区前野町6-55-1'
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 料金設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PRICING: {
    MULTI_DOG_FEE: 2000,        // 複数頭追加料金（円）
    MULTI_DOG_DURATION: 30,     // 複数頭追加時間（分）
    
    // 出張費計算（距離ベース）
    TRAVEL_FEE: {
      TIER_1: { MAX: 3,  FEE: 0 },       // 3km以内: 無料
      TIER_2: { MAX: 5,  FEE: 500 },     // 3-5km: 500円
      TIER_3: { MAX: 10, FEE: 1000 },    // 5-10km: 1000円
      TIER_4: { MAX: 15, FEE: 1500 },    // 10-15km: 1500円
      TIER_5: { BASE: 1500, PER_KM: 100 } // 15km超: 1500円 + 100円/km
    },

    // キャンセル料率
    CANCELLATION: {
      DAYS_4_PLUS: 0,      // 4日前まで: 無料
      DAYS_2_TO_3: 0.5,    // 3-2日前: 50%
      DAYS_0_TO_1: 1.0     // 前日-当日: 100%
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // UI設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  UI: {
    LOADING_TIPS: [
      "犬の鼻紋は一頭一頭違います。",
      "犬は人間の約4倍の聴力を持っています。",
      "犬の嗅覚は人間の100万倍以上。",
      "犬は肉球からしか汗をかけません。",
      "あくびはストレスサインかも？",
      "しっぽが右寄りなら「嬉しい」サイン。",
      "小型犬は大型犬より長生き傾向。",
      "犬も夢を見ます。",
      "ダルメシアンは生まれたては真っ白。",
      "顔を舐めるのは愛情表現です。"
    ],
    TIP_ROTATION_INTERVAL: 1200,  // ローディングTips表示間隔（ミリ秒）
    TOAST_DURATION: 3000,         // トースト表示時間（ミリ秒）

    // カレンダー設定
    CALENDAR: {
      PREFETCH_MONTHS: 3,         // 事前読み込み月数
      CACHE_DURATION: 300000      // キャッシュ有効期間（5分）
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // エラーメッセージ（顧客向け）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ERROR_MESSAGES: {
    LIFF_INIT_FAILED: 'LINEアプリの初期化に失敗しました。ページを再読み込みしてください。',
    NOT_LOGGED_IN: 'ログインが必要です。LINEアプリから開いてください。',
    API_TIMEOUT: 'サーバーとの通信がタイムアウトしました。',
    API_ERROR: 'サーバーとの通信に失敗しました。',
    PAYMENT_FAILED: '決済処理に失敗しました。',
    RESERVATION_FAILED: '予約の確定に失敗しました。',
    VALIDATION_ERROR: '入力内容に誤りがあります。'
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // アセットURL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ASSETS: {
    LOGO: 'assets/K9_logoFull.png',
    LOTTIE: {
      LOADING_DOG: 'https://lottie.host/f4a4a4a4-4a4a-4a4a-4a4a-4a4a4a4a4a4a/loading-dog.json'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 外部サービスAPI
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  EXTERNAL: {
    ZIP_CLOUD_API: 'https://zipcloud.ibsnet.co.jp/api/search'  // 郵便番号検索API
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // バリデーション設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VALIDATION: {
    PHONE: {
      PATTERN: /^0\d{9,10}$/,
      MESSAGE: '有効な電話番号を入力してください'
    },
    ZIP: {
      PATTERN: /^\d{3}-?\d{4}$/,
      MESSAGE: '郵便番号は7桁で入力してください'
    },
    EMAIL: {
      PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      MESSAGE: '有効なメールアドレスを入力してください'
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // スプレッドシートID（参照用）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SPREADSHEETS: {
    MASTER: '1HWDB3aaybBHHc9JtnZEZH-x2rztUZbb_Wd2-87USmao',
    TRANSACTIONS: '1ecSykDQYL_63iQYOcULlPS8ZVzxCSKOQdYq5bFuTfXY',
    ANALYTICS: '1DOfthZeF0fyMqJ5bzWQ4Tqf26xh9HKNdQg5hjl_pW6s',
    EVENTS: '15Ipv-HEKyJj9nccsTJ_nD3HLFiwFvnPNmOYzFlxh4gc'
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ヘルパー関数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * デバッグモード判定
 */
CONFIG.isDebugMode = function() {
  return this.DEBUG.ENABLED;
};

/**
 * 本番環境判定
 */
CONFIG.isProduction = function() {
  return !this.DEBUG.ENABLED;
};

/**
 * 出張費計算
 * @param {number} distanceKm - 距離（km）
 * @returns {number} 出張費（円）
 */
CONFIG.calculateTravelFee = function(distanceKm) {
  const { TRAVEL_FEE } = this.PRICING;
  
  if (distanceKm <= TRAVEL_FEE.TIER_1.MAX) return TRAVEL_FEE.TIER_1.FEE;
  if (distanceKm <= TRAVEL_FEE.TIER_2.MAX) return TRAVEL_FEE.TIER_2.FEE;
  if (distanceKm <= TRAVEL_FEE.TIER_3.MAX) return TRAVEL_FEE.TIER_3.FEE;
  if (distanceKm <= TRAVEL_FEE.TIER_4.MAX) return TRAVEL_FEE.TIER_4.FEE;
  
  const excessKm = Math.ceil(distanceKm - TRAVEL_FEE.TIER_4.MAX);
  return TRAVEL_FEE.TIER_5.BASE + (excessKm * TRAVEL_FEE.TIER_5.PER_KM);
};

/**
 * キャンセル料率取得
 * @param {string} reservationDate - 予約日（YYYY-MM-DD）
 * @returns {Object} { rate: number, label: string, days: number }
 */
CONFIG.getCancellationRate = function(reservationDate) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const resDate = new Date(reservationDate);
  resDate.setHours(0, 0, 0, 0);
  
  const diffTime = resDate - now;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const { CANCELLATION } = this.PRICING;
  
  if (diffDays >= 4) {
    return { rate: CANCELLATION.DAYS_4_PLUS, label: '無料', days: diffDays };
  }
  if (diffDays >= 2) {
    return { rate: CANCELLATION.DAYS_2_TO_3, label: '50%', days: diffDays };
  }
  return { rate: CANCELLATION.DAYS_0_TO_1, label: '100%', days: diffDays };
};

/**
 * 2地点間の距離計算（Haversine formula）
 * @param {number} lat1 - 地点1の緯度
 * @param {number} lon1 - 地点1の経度
 * @param {number} lat2 - 地点2の緯度
 * @param {number} lon2 - 地点2の経度
 * @returns {number} 距離（km）
 */
CONFIG.calculateDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球の半径（km）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// グローバルに公開
window.CONFIG = CONFIG;