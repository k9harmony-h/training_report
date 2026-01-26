/**
 * ============================================================================
 * K9 Harmony - Production Configuration
 * ============================================================================
 * 本番環境用設定
 * 使用方法: デプロイ時に config.js を config.production.js で上書き
 */

const CONFIG = {
  // バージョン情報
  VERSION: 'v2026.01.26',
  BUILD_DATE: '2026-01-26',

  // デバッグ設定（本番環境: 全てOFF）
  DEBUG: {
    ENABLED: false,
    LOG_API_CALLS: false,
    LOG_LIFF_EVENTS: false,
    LOG_UI_EVENTS: false,
    LOG_PERFORMANCE: false
  },

  // API設定
  API: {
    GAS_URL: 'https://k9-harmony-ppcl.k9-harmony-ppcl.workers.dev',
    TIMEOUT: 30000,
    RETRY_COUNT: 3,
    RETRY_DELAY: 1000
  },

  // LIFF設定
  LIFF: {
    ID: '2008546673-MJY7j3ox'
  },

  // Square設定（本番）
  SQUARE: {
    APP_ID: 'sq0idp-Be2C7nNqHdTLuPmOieTTdQ',
    LOCATION_ID: 'LP7Q98MRY63VH',
    SDK_URL: 'https://web.squarecdn.com/v1/square.js'
  },

  // 事務所所在地
  OFFICE: {
    LAT: 35.7665,
    LNG: 139.6936,
    ADDRESS: '東京都板橋区前野町6-55-1'
  },

  // 料金設定
  PRICING: {
    MULTI_DOG_FEE: 2000,
    MULTI_DOG_DURATION: 30,

    TRAVEL_FEE: {
      TIER_1: { MAX: 3,  FEE: 0 },
      TIER_2: { MAX: 5,  FEE: 500 },
      TIER_3: { MAX: 10, FEE: 1000 },
      TIER_4: { MAX: 15, FEE: 1500 },
      TIER_5: { BASE: 1500, PER_KM: 100 }
    },

    CANCELLATION: {
      DAYS_4_PLUS: 0,
      DAYS_2_TO_3: 0.5,
      DAYS_0_TO_1: 1.0
    }
  },

  // UI設定
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
    TIP_ROTATION_INTERVAL: 1200,

    CALENDAR: {
      PREFETCH_MONTHS: 3,
      CACHE_DURATION: 300000
    }
  },

  // 外部サービスAPI
  EXTERNAL: {
    ZIP_CLOUD_API: 'https://zipcloud.ibsnet.co.jp/api/search'
  },

  // バリデーション設定
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

  // スプレッドシートID
  SPREADSHEETS: {
    MASTER: '1HWDB3aaybBHHc9JtnZEZH-x2rztUZbb_Wd2-87USmao',
    TRANSACTIONS: '1ecSykDQYL_63iQYOcULlPS8ZVzxCSKOQdYq5bFuTfXY',
    ANALYTICS: '1DOfthZeF0fyMqJ5bzWQ4Tqf26xh9HKNdQg5hjl_pW6s',
    EVENTS: '15Ipv-HEKyJj9nccsTJ_nD3HLFiwFvnPNmOYzFlxh4gc'
  }
};

// ヘルパー関数
CONFIG.isDebugMode = function() {
  return this.DEBUG.ENABLED;
};

CONFIG.isProduction = function() {
  return !this.DEBUG.ENABLED;
};

CONFIG.calculateTravelFee = function(distanceKm) {
  const { TRAVEL_FEE } = this.PRICING;

  if (distanceKm <= TRAVEL_FEE.TIER_1.MAX) return TRAVEL_FEE.TIER_1.FEE;
  if (distanceKm <= TRAVEL_FEE.TIER_2.MAX) return TRAVEL_FEE.TIER_2.FEE;
  if (distanceKm <= TRAVEL_FEE.TIER_3.MAX) return TRAVEL_FEE.TIER_3.FEE;
  if (distanceKm <= TRAVEL_FEE.TIER_4.MAX) return TRAVEL_FEE.TIER_4.FEE;

  const excessKm = Math.ceil(distanceKm - TRAVEL_FEE.TIER_4.MAX);
  return TRAVEL_FEE.TIER_5.BASE + (excessKm * TRAVEL_FEE.TIER_5.PER_KM);
};

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

CONFIG.calculateDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

window.CONFIG = CONFIG;
