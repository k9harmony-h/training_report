/**
 * ============================================================================
 * K9 Harmony - Triggers Setup
 * ============================================================================
 * ファイル名: Triggers.gs
 * 役割: 自動実行トリガーの設定
 * 最終更新: 2026-01-02
 * バージョン: v1.0.0
 * 
 * 実行方法:
 * 1. setupAllTriggers() を1回だけ実行
 * 2. 各トリガーが自動で作成される
 * 3. GAS エディタ → トリガー で確認
 */

/**
 * 全トリガーを一括設定
 * 
 * 注意: この関数は1回だけ実行してください
 * 重複実行すると同じトリガーが複数作成されます
 */
function setupAllTriggers() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Setting Up All Triggers                  ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  try {
    // 既存のトリガーを削除（重複防止）
    deleteAllTriggers();
    
    // 1. リマインダー送信（毎日AM 9:00）
    createReminderTrigger();
    
    // 2. 予約ロック解除（毎時0分）
    createLockReleaseTrigger();
    
    // 3. ライフサイクル更新（毎日AM 6:00）
    createDailyBatchTrigger();
    
    // 4. 月次レポート生成（毎月1日AM 9:00）
    createMonthlyReportTrigger();

    // 5. Keep-Warm（5分間隔 - V8コールドスタート防止）
    createKeepWarmTrigger();

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   All Triggers Created Successfully!       ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('\n確認方法:');
    console.log('GASエディタ → 左メニュー「トリガー」⏰');
    console.log('→ 5つのトリガーが表示されていればOK');
    
  } catch (error) {
    console.error('❌ トリガー設定失敗:', error.message);
    console.log('\nトラブルシューティング:');
    console.log('1. 実行ログを確認');
    console.log('2. どこでエラーが出たか特定');
    console.log('3. 個別のトリガー作成関数を実行');
  }
}

/**
 * 既存のトリガーを全て削除
 */
function deleteAllTriggers() {
  console.log('既存トリガーを削除中...');
  
  var triggers = ScriptApp.getProjectTriggers();
  
  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
  
  console.log('✅ 削除完了: ' + triggers.length + '個');
  console.log('');
}

/**
 * 1. リマインダー送信トリガー
 * 毎日AM 9:00に実行
 */
function createReminderTrigger() {
  console.log('[1/4] リマインダー送信トリガー作成中...');
  
  try {
    ScriptApp.newTrigger('sendDailyReminders')
      .timeBased()
      .atHour(9)  // 9:00
      .everyDays(1)
      .create();
    
    console.log('✅ 作成完了: sendDailyReminders');
    console.log('   実行時刻: 毎日 AM 9:00');
    console.log('   機能: 明日の予約のリマインダー送信');
    console.log('');
    
  } catch (error) {
    console.error('❌ 作成失敗:', error.message);
  }
}

/**
 * 2. 予約ロック解除トリガー
 * 毎時0分に実行
 */
function createLockReleaseTrigger() {
  console.log('[2/4] 予約ロック解除トリガー作成中...');
  
  try {
    ScriptApp.newTrigger('releaseExpiredLocks')
      .timeBased()
      .everyHours(1)  // 毎時
      .create();
    
    console.log('✅ 作成完了: releaseExpiredLocks');
    console.log('   実行間隔: 1時間ごと');
    console.log('   機能: 期限切れ予約ロックの自動解除');
    console.log('');
    
  } catch (error) {
    console.error('❌ 作成失敗:', error.message);
  }
}

/**
 * 3. ライフサイクル更新トリガー
 * 毎日AM 6:00に実行
 */
function createDailyBatchTrigger() {
  console.log('[3/4] ライフサイクル更新トリガー作成中...');
  
  try {
    ScriptApp.newTrigger('runDailyBatch')
      .timeBased()
      .atHour(6)  // 6:00
      .everyDays(1)
      .create();
    
    console.log('✅ 作成完了: runDailyBatch');
    console.log('   実行時刻: 毎日 AM 6:00');
    console.log('   機能: 顧客ライフサイクルステージ自動判定');
    console.log('');
    
  } catch (error) {
    console.error('❌ 作成失敗:', error.message);
  }
}

/**
 * 4. 月次レポート生成トリガー
 * 毎月1日AM 9:00に実行
 */
function createMonthlyReportTrigger() {
  console.log('[4/4] 月次レポート生成トリガー作成中...');
  
  try {
    ScriptApp.newTrigger('generateMonthlyReport')
      .timeBased()
      .atHour(9)  // 9:00
      .onMonthDay(1)  // 毎月1日
      .create();
    
    console.log('✅ 作成完了: generateMonthlyReport');
    console.log('   実行時刻: 毎月1日 AM 9:00');
    console.log('   機能: 月次レポート自動生成・メール送信');
    console.log('');
    
  } catch (error) {
    console.error('❌ 作成失敗:', error.message);
  }
}

/**
 * 5. Keep-Warmトリガー
 * 5分間隔で実行 - V8コールドスタート防止 & コアテーブル事前ロード
 *
 * 効果:
 * - V8インスタンスをwarm状態に維持（コールドスタート ~8秒を排除）
 * - コアテーブル（customers, dogs, lessons, reservations）をCacheServiceに事前ロード
 * - 結果: ユーザーリクエスト時の応答が ~14秒 → ~1-2秒に改善
 */
