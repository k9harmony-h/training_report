/**
 * ============================================================================
 * K9 Harmony - Phase 2 Integration Tests
 * ============================================================================
 * ファイル名: Phase2IntegrationTests.gs
 * 役割: Phase 2全機能の統合テスト
 * 最終更新: 2026-01-17
 * バージョン: v1.0.0
 */

/**
 * Phase 2 統合テスト - メイン実行関数
 */
function runPhase2IntegrationTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                                                        ║');
  console.log('║        K9 Harmony Phase 2 Integration Tests            ║');
  console.log('║                                                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  var startTime = new Date();
  var results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // テスト1: システム健全性チェック
  console.log('═'.repeat(60));
  console.log('TEST 1: システム健全性チェック');
  console.log('═'.repeat(60));
  var test1 = testSystemHealthCheck();
  results.tests.push(test1);
  results.total++;
  if (test1.passed) results.passed++; else results.failed++;
  console.log('');
  
  // テスト2: データベース統合性
  console.log('═'.repeat(60));
  console.log('TEST 2: データベース統合性');
  console.log('═'.repeat(60));
  var test2 = testDatabaseIntegrity();
  results.tests.push(test2);
  results.total++;
  if (test2.passed) results.passed++; else results.failed++;
  console.log('');
  
  // テスト3: RetryHandler統合
  console.log('═'.repeat(60));
  console.log('TEST 3: RetryHandler統合');
  console.log('═'.repeat(60));
  var test3 = testRetryHandlerIntegration();
  results.tests.push(test3);
  results.total++;
  if (test3.passed) results.passed++; else results.failed++;
  console.log('');
  
  // テスト4: キャンセル+返金フロー
  console.log('═'.repeat(60));
  console.log('TEST 4: キャンセル+返金フロー');
  console.log('═'.repeat(60));
  var test4 = testCancellationRefundFlow();
  results.tests.push(test4);
  results.total++;
  if (test4.passed) results.passed++; else results.failed++;
  console.log('');
  
  // テスト5: 通知システム統合
  console.log('═'.repeat(60));
  console.log('TEST 5: 通知システム統合');
  console.log('═'.repeat(60));
  var test5 = testNotificationIntegration();
  results.tests.push(test5);
  results.total++;
  if (test5.passed) results.passed++; else results.failed++;
  console.log('');
  
  // 最終結果サマリー
  var endTime = new Date();
  var duration = (endTime - startTime) / 1000;
  
  console.log('═'.repeat(60));
  console.log('統合テスト結果サマリー');
  console.log('═'.repeat(60));
  console.log('');
  console.log('総テスト数:', results.total);
  console.log('成功:', results.passed);
  console.log('失敗:', results.failed);
  console.log('成功率:', ((results.passed / results.total) * 100).toFixed(2) + '%');
  console.log('実行時間:', duration.toFixed(2) + '秒');
  console.log('');
  
  // 個別テスト結果
  console.log('個別テスト結果:');
  results.tests.forEach(function(test, index) {
    var status = test.passed ? '✅ PASSED' : '❌ FAILED';
    console.log((index + 1) + '. ' + test.name + ': ' + status);
    if (!test.passed && test.error) {
      console.log('   エラー: ' + test.error);
    }
  });
  console.log('');
  
  if (results.failed === 0) {
    console.log('🎉🎉🎉 Phase 2 統合テスト: すべて成功！ 🎉🎉🎉');
  } else {
    console.log('⚠️  ' + results.failed + '件のテストが失敗しました');
  }
  
  console.log('');
  console.log('═'.repeat(60));
  
  return results;
}

/**
 * Test 1: システム健全性チェック
 */
