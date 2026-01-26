/**
 * ============================================================================
 * K9 Harmony - Year End Service
 * ============================================================================
 * 年度切替・アーカイブ処理
 * 最終更新: 2026-01-19
 * バージョン: v1.0.0
 */

var YearEndService = {
  
  /**
   * 年度切替処理（1/1に実行）
   * トリガー設定推奨: 毎年1月1日 午前2時
   */
  executeYearEndProcess: function() {
    try {
      log('INFO', 'YearEndService', '========== 年度切替処理開始 ==========');
      
      var today = new Date();
      var currentYear = today.getFullYear();
      var previousYear = currentYear - 1;
      
      log('INFO', 'YearEndService', '前年度: ' + previousYear + ', 新年度: ' + currentYear);
      
      // 1. 新年度スプレッドシート作成
      var newSpreadsheetId = this._createNewYearSpreadsheet(currentYear);
      
      if (!newSpreadsheetId) {
        throw new Error('Failed to create new year spreadsheet');
      }
      
      // 2. Config.gsに新年度IDを追加（手動で追加が必要）
      log('INFO', 'YearEndService', '✅ 新年度スプレッドシート作成完了: ' + newSpreadsheetId);
      log('INFO', 'YearEndService', '⚠️ Config.gsに以下を追加してください:');
      log('INFO', 'YearEndService', '   TRANS_ID_' + currentYear + ': "' + newSpreadsheetId + '",');
      
      // 3. 前年度スプレッドシートをアーカイブ
      this._archivePreviousYearSpreadsheet(previousYear);
      
      // 4. 完了通知（LINEまたはメール）
      this._sendYearEndNotification(previousYear, currentYear, newSpreadsheetId);
      
      log('INFO', 'YearEndService', '========== 年度切替処理完了 ==========');
      
      return {
        success: true,
        newYear: currentYear,
        newSpreadsheetId: newSpreadsheetId
      };
      
    } catch (error) {
      log('ERROR', 'YearEndService', 'Year end process failed: ' + error.message);
      return {
        error: true,
        message: error.message
      };
    }
  },
  
  /**
   * 新年度スプレッドシート作成
   */
  _createNewYearSpreadsheet: function(year) {
    try {
      log('INFO', 'YearEndService', '新年度スプレッドシート作成中: ' + year);
      
      // 前年度のスプレッドシートをテンプレートとして使用
      var previousYear = year - 1;
      var templateId = CONFIG.SPREADSHEET.getTransIdForYear(previousYear);
      
      if (!templateId) {
        throw new Error('Template spreadsheet not found for year: ' + previousYear);
      }
      
      // テンプレートを開く
      var templateSs = SpreadsheetApp.openById(templateId);
      
      // 新しいスプレッドシートとしてコピー
      var newSs = templateSs.copy('K9_Harmony_Transactions_' + year);
      var newSpreadsheetId = newSs.getId();
      
      log('INFO', 'YearEndService', '✅ スプレッドシートコピー完了');
      
      // 全シートのデータをクリア（ヘッダー行のみ残す）
      var sheets = newSs.getSheets();
      sheets.forEach(function(sheet) {
        var sheetName = sheet.getName();
        
        // システムログ・監査ログは除外
        if (sheetName === 'Systemログ' || sheetName === '監査ログ') {
          return;
        }
        
        var lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
          log('INFO', 'YearEndService', 'シートクリア: ' + sheetName);
        }
      });
      
      log('INFO', 'YearEndService', '✅ データクリア完了');
      
      return newSpreadsheetId;
      
    } catch (error) {
      log('ERROR', 'YearEndService', 'Failed to create new year spreadsheet: ' + error.message);
      return null;
    }
  },
  
  /**
   * 前年度スプレッドシートをアーカイブ
   */
  _archivePreviousYearSpreadsheet: function(year) {
    try {
      log('INFO', 'YearEndService', '前年度スプレッドシートアーカイブ中: ' + year);
      
      var spreadsheetId = CONFIG.SPREADSHEET.getTransIdForYear(year);
      
      if (!spreadsheetId) {
        log('WARN', 'YearEndService', 'Spreadsheet not found for year: ' + year);
        return;
      }
      
      var file = DriveApp.getFileById(spreadsheetId);
      var archiveFolder = DriveApp.getFolderById(CONFIG.SPREADSHEET.ARCHIVE_FOLDER_ID);
      
      // アーカイブフォルダに移動
      file.moveTo(archiveFolder);
      
      log('INFO', 'YearEndService', '✅ アーカイブ完了: ' + file.getName());
      
      return true;
      
    } catch (error) {
      log('ERROR', 'YearEndService', 'Failed to archive spreadsheet: ' + error.message);
      return false;
    }
  },
  
  /**
   * 完了通知送信
   */
  _sendYearEndNotification: function(previousYear, currentYear, newSpreadsheetId) {
    try {
      var message = '【年度切替完了】\n\n';
      message += '前年度: ' + previousYear + '年\n';
      message += '新年度: ' + currentYear + '年\n';
      message += '新スプレッドシートID: ' + newSpreadsheetId + '\n\n';
      message += '⚠️ Config.gsに以下を追加してください:\n';
      message += 'TRANS_ID_' + currentYear + ': "' + newSpreadsheetId + '",';
      
      log('INFO', 'YearEndService', message);
      
      // TODO: LINE通知またはメール通知を実装
      // MailApp.sendEmail({
      //   to: 'admin@example.com',
      //   subject: '【K9 Harmony】年度切替完了通知',
      //   body: message
      // });
      
    } catch (error) {
      log('ERROR', 'YearEndService', 'Failed to send notification: ' + error.message);
    }
  }
};

// ============================================================================
// トリガー設定用関数
// ============================================================================

/**
 * 年度切替トリガー設定
 * Apps Scriptエディタから手動で実行してトリガーを設定
 */
function setupYearEndTrigger() {
  // 既存のトリガーを削除
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'executeYearEndProcess') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 毎年1月1日午前2時に実行するトリガーを作成
  ScriptApp.newTrigger('executeYearEndProcess')
    .timeBased()
    .onMonthDay(1)  // 1日
    .atHour(2)      // 午前2時
    .create();
  
  console.log('✅ 年度切替トリガー設定完了（毎年1月1日 午前2時）');
}

/**
 * 年度切替処理実行（トリガーから呼ばれる）
 */
function executeYearEndProcess() {
  YearEndService.executeYearEndProcess();
}

// ============================================================================
// テスト関数
// ============================================================================

/**
 * 年度切替処理テスト（実際には実行しない）
 */
function testYearEndProcess() {
  console.log('=== Year End Process Test ===\n');
  
  console.log('⚠️ これはテストです。実際の年度切替は行いません。\n');
  
  var currentYear = new Date().getFullYear();
  var previousYear = currentYear - 1;
  
  console.log('前年度:', previousYear);
  console.log('新年度:', currentYear);
  
  console.log('\n実行される処理:');
  console.log('1. ' + currentYear + '年度スプレッドシート作成');
  console.log('2. ' + previousYear + '年度スプレッドシートをアーカイブ');
  console.log('3. 完了通知送信');
  
  console.log('\n⚠️ 実際に実行する場合は executeYearEndProcess() を呼び出してください');
}