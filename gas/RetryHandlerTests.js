/**
 * ============================================================================
 * K9 Harmony - Retry Handler Tests
 * ============================================================================
 * ファイル名: RetryHandlerTests.gs
 * 役割: RetryHandler強化版のテスト
 * 最終更新: 2026-01-16
 * バージョン: v1.0.0
 */

/**
 * リトライハンドラーの基本テスト
 */
function testRetryHandler() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Retry Handler Test                       ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  // Test 1: 成功するまでリトライ
  console.log('【Test 1】成功するまでリトライ');
  
  var attemptCount = 0;
  var result = RetryHandler.execute(function() {
    attemptCount++;
    console.log('  試行 ' + attemptCount + '回目');
    
    if (attemptCount < 2) {
      throw new Error('Simulated failure');
    }
    
    return { success: true, data: 'Test data' };
  }, {
    context: { operation: 'testOperation' },
    maxRetries: 3,
    delay: 500
  });
  
  if (result.success) {
    console.log('  ✅ 成功: ' + result.attempts + '回目で成功');
    console.log('  Retry ID:', result.retry_id);
  } else {
    console.log('  ❌ 失敗:', result.error.message);
  }
  
  console.log('');
  
  // Test 2: 全てのリトライが失敗
  console.log('【Test 2】全てのリトライが失敗');
  
  var result2 = RetryHandler.execute(function() {
    throw new Error('Always fails');
  }, {
    context: { operation: 'testFailure' },
    maxRetries: 3,
    delay: 500
  });
  
  if (result2.success) {
    console.log('  ⚠️  予期しない成功');
  } else {
    console.log('  ✅ 期待通り失敗');
    console.log('  試行回数:', result2.attempts);
    console.log('  エラー:', result2.error.message);
  }
  
  console.log('');
  console.log('═'.repeat(48));
  console.log('Retry Handler Test Complete');
}

/**
 * リトライポリシーのテスト
 */
function testRetryPolicies() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Retry Policy Test                        ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  // Test 1: Square決済のポリシー（5回リトライ）
  console.log('【Test 1】Square決済ポリシー');
  
  var attemptCount = 0;
  var result = RetryHandler.execute(function() {
    attemptCount++;
    if (attemptCount < 4) {
      throw new Error('Square API timeout');
    }
    return { success: true };
  }, {
    context: { operation: 'squarePayment' }
  });
  
  if (result.success) {
    console.log('  ✅ 成功: ' + result.attempts + '回目で成功');
    console.log('  （Square決済は最大5回までリトライ）');
  } else {
    console.log('  ❌ 失敗');
  }
  
  console.log('');
  
  // Test 2: 通知送信のポリシー（2回リトライ）
  console.log('【Test 2】通知送信ポリシー');
  
  attemptCount = 0;
  var result2 = RetryHandler.execute(function() {
    attemptCount++;
    if (attemptCount < 2) {
      throw new Error('LINE API error');
    }
    return { success: true };
  }, {
    context: { operation: 'sendNotification' }
  });
  
  if (result2.success) {
    console.log('  ✅ 成功: ' + result2.attempts + '回目で成功');
    console.log('  （通知送信は最大2回までリトライ）');
  } else {
    console.log('  ❌ 失敗');
  }
  
  console.log('');
  console.log('═'.repeat(48));
  console.log('Retry Policy Test Complete');
}

/**
 * リトライ統計のテスト
 */
function testRetryStatistics() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Retry Statistics Test                    ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  var result = RetryHandler.getRetryStatistics(7);
  
  if (result.error) {
    console.error('  ❌ エラー:', result.message);
    return;
  }
  
  if (!result.success) {
    console.log('  ⚠️  RETRY_LOGS シートが未設定');
    console.log('  シートを作成してから再実行してください');
    return;
  }
  
  var stats = result.statistics;
  
  console.log('【過去' + stats.period_days + '日間の統計】\n');
  console.log('  総リトライ数:', stats.total_retries);
  console.log('  成功:', stats.successful);
  console.log('  失敗:', stats.failed);
  console.log('  成功率:', stats.success_rate + '%');
  console.log('  平均試行回数:', stats.avg_attempts);
  
  if (Object.keys(stats.by_operation).length > 0) {
    console.log('\n  【操作別統計】');
    Object.keys(stats.by_operation).forEach(function(operation) {
      var opStats = stats.by_operation[operation];
      console.log('    ' + operation + ':');
      console.log('      総数:', opStats.total);
      console.log('      成功:', opStats.successful);
      console.log('      失敗:', opStats.failed);
    });
  }
  
  if (Object.keys(stats.top_errors).length > 0) {
    console.log('\n  【頻出エラーTOP3】');
    var errors = Object.keys(stats.top_errors)
      .map(function(error) {
        return { error: error, count: stats.top_errors[error] };
      })
      .sort(function(a, b) {
        return b.count - a.count;
      })
      .slice(0, 3);
    
    errors.forEach(function(item, index) {
      console.log('    ' + (index + 1) + '. ' + item.error + ' (' + item.count + '回)');
    });
  }
  
  console.log('');
  console.log('═'.repeat(48));
  console.log('Retry Statistics Test Complete');
}