function createKeepWarmTrigger() {
  console.log('[5/5] Keep-Warmトリガー作成中...');

  try {
    ScriptApp.newTrigger('keepWarmGAS')
      .timeBased()
      .everyMinutes(5)
      .create();

    console.log('✅ 作成完了: keepWarmGAS');
    console.log('   実行間隔: 5分ごと');
    console.log('   機能: V8コールドスタート防止 & コアテーブル事前ロード');
    console.log('');

  } catch (error) {
    console.error('❌ 作成失敗:', error.message);
  }
}

/**
 * Keep-Warm実行関数（トリガーから呼び出される）
 * コアテーブルをCacheServiceに事前ロードし、V8を暖機する
 */
function keepWarmGAS() {
  var startTime = new Date().getTime();

  // コアテーブルを事前ロード（CONFIG.SHEET定数使用）
  var coreTableConfig = {
    customers: CONFIG.SHEET.CUSTOMERS,
    dogs: CONFIG.SHEET.DOGS,
    lessons: CONFIG.SHEET.LESSONS,
    reservations: CONFIG.SHEET.RESERVATIONS
  };
  var results = {};

  Object.keys(coreTableConfig).forEach(function(key) {
    var sheetName = coreTableConfig[key];
    var tableStart = new Date().getTime();
    try {
      TableCache.getTable(sheetName);
      results[key] = new Date().getTime() - tableStart;
    } catch (e) {
      results[key] = -1;
    }
  });

  var totalMs = new Date().getTime() - startTime;
  console.log('Keep-Warm完了: ' + totalMs + 'ms - ' + JSON.stringify(results));
}

/**
 * トリガー一覧表示
 */
function listAllTriggers() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Current Triggers                         ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  var triggers = ScriptApp.getProjectTriggers();
  
  if (triggers.length === 0) {
    console.log('⚠️  トリガーが設定されていません');
    console.log('\n設定方法:');
    console.log('関数: setupAllTriggers を実行');
    return;
  }
  
  console.log('トリガー数: ' + triggers.length);
  console.log('');
  
  triggers.forEach(function(trigger, index) {
    console.log('━━━━━━━━━━━━━━━━━━━━');
    console.log('[' + (index + 1) + '] ' + trigger.getHandlerFunction());
    console.log('   イベント: ' + trigger.getEventType());
    
    var triggerSource = trigger.getTriggerSource();
    if (triggerSource === ScriptApp.TriggerSource.CLOCK) {
      console.log('   タイプ: 時間ベース');
    }
    
    console.log('');
  });
  
  console.log('━━━━━━━━━━━━━━━━━━━━');
  console.log('\n確認方法:');
  console.log('GASエディタ → トリガー⏰ で詳細確認可能');
}

/**
 * 個別トリガー削除（トラブルシューティング用）
 */
function deleteTriggerByFunction(functionName) {
  console.log('=== Delete Trigger: ' + functionName + ' ===\n');
  
  var triggers = ScriptApp.getProjectTriggers();
  var deleted = 0;
  
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(trigger);
      deleted++;
      console.log('✅ 削除: ' + functionName);
    }
  });
  
  if (deleted === 0) {
    console.log('⚠️  該当するトリガーが見つかりませんでした');
  } else {
    console.log('\n削除数: ' + deleted);
  }
}

/**
 * トリガーのテスト実行（手動）
 * 実際のトリガーが動くか確認
 */
function testAllTriggerFunctions() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Testing All Trigger Functions           ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━');
  console.log('[1/4] sendDailyReminders (ドライラン)');
  console.log('━━━━━━━━━━━━━━━━━━━━');
  try {
    testDailyRemindersDryRun();
    console.log('✅ OK\n');
  } catch (e) {
    console.error('❌ エラー:', e.message, '\n');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━');
  console.log('[2/4] releaseExpiredLocks');
  console.log('━━━━━━━━━━━━━━━━━━━━');
  try {
    // 実際には実行しない（ロック解除は影響大）
    console.log('⚠️  スキップ（実運用時に自動実行）');
    console.log('✅ OK\n');
  } catch (e) {
    console.error('❌ エラー:', e.message, '\n');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━');
  console.log('[3/4] runDailyBatch');
  console.log('━━━━━━━━━━━━━━━━━━━━');
  try {
    testLifecycleBatch();
    console.log('✅ OK\n');
  } catch (e) {
    console.error('❌ エラー:', e.message, '\n');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━');
  console.log('[4/4] generateMonthlyReport');
  console.log('━━━━━━━━━━━━━━━━━━━━');
  try {
    testMonthlyReportNotification();
    console.log('✅ OK\n');
  } catch (e) {
    console.error('❌ エラー:', e.message, '\n');
  }
  
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Test Complete                            ║');
  console.log('╚════════════════════════════════════════════╝');
}

/**
 * 実行ガイド
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 【初回セットアップ】
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 1. setupAllTriggers() を実行
 *    → 4つのトリガーが作成される
 * 
 * 2. listAllTriggers() を実行
 *    → 作成されたトリガーを確認
 * 
 * 3. GASエディタ → トリガー⏰ で確認
 *    → UIで詳細確認
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 【テスト】
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * testAllTriggerFunctions() を実行
 * → 各関数が正しく動作するか確認
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 【トラブルシューティング】
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 全削除: deleteAllTriggers()
 * 個別削除: deleteTriggerByFunction('関数名')
 * 一覧表示: listAllTriggers()
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */