/**
 * ============================================================================
 * K9 Harmony - System Configuration
 * ============================================================================
 * @file    systemConfig.gs
 * @version v2025.12.23-Integrated_Phase4_API_Mode
 * @desc    予約システム専用の設定・定数定義ファイル。
 * Phase 4: バックアップ設定に加え、Admin API用の認証キーを追加。
 */

const SYS_CONFIG = {
  // 環境設定 ('DEV' or 'PROD')
  ENV: 'PROD',

  // シート名定義
  SHEETS: {
    RESERVATIONS: 'Reservations_2025', // 年次切り替え対応
    MASTERS:      'System_Masters',
    LOGS:         'System_Logs'
  },

  // 外部API連携設定
  // ※セキュリティ推奨: 本番運用時は ScriptProperties から値を取得することを強く推奨します。
  API: {
    // Distance Matrix API等の利用に使用
    GCP_MAPS_KEY: 'AIzaSyDwMsk6IbTuGA4g8pluStQhpVUxanoyMt0', 
    // 予約同期先カレンダーID
    CALENDAR_ID:  'cacc5a66bcbced84914ba3e351f17220afc2043517a9bb855fbe8023378fd8dc@group.calendar.google.com'
  },

  // 予約・ロジック設定
  RESERVATION: {
    START_HOUR: 10,       // 営業開始
    END_HOUR: 20,         // 営業終了
    SLOT_UNIT_MIN: 30,    // 枠生成単位
    DEFAULT_BUFFER_MIN: 15, // 必須バッファ（準備・消毒）
    MAX_TRAVEL_MIN: 60,   // 最大許容移動時間
    
    // 多頭飼いオプション設定
    MULTI_DOG_EXTRA_MIN: 30, // 追加時間
    MULTI_DOG_PRICE: 2000    // 追加料金(税込)
  },

  // 商品マスタ定義 (要件定義書 3.1 準拠)
  PRODUCTS: {
    SINGLE: { key: 'PROD_SINGLE_90', name: '単発レッスン (90分)', duration: 90, price: 4900 },
    TICKET_4: { key: 'PROD_TICKET_4', name: '4回券 (有効60日)', duration: 90, price: 18900 },
    TICKET_8: { key: 'PROD_TICKET_8', name: '8回券 (有効90日)', duration: 90, price: 34900 }
  },

  // Phase 4: バックアップ設定
  BACKUP: {
    FOLDER_ID: '1WR_MAfJ_eBCEIE0i_tyw7uEkNN5Jg6i6'
  },

  // ▼▼▼ 【追加】 Phase 4: Admin API認証キー (GitHub連携用) ▼▼▼
  ADMIN: {
    API_KEY: 'k9_secret_key_2025' // GitHub側のHTMLと一致させる必要があります
  }
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
};

/**
 * [Helper] ScriptProperties または Config から値を取得
 * キー管理の移行期間用ヘルパー
 */
function getSysProp_(key, fallbackValue) {
  try {
    const props = PropertiesService.getScriptProperties();
    const val = props.getProperty(key);
    if (val) return val;
  } catch (e) {
    console.warn('PropertiesService access failed:', e);
  }
  return fallbackValue;
}

/**
 * [Getter] API Key
 */
function getMapsApiKey() {
  return getSysProp_('GCP_MAPS_KEY', SYS_CONFIG.API.GCP_MAPS_KEY);
}

/**
 * [Getter] Calendar ID
 */
function getCalendarId() {
  return getSysProp_('CALENDAR_ID', SYS_CONFIG.API.CALENDAR_ID);
}