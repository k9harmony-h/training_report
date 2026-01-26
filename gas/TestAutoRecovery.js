/**
 * ============================================================================
 * 自動復旧テスト - 検出された問題を修復
 * ============================================================================
 */

function TEST_AutoRecoveryOrphanedReservations() {
  console.log('=== Auto Recovery Test: Orphaned Reservations ===\n');
  
  // 孤児予約をリスト
  var orphanedReservations = [
    { id: 'res001', code: 'RES-20260115-001', customer_id: '6fec4d95-a1b2-c3d4-e5f6-123456789001' },
    { id: 'res002', code: 'RES-20260118-001', customer_id: '8d7e6f54-b2c3-d4e5-f6a7-234567890002' },
    { id: 'res004', code: 'RES-20260122-001', customer_id: '0f1a2b3c-d4e5-f6a7-b8c9-456789012004' },
    { id: 'res005', code: 'RES-20260125-001', customer_id: '6fec4d95-a1b2-c3d4-e5f6-123456789001' }
  ];
  
  console.log('検出された孤児予約:', orphanedReservations.length, '件\n');
  
  var recovered = 0;
  var failed = 0;
  
  orphanedReservations.forEach(function(res) {
    console.log('復旧中:', res.code);
    
    try {
      // 決済レコードを作成
      var paymentData = {
        reservation_id: res.id,
        customer_id: res.customer_id,
        payment_method: 'CASH',  // UNKNOWN → CASH に変更
        amount: 0,
        tax_amount: 0,
        total_amount: 0,
        payment_status: 'PENDING',
        notes: '自動復旧で作成（整合性チェック）'
      };
      
      var payment = PaymentRepository.create(paymentData);
      
      if (!payment.error) {
        recovered++;
        console.log('  ✅ 復旧成功 - 決済コード:', payment.payment_code);
      } else {
        failed++;
        console.log('  ❌ 復旧失敗:', payment.message);
      }
    } catch (error) {
      failed++;
      console.log('  ❌ エラー:', error.message);
    }
  });
  
  console.log('\n【復旧結果】');
  console.log('  成功:', recovered, '件');
  console.log('  失敗:', failed, '件');
  
  if (recovered > 0) {
    console.log('\n✅ 孤児予約の復旧が完了しました');
    console.log('   決済履歴DBを確認してください');
  }
}

function TEST_AutoRecoveryDuplicates() {
  console.log('=== Auto Recovery Test: Duplicate Reservations ===\n');
  
  // 重複予約をリスト（最初のもの以外をキャンセル）
  var duplicates = [
    '20260104-0002',
    '20260104-0003',
    '20260104-0004',
    '20260104-0005',
    '20260104-0006',
    '20260104-0007',
    '20260104-0008',
    '20260104-0009'
  ];
  
  console.log('検出された重複予約:', duplicates.length, '件');
  console.log('※ 20260104-0001 のみ残し、他をキャンセルします\n');
  
  var cancelled = 0;
  var failed = 0;
  
  duplicates.forEach(function(code) {
    console.log('キャンセル中:', code);
    
    try {
      // 予約コードから予約IDを取得
      var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
      var reservation = reservations.find(function(r) {
        return r.reservation_code === code;
      });
      
      if (!reservation) {
        console.log('  ⚠️  予約が見つかりません');
        failed++;
        return;
      }
      
      // キャンセル処理
      var result = ReservationService.cancelReservation(
        reservation.reservation_id,
        '重複予約のため自動キャンセル',
        'SYSTEM'
      );
      
      if (!result.error) {
        cancelled++;
        console.log('  ✅ キャンセル成功');
      } else {
        failed++;
        console.log('  ❌ キャンセル失敗:', result.message);
      }
    } catch (error) {
      failed++;
      console.log('  ❌ エラー:', error.message);
    }
  });
  
  console.log('\n【キャンセル結果】');
  console.log('  成功:', cancelled, '件');
  console.log('  失敗:', failed, '件');
  
  if (cancelled > 0) {
    console.log('\n✅ 重複予約のキャンセルが完了しました');
    console.log('   予約台帳DBを確認してください');
  }
}

function TEST_FullAutoRecovery() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Full Auto Recovery Test                  ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  // 1. 孤児予約を復旧
  console.log('【Phase 1】孤児予約の復旧\n');
  TEST_AutoRecoveryOrphanedReservations();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 2. 重複予約をキャンセル
  console.log('【Phase 2】重複予約のキャンセル\n');
  TEST_AutoRecoveryDuplicates();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 3. 再度整合性チェック
  console.log('【Phase 3】整合性チェック（再確認）\n');
  
  var result = DataIntegrityService.runFullIntegrityCheck();
  
  if (!result.error) {
    console.log('✅ 整合性チェック完了');
    console.log('   総問題数:', result.results.summary.totalIssues);
    console.log('   重大な問題:', result.results.summary.criticalIssues);
    console.log('   警告:', result.results.summary.warnings);
    
    if (result.results.summary.totalIssues === 0) {
      console.log('\n🎉 全ての問題が解決されました！');
    } else {
      console.log('\n⚠️  一部問題が残っています');
    }
  }
}