/**
 * アクティブなリトライの確認
 */
function testActiveRetries() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Active Retries Test                      ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  var result = RetryHandler.getActiveRetries();
  
  if (result.error) {
    console.error('  ❌ エラー:', result.message);
    return;
  }
  
  if (!result.success) {
    console.log('  ⚠️  RETRY_LOGS シートが未設定');
    return;
  }
  
  console.log('  リトライ中の操作:', result.count + '件');
  
  if (result.count > 0) {
    console.log('\n  【リトライ中の操作一覧】');
    result.retries.forEach(function(retry, index) {
      console.log('    ' + (index + 1) + '. ' + retry.operation);
      console.log('       Retry ID:', retry.retry_id);
      console.log('       開始時刻:', Utilities.formatDate(
        new Date(retry.start_time),
        'JST',
        'yyyy-MM-dd HH:mm:ss'
      ));
      console.log('       試行回数:', retry.attempts_count + '/' + retry.max_retries);
    });
  }
  
  console.log('');
  console.log('═'.repeat(48));
  console.log('Active Retries Test Complete');
}

/**
 * 重大エラー通知のテスト（DRY RUN）
 */
function testCriticalErrorNotification() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Critical Error Notification Test (DRY)   ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  console.log('⚠️  実際の通知は送信しません（DRY RUN）\n');
  
  // 重大なエラーをシミュレート
  var mockRetryLog = {
    retry_id: 'test-retry-' + Utilities.getUuid(),
    operation: 'squarePayment',
    context: { customer_id: 'test-customer' },
    max_retries: 5,
    start_time: new Date(),
    end_time: new Date(),
    total_duration_ms: 15000,
    status: 'FAILED',
    attempts: [
      { attempt_number: 1, status: 'FAILED', error: 'Timeout', duration_ms: 3000 },
      { attempt_number: 2, status: 'FAILED', error: 'Timeout', duration_ms: 3000 },
      { attempt_number: 3, status: 'FAILED', error: 'Timeout', duration_ms: 3000 },
      { attempt_number: 4, status: 'FAILED', error: 'Timeout', duration_ms: 3000 },
      { attempt_number: 5, status: 'FAILED', error: 'Timeout', duration_ms: 3000 }
    ],
    final_error: 'Square API Timeout'
  };
  
  // 重大エラー判定
  var isCritical = RetryHandler._isCriticalFailure(mockRetryLog);
  
  console.log('  操作:', mockRetryLog.operation);
  console.log('  ステータス:', mockRetryLog.status);
  console.log('  重大エラー判定:', isCritical ? '✅ Yes' : '❌ No');
  
  if (isCritical) {
    console.log('\n  💡 この場合、管理者に以下の通知が送信されます:');
    console.log('  ────────────────────────────────────────');
    console.log('  件名: [K9 Harmony] 重大エラー: リトライ失敗');
    console.log('  ────────────────────────────────────────');
    console.log('  リトライID:', mockRetryLog.retry_id);
    console.log('  操作: Square決済処理');
    console.log('  リトライ回数: 5/5 全て失敗');
    console.log('  最終エラー: Square API Timeout');
    console.log('  ────────────────────────────────────────');
  }
  
  console.log('');
  console.log('═'.repeat(48));
  console.log('Critical Error Notification Test Complete');
}

/**
 * 統合テスト: RetryHandler全機能
 */
function testRetryHandlerIntegration() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Retry Handler Integration Test          ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  var tests = [
    { name: 'リトライ基本機能', func: testRetryHandler },
    { name: 'リトライポリシー', func: testRetryPolicies },
    { name: 'リトライ統計', func: testRetryStatistics },
    { name: 'アクティブリトライ', func: testActiveRetries },
    { name: '重大エラー通知', func: testCriticalErrorNotification }
  ];
  
  var passed = 0;
  var failed = 0;
  
  tests.forEach(function(test) {
    console.log('【' + test.name + '】');
    
    try {
      test.func();
      passed++;
      console.log('✅ Passed\n');
    } catch (error) {
      failed++;
      console.error('❌ Failed:', error.message + '\n');
    }
  });
  
  console.log('═'.repeat(48));
  console.log('Integration Test Complete');
  console.log('Passed:', passed + '/' + tests.length);
  console.log('Failed:', failed + '/' + tests.length);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  }
}