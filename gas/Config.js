/**
 * ============================================================================
 * K9 Harmony - Configuration (Complete Version - FIXED v2.2.1)
 * ============================================================================
 * 最終更新: 2026-01-02
 * バージョン: v2.2.1
 * 
 * 修正内容:
 * - Sandbox LOCATION_ID を修正: L9DXQ4GQKFNZV
 */

const CONFIG = {
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Spreadsheet 設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPREADSHEET: {
  MASTER_ID: '1HWDB3aaybBHHc9JtnZEZH-x2rztUZbb_Wd2-87USmao',
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 年度別トランザクションスプレッドシート
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TRANS_ID_2026: '1ecSykDQYL_63iQYOcULlPS8ZVzxCSKOQdYq5bFuTfXY',
  // TRANS_ID_2027: 'ここに2027年のIDが入る（1/1に自動作成）',
  
  // 現在の年度のトランザクションID（後方互換性のため）
  get TRANS_ID() {
    return this.getCurrentYearTransId();
  },
  
  /**
   * 現在の年度のトランザクションスプレッドシートIDを取得
   */
  getCurrentYearTransId: function() {
    var currentYear = new Date().getFullYear();
    var key = 'TRANS_ID_' + currentYear;
    
    if (this[key]) {
      return this[key];
    }
    
    // 該当年度のIDが見つからない場合は最新のIDを返す
    log('WARN', 'Config', 'Transaction spreadsheet ID not found for year: ' + currentYear);
    return this.TRANS_ID_2026;  // フォールバック
  },
  
  /**
   * 指定年度のトランザクションスプレッドシートIDを取得
   */
  getTransIdForYear: function(year) {
    var key = 'TRANS_ID_' + year;
    
    if (this[key]) {
      return this[key];
    }
    
    log('WARN', 'Config', 'Transaction spreadsheet ID not found for year: ' + year);
    return null;
  },
  
  ANALYTICS_ID: '1DOfthZeF0fyMqJ5bzWQ4Tqf26xh9HKNdQg5hjl_pW6s',
  EVENT_ID: '15Ipv-HEKyJj9nccsTJ_nD3HLFiwFvnPNmOYzFlxh4gc',
  
  // アーカイブフォルダ
  ARCHIVE_FOLDER_ID: '1WR_MAfJ_eBCEIE0i_tyw7uEkNN5Jg6i6'
},
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // シート名定義
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SHEET: {
    // Master
    CUSTOMERS: '顧客情報',
    DOGS: '犬情報',
    TRAINERS: 'トレーナーマスタ',
    OFFICES: '事業所マスタ',
    PRODUCTS: '商品マスタ',
    COUPONS: 'クーポンマスタ',
    SYSTEM_CONFIG: 'Config',
    SYSTEM_LOGS: 'Systemログ',
    
    // Transactions
    RESERVATIONS: '予約台帳',
    PAYMENTS: '決済履歴',
    LESSONS: 'レッスン評価',
    SALES: '売上管理',
    EXPENSES: '経費',
    PROCUREMENTS: '仕入',
    RESERVATION_LOCKS: '予約枠ロック',
    TRANSACTION_LOG: 'トランザクションログ',
    RETRY_LOGS: 'リトライログ',
    
    // Analytics
    CUSTOMER_LIFECYCLE: 'ライフサイクル',
    LIFECYCLE_CHANGES: 'ライフサイクル変更履歴',
    LIFECYCLE_REPORTS: 'ライフサイクルレポート',
    AD_TRACKING: '広告管理',
    CAMPAIGNS: 'キャンペーン管理',
    INVOICES: '請求書',
    TAX_REPORTS: '確定申告',
    AUDIT_LOGS: '監査ログ',
    
    // Events
    EVENTS: 'イベント管理',
    EVENT_APPLICATIONS: 'イベント申込'
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Google Drive フォルダ設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  FOLDER: {
    ROOT_ID: '1kegDvIY7Ukmi4IEai8xcP823v42-Ls4-',
    CUSTOMERS_ROOT: '1Af5NfmKL7S8NszCZHLJHBgfRwPqcTeEy'
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Googleカレンダー設定（追加）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GOOGLE_CALENDAR: {
  CALENDAR_ID: 'cacc5a66bcbced84914ba3e351f17220afc2043517a9bb855fbe8023378fd8dc@group.calendar.google.com'
},

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LIFF 設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LIFF: {
    LIFF_ID: '2008546673-MJY7j3ox',
    BASE_URL: 'https://liff.line.me/2008546673-MJY7j3ox'
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LINE Messaging API 設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LINE: {
    CHANNEL_ID: '2008546673',
    CHANNEL_SECRET: getScriptProperty('LINE_CHANNEL_SECRET'),
    CHANNEL_ACCESS_TOKEN: getScriptProperty('LINE_CHANNEL_ACCESS_TOKEN'),
    MESSAGING_API_URL: 'https://api.line.me/v2/bot/message',
    VERIFY_API_URL: 'https://api.line.me/oauth2/v2.1/verify'
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Square 決済設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SQUARE: {
    ENVIRONMENT: 'production',
    SANDBOX_MODE: false,
    
    SANDBOX: {
      ACCESS_TOKEN: getScriptProperty('SQUARE_SANDBOX_ACCESS_TOKEN'),
      APPLICATION_ID: 'sandbox-sq0idb-gCSIUTwd9ZQ7QtByBHz7uQ',
      LOCATION_ID: 'L9DXQ4GQKFNZV',  // ← 修正（Sandbox用の正しいID）
      API_URL: 'https://connect.squareupsandbox.com/v2'
    },
    
    PRODUCTION: {
      ACCESS_TOKEN: getScriptProperty('SQUARE_PRODUCTION_ACCESS_TOKEN'),
      APPLICATION_ID: getScriptProperty('SQUARE_PRODUCTION_APP_ID'),
      LOCATION_ID: 'LP7Q98MRY63VH',  // ← Production用はこちら
      API_URL: 'https://connect.squareup.com/v2'
    }
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Google Maps API 設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GOOGLE_MAPS: {
    API_KEY: getScriptProperty('GOOGLE_MAPS_API_KEY'),
    GEOCODING_URL: 'https://maps.googleapis.com/maps/api/geocode/json',
    DISTANCE_MATRIX_URL: 'https://maps.googleapis.com/maps/api/distancematrix/json'
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 管理画面 API 設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ADMIN: {
    API_KEY: getScriptProperty('ADMIN_API_KEY') || 'k9_secret_key_2025',
    EMAIL: 'k9.harmony.ppcl@gmail.com'
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ビジネスルール設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BUSINESS: {
    TAX_RATE: 0.10,
    FISCAL_YEAR_START: '04/01',
    
    RESERVATION: {
      BUFFER_MINUTES: 30,
      MAX_ADVANCE_DAYS: 60,
      CANCEL_DEADLINE_HOURS: 24,
      DEFAULT_DURATION: 90
    },
    
    LIFECYCLE: {
      TRIAL_THRESHOLD: 1,
      REGULAR_THRESHOLD: 3,
      LOYAL_THRESHOLD_MONTHS: 6,
      VIP_THRESHOLD_REVENUE: 100000,
      CHURN_THRESHOLD_DAYS: 180
    }
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // システム設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SYSTEM: {
    API_VERSION: 'v2.2.1',
    MIN_CLIENT_VERSION: '1.0.0',
    LOG_LEVEL: 'INFO',
    LOG_RETENTION_DAYS: 7,
    CACHE_TTL: 300
  }
};

// ============================================================================
// ヘルパー関数
// ============================================================================

function getScriptProperty(key) {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(key);
  } catch (e) {
    console.error(`Failed to get property: ${key}`, e);
    return null;
  }
}

//後ほど削除
function getCurrentSquareEnv_() {
  const env = CONFIG.SQUARE.ENVIRONMENT;
  return CONFIG.SQUARE[env.toUpperCase()];
}

function getAdminApiKey() {
  return CONFIG.ADMIN.API_KEY;
}

function getSpreadsheet_(type) {
  const cacheKey = `ss_${type}`;
  const cache = CacheService.getScriptCache();
  
  let ssId = cache.get(cacheKey);
  
  if (!ssId) {
    if (type === 'master') {
      ssId = CONFIG.SPREADSHEET.MASTER_ID;
    } else if (type === 'trans') {
      ssId = CONFIG.SPREADSHEET.TRANS_ID;
    } else if (type === 'analytics') {
      ssId = CONFIG.SPREADSHEET.ANALYTICS_ID;
    } else if (type === 'event') {
      ssId = CONFIG.SPREADSHEET.EVENT_ID;
    } else {
      throw new Error(`Invalid spreadsheet type: ${type}`);
    }
    
    cache.put(cacheKey, ssId, CONFIG.SYSTEM.CACHE_TTL);
  }
  
  return SpreadsheetApp.openById(ssId);
}

// ============================================================================
// セットアップ関数
// ============================================================================

function setupScriptProperties() {
  console.log('=== Setting up Script Properties ===');
  
  const props = PropertiesService.getScriptProperties();
  
  props.setProperty('LINE_CHANNEL_SECRET', '4d321918161823475cb244ac35e6a3be');
  props.setProperty('LINE_CHANNEL_ACCESS_TOKEN', 'z/vTjLfxCC+YtyJvsBedRk0EvZYG0gmMApNm1yTLTUTpwFGJUnjIA5lFtCc9rHU3GebfCBb1lbSv02QWhfXdH+ul+eJAlJAvbDkCEiTtdf55OpxdRBCubTJrEaIyB5HLT+kXr3+Uv7btxGZABB1CfQdB04t89/1O/w1cDnyilFU=');
  console.log('✅ LINE credentials set');
  
  props.setProperty('SQUARE_SANDBOX_ACCESS_TOKEN', 'EAAAlxo_WFb5qDGd8iWo9s5dVpEP5RlhDTeDaROW-YmXrYSh1-fWJd95vkkJzCrZ');
  console.log('✅ Square Sandbox credentials set');
  
  props.setProperty('SQUARE_PRODUCTION_ACCESS_TOKEN', 'EAAAl_CaoaeDrw6WZvVu37SpOe8jgRU6NlxnKXh9fSwisdK_PW76KQbT10IvMi6S');
  props.setProperty('SQUARE_PRODUCTION_APP_ID', 'sq0idp-Be2C7nNqHdTLuPmOieTTdQ');
  props.setProperty('SQUARE_PRODUCTION_LOCATION_ID', 'LP7Q98MRY63VH');
  console.log('✅ Square Production credentials set');
  
  props.setProperty('GOOGLE_MAPS_API_KEY', 'AIzaSyDzEGNHOHLj0A6s1UiotSRT3kxiAiKbhgQ');
  console.log('✅ Google Maps API Key set');
  
  const adminKey = 'k9_secure_' + Utilities.getUuid().replace(/-/g, '').substring(0, 20);
  props.setProperty('ADMIN_API_KEY', adminKey);
  console.log('✅ Admin API Key generated:', adminKey);
  
  console.log('\n=== Setup Complete ===');
}

function validateConfig() {
  console.log('=== Config Validation ===');
  
  let hasErrors = false;
  
  if (!CONFIG.SPREADSHEET.MASTER_ID) {
    console.error('❌ MASTER_ID not set');
    hasErrors = true;
  } else {
    console.log('✅ MASTER_ID set');
  }
  
  if (!CONFIG.SPREADSHEET.TRANS_ID) {
    console.error('❌ TRANS_ID not set');
    hasErrors = true;
  } else {
    console.log('✅ TRANS_ID set');
  }
  
  if (!CONFIG.SPREADSHEET.ANALYTICS_ID) {
    console.error('❌ ANALYTICS_ID not set');
    hasErrors = true;
  } else {
    console.log('✅ ANALYTICS_ID set');
  }
  
  if (!CONFIG.SPREADSHEET.EVENT_ID) {
    console.error('❌ EVENT_ID not set');
    hasErrors = true;
  } else {
    console.log('✅ EVENT_ID set');
  }
  
  if (!CONFIG.LINE.CHANNEL_SECRET) {
    console.error('❌ LINE_CHANNEL_SECRET not set');
    hasErrors = true;
  } else {
    console.log('✅ LINE_CHANNEL_SECRET set');
  }
  
  if (!CONFIG.LINE.CHANNEL_ACCESS_TOKEN) {
    console.error('❌ LINE_CHANNEL_ACCESS_TOKEN not set');
    hasErrors = true;
  } else {
    console.log('✅ LINE_CHANNEL_ACCESS_TOKEN set');
  }
  //内部用
  const squareEnv = getCurrentSquareEnv_();       // 公開用関数を使用
  if (!squareEnv.ACCESS_TOKEN) {
    console.error('❌ Square token not set');
    hasErrors = true;
  } else {
    console.log('✅ Square token set');
  }
  
  if (!CONFIG.GOOGLE_MAPS.API_KEY) {
    console.error('❌ GOOGLE_MAPS_API_KEY not set');
    hasErrors = true;
  } else {
    console.log('✅ GOOGLE_MAPS_API_KEY set');
  }
  
  if (hasErrors) {
    console.log('\n❌ Validation FAILED');
    return false;
  } else {
    console.log('\n✅ Validation PASSED');
    return true;
  }
}

function showConfig() {
  console.log('=== K9 Harmony Configuration ===');
  console.log('API Version:', CONFIG.SYSTEM.API_VERSION);
  console.log('Square Environment:', CONFIG.SQUARE.ENVIRONMENT);
  console.log('Square Sandbox Location:', CONFIG.SQUARE.SANDBOX.LOCATION_ID);
  console.log('Square Production Location:', CONFIG.SQUARE.PRODUCTION.LOCATION_ID);
  console.log('LIFF ID:', CONFIG.LIFF.LIFF_ID);
  console.log('Admin Email:', CONFIG.ADMIN.EMAIL);
  console.log('================================');
}

/**
 * Configシートから動的設定を取得
 */
function getConfigValue(category, key) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET.MASTER_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET.SYSTEM_CONFIG);
    
    if (!sheet) {
      throw new Error('Configシートが見つかりません');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const categoryIndex = headers.indexOf('category');
    const keyIndex = headers.indexOf('key');
    const valueIndex = headers.indexOf('value');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][categoryIndex] === category && data[i][keyIndex] === key) {
        return data[i][valueIndex];
      }
    }
    
    return null;
  } catch (error) {
    Logger.log('❌ Config取得エラー: ' + error.message);
    return null;
  }
}

/**
 * 営業時間設定を取得
 */
function getBusinessHoursConfig() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET.MASTER_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET.SYSTEM_CONFIG);
    
    if (!sheet) {
      throw new Error('Configシートが見つかりません');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const categoryIndex = headers.indexOf('category');
    const keyIndex = headers.indexOf('key');
    const valueIndex = headers.indexOf('value');
    
    const businessHours = {};
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][categoryIndex] === 'BUSINESS_HOURS') {
        const key = data[i][keyIndex];
        const value = data[i][valueIndex];
        businessHours[key] = value;
      }
    }
    
    return businessHours;
  } catch (error) {
    Logger.log('❌ 営業時間取得エラー: ' + error.message);
    return null;
  }
}

