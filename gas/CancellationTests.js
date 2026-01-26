/**
 * ============================================================================
 * K9 Harmony - Cancellation System Integration Tests
 * ============================================================================
 * ファイル名: CancellationTests.gs
 * 役割: キャンセルシステムの統合テスト
 * 最終更新: 2026-01-16
 * バージョン: v1.0.0
 */

/**
 * キャンセルシステム統合テスト
 */
function testCancellationSystem() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Cancellation System Integration Test    ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  // Test 1: キャンセル料計算
  console.log('【Test 1】キャンセル料計算ロジック');
  _testCancellationFeeCalculation();
  console.log('');
  
  // Test 2: キャンセル常習者チェック
  console.log('【Test 2】キャンセル常習者チェック');
  _testFrequentCancellerCheck();
  console.log('');
  
  // Test 3: キャンセル申請一覧取得
  console.log('【Test 3】キャンセル申請一覧取得（管理者用）');
  _testGetPendingCancellations();
  console.log('');
  
  // Test 4: バリデーション
  console.log('【Test 4】キャンセルデータのバリデーション');
  _testCancellationValidation();
  console.log('');
  
  console.log('═'.repeat(48));
  console.log('Cancellation System Test Complete\n');
  
  console.log('💡 実際のキャンセル処理をテストする場合:');
  console.log('  testRealCancellation() を実行してください');
  console.log('  （実在する予約IDが必要）');
}

/**
 * Test 1: キャンセル料計算
 */
function _testCancellationFeeCalculation() {
  var now = new Date();
  
  // テストケース1: 4日前（無料）
  var reservationDate1 = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  var result1 = CancellationService.calculateCancellationFee(reservationDate1, now);
  
  console.log('  ケース1: 4日前のキャンセル');
  console.log('    キャンセル料率:', (result1.feeRate * 100) + '%');
  console.log('    判定:', result1.feeRate === 0 ? '✅ 無料' : '❌ エラー');
  
  // テストケース2: 3日前（50%）
  var reservationDate2 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  var result2 = CancellationService.calculateCancellationFee(reservationDate2, now);
  
  console.log('  ケース2: 3日前のキャンセル');
  console.log('    キャンセル料率:', (result2.feeRate * 100) + '%');
  console.log('    判定:', result2.feeRate === 0.5 ? '✅ 50%' : '❌ エラー');
  
  // テストケース3: 前日（100%）
  var reservationDate3 = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  var result3 = CancellationService.calculateCancellationFee(reservationDate3, now);
  
  console.log('  ケース3: 前日のキャンセル');
  console.log('    キャンセル料率:', (result3.feeRate * 100) + '%');
  console.log('    判定:', result3.feeRate === 1.0 ? '✅ 100%' : '❌ エラー');
  
  // テストケース4: 当日（100%）
  var reservationDate4 = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  var result4 = CancellationService.calculateCancellationFee(reservationDate4, now);
  
  console.log('  ケース4: 当日のキャンセル');
  console.log('    キャンセル料率:', (result4.feeRate * 100) + '%');
  console.log('    判定:', result4.feeRate === 1.0 ? '✅ 100%' : '❌ エラー');
}

/**
 * Test 2: キャンセル常習者チェック
 */
function _testFrequentCancellerCheck() {
  // テスト用の顧客を探す
  var customers = DB.fetchTable(CONFIG.SHEET.CUSTOMERS);
  
  if (customers.length === 0) {
    console.log('  ⚠️  顧客データが存在しません');
    return;
  }
  
  var testCustomer = customers[0];
  
  var result = CancellationService._checkFrequentCanceller(testCustomer.customer_id);
  
  console.log('  テスト対象:', testCustomer.customer_name || testCustomer.customer_id);
  console.log('  過去6ヶ月のキャンセル数:', result.count + '件');
  console.log('  常習者判定:', result.isFrequent ? '⚠️  常習者' : '✅ 通常');
  console.log('  （基準: 5回以上で常習者）');
}

/**
 * Test 3: キャンセル申請一覧取得
 */
function _testGetPendingCancellations() {
  var result = CancellationService.getPendingCancellations();
  
  if (result.error) {
    console.error('  ❌ Failed:', result.message);
    return;
  }
  
  console.log('  ✅ Success');
  console.log('  申請中のキャンセル:', result.count + '件');
  
  if (result.count > 0) {
    console.log('\n  申請一覧:');
    result.cancellations.slice(0, 3).forEach(function(item, index) {
      console.log('    ' + (index + 1) + '. ' + item.customer.customer_name);
      console.log('       理由:', item.reason);
      console.log('       申請日時:', Utilities.formatDate(
        new Date(item.requestedAt),
        'JST',
        'yyyy-MM-dd HH:mm'
      ));
    });
    
    if (result.count > 3) {
      console.log('    ... 他 ' + (result.count - 3) + '件');
    }
  }
}

/**
 * Test 4: バリデーション
 */
