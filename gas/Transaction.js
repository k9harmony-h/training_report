/**
 * ============================================================================
 * K9 Harmony - Transaction Manager (Enhanced)
 * ============================================================================
 * ファイル名: Transaction.gs
 * 役割: 疑似トランザクション管理・ロールバック・監査ログ
 * 最終更新: 2026-01-05
 * バージョン: v2.0.0
 * 
 * 変更内容:
 * - トランザクションログ詳細化
 * - ロールバック処理の改善
 * - 監査ログ機能追加
 * - リトライロジック統合
 */

var Transaction = {
  
  /**
   * トランザクション実行
   * 
   * @param {Function} operation - 実行する処理
   * @param {Object} context - コンテキスト情報
   * @return {Object} 実行結果
   */
  execute: function(operation, context) {
    var transactionId = Utilities.getUuid();
    var startTime = new Date();
    
    var transactionLog = {
      transaction_id: transactionId,
      context: context || {},
      start_time: startTime,
      status: 'STARTED',
      operations: [],
      rollback_operations: []
    };
    
    try {
      log('INFO', 'Transaction', 'Transaction started: ' + transactionId, context);
      
      // 操作実行
      var result = operation(transactionLog);
      
      // 成功
      transactionLog.status = 'COMMITTED';
      transactionLog.end_time = new Date();
      transactionLog.duration_ms = transactionLog.end_time - startTime;
      transactionLog.result = result;
      
      this._saveTransactionLog(transactionLog);
      
      log('INFO', 'Transaction', 'Transaction committed: ' + transactionId + 
          ' (Duration: ' + transactionLog.duration_ms + 'ms)');
      
      return {
        success: true,
        transaction_id: transactionId,
        result: result
      };
      
    } catch (error) {
      // エラー発生 - ロールバック実行
      transactionLog.status = 'FAILED';
      transactionLog.end_time = new Date();
      transactionLog.duration_ms = transactionLog.end_time - startTime;
      transactionLog.error = error.message || error.toString();
      
      log('ERROR', 'Transaction', 'Transaction failed: ' + transactionId + ' - ' + transactionLog.error);
      
      // ロールバック実行
      var rollbackResult = this._executeRollback(transactionLog);
      
      transactionLog.rollback_status = rollbackResult.status;
      transactionLog.rollback_details = rollbackResult.details;
      
      this._saveTransactionLog(transactionLog);
      
      return {
        success: false,
        transaction_id: transactionId,
        error: error,
        rollback_result: rollbackResult
      };
    }
  },
  
  /**
   * ロールバック実行
   */
  _executeRollback: function(transactionLog) {
    log('WARN', 'Transaction', 'Executing rollback: ' + transactionLog.transaction_id);
    
    var rollbackDetails = {
      total: transactionLog.rollback_operations.length,
      successful: 0,
      failed: 0,
      errors: []
    };
    
    // ロールバック操作を逆順で実行
    var reversedOps = transactionLog.rollback_operations.slice().reverse();
    
    reversedOps.forEach(function(rollbackOp) {
      try {
        rollbackOp.operation();
        rollbackDetails.successful++;
        
        log('INFO', 'Transaction', 'Rollback operation succeeded: ' + rollbackOp.description);
        
      } catch (rollbackError) {
        rollbackDetails.failed++;
        rollbackDetails.errors.push({
          description: rollbackOp.description,
          error: rollbackError.message || rollbackError.toString()
        });
        
        log('ERROR', 'Transaction', 'Rollback operation failed: ' + rollbackOp.description + 
            ' - ' + rollbackError.message);
      }
    });
    
    var status = rollbackDetails.failed === 0 ? 'ROLLED_BACK' : 'PARTIAL_ROLLBACK';
    
    log('WARN', 'Transaction', 'Rollback completed: ' + status + 
        ' (Success: ' + rollbackDetails.successful + ', Failed: ' + rollbackDetails.failed + ')');
    
    return {
      status: status,
      details: rollbackDetails
    };
  },
  
  /**
   * トランザクションログを保存
   */
  _saveTransactionLog: function(transactionLog) {
    try {
      var logEntry = {
        transaction_id: transactionLog.transaction_id,
        context: JSON.stringify(transactionLog.context),
        status: transactionLog.status,
        start_time: transactionLog.start_time,
        end_time: transactionLog.end_time,
        duration_ms: transactionLog.duration_ms,
        operations_count: transactionLog.operations.length,
        rollback_operations_count: transactionLog.rollback_operations.length,
        rollback_status: transactionLog.rollback_status || '',
        error: transactionLog.error || '',
        created_at: new Date()
      };
      
      // トランザクションログシートに保存
      DB.insert(CONFIG.SHEET.TRANSACTION_LOG, logEntry);
      
    } catch (error) {
      log('ERROR', 'Transaction', 'Failed to save transaction log: ' + error.message);
    }
  },
  
  /**
   * 操作を記録（監査用）
   */
  recordOperation: function(transactionLog, description, data) {
    if (!transactionLog) return;
    
    transactionLog.operations.push({
      timestamp: new Date(),
      description: description,
      data: data
    });
    
    log('DEBUG', 'Transaction', 'Operation recorded: ' + description);
  },
  
  /**
   * ロールバック操作を登録
   */
  registerRollback: function(transactionLog, description, rollbackOperation) {
    if (!transactionLog) return;
    
    transactionLog.rollback_operations.push({
      description: description,
      operation: rollbackOperation
    });
    
    log('DEBUG', 'Transaction', 'Rollback operation registered: ' + description);
  },
  
  /**
   * アトミック操作ヘルパー - 予約+決済（Square API呼び出し含む）
   * 2026-01-26: Square決済処理を追加
   */
  createReservationWithPaymentAtomic: function(reservationData, paymentData, lockId) {
    var context = {
      operation: 'createReservationWithPayment',
      customer_id: reservationData.customer_id
    };

    return this.execute(function(transactionLog) {

      // Step 1: ロック解除
      if (lockId && lockId !== 'null') {
        Transaction.recordOperation(transactionLog, 'Unlock slot', { lockId: lockId });
        ReservationService.unlockSlot(lockId, 'COMPLETED');
      }

      // Step 2: 予約作成
      log('INFO', 'Transaction', 'Step 2: Creating reservation');
      Transaction.recordOperation(transactionLog, 'Create reservation', reservationData);

      var reservation = ReservationRepository.create(reservationData);

      if (reservation.error) {
        log('ERROR', 'Transaction', 'Reservation creation failed', reservation);
        throw reservation;
      }

      log('INFO', 'Transaction', 'Reservation created: ' + reservation.reservation_code);

      // ロールバック登録: 予約削除
      Transaction.registerRollback(
        transactionLog,
        'Delete reservation: ' + reservation.reservation_code,
        function() {
          DB.deleteById(CONFIG.SHEET.RESERVATIONS, reservation.reservation_id);
          // Googleカレンダーイベントも削除
          if (reservation.google_calendar_id) {
            try {
              var calendarRepo = new CalendarRepository();
              calendarRepo.deleteEvent(reservation.google_calendar_id);
            } catch (calError) {
              log('WARN', 'Transaction', 'Calendar event deletion failed: ' + calError.message);
            }
          }
        }
      );

      // Step 3: 決済レコード作成（PENDING状態）
      log('INFO', 'Transaction', 'Step 3: Creating payment record');
      paymentData.reservation_id = reservation.reservation_id;
      paymentData.customer_id = reservation.customer_id;
      paymentData.payment_status = 'PENDING';  // 初期状態

      Transaction.recordOperation(transactionLog, 'Create payment record', paymentData);

      var payment = PaymentRepository.create(paymentData);

      if (payment.error) {
        log('ERROR', 'Transaction', 'Payment record creation failed', payment);
        throw payment;
      }

      log('INFO', 'Transaction', 'Payment record created: ' + payment.payment_id);

      // ロールバック登録: 決済レコード削除
      Transaction.registerRollback(
        transactionLog,
        'Delete payment: ' + payment.payment_id,
        function() {
          DB.deleteById(CONFIG.SHEET.PAYMENTS, payment.payment_id);
        }
      );

      // ===== Step 4: Square決済実行 =====
      log('INFO', 'Transaction', 'Step 4: Processing Square payment');
      log('DEBUG', 'Transaction', 'Square source_id: ' + paymentData.square_source_id);

      if (!paymentData.square_source_id) {
        throw createK9Error(
          ErrorCode.VALIDATION_ERROR,
          'Square source_id (payment token) is required',
          { payment_id: payment.payment_id }
        );
      }

      Transaction.recordOperation(transactionLog, 'Process Square payment', {
        amount: paymentData.total_amount,
        source_id: paymentData.square_source_id
      });

      var squareResult = SquareService.processCardPayment(paymentData, paymentData.square_source_id);

      log('INFO', 'Transaction', 'Square payment result', {
        success: squareResult.success,
        error: squareResult.error,
        square_payment_id: squareResult.square_payment_id
      });

      if (squareResult.error || !squareResult.success) {
        log('ERROR', 'Transaction', 'Square payment failed', squareResult);
        throw createK9Error(
          ErrorCode.SQUARE_API_ERROR,
          'Square payment failed: ' + (squareResult.message || 'Unknown error'),
          squareResult
        );
      }

      log('INFO', 'Transaction', 'Square payment successful: ' + squareResult.square_payment_id);

      // ロールバック登録: Square決済キャンセル
      Transaction.registerRollback(
        transactionLog,
        'Cancel Square payment: ' + squareResult.square_payment_id,
        function() {
          try {
            log('INFO', 'Transaction', 'Cancelling Square payment: ' + squareResult.square_payment_id);
            SquareService.cancelPayment(squareResult.square_payment_id);
          } catch (cancelError) {
            log('ERROR', 'Transaction', 'Square payment cancellation failed: ' + cancelError.message);
          }
        }
      );

      // ===== Step 5: 決済レコード更新（CAPTURED + Square詳細）=====
      log('INFO', 'Transaction', 'Step 5: Updating payment record with Square details');

      var paymentUpdateData = {
        payment_status: 'CAPTURED',
        square_payment_id: squareResult.square_payment_id,
        card_brand: squareResult.card_brand || '',
        card_last4: squareResult.card_last4 || '',
        updated_at: new Date()
      };

      PaymentRepository.update(payment.payment_id, paymentUpdateData);

      // メモリ内のpaymentオブジェクトも更新
      payment.payment_status = 'CAPTURED';
      payment.square_payment_id = squareResult.square_payment_id;
      payment.card_brand = squareResult.card_brand;
      payment.card_last4 = squareResult.card_last4;

      log('INFO', 'Transaction', 'Payment record updated to CAPTURED');

      // ===== Step 6: 予約ステータス更新（CONFIRMED）=====
      log('INFO', 'Transaction', 'Step 6: Updating reservation status to CONFIRMED');

      DB.update(CONFIG.SHEET.RESERVATIONS, reservation.reservation_id, {
        status: 'CONFIRMED',
        payment_status: 'CAPTURED',
        updated_at: new Date()
      });

      reservation.status = 'CONFIRMED';
      reservation.payment_status = 'CAPTURED';

      // ===== Step 7: 売上計上 =====
      log('INFO', 'Transaction', 'Step 7: Recording sale');

      try {
        var saleData = {
          sale_id: Utilities.getUuid(),
          sale_date: new Date(),
          customer_id: payment.customer_id,
          product_id: reservation.product_id || '',
          sales_price: payment.amount,
          sales_amount: payment.total_amount,
          tax_amount: payment.tax_amount,
          sale_type: 'LESSON',
          reservation_id: reservation.reservation_id,
          sale_status: 'ACTIVE',
          payment_method: payment.payment_method,
          created_at: new Date(),
          updated_at: new Date(),
          remarks: 'Payment ID: ' + payment.payment_id + ', Square: ' + squareResult.square_payment_id
        };

        DB.insert(CONFIG.SHEET.SALES, saleData);
        log('INFO', 'Transaction', 'Sale recorded: ' + saleData.sale_id);

        // ロールバック登録: 売上取り消し
        Transaction.registerRollback(
          transactionLog,
          'Cancel sale: ' + saleData.sale_id,
          function() {
            DB.update(CONFIG.SHEET.SALES, saleData.sale_id, {
              sale_status: 'CANCELLED',
              cancellation_reason: 'TRANSACTION_ROLLBACK',
              updated_at: new Date()
            });
          }
        );
      } catch (saleError) {
        log('ERROR', 'Transaction', 'Sale recording failed (non-critical): ' + saleError.message);
      }

      // ===== Step 8: 通知送信（失敗してもロールバックしない）=====
      if (typeof NotificationService !== 'undefined') {
        try {
          log('INFO', 'Transaction', 'Step 8: Sending notification');
          Transaction.recordOperation(transactionLog, 'Send notification', {
            reservation_id: reservation.reservation_id
          });

          var customer = CustomerRepository.findById(reservation.customer_id);

          if (!customer.error && customer.line_user_id) {
            NotificationService.sendReservationConfirmation(reservation, customer);
          }
        } catch (notificationError) {
          log('WARN', 'Transaction', 'Notification failed (non-critical): ' + notificationError.message);
        }
      }

      log('INFO', 'Transaction', '=== Transaction completed successfully ===');

      return {
        reservation: reservation,
        payment: payment
      };

    }, context);
  },
  
  /**
   * トランザクション履歴取得
   */
  getTransactionHistory: function(filters) {
    var context = { service: 'Transaction', action: 'getTransactionHistory' };
    
    try {
      var logs = DB.fetchTable(CONFIG.SHEET.TRANSACTION_LOG);
      
      // フィルタリング
      if (filters) {
        if (filters.status) {
          logs = logs.filter(function(log) {
            return log.status === filters.status;
          });
        }
        
        if (filters.dateFrom) {
          var dateFrom = new Date(filters.dateFrom);
          logs = logs.filter(function(log) {
            return new Date(log.start_time) >= dateFrom;
          });
        }
        
        if (filters.dateTo) {
          var dateTo = new Date(filters.dateTo);
          logs = logs.filter(function(log) {
            return new Date(log.start_time) <= dateTo;
          });
        }
      }
      
      // 新しい順にソート
      logs.sort(function(a, b) {
        return new Date(b.start_time) - new Date(a.start_time);
      });
      
      return {
        success: true,
        logs: logs
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 失敗したトランザクションの統計
   */
  getFailureStatistics: function(days) {
    var context = { service: 'Transaction', action: 'getFailureStatistics' };
    
    try {
      days = days || 7;
      
      var dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      
      var logs = DB.fetchTable(CONFIG.SHEET.TRANSACTION_LOG);
      
      var recentLogs = logs.filter(function(log) {
        return new Date(log.start_time) >= dateFrom;
      });
      
      var stats = {
        period_days: days,
        total_transactions: recentLogs.length,
        successful: 0,
        failed: 0,
        rolled_back: 0,
        partial_rollback: 0,
        failure_rate: 0,
        avg_duration_ms: 0,
        errors: {}
      };
      
      var totalDuration = 0;
      
      recentLogs.forEach(function(log) {
        if (log.status === 'COMMITTED') {
          stats.successful++;
        } else if (log.status === 'FAILED') {
          stats.failed++;
          
          if (log.rollback_status === 'ROLLED_BACK') {
            stats.rolled_back++;
          } else if (log.rollback_status === 'PARTIAL_ROLLBACK') {
            stats.partial_rollback++;
          }
          
          // エラー種別集計
          if (log.error) {
            stats.errors[log.error] = (stats.errors[log.error] || 0) + 1;
          }
        }
        
        totalDuration += log.duration_ms || 0;
      });
      
      if (stats.total_transactions > 0) {
        stats.failure_rate = (stats.failed / stats.total_transactions * 100).toFixed(2);
        stats.avg_duration_ms = Math.round(totalDuration / stats.total_transactions);
      }
      
      return {
        success: true,
        statistics: stats
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  }
};

// ============================================================================
// リトライハンドラー（強化版）
// ============================================================================

var RetryHandler = {
  
  /**
   * リトライ実行（強化版 - 詳細ログ付き）
   * 
   * @param {Function} operation - 実行する処理
   * @param {Object} options - オプション設定
   * @return {Object} 実行結果
   */
  execute: function(operation, options) {
    options = options || {};
    
    var retryId = Utilities.getUuid();
    var context = options.context || {};
    var maxRetries = options.maxRetries || this._getMaxRetries(context.operation);
    var delay = options.delay || this._getInitialDelay(context.operation);
    var backoff = options.backoff || 2;
    var timeout = options.timeout || 30000; // 30秒
    
    var retryLog = {
      retry_id: retryId,
      operation: context.operation || 'UNKNOWN',
      context: context,
      max_retries: maxRetries,
      start_time: new Date(),
      attempts: [],
      status: 'STARTED'
    };
    
    var attempt = 0;
    var lastError;
    var startTime = new Date().getTime();
    
    while (attempt < maxRetries) {
      var attemptStartTime = new Date();
      
      try {
        log('INFO', 'RetryHandler', 'Attempt ' + (attempt + 1) + '/' + maxRetries + 
            ' for retry_id: ' + retryId);
        
        // タイムアウトチェック
        if (new Date().getTime() - startTime > timeout) {
          throw new Error('Operation timeout after ' + timeout + 'ms');
        }
        
        // 操作実行
        var result = operation();
        
        // 成功
        var attemptEndTime = new Date();
        var attemptDuration = attemptEndTime - attemptStartTime;
        
        retryLog.attempts.push({
          attempt_number: attempt + 1,
          start_time: attemptStartTime,
          end_time: attemptEndTime,
          duration_ms: attemptDuration,
          status: 'SUCCESS',
          error: null
        });
        
        retryLog.status = 'SUCCESS';
        retryLog.end_time = new Date();
        retryLog.total_duration_ms = retryLog.end_time - retryLog.start_time;
        retryLog.successful_attempt = attempt + 1;
        
        this._saveRetryLog(retryLog);
        
        log('INFO', 'RetryHandler', 'Operation succeeded on attempt ' + (attempt + 1) + 
            ' (retry_id: ' + retryId + ')');
        
        return {
          success: true,
          result: result,
          retry_id: retryId,
          attempts: attempt + 1
        };
        
      } catch (error) {
        attempt++;
        lastError = error;
        
        var attemptEndTime = new Date();
        var attemptDuration = attemptEndTime - attemptStartTime;
        
        retryLog.attempts.push({
          attempt_number: attempt,
          start_time: attemptStartTime,
          end_time: attemptEndTime,
          duration_ms: attemptDuration,
          status: 'FAILED',
          error: error.message || error.toString()
        });
        
        log('WARN', 'RetryHandler', 'Attempt ' + attempt + ' failed: ' + error.message + 
            ' (retry_id: ' + retryId + ')');
        
        if (attempt < maxRetries) {
          log('INFO', 'RetryHandler', 'Waiting ' + delay + 'ms before retry...');
          Utilities.sleep(delay);
          delay *= backoff;
        }
      }
    }
    
    // 全てのリトライ失敗
    retryLog.status = 'FAILED';
    retryLog.end_time = new Date();
    retryLog.total_duration_ms = retryLog.end_time - retryLog.start_time;
    retryLog.final_error = lastError.message || lastError.toString();
    
    this._saveRetryLog(retryLog);
    
    // 重大なエラー: 管理者に通知
    this._notifyAdminRetryFailure(retryLog);
    
    log('ERROR', 'RetryHandler', 'All retries failed (retry_id: ' + retryId + '): ' + 
        lastError.message);
    
    return {
      success: false,
      error: lastError,
      retry_id: retryId,
      attempts: attempt
    };
  },
  
  /**
   * 操作別の最大リトライ回数を取得
   */
  _getMaxRetries: function(operation) {
    var policies = {
      'squarePayment': 5,
      'squareRefund': 5,
      'createReservationWithPayment': 3,
      'sendNotification': 2,
      'default': 3
    };
    
    return policies[operation] || policies.default;
  },
  
  /**
   * 操作別の初回待機時間を取得
   */
  _getInitialDelay: function(operation) {
    var delays = {
      'squarePayment': 2000,
      'squareRefund': 2000,
      'createReservationWithPayment': 1000,
      'sendNotification': 500,
      'default': 1000
    };
    
    return delays[operation] || delays.default;
  },
  
  /**
   * リトライログを保存
   */
  _saveRetryLog: function(retryLog) {
    try {
      // Retry_Logs シートが存在するか確認
      if (!CONFIG.SHEET || !CONFIG.SHEET.RETRY_LOGS) {
        log('WARN', 'RetryHandler', 'RETRY_LOGS sheet not configured');
        return;
      }
      
      var logEntry = {
        retry_id: retryLog.retry_id,
        operation: retryLog.operation,
        context: JSON.stringify(retryLog.context),
        max_retries: retryLog.max_retries,
        start_time: retryLog.start_time,
        end_time: retryLog.end_time,
        total_duration_ms: retryLog.total_duration_ms,
        status: retryLog.status,
        attempts_count: retryLog.attempts.length,
        successful_attempt: retryLog.successful_attempt || null,
        final_error: retryLog.final_error || null,
        attempts_detail: JSON.stringify(retryLog.attempts),
        created_at: new Date()
      };
      
      DB.insert(CONFIG.SHEET.RETRY_LOGS, logEntry);
      
      log('DEBUG', 'RetryHandler', 'Retry log saved: ' + retryLog.retry_id);
      
    } catch (error) {
      log('ERROR', 'RetryHandler', 'Failed to save retry log: ' + error.message);
    }
  },
  
  /**
   * リトライ失敗時に管理者へ通知（重大エラーのみ）
   */
  _notifyAdminRetryFailure: function(retryLog) {
    try {
      // 重大なエラーかどうか判定
      var isCritical = this._isCriticalFailure(retryLog);
      
      if (!isCritical) {
        log('INFO', 'RetryHandler', 'Retry failure is not critical, skipping admin notification');
        return;
      }
      
      if (typeof NotificationService === 'undefined') {
        log('WARN', 'RetryHandler', 'NotificationService not available');
        return;
      }
      
      var subject = '[K9 Harmony] 重大エラー: リトライ失敗';
      var body = this._buildRetryFailureEmail(retryLog);
      
      NotificationService.sendAdminNotification(subject, body, 'CRITICAL');
      
      log('INFO', 'RetryHandler', 'Admin notification sent for retry failure: ' + retryLog.retry_id);
      
    } catch (error) {
      log('ERROR', 'RetryHandler', 'Failed to notify admin: ' + error.message);
    }
  },
  
  /**
   * 重大なエラーかどうか判定
   */
  _isCriticalFailure: function(retryLog) {
    // 重大な操作のリスト
    var criticalOperations = [
      'squarePayment',
      'squareRefund',
      'createReservationWithPayment'
    ];
    
    // 重大な操作かつ全てのリトライが失敗
    return criticalOperations.indexOf(retryLog.operation) !== -1 && 
           retryLog.status === 'FAILED';
  },
  
  /**
   * リトライ失敗メール本文生成
   */
  _buildRetryFailureEmail: function(retryLog) {
    var body = '重大なエラーが発生しました。\n\n';
    body += '='.repeat(50) + '\n';
    body += 'リトライID: ' + retryLog.retry_id + '\n';
    body += '操作: ' + retryLog.operation + '\n';
    body += '発生時刻: ' + Utilities.formatDate(retryLog.start_time, 'JST', 'yyyy-MM-dd HH:mm:ss') + '\n';
    body += 'リトライ回数: ' + retryLog.attempts.length + '/' + retryLog.max_retries + '\n';
    body += 'ステータス: 全て失敗\n';
    body += '='.repeat(50) + '\n\n';
    
    body += '【各リトライの詳細】\n\n';
    
    retryLog.attempts.forEach(function(attempt, index) {
      body += (index + 1) + '回目:\n';
      body += '  開始: ' + Utilities.formatDate(attempt.start_time, 'JST', 'HH:mm:ss') + '\n';
      body += '  所要時間: ' + attempt.duration_ms + 'ms\n';
      body += '  結果: ' + attempt.status + '\n';
      if (attempt.error) {
        body += '  エラー: ' + attempt.error + '\n';
      }
      body += '\n';
    });
    
    body += '【最終エラー】\n';
    body += retryLog.final_error + '\n\n';
    
    body += '【コンテキスト】\n';
    body += JSON.stringify(retryLog.context, null, 2) + '\n\n';
    
    body += '='.repeat(50) + '\n';
    body += '管理者ダッシュボードで詳細を確認してください。\n';
    body += '必要に応じて手動で再実行してください。\n';
    
    return body;
  },
  
  /**
   * リトライ統計を取得
   */
  getRetryStatistics: function(days) {
    var context = { service: 'RetryHandler', action: 'getRetryStatistics' };
    
    try {
      days = days || 7;
      
      // Retry_Logs シートが存在するか確認
      if (!CONFIG.SHEET || !CONFIG.SHEET.RETRY_LOGS) {
        log('WARN', 'RetryHandler', 'RETRY_LOGS sheet not configured');
        return {
          success: false,
          message: 'RETRY_LOGS sheet not configured'
        };
      }
      
      var dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      
      var logs = DB.fetchTable(CONFIG.SHEET.RETRY_LOGS);
      
      var recentLogs = logs.filter(function(log) {
        return new Date(log.start_time) >= dateFrom;
      });
      
      var stats = {
        period_days: days,
        total_retries: recentLogs.length,
        successful: 0,
        failed: 0,
        success_rate: 0,
        avg_attempts: 0,
        by_operation: {},
        top_errors: {}
      };
      
      var totalAttempts = 0;
      
      recentLogs.forEach(function(log) {
        if (log.status === 'SUCCESS') {
          stats.successful++;
        } else if (log.status === 'FAILED') {
          stats.failed++;
          
          // エラー種別集計
          if (log.final_error) {
            stats.top_errors[log.final_error] = (stats.top_errors[log.final_error] || 0) + 1;
          }
        }
        
        // 操作別集計
        var operation = log.operation || 'UNKNOWN';
        if (!stats.by_operation[operation]) {
          stats.by_operation[operation] = {
            total: 0,
            successful: 0,
            failed: 0
          };
        }
        
        stats.by_operation[operation].total++;
        
        if (log.status === 'SUCCESS') {
          stats.by_operation[operation].successful++;
        } else {
          stats.by_operation[operation].failed++;
        }
        
        totalAttempts += log.attempts_count || 0;
      });
      
      if (stats.total_retries > 0) {
        stats.success_rate = (stats.successful / stats.total_retries * 100).toFixed(2);
        stats.avg_attempts = (totalAttempts / stats.total_retries).toFixed(2);
      }
      
      return {
        success: true,
        statistics: stats
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * アクティブなリトライを取得（実行中のもの）
   */
  getActiveRetries: function() {
    var context = { service: 'RetryHandler', action: 'getActiveRetries' };
    
    try {
      // Retry_Logs シートが存在するか確認
      if (!CONFIG.SHEET || !CONFIG.SHEET.RETRY_LOGS) {
        return {
          success: false,
          message: 'RETRY_LOGS sheet not configured'
        };
      }
      
      // 過去1時間以内でSTARTED状態のもの
      var oneHourAgo = new Date(new Date().getTime() - 60 * 60 * 1000);
      var logs = DB.fetchTable(CONFIG.SHEET.RETRY_LOGS);
      
      var activeRetries = logs.filter(function(log) {
        return log.status === 'STARTED' && 
               new Date(log.start_time) >= oneHourAgo;
      });
      
      return {
        success: true,
        retries: activeRetries,
        count: activeRetries.length
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  }
};

// ============================================================================
// テスト関数
// ============================================================================

function TEST_Transaction() {
  console.log('=== Transaction Test ===\n');
  
  // テスト用の予約データ
  var reservationData = {
    customer_id: '6fec4d95-a1b2-c3d4-e5f6-123456789001',
    primary_dog_id: 'da12c3a5-b2c3-d4e5-f6a7-001',
    trainer_id: 'e44b0184-c3d4-e5f6-a7b8-tr001',
    office_id: '0721fa20-d4e5-f6a7-b8c9-of001',
    product_id: 'prod001',
    reservation_date: '2026-03-20 14:00:00',
    start_time: '14:00',
    location_type: '屋外'
  };
  
  var paymentData = {
    amount: 4900,
    payment_method: 'CREDIT_CARD',
    square_source_id: 'test-source-id'
  };
  
  console.log('テスト: 予約+決済のアトミック処理');
  
  var result = Transaction.createReservationWithPaymentAtomic(
    reservationData,
    paymentData,
    null
  );
  
  if (result.success) {
    console.log('✅ トランザクション成功');
    console.log('   Transaction ID:', result.transaction_id);
    console.log('   予約コード:', result.result.reservation.reservation_code);
    console.log('   決済コード:', result.result.payment.payment_code);
  } else {
    console.log('❌ トランザクション失敗');
    console.log('   Transaction ID:', result.transaction_id);
    console.log('   エラー:', result.error.message);
    console.log('   ロールバック:', result.rollback_result.status);
  }
}

function TEST_TransactionStats() {
  console.log('=== Transaction Statistics Test ===\n');
  
  var result = Transaction.getFailureStatistics(7);
  
  if (result.error) {
    console.error('❌ エラー:', result.message);
    return;
  }
  
  var stats = result.statistics;
  
  console.log('【過去' + stats.period_days + '日間の統計】');
  console.log('  総トランザクション数:', stats.total_transactions);
  console.log('  成功:', stats.successful);
  console.log('  失敗:', stats.failed);
  console.log('  失敗率:', stats.failure_rate + '%');
  console.log('  完全ロールバック:', stats.rolled_back);
  console.log('  部分ロールバック:', stats.partial_rollback);
  console.log('  平均実行時間:', stats.avg_duration_ms + 'ms');
  
  if (Object.keys(stats.errors).length > 0) {
    console.log('\n【エラー種別】');
    Object.keys(stats.errors).forEach(function(error) {
      console.log('  ' + error + ':', stats.errors[error] + '回');
    });
  }
}