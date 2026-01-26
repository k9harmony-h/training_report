/**
 * ============================================================================
 * K9 Harmony - System Monitor (Integrated)
 * ============================================================================
 * ファイル名: SystemMonitor.gs
 * 役割: システム監視の統合管理
 * 最終更新: 2026-01-16
 * バージョン: v1.0.0
 * 
 * 統合機能:
 * 1. TransactionMonitor - トランザクション失敗検知
 * 2. DataIntegrityService - データ整合性チェック
 * 3. HealthCheckService - システム健全性監視（新規）
 */

var SystemMonitor = {
  
  // ============================================================================
  // 1. Transaction Monitor（既存機能統合）
  // ============================================================================
  
  /**
   * 失敗トランザクションのチェック
   */
  checkFailedTransactions: function() {
    try {
      log('INFO', 'SystemMonitor', 'Starting failed transaction check');
      
      var oneHourAgo = new Date(new Date().getTime() - 60 * 60 * 1000);
      var transactions = DB.fetchTable(CONFIG.SHEET.TRANSACTION_LOG);
      
      var failedTransactions = transactions.filter(function(tx) {
        var startTime = new Date(tx.start_time);
        return startTime >= oneHourAgo && 
               (tx.status === 'FAILED' || tx.rollback_status === 'PARTIAL_ROLLBACK');
      });
      
      if (failedTransactions.length === 0) {
        log('INFO', 'SystemMonitor', 'No failed transactions found');
        return { success: true, failedCount: 0 };
      }
      
      // 管理者に通知
      this._notifyAdminFailedTransactions(failedTransactions);
      
      // 復旧レポート生成
      var report = this._generateRecoveryReport(failedTransactions);
      
      log('WARN', 'SystemMonitor', 'Failed transactions detected', {
        count: failedTransactions.length
      });
      
      return {
        success: true,
        failedCount: failedTransactions.length,
        report: report
      };
      
    } catch (error) {
      log('ERROR', 'SystemMonitor', 'Transaction check failed', { error: error.message });
      return { error: true, message: error.message };
    }
  },
  
  /**
   * 管理者通知（トランザクション失敗）
   */
  _notifyAdminFailedTransactions: function(failedTransactions) {
    try {
      var subject = '[K9 Harmony] トランザクション失敗を検知しました';
      var body = this._buildFailedTransactionEmail(failedTransactions);
      
      if (typeof NotificationService !== 'undefined') {
        NotificationService.sendAdminNotification(subject, body, 'ERROR');
      }
      
      log('INFO', 'SystemMonitor', 'Admin notification sent');
      
    } catch (error) {
      log('ERROR', 'SystemMonitor', 'Failed to send notification', { error: error.message });
    }
  },
  
  /**
   * トランザクション失敗メール本文生成
   */
  _buildFailedTransactionEmail: function(failedTransactions) {
    var body = 'トランザクション失敗が検知されました。\n\n';
    body += '='.repeat(50) + '\n';
    body += '検知時刻: ' + Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd HH:mm:ss') + '\n';
    body += '失敗数: ' + failedTransactions.length + '件\n';
    body += '='.repeat(50) + '\n\n';
    
    failedTransactions.forEach(function(tx, index) {
      body += '【失敗 ' + (index + 1) + '】\n';
      body += 'Transaction ID: ' + tx.transaction_id + '\n';
      body += '発生時刻: ' + Utilities.formatDate(new Date(tx.start_time), 'JST', 'yyyy-MM-dd HH:mm:ss') + '\n';
      body += 'ステータス: ' + tx.status + '\n';
      body += 'ロールバック: ' + (tx.rollback_status || 'N/A') + '\n';
      body += 'エラー内容: ' + (tx.error || 'N/A') + '\n';
      body += '-'.repeat(50) + '\n\n';
    });
    
    body += '\n対応が必要な場合は、GASのトランザクションログシートを確認してください。';
    
    return body;
  },
  
  /**
   * 復旧レポート生成
   */
  _generateRecoveryReport: function(failedTransactions) {
    var report = {
      totalFailed: failedTransactions.length,
      byStatus: {},
      byOperation: {},
      recommendations: []
    };
    
    failedTransactions.forEach(function(tx) {
      // ステータス別集計
      if (!report.byStatus[tx.status]) {
        report.byStatus[tx.status] = 0;
      }
      report.byStatus[tx.status]++;
      
      // 操作別集計
      try {
        var context = JSON.parse(tx.context);
        var operation = context.operation || 'UNKNOWN';
        
        if (!report.byOperation[operation]) {
          report.byOperation[operation] = 0;
        }
        report.byOperation[operation]++;
      } catch (e) {
        // JSON parse error
      }
    });
    
    // 推奨アクション生成
    if (report.byOperation.createReservationWithPayment > 0) {
      report.recommendations.push('予約作成+決済処理が失敗しています。Square APIの状態を確認してください。');
    }
    
    if (report.byStatus.FAILED > 5) {
      report.recommendations.push('失敗トランザクションが多発しています。システム全体の健全性を確認してください。');
    }
    
    return report;
  },
  
  // ============================================================================
  // 2. Data Integrity Service（既存機能統合）
  // ============================================================================
  
  /**
   * 全体整合性チェック実行
   */
  runFullIntegrityCheck: function() {
    var context = { service: 'SystemMonitor', action: 'runFullIntegrityCheck' };
    
    try {
      log('INFO', 'SystemMonitor', '=== Full Integrity Check Started ===');
      
      var results = {
        timestamp: new Date(),
        checks: {
          orphanedPayments: this._checkOrphanedPayments(),
          orphanedReservations: this._checkOrphanedReservations(),
          statusMismatches: this._checkStatusMismatches(),
          amountMismatches: this._checkAmountMismatches(),
          duplicateReservations: this._checkDuplicateReservations()
        },
        summary: {
          totalIssues: 0,
          criticalIssues: 0,
          warnings: 0
        }
      };
      
      // サマリー集計
      Object.keys(results.checks).forEach(function(checkName) {
        var check = results.checks[checkName];
        results.summary.totalIssues += check.issues.length;
        results.summary.criticalIssues += check.issues.filter(function(i) { return i.severity === 'CRITICAL'; }).length;
        results.summary.warnings += check.issues.filter(function(i) { return i.severity === 'WARNING'; }).length;
      });
      
      // 重大な問題があれば管理者通知
      if (results.summary.criticalIssues > 0 && typeof NotificationService !== 'undefined') {
        NotificationService.sendAdminNotification(
          'Data Integrity Check: Critical Issues Found',
          'Critical Issues: ' + results.summary.criticalIssues + '\n' +
          'Warnings: ' + results.summary.warnings,
          'CRITICAL'
        );
      }
      
      log('INFO', 'SystemMonitor', '=== Full Integrity Check Completed ===');
      log('INFO', 'SystemMonitor', 'Total Issues: ' + results.summary.totalIssues);
      
      return {
        success: true,
        results: results
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 孤児決済レコードチェック
   */
  _checkOrphanedPayments: function() {
    try {
      var payments = DB.fetchTable(CONFIG.SHEET.PAYMENTS);
      var issues = [];
      
      payments.forEach(function(payment) {
        if (!payment.reservation_id) {
          issues.push({
            severity: 'WARNING',
            type: 'ORPHANED_PAYMENT',
            payment_id: payment.payment_id,
            message: '予約IDが未設定の決済'
          });
          return;
        }
        
        var reservation = DB.findById(CONFIG.SHEET.RESERVATIONS, payment.reservation_id);
        
        if (!reservation) {
          issues.push({
            severity: 'CRITICAL',
            type: 'ORPHANED_PAYMENT',
            payment_id: payment.payment_id,
            reservation_id: payment.reservation_id,
            message: '予約が存在しない決済'
          });
        }
      });
      
      return {
        checkName: 'Orphaned Payments',
        issues: issues
      };
      
    } catch (error) {
      log('ERROR', 'SystemMonitor', 'Orphaned payments check failed', { error: error.message });
      return { checkName: 'Orphaned Payments', issues: [] };
    }
  },
  
  /**
   * 孤児予約レコードチェック
   */
  _checkOrphanedReservations: function() {
    try {
      var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
      var issues = [];
      
      reservations.forEach(function(reservation) {
        if (reservation.reservation_status === 'CANCELLED') return;
        
        var payments = PaymentRepository.findByReservationId(reservation.reservation_id);
        
        if (payments.length === 0) {
          issues.push({
            severity: 'CRITICAL',
            type: 'ORPHANED_RESERVATION',
            reservation_id: reservation.reservation_id,
            message: '決済レコードが存在しない予約'
          });
        }
      });
      
      return {
        checkName: 'Orphaned Reservations',
        issues: issues
      };
      
    } catch (error) {
      log('ERROR', 'SystemMonitor', 'Orphaned reservations check failed', { error: error.message });
      return { checkName: 'Orphaned Reservations', issues: [] };
    }
  },
  
  /**
   * ステータス不整合チェック
   */
  _checkStatusMismatches: function() {
    try {
      var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
      var issues = [];
      
      reservations.forEach(function(reservation) {
        var payments = PaymentRepository.findByReservationId(reservation.reservation_id);
        
        if (payments.length === 0) return;
        
        var payment = payments[0];
        
        // 予約確定済みなのに決済未完了
        if (reservation.reservation_status === 'CONFIRMED' && 
            payment.payment_status !== 'CAPTURED' && 
            payment.payment_status !== 'AUTHORIZED') {
          issues.push({
            severity: 'CRITICAL',
            type: 'STATUS_MISMATCH',
            reservation_id: reservation.reservation_id,
            message: '予約確定済みだが決済が未完了'
          });
        }
        
        // 予約キャンセルなのに決済成立
        if (reservation.reservation_status === 'CANCELLED' && 
            payment.payment_status === 'CAPTURED') {
          issues.push({
            severity: 'CRITICAL',
            type: 'STATUS_MISMATCH',
            reservation_id: reservation.reservation_id,
            message: '予約キャンセル済みだが決済が確定（返金必要）'
          });
        }
      });
      
      return {
        checkName: 'Status Mismatches',
        issues: issues
      };
      
    } catch (error) {
      log('ERROR', 'SystemMonitor', 'Status mismatches check failed', { error: error.message });
      return { checkName: 'Status Mismatches', issues: [] };
    }
  },
  
  /**
   * 金額不一致チェック
   */
  _checkAmountMismatches: function() {
    try {
      var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
      var issues = [];
      
      reservations.forEach(function(reservation) {
        var payments = PaymentRepository.findByReservationId(reservation.reservation_id);
        
        if (payments.length === 0) return;
        
        var totalPaid = payments.reduce(function(sum, payment) {
          if (payment.payment_status === 'CAPTURED' || payment.payment_status === 'AUTHORIZED') {
            return sum + (payment.total_amount || 0);
          }
          return sum;
        }, 0);
        
        if (reservation.product_id) {
          var product = DB.findById(CONFIG.SHEET.PRODUCTS, reservation.product_id);
          
          if (product && product.product_price && totalPaid !== product.product_price) {
            issues.push({
              severity: 'WARNING',
              type: 'AMOUNT_MISMATCH',
              reservation_id: reservation.reservation_id,
              expected: product.product_price,
              actual: totalPaid,
              message: '決済金額が商品価格と一致しない'
            });
          }
        }
      });
      
      return {
        checkName: 'Amount Mismatches',
        issues: issues
      };
      
    } catch (error) {
      log('ERROR', 'SystemMonitor', 'Amount mismatches check failed', { error: error.message });
      return { checkName: 'Amount Mismatches', issues: [] };
    }
  },
  
  /**
   * 重複予約チェック
   */
  _checkDuplicateReservations: function() {
    try {
      var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
      var issues = [];
      var seen = {};
      
      reservations.forEach(function(reservation) {
        if (reservation.reservation_status === 'CANCELLED') return;
        
        var key = [
          reservation.customer_id,
          reservation.trainer_id,
          reservation.reservation_date
        ].join('|');
        
        if (seen[key]) {
          issues.push({
            severity: 'WARNING',
            type: 'DUPLICATE_RESERVATION',
            reservation_id: reservation.reservation_id,
            message: '同じ顧客・トレーナー・日時の予約が重複'
          });
        } else {
          seen[key] = reservation;
        }
      });
      
      return {
        checkName: 'Duplicate Reservations',
        issues: issues
      };
      
    } catch (error) {
      log('ERROR', 'SystemMonitor', 'Duplicate reservations check failed', { error: error.message });
      return { checkName: 'Duplicate Reservations', issues: [] };
    }
  },
  
  /**
   * 自動復旧処理
   */
  attemptAutoRecovery: function() {
    try {
      log('INFO', 'SystemMonitor', 'Starting auto recovery...');
      
      var results = {
        orphanedReservations: this._recoverOrphanedReservations()
      };
      
      var totalRecovered = results.orphanedReservations.recovered;
      
      log('INFO', 'SystemMonitor', 'Auto recovery completed: ' + totalRecovered + ' issues recovered');
      
      if (totalRecovered > 0 && typeof NotificationService !== 'undefined') {
        NotificationService.sendAdminNotification(
          'Data Integrity: Auto Recovery Completed',
          'Recovered Issues: ' + totalRecovered,
          'INFO'
        );
      }
      
      return {
        success: true,
        results: results,
        totalRecovered: totalRecovered
      };
      
    } catch (error) {
      log('ERROR', 'SystemMonitor', 'Auto recovery failed', { error: error.message });
      return { error: true, message: error.message };
    }
  },
  
/**
 * 孤児予約の復旧（最終修正版）
 */
_recoverOrphanedReservations: function() {
  var orphanedCheck = this._checkOrphanedReservations();
  var recovered = 0;
  var failed = 0;
  
  orphanedCheck.issues.forEach(function(issue) {
    try {
      var reservation = DB.findById(CONFIG.SHEET.RESERVATIONS, issue.reservation_id);
      
      if (!reservation) {
        failed++;
        return;
      }
      
      // 商品価格を取得
      var amount = 0;
      if (reservation.product_id) {
        var product = DB.findById(CONFIG.SHEET.PRODUCTS, reservation.product_id);
        if (product && product.product_price) {
          amount = product.product_price;
        }
      }
      
      // ★★★ 最終修正: payment_method を CREDIT_CARD に変更 ★★★
      var paymentData = {
        reservation_id: issue.reservation_id,
        customer_id: reservation.customer_id,
        payment_method: 'CREDIT_CARD',  // ← UNKNOWN から変更
        amount: amount,
        payment_status: 'PENDING',
        notes: '自動復旧で作成（整合性チェック）'
      };
      
      var payment = PaymentRepository.create(paymentData);
      
      if (!payment.error) {
        recovered++;
        log('INFO', 'SystemMonitor', 'Recovered orphaned reservation: ' + issue.reservation_id);
      } else {
        failed++;
        log('ERROR', 'SystemMonitor', 'Failed to recover: ' + issue.reservation_id, payment);
      }
    } catch (error) {
      failed++;
      log('ERROR', 'SystemMonitor', 'Recovery exception: ' + error.message);
    }
  });
  
  return { recovered: recovered, failed: failed };
},
  
  // ============================================================================
  // 3. Health Check Service（新規実装）
  // ============================================================================
  
  /**
   * システム全体の健全性チェック
   */
  getSystemHealth: function() {
    var context = { service: 'SystemMonitor', action: 'getSystemHealth' };
    
    try {
      log('INFO', 'SystemMonitor', 'Starting system health check');
      
      var health = {
        timestamp: new Date(),
        overall: 'HEALTHY',
        components: {
          database: this._checkDatabaseHealth(),
          transactions: this._checkTransactionHealth(),
          apis: this._checkApiHealth()
        }
      };
      
      // 全体ステータス判定
      var componentStatuses = [
        health.components.database.status,
        health.components.transactions.status,
        health.components.apis.status
      ];
      
      if (componentStatuses.indexOf('CRITICAL') !== -1) {
        health.overall = 'CRITICAL';
      } else if (componentStatuses.indexOf('WARNING') !== -1) {
        health.overall = 'WARNING';
      }
      
      log('INFO', 'SystemMonitor', 'System health: ' + health.overall);
      
      return {
        success: true,
        health: health
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * データベース健全性チェック
   */
  _checkDatabaseHealth: function() {
    try {
      var startTime = new Date().getTime();
      
      // テストクエリ実行
      DB.fetchTable(CONFIG.SHEET.CUSTOMERS);
      
      var responseTime = new Date().getTime() - startTime;
      
      var status = 'OK';
      if (responseTime > 3000) {
        status = 'WARNING';
      } else if (responseTime > 5000) {
        status = 'CRITICAL';
      }
      
      return {
        status: status,
        responseTime: responseTime,
        message: responseTime + 'ms'
      };
      
    } catch (error) {
      return {
        status: 'CRITICAL',
        responseTime: -1,
        message: 'Database connection failed: ' + error.message
      };
    }
  },
  
  /**
   * トランザクション健全性チェック
   */
  _checkTransactionHealth: function() {
    try {
      // 過去24時間のトランザクション統計
      var stats = Transaction.getFailureStatistics(1);
      
      if (stats.error) {
        return {
          status: 'WARNING',
          successRate: 0,
          failedCount: 0,
          message: 'Statistics unavailable'
        };
      }
      
      var successRate = stats.statistics.total_transactions > 0 ?
        ((stats.statistics.successful / stats.statistics.total_transactions) * 100).toFixed(2) :
        100;
      
      var status = 'OK';
      if (successRate < 95) {
        status = 'WARNING';
      } else if (successRate < 90) {
        status = 'CRITICAL';
      }
      
      return {
        status: status,
        successRate: parseFloat(successRate),
        failedCount: stats.statistics.failed,
        message: successRate + '% success rate'
      };
      
    } catch (error) {
      return {
        status: 'WARNING',
        successRate: 0,
        failedCount: 0,
        message: 'Transaction check failed'
      };
    }
  },
  
  /**
   * 外部API健全性チェック
   */
  _checkApiHealth: function() {
    var apis = {
      square: 'OK',
      line: 'OK'
    };
    
    // Square API チェック（簡易）
    try {
      if (!CONFIG.SQUARE || !CONFIG.SQUARE.SANDBOX || !CONFIG.SQUARE.SANDBOX.ACCESS_TOKEN) {
        apis.square = 'WARNING';
      }
    } catch (error) {
      apis.square = 'CRITICAL';
    }
    
    // LINE API チェック（簡易）
    try {
      if (!CONFIG.LINE || !CONFIG.LINE.CHANNEL_ACCESS_TOKEN) {
        apis.line = 'WARNING';
      }
    } catch (error) {
      apis.line = 'CRITICAL';
    }
    
    var status = 'OK';
    if (apis.square === 'CRITICAL' || apis.line === 'CRITICAL') {
      status = 'CRITICAL';
    } else if (apis.square === 'WARNING' || apis.line === 'WARNING') {
      status = 'WARNING';
    }
    
    return {
      status: status,
      square: apis.square,
      line: apis.line,
      message: 'Square: ' + apis.square + ', LINE: ' + apis.line
    };
  }
};

// ============================================================================
// トリガー設定関数
// ============================================================================

/**
 * トランザクション監視トリガー
 */
function TRIGGER_CheckFailedTransactions() {
  SystemMonitor.checkFailedTransactions();
}

/**
 * 整合性チェックトリガー
 */
function runDailyIntegrityCheck() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Daily Data Integrity Check               ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  try {
    var checkResult = SystemMonitor.runFullIntegrityCheck();
    
    if (checkResult.error) {
      console.error('❌ Integrity check failed:', checkResult.message);
      return;
    }
    
    console.log('✅ Integrity check completed');
    console.log('   Total Issues:', checkResult.results.summary.totalIssues);
    console.log('   Critical:', checkResult.results.summary.criticalIssues);
    console.log('   Warnings:', checkResult.results.summary.warnings);
    
    if (checkResult.results.summary.totalIssues > 0) {
      console.log('\nAttempting auto recovery...');
      
      var recoveryResult = SystemMonitor.attemptAutoRecovery();
      
      if (!recoveryResult.error) {
        console.log('✅ Auto recovery completed');
        console.log('   Recovered:', recoveryResult.totalRecovered);
      }
    }
    
  } catch (error) {
    console.error('❌ Daily integrity check failed:', error.message);
  }
}

// ============================================================================
// テスト関数
// ============================================================================

/**
 * システムモニター統合テスト
 */
function testSystemMonitor() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   System Monitor Integration Test         ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  // Test 1: トランザクション監視
  console.log('【Test 1】トランザクション監視');
  var txResult = SystemMonitor.checkFailedTransactions();
  
  if (txResult.error) {
    console.error('  ❌ Failed:', txResult.message);
  } else {
    console.log('  ✅ Success');
    console.log('    Failed transactions:', txResult.failedCount);
  }
  
  console.log('');
  
  // Test 2: 整合性チェック
  console.log('【Test 2】整合性チェック');
  var integrityResult = SystemMonitor.runFullIntegrityCheck();
  
  if (integrityResult.error) {
    console.error('  ❌ Failed:', integrityResult.message);
  } else {
    console.log('  ✅ Success');
    console.log('    Total issues:', integrityResult.results.summary.totalIssues);
    console.log('    Critical:', integrityResult.results.summary.criticalIssues);
  }
  
  console.log('');
  
  // Test 3: システム健全性
  console.log('【Test 3】システム健全性');
  var healthResult = SystemMonitor.getSystemHealth();
  
  if (healthResult.error) {
    console.error('  ❌ Failed:', healthResult.message);
  } else {
    console.log('  ✅ Success');
    console.log('    Overall:', healthResult.health.overall);
    console.log('    Database:', healthResult.health.components.database.status,
                '(' + healthResult.health.components.database.responseTime + 'ms)');
    console.log('    Transactions:', healthResult.health.components.transactions.status,
                '(' + healthResult.health.components.transactions.successRate + '%)');
    console.log('    APIs:', healthResult.health.components.apis.status);
  }
  
  console.log('');
  console.log('═'.repeat(48));
  console.log('System Monitor Test Complete');
}

/**
 * エラー監視トリガー作成（1時間ごと）
 */
function createErrorMonitoringTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  
  // 既存トリガー削除
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'TRIGGER_MonitorErrors') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 新規作成
  ScriptApp.newTrigger('TRIGGER_MonitorErrors')
    .timeBased()
    .everyHours(1)
    .create();
  
  log('INFO', 'Triggers', 'Error monitoring trigger created');
}

/**
 * エラー監視トリガー実行関数
 */
function TRIGGER_MonitorErrors() {
  NotificationService.monitorCriticalErrors();
}