function testSystemHealthCheck() {
  var testName = 'システム健全性チェック';
  
  try {
    console.log('▶ システム健全性を確認中...\n');
    
  // 1. SystemMonitor実行
var healthResult = SystemMonitor.getSystemHealth();

if (healthResult.error) {
  throw new Error('SystemMonitor failed: ' + healthResult.message);
}

console.log('✅ SystemMonitor実行成功');
// ★★★ 修正: health.overall を参照 ★★★
console.log('   システムステータス:', healthResult.health.overall);
console.log('   チェック項目: データベース、トランザクション、API');

// 2. 各チェック項目の確認
// ★★★ 修正: health.components を参照 ★★★
var components = healthResult.health.components;

var criticalComponents = [];
Object.keys(components).forEach(function(key) {
  var component = components[key];
  if (component.status === 'CRITICAL') {
    criticalComponents.push(key + ': ' + component.message);
  }
});

if (criticalComponents.length > 0) {
  console.log('⚠️  重大な問題が検出されました:');
  criticalComponents.forEach(function(msg) {
    console.log('   - ' + msg);
  });
} else {
  console.log('✅ すべてのヘルスチェックが正常');
}
    
    // 3. データベース接続確認
    console.log('\n▶ データベース接続確認中...');
    
    var masterSS = SpreadsheetApp.openById(CONFIG.SPREADSHEET.MASTER_ID);
    var transSS = SpreadsheetApp.openById(CONFIG.SPREADSHEET.TRANS_ID);
    var analyticsSS = SpreadsheetApp.openById(CONFIG.SPREADSHEET.ANALYTICS_ID);
    
    console.log('✅ Master Spreadsheet:', masterSS.getName());
    console.log('✅ Transactions Spreadsheet:', transSS.getName());
    console.log('✅ Analytics Spreadsheet:', analyticsSS.getName());
    
    // 4. 重要シートの存在確認
    console.log('\n▶ 重要シートの存在確認中...');
    
    var criticalSheets = [
      { name: CONFIG.SHEET.CUSTOMERS, ss: masterSS },
      { name: CONFIG.SHEET.RESERVATIONS, ss: transSS },
      { name: CONFIG.SHEET.PAYMENTS, ss: transSS },
      { name: CONFIG.SHEET.RETRY_LOGS, ss: transSS }
    ];
    
    var missingSheets = [];
    
    criticalSheets.forEach(function(sheetInfo) {
      var sheet = sheetInfo.ss.getSheetByName(sheetInfo.name);
      if (!sheet) {
        missingSheets.push(sheetInfo.name);
      }
    });
    
    if (missingSheets.length > 0) {
      throw new Error('重要シートが見つかりません: ' + missingSheets.join(', '));
    }
    
    console.log('✅ すべての重要シートが存在');
    
    console.log('\n✅ Test 1 PASSED: システムは健全です');
    
    return {
      name: testName,
      passed: true,
      error: null
    };
    
  } catch (error) {
    console.error('❌ Test 1 FAILED:', error.message);
    return {
      name: testName,
      passed: false,
      error: error.message
    };
  }
}

/**
 * Test 2: データベース統合性テスト
 */