/**
 * 予約設定を取得
 */
function getReservationConfig() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET.MASTER_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET.SYSTEM_CONFIG);
    
    if (!sheet) {
      throw new Error('Configシートが見つかりません');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const categoryIndex = headers.indexOf('category');
    const keyIndex = headers.indexOf('key');
    const valueIndex = headers.indexOf('value');
    
    const reservationConfig = {};
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][categoryIndex] === 'RESERVATION') {
        const key = data[i][keyIndex];
        const value = data[i][valueIndex];
        reservationConfig[key] = value;
      }
    }
    
    return reservationConfig;
  } catch (error) {
    Logger.log('❌ 予約設定取得エラー: ' + error.message);
    return null;
  }
}
/**
 * 現在のSquare環境を取得
 */
//公開用
function getCurrentSquareEnv() {
  var env = CONFIG.SQUARE.ENVIRONMENT;
  return CONFIG.SQUARE[env.toUpperCase()];
}

/**
 * Square環境を一時的に切り替え
 */
function switchSquareEnvironment(targetEnv) {
  if (targetEnv !== 'sandbox' && targetEnv !== 'production') {
    throw new Error('Invalid environment: ' + targetEnv);
  }
  
  CONFIG.SQUARE.ENVIRONMENT = targetEnv;
  log('INFO', 'Config', 'Environment switched to: ' + targetEnv);
  
  return getCurrentSquareEnv();
}

/**
 * 現在の環境を表示
 */
function showCurrentEnvironment() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Current Environment                      ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('Environment:', CONFIG.SQUARE.ENVIRONMENT);
  console.log('API URL:', getCurrentSquareEnv().API_URL);
  console.log('Application ID:', getCurrentSquareEnv().APPLICATION_ID);
  console.log('Location ID:', getCurrentSquareEnv().LOCATION_ID);
  console.log('════════════════════════════════════════════');
}

function checkCurrentEnvironment() {
  console.log('=== Current Environment ===');
  console.log('SQUARE.ENVIRONMENT:', CONFIG.SQUARE.ENVIRONMENT);
  console.log('SQUARE.SANDBOX_MODE:', CONFIG.SQUARE.SANDBOX_MODE);
  
  var env = getCurrentSquareEnv();
  console.log('Current API URL:', env.API_URL);
  console.log('Current Access Token:', env.ACCESS_TOKEN ? env.ACCESS_TOKEN.substring(0, 20) + '...' : 'NOT SET');
}