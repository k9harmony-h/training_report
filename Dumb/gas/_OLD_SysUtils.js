/**
 * System Utilities
 * 汎用ヘルパー関数 (予約システム用)
 * ※既存Utilsとの競合回避のため SysUtils としています
 */

const SysUtils = {
  /**
   * ユニークIDを生成 (UUID v4形式ライクなランダム文字列)
   * @return {string} 例: "a1b2c3d4" (8桁)
   */
  generateUniqueId: function() {
    return Math.random().toString(36).substring(2, 10);
  },

  /**
   * 現在の日時をフォーマット済み文字列で取得
   * @return {string} "yyyy/MM/dd HH:mm:ss"
   */
  getCurrentTime: function() {
    return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
  },

  /**
   * 今日の日付文字列
   * @return {string} "yyyyMMdd"
   */
  getDateString: function() {
    return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd");
  },

  /**
   * ログ出力（System_Logsシートへ追記）
   * @param {string} level - INFO, ERROR, WARN
   * @param {string} funcName - 関数名
   * @param {string} message - メッセージ
   * @param {object} details - 詳細オブジェクト(任意)
   */
  log: function(level, funcName, message, details = {}) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SYS_CONFIG.SHEETS.LOGS);
    if (!sheet) return;

    sheet.appendRow([
      this.getCurrentTime(),
      level,
      funcName,
      message,
      JSON.stringify(details)
    ]);
    
    // ERROR時はコンソールにも出す
    if (level === 'ERROR') {
      console.error(`[${funcName}] ${message}`, details);
    }
  }
};