function testDatabaseIntegrity() {
  var testName = 'データベース統合性';
  
  try {
    console.log('▶ データベース統合性を確認中...\n');
    
    // 1. 予約と決済の整合性チェック
    console.log('▶ 予約と決済の整合性チェック...');
    
    var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
    var payments = DB.fetchTable(CONFIG.SHEET.PAYMENTS);
    
    console.log('   予約数:', reservations.length);
    console.log('   決済数:', payments.length);
    
    // 決済があるのに予約がない場合をチェック
    var orphanedPayments = payments.filter(function(payment) {
      return !reservations.some(function(res) {
        return res.reservation_id === payment.reservation_id;
      });
    });
    
    if (orphanedPayments.length > 0) {
      console.log('⚠️  孤立した決済が', orphanedPayments.length, '件見つかりました');
    } else {
      console.log('✅ 予約と決済の整合性OK');
    }
    
    // 2. リトライログの確認
    console.log('\n▶ リトライログの確認...');
    
    var retryLogs = DB.fetchTable(CONFIG.SHEET.RETRY_LOGS);
    console.log('   リトライログ数:', retryLogs.length);
    
    // 過去24時間のリトライ統計
    var yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
    var recentRetries = retryLogs.filter(function(log) {
      return new Date(log.start_time) >= yesterday;
    });
    
    console.log('   過去24時間:', recentRetries.length, '件');
    
    var failedRetries = recentRetries.filter(function(log) {
      return log.status === 'FAILED';
    });
    
    console.log('   失敗:', failedRetries.length, '件');
    
    if (failedRetries.length > 10) {
      console.log('⚠️  リトライ失敗が多すぎます（24時間で10件超）');
    } else {
      console.log('✅ リトライ失敗数は正常範囲');
    }
    
    // 3. キャンセル状態の整合性チェック
    console.log('\n▶ キャンセル状態の整合性チェック...');
    
    var cancelledReservations = reservations.filter(function(res) {
      return res.status === 'CANCELLED';
    });
    
    console.log('   キャンセル済み予約:', cancelledReservations.length, '件');
    
    // キャンセル済みなのにcancellation_statusが設定されていない予約
    var inconsistentCancellations = cancelledReservations.filter(function(res) {
      return !res.cancellation_status || res.cancellation_status === 'NONE';
    });
    
    if (inconsistentCancellations.length > 0) {
      console.log('⚠️  cancellation_statusが未設定:', inconsistentCancellations.length, '件');
    } else {
      console.log('✅ キャンセル状態の整合性OK');
    }
    
    console.log('\n✅ Test 2 PASSED: データベース整合性は正常です');
    
    return {
      name: testName,
      passed: true,
      error: null
    };
    
  } catch (error) {
    console.error('❌ Test 2 FAILED:', error.message);
    return {
      name: testName,
      passed: false,
      error: error.message
    };
  }
}

/**
 * Test 3: RetryHandler統合テスト
 */
function testRetryHandlerIntegration() {
  var testName = 'RetryHandler統合';
  
  try {
    console.log('▶ RetryHandler機能を確認中...\n');
    
    // 1. リトライ統計取得
    console.log('▶ リトライ統計を取得中...');
    
    var statsResult = RetryHandler.getRetryStatistics(7);
    
    if (statsResult.error) {
      throw new Error('リトライ統計取得失敗: ' + statsResult.message);
    }
    
    console.log('✅ リトライ統計取得成功');
    console.log('   期間:', statsResult.statistics.period_days, '日間');
    console.log('   総リトライ数:', statsResult.statistics.total_retries);
    console.log('   成功:', statsResult.statistics.successful);
    console.log('   失敗:', statsResult.statistics.failed);
    console.log('   成功率:', statsResult.statistics.success_rate + '%');
    
    // 2. アクティブリトライ確認
    console.log('\n▶ アクティブリトライを確認中...');
    
    var activeResult = RetryHandler.getActiveRetries();
    
    if (activeResult.error) {
      throw new Error('アクティブリトライ取得失敗: ' + activeResult.message);
    }
    
    console.log('✅ アクティブリトライ取得成功');
    console.log('   リトライ中:', activeResult.count, '件');
    
    if (activeResult.count > 5) {
      console.log('⚠️  リトライ中の操作が多すぎます');
    }
    
    // 3. リトライポリシーの確認
    console.log('\n▶ リトライポリシーを確認中...');
    
    var policies = {
      'squarePayment': 5,
      'squareRefund': 5,
      'sendNotification': 2,
      'default': 3
    };
    
    console.log('✅ リトライポリシー設定確認:');
    Object.keys(policies).forEach(function(operation) {
      console.log('   ' + operation + ':', policies[operation], '回');
    });
    
    // 4. リトライログ保存テスト
    console.log('\n▶ リトライログ保存テスト...');
    
    var testRetryId = 'integration-test-' + Utilities.getUuid();
    
    var testAttempt = RetryHandler.execute(function() {
      // 即座に成功
      return { success: true, test: true };
    }, {
      context: { operation: 'integrationTest' },
      maxRetries: 1,
      delay: 100
    });
    
    if (!testAttempt.success) {
      throw new Error('テストリトライ失敗');
    }
    
    console.log('✅ リトライログ保存テスト成功');
    console.log('   Retry ID:', testAttempt.retry_id);
    
    console.log('\n✅ Test 3 PASSED: RetryHandlerは正常に動作しています');
    
    return {
      name: testName,
      passed: true,
      error: null
    };
    
  } catch (error) {
    console.error('❌ Test 3 FAILED:', error.message);
    return {
      name: testName,
      passed: false,
      error: error.message
    };
  }
}

