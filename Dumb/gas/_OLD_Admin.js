/**
 * ============================================================================
 * K9 Harmony - Admin Portal Backend
 * ============================================================================
 * @file    adminService.gs
 * @version v2025.12.23-Phase4_Admin_Init
 * @desc    管理画面向けのデータ提供、緊急停止、代理登録機能。
 */

/**
 * 管理画面のHTMLを返す
 */
function getAdminHtml() {
  return HtmlService.createHtmlOutputFromFile('admin')
    .setTitle('K9 Harmony Admin Portal')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * ダッシュボード用データ取得 (API)
 */
function getAdminDashboardData() {
  const today = new Date();
  // 1. 火曜日チェック (0:日, 1:月, 2:火)
  const isTuesday = (today.getDay() === 2);
  
  // 2. 予約リスト取得 (直近50件)
  const reservations = _fetchRecentReservations(50);

  // 3. メンテナンスモード確認
  const isMaintenance = _checkMaintenanceMode();

  return {
    isTuesday: isTuesday,
    reservations: reservations,
    isMaintenance: isMaintenance
  };
}

/**
 * メンテナンスモード切替
 */
function toggleMaintenanceMode(isActive) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SYS_CONFIG.SHEETS.MASTERS);
  if (!sheet) {
    sheet = ss.insertSheet(SYS_CONFIG.SHEETS.MASTERS);
    sheet.appendRow(['key', 'value', 'memo']);
  }
  
  const data = sheet.getDataRange().getValues();
  let found = false;
  
  // 既存があれば更新
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'MAINTENANCE_MODE') {
      sheet.getRange(i + 1, 2).setValue(isActive ? 'TRUE' : 'FALSE');
      found = true;
      break;
    }
  }
  
  // なければ追加
  if (!found) {
    sheet.appendRow(['MAINTENANCE_MODE', isActive ? 'TRUE' : 'FALSE', 'システム緊急停止フラグ']);
  }
  
  return { success: true, status: isActive };
}

// --- Helpers ---

function _fetchRecentReservations(limit) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SYS_CONFIG.SHEETS.RESERVATIONS);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  const map = {};
  headers.forEach((h, i) => map[String(h).trim()] = i);

  // 新しい順にソートして取得
  const rows = data.slice(1).sort((a, b) => {
    return new Date(b[map['created_at']]) - new Date(a[map['created_at']]);
  }).slice(0, limit);

  return rows.map(r => ({
    resId: r[map['res_id']],
    startTime: _fmtDate(r[map['start_time']]),
    status: r[map['status']],
    payment: r[map['payment_status']],
    isMultiDog: r[map['multi_dog_flag']] === 'TRUE',
    receipt: r[map['receipt_required']] === 'TRUE',
    memo: r[map['memo']]
  }));
}

function _checkMaintenanceMode() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SYS_CONFIG.SHEETS.MASTERS);
  if (!sheet) return false;
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'MAINTENANCE_MODE') {
      return String(data[i][1]).toUpperCase() === 'TRUE';
    }
  }
  return false;
}

function _fmtDate(d) {
  try {
    return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'MM/dd HH:mm');
  } catch(e) { return String(d); }
}