function _testCancellationValidation() {
  // ケース1: 正常（体調不良 + 詳細あり）
  var data1 = {
    reason: '愛犬・飼い主の体調不良',
    detail: '犬が体調不良のため'
  };
  var result1 = CancellationService._validateCancellationData(data1);
  console.log('  ケース1: 体調不良（詳細あり）');
  console.log('    判定:', result1.error ? '❌ エラー' : '✅ OK');
  
  // ケース2: 正常（都合が悪くなった + 詳細なし）
  var data2 = {
    reason: '都合が悪くなった'
  };
  var result2 = CancellationService._validateCancellationData(data2);
  console.log('  ケース2: 都合が悪くなった（詳細なし）');
  console.log('    判定:', result2.error ? '❌ エラー' : '✅ OK');
  
  // ケース3: エラー（体調不良 + 詳細なし）
  var data3 = {
    reason: '愛犬・飼い主の体調不良'
  };
  var result3 = CancellationService._validateCancellationData(data3);
  console.log('  ケース3: 体調不良（詳細なし）');
  console.log('    判定:', result3.error ? '✅ エラー検出' : '❌ エラー未検出');
  
  // ケース4: エラー（その他 + 詳細なし）
  var data4 = {
    reason: 'その他'
  };
  var result4 = CancellationService._validateCancellationData(data4);
  console.log('  ケース4: その他（詳細なし）');
  console.log('    判定:', result4.error ? '✅ エラー検出' : '❌ エラー未検出');
}

/**
 * 実際のキャンセル処理テスト（実在データ使用）
 */
function testRealCancellation() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Real Cancellation Test                   ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  console.log('⚠️  このテストは実際のデータを使用します\n');
  
  // 予約を検索
  var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
  var activeReservations = reservations.filter(function(r) {
  return r.status === 'CONFIRMED' || r.status === 'PENDING';
});
  
  if (activeReservations.length === 0) {
    console.log('❌ キャンセル可能な予約が見つかりません');
    console.log('   （CONFIRMED または PENDING 状態の予約が必要）');
    return;
  }
  
  var testReservation = activeReservations[0];
  
  console.log('テスト対象予約:');
  console.log('  ID:', testReservation.reservation_id);
  console.log('  顧客ID:', testReservation.customer_id);
  console.log('  日時:', Utilities.formatDate(
    new Date(testReservation.reservation_date),
    'JST',
    'yyyy-MM-dd HH:mm'
  ));
  console.log('  ステータス:', testReservation.status);
  console.log('');
  
  console.log('💡 実際にキャンセルを実行する場合:');
  console.log('');
  console.log('【パターン1】間違えて予約（自動キャンセル）');
  console.log('  var result = CancellationService.requestCancellation(');
  console.log('    "' + testReservation.reservation_id + '",');
  console.log('    { reason: "間違えて予約した" }');
  console.log('  );');
  console.log('');
  console.log('【パターン2】体調不良（管理者確認）');
  console.log('  var result = CancellationService.requestCancellation(');
  console.log('    "' + testReservation.reservation_id + '",');
  console.log('    {');
  console.log('      reason: "愛犬・飼い主の体調不良",');
  console.log('      detail: "犬が体調不良のため"');
  console.log('    }');
  console.log('  );');
  console.log('');
  console.log('【パターン3】都合が悪くなった（管理者確認）');
  console.log('  var result = CancellationService.requestCancellation(');
  console.log('    "' + testReservation.reservation_id + '",');
  console.log('    { reason: "都合が悪くなった" }');
  console.log('  );');
  console.log('');
  console.log('⚠️  実行後は以下を確認:');
  console.log('  1. 予約台帳のステータス更新');
  console.log('  2. 決済台帳の返金記録（自動キャンセルの場合）');
  console.log('  3. LINE・Email通知送信');
  console.log('  4. 管理者への通知（管理者確認の場合）');
}

/**
 * キャンセル統計テスト
 */
function testCancellationStatistics() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Cancellation Statistics Test             ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
  
  // 過去30日のキャンセル統計
  var thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  var recentCancellations = reservations.filter(function(r) {
    if (r.reservation_status !== 'CANCELLED') return false;
    
    var cancelDate = r.cancellation_completed_at ? 
      new Date(r.cancellation_completed_at) : 
      new Date(r.updated_at);
    
    return cancelDate >= thirtyDaysAgo;
  });
  
  console.log('【過去30日間のキャンセル統計】\n');
  console.log('  総キャンセル数:', recentCancellations.length + '件');
  
  // 理由別集計
  var byReason = {};
  recentCancellations.forEach(function(r) {
    var reason = r.cancellation_reason || 'UNKNOWN';
    if (!byReason[reason]) {
      byReason[reason] = 0;
    }
    byReason[reason]++;
  });
  
  console.log('\n  理由別:');
  Object.keys(byReason).forEach(function(reason) {
    console.log('    ' + reason + ':', byReason[reason] + '件');
  });
  
  // ステータス別集計
  var statusCount = {
    requested: 0,
    processing: 0,
    completed: 0
  };
  
  reservations.forEach(function(r) {
    if (r.cancellation_status === 'CANCELLATION_REQUESTED') {
      statusCount.requested++;
    } else if (r.cancellation_status === 'CANCELLATION_PROCESSING') {
      statusCount.processing++;
    } else if (r.cancellation_status === 'CANCELLED') {
      statusCount.completed++;
    }
  });
  
  console.log('\n  ステータス別:');
  console.log('    申請中:', statusCount.requested + '件');
  console.log('    処理中:', statusCount.processing + '件');
  console.log('    完了:', statusCount.completed + '件');
  
  console.log('\n' + '═'.repeat(48));
  console.log('Cancellation Statistics Complete');
}