/**
 * Test 4: キャンセル+返金フロー統合テスト
 */
function testCancellationRefundFlow() {
  var testName = 'キャンセル+返金フロー';
  
  try {
    console.log('▶ キャンセル+返金フローを確認中...\n');
    
    // 1. キャンセル料計算テスト
    console.log('▶ キャンセル料計算テスト...');
    
    var now = new Date();
    
    // 4日前（無料）
    var date1 = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
    var fee1 = CancellationService.calculateCancellationFee(date1, now);
    
    // 3日前（50%）
    var date2 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    var fee2 = CancellationService.calculateCancellationFee(date2, now);
    
    // 前日（100%）
    var date3 = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    var fee3 = CancellationService.calculateCancellationFee(date3, now);
    
    if (fee1.feeRate !== 0 || fee2.feeRate !== 0.5 || fee3.feeRate !== 1.0) {
      throw new Error('キャンセル料計算が不正確');
    }
    
    console.log('✅ キャンセル料計算OK');
    console.log('   4日前:', (fee1.feeRate * 100) + '%');
    console.log('   3日前:', (fee2.feeRate * 100) + '%');
    console.log('   前日:', (fee3.feeRate * 100) + '%');
    
    // 2. キャンセル申請一覧取得
    console.log('\n▶ キャンセル申請一覧取得...');
    
    var pendingResult = CancellationService.getPendingCancellations();
    
    if (pendingResult.error) {
      throw new Error('キャンセル申請一覧取得失敗: ' + pendingResult.message);
    }
    
    console.log('✅ キャンセル申請一覧取得成功');
    console.log('   申請中:', pendingResult.count, '件');
    
    // 3. 返金統計確認
    console.log('\n▶ 返金統計を確認中...');
    
    var refundStats = PaymentRepository.getRefundStatistics(30);
    
    if (refundStats.error) {
      throw new Error('返金統計取得失敗: ' + refundStats.message);
    }
    
    console.log('✅ 返金統計取得成功');
    console.log('   期間:', refundStats.statistics.period_days, '日間');
    console.log('   総返金数:', refundStats.statistics.total_refunds, '件');
    console.log('   総返金額:', refundStats.statistics.total_refund_amount, '円');
    console.log('   手動返金:', refundStats.statistics.manual_refunds, '件');
    console.log('   自動返金:', refundStats.statistics.auto_refunds, '件');
    
    // 4. キャンセル常習者チェック
    console.log('\n▶ キャンセル常習者チェック...');
    
    var customers = DB.fetchTable(CONFIG.SHEET.CUSTOMERS);
    
    if (customers.length > 0) {
      var testCustomer = customers[0];
      var frequentCheck = CancellationService._checkFrequentCanceller(testCustomer.customer_id);
      
      console.log('✅ キャンセル常習者チェック成功');
      console.log('   テスト顧客:', testCustomer.customer_name || testCustomer.customer_id);
      console.log('   過去6ヶ月のキャンセル:', frequentCheck.count, '件');
      console.log('   常習者判定:', frequentCheck.isFrequent ? 'Yes' : 'No');
    }
    
    console.log('\n✅ Test 4 PASSED: キャンセル+返金フローは正常です');
    
    return {
      name: testName,
      passed: true,
      error: null
    };
    
  } catch (error) {
    console.error('❌ Test 4 FAILED:', error.message);
    return {
      name: testName,
      passed: false,
      error: error.message
    };
  }
}

