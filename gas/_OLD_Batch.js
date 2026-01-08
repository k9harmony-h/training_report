/**
 * ============================================================================
 * K9 Harmony - Batch Processing Service
 * ============================================================================
 * @file    batchService.gs
 * @version v2025.12.23-Phase4_Backup
 * @desc    日次バッチ処理（バックアップ、チケット失効管理、整合性チェック）を担当。
 * トリガー設定により毎日AM 4:00に実行されることを想定。
 */

/**
 * [Entry Point] 日次バッチ実行関数
 * ※GASトリガーでこの関数を「時間主導型 > 日付ベースのタイマー > 午前4時〜5時」に設定してください。
 */
function runDailyBatch() {
  const timestamp = new Date();
  console.log(`[${timestamp.toISOString()}] [Batch] Start Daily Processing.`);

  try {
    // 1. DBバックアップ (最優先)
    _backupSpreadsheet(timestamp);

    // 2. チケット有効期限チェック (今回は枠組みのみ)
    _checkTicketExpiration(timestamp);

    console.log(`[${timestamp.toISOString()}] [Batch] Completed Successfully.`);
  } catch (e) {
    console.error(`[Batch Error] ${e.stack}`);
    // 将来的にここに管理者へのLINE通知処理を追加推奨
  }
}

/**
 * [Logic] スプレッドシートのバックアップを作成
 */
function _backupSpreadsheet(dateObj) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // systemConfig.gs で定義したIDを取得
    // 万が一未定義ならエラーにする安全設計
    if (!SYS_CONFIG.BACKUP || !SYS_CONFIG.BACKUP.FOLDER_ID) {
      throw new Error('Backup Folder ID is not configured in SYS_CONFIG.');
    }
    const backupFolderId = SYS_CONFIG.BACKUP.FOLDER_ID;

    const folder = DriveApp.getFolderById(backupFolderId);
    
    // ファイル名生成: "K9_DB_Backup_20251224"
    const dateStr = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyyMMdd');
    const filename = `K9_DB_Backup_${dateStr}`;
    
    // コピー作成
    const backupFile = DriveApp.getFileById(ss.getId()).makeCopy(filename, folder);
    
    console.log(`[Batch] Backup created: ${backupFile.getName()} (ID: ${backupFile.getId()})`);
    
  } catch (e) {
    console.error(`[Batch] Backup Failed: ${e.message}`);
    throw e; // バックアップ失敗は致命的なので例外を再スロー
  }
}

/**
 * [Logic] チケット有効期限チェック
 * SalesシートとProductシートを突き合わせ、期限切れのチケットを無効化する
 */
function _checkTicketExpiration(dateObj) {
  // Phase 4の次のステップで詳細実装します
  console.log('[Batch] Ticket expiration check skipped (To be implemented).');
}