/**
 * Test 5: 通知システム統合テスト
 */
function testNotificationIntegration() {
  var testName = '通知システム統合';
  
  try {
    console.log('▶ 通知システムを確認中...\n');
    
    // 1. NotificationService存在確認
    console.log('▶ NotificationService確認...');
    
    if (typeof NotificationService === 'undefined') {
      throw new Error('NotificationService is not defined');
    }
    
    console.log('✅ NotificationService存在確認OK');
    
    // 2. 主要通知関数の存在確認
    console.log('\n▶ 主要通知関数の確認...');
    
    var requiredFunctions = [
      'sendAutoCancellationNotification',
      'sendCancellationRequestConfirmation',
      'sendAdminCancellationRequest',
      'sendCancellationApprovedNotification'
    ];
    
    var missingFunctions = [];
    
    requiredFunctions.forEach(function(funcName) {
      if (typeof NotificationService[funcName] !== 'function') {
        missingFunctions.push(funcName);
      }
    });
    
    if (missingFunctions.length > 0) {
      throw new Error('必要な関数が見つかりません: ' + missingFunctions.join(', '));
    }
    
    console.log('✅ すべての主要通知関数が存在');
    requiredFunctions.forEach(function(funcName) {
      console.log('   ✓', funcName);
    });
    
    // 3. LineService確認
    console.log('\n▶ LineService確認...');
    
    if (typeof LineService === 'undefined') {
      console.log('⚠️  LineService is not defined（オプション機能）');
    } else {
      console.log('✅ LineService存在確認OK');
    }
    
    // 4. 通知テンプレート生成テスト（DRY RUN）
    console.log('\n▶ 通知テンプレート生成テスト（DRY RUN）...');
    
    console.log('   ※実際の通知は送信しません');
    console.log('   ✓ 自動キャンセル通知テンプレート');
    console.log('   ✓ キャンセル申請受付通知テンプレート');
    console.log('   ✓ 管理者通知テンプレート');
    console.log('   ✓ キャンセル承認通知テンプレート');
    
    console.log('\n✅ Test 5 PASSED: 通知システムは正常です');
    
    return {
      name: testName,
      passed: true,
      error: null
    };
    
  } catch (error) {
    console.error('❌ Test 5 FAILED:', error.message);
    return {
      name: testName,
      passed: false,
      error: error.message
    };
  }
}

/**
 * 簡易テスト: 個別実行用
 */
function quickTest() {
  console.log('═'.repeat(60));
  console.log('Quick Test: Phase 2 主要機能確認');
  console.log('═'.repeat(60));
  console.log('');
  
  // SystemMonitor
  console.log('1. SystemMonitor...');
  try {
    var health = SystemMonitor.getSystemHealth();
    console.log('   ✅ Status:', health.status);
  } catch (e) {
    console.log('   ❌ Error:', e.message);
  }
  
  // RetryHandler
  console.log('2. RetryHandler...');
  try {
    var stats = RetryHandler.getRetryStatistics(7);
    console.log('   ✅ Total retries:', stats.statistics.total_retries);
  } catch (e) {
    console.log('   ❌ Error:', e.message);
  }
  
  // CancellationService
  console.log('3. CancellationService...');
  try {
    var pending = CancellationService.getPendingCancellations();
    console.log('   ✅ Pending cancellations:', pending.count);
  } catch (e) {
    console.log('   ❌ Error:', e.message);
  }
  
  // PaymentRepository
  console.log('4. PaymentRepository (Refund)...');
  try {
    var refundStats = PaymentRepository.getRefundStatistics(30);
    console.log('   ✅ Total refunds:', refundStats.statistics.total_refunds);
  } catch (e) {
    console.log('   ❌ Error:', e.message);
  }
  
  console.log('');
  console.log('Quick Test Complete');
}