/**
 * ============================================================================
 * K9 Harmony - Payment Repository
 * ============================================================================
 * ファイル名: PaymentRepository.gs
 * 役割: 決済情報のCRUD操作 + Square統合準備
 * 最終更新: 2026-01-02
 * バージョン: v1.0.0
 */

// ============================================================================
// 決済リポジトリ
// ============================================================================

var PaymentRepository = {
  
  /**
   * 決済作成
   * @param {Object} data 決済データ
   * @return {Object} 作成された決済データ
   */
  create: function(data) {
    var context = { service: 'PaymentRepository', action: 'create' };
    
    try {
      // 1. バリデーション
      var errors = ValidationRules.payment(data);
      if (errors.length > 0) {
        throw errors[0];
      }
      
      // 2. 予約存在確認
      var reservation = ReservationRepository.findById(data.reservation_id);
      if (reservation.error) {
        throw ErrorHandler.notFoundError('Reservation', data.reservation_id);
      }
      
      // 3. ID生成
      data.payment_id = Utilities.getUuid();
      
// 4. 税額・合計金額計算
if (!data.tax_amount && !data.total_amount) {
  data.tax_amount = Math.floor(data.amount * CONFIG.BUSINESS.TAX_RATE);
  data.total_amount = data.amount + data.tax_amount;
} else if (!data.total_amount) {
  data.total_amount = data.amount + (data.tax_amount || 0);
} else {
  if (!data.tax_amount) {
    data.tax_amount = data.total_amount - data.amount;
  }
}

// 5. デフォルト値設定
data.payment_status = data.payment_status || 'PENDING';
data.payment_method = data.payment_method || 'CREDIT_CARD';
data.created_at = new Date();
data.updated_at = new Date();

// 6. DB登録
DB.insert(CONFIG.SHEET.PAYMENTS, data);

// ★★★ 7. CAPTUREDの場合は売上計上も行う ★★★
if (data.payment_status === 'CAPTURED') {
  var saleData = {
    sale_id: Utilities.getUuid(),
    sale_code: '',  // 空のまま（自動採番は将来実装）
    sale_date: new Date(),
    customer_id: data.customer_id || this._getCustomerIdFromReservation(data.reservation_id),
    product_id: '',  // 商品IDは予約から取得する必要がある
    sales_price: 0,
    coupon_id: '',
    coupon_value: 0,
    sales_amount: data.total_amount,
    payment_method: data.payment_method,
    created_at: new Date(),
    updated_at: new Date(),
    remarks: 'Payment ID: ' + data.payment_id  // payment_idはremarksに記録
  };
  
  try {
    DB.insert(CONFIG.SHEET.SALES, saleData);
    log('INFO', 'PaymentRepository', 'Sale recorded: ' + saleData.sale_id);
  } catch (saleError) {
    log('ERROR', 'PaymentRepository', 'Failed to record sale', { error: saleError.message });
  }
}

// 8. 監査ログ記録
if (typeof AuditService !== 'undefined') {
  AuditService.logSafe('payment', data.payment_id, 'CREATE', null, data, 'SYSTEM', 'PAYMENT_SYSTEM');
}

log('INFO', 'PaymentRepository', 'Payment created: ' + data.payment_id);

return data;
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 決済検索（ID）
   */
  findById: function(paymentId) {
    try {
      var payment = DB.findById(CONFIG.SHEET.PAYMENTS, paymentId);
      
      if (!payment) {
        throw ErrorHandler.notFoundError('Payment', paymentId);
      }
      
      return payment;
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'PaymentRepository', action: 'findById' });
    }
  },
  
  /**
   * 予約IDで決済検索
   */
  findByReservationId: function(reservationId) {
    try {
      return DB.findBy(CONFIG.SHEET.PAYMENTS, 'reservation_id', reservationId);
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'PaymentRepository', action: 'findByReservationId' });
    }
  },
  
  /**
   * Square決済IDで検索
   */
  findBySquarePaymentId: function(squarePaymentId) {
    try {
      var payments = DB.findBy(CONFIG.SHEET.PAYMENTS, 'square_payment_id', squarePaymentId);
      return payments.length > 0 ? payments[0] : null;
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'PaymentRepository', action: 'findBySquarePaymentId' });
    }
  },
  
  /**
   * 決済更新
   */
  update: function(paymentId, data) {
    var context = { service: 'PaymentRepository', action: 'update' };
    
    try {
      var oldData = this.findById(paymentId);
      
      if (oldData.error) {
        throw oldData;
      }
      
      data.updated_at = new Date();
      
      DB.update(CONFIG.SHEET.PAYMENTS, paymentId, data);
      
      if (typeof AuditService !== 'undefined') {
  AuditService.logSafe('payment', paymentId, 'UPDATE', oldData, data, 'SYSTEM', 'PAYMENT_SYSTEM');
}
      
      log('INFO', 'PaymentRepository', 'Payment updated: ' + paymentId);
      
      return this.findById(paymentId);
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 決済承認
   */
  authorize: function(paymentId, squarePaymentId) {
    return this.update(paymentId, {
      payment_status: 'AUTHORIZED',
      square_payment_id: squarePaymentId,
      authorized_at: new Date()
    });
  },
  
  /**
   * 決済確定（売上計上）
   */
  capture: function(paymentId) {
    var context = { service: 'PaymentRepository', action: 'capture' };
    
    try {
      var payment = this.findById(paymentId);
      
      if (payment.error) {
        throw payment;
      }
      
      // ステータス確認
      if (payment.payment_status !== 'AUTHORIZED') {
        throw ErrorHandler.validationError(
          'payment_status',
          'Payment must be AUTHORIZED before capture. Current status: ' + payment.payment_status
        );
      }
      
      // 決済ステータス更新
      DB.update(CONFIG.SHEET.PAYMENTS, paymentId, {
        payment_status: 'CAPTURED',
        captured_at: new Date(),
        updated_at: new Date()
      });

      // 売上計上
      var saleData = {
        sale_id: Utilities.getUuid(),
        payment_id: paymentId,
        reservation_id: payment.reservation_id,
        customer_id: payment.customer_id || PaymentRepository._getCustomerIdFromReservation(payment.reservation_id),
        sale_date: new Date(),
        sales_amount: payment.total_amount,
        tax_amount: payment.tax_amount,
        created_at: new Date(),
        updated_at: new Date()
      };

      DB.insert(CONFIG.SHEET.SALES, saleData);

      log('INFO', 'PaymentRepository', 'Payment captured and sale recorded: ' + paymentId);

      return this.findById(paymentId);
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 決済失敗
   */
  fail: function(paymentId, errorMessage) {
    return this.update(paymentId, {
      payment_status: 'FAILED',
      error_message: errorMessage,
      failed_at: new Date()
    });
  },
  
  /**
   * 決済キャンセル
   */
  cancel: function(paymentId) {
    return this.update(paymentId, {
      payment_status: 'CANCELLED',
      cancelled_at: new Date()
    });
  },
  
  /**
   * 返金処理
   */
  refund: function(paymentId, refundAmount, reason) {
    var context = { service: 'PaymentRepository', action: 'refund' };
    
    try {
      var payment = this.findById(paymentId);
      
      if (payment.error) {
        throw payment;
      }
      
      // 返金可能なステータスか確認
      if (payment.payment_status !== 'CAPTURED') {
        throw ErrorHandler.validationError(
          'payment_status',
          'Only CAPTURED payments can be refunded. Current status: ' + payment.payment_status
        );
      }
      
      // 返金額チェック
      if (refundAmount > payment.total_amount) {
        throw ErrorHandler.validationError(
          'refund_amount',
          'Refund amount cannot exceed payment amount'
        );
      }
      
      return this.update(paymentId, {
        payment_status: 'REFUNDED',
        refund_amount: refundAmount,
        refund_reason: reason || '',
        refunded_at: new Date()
      });
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 予約IDから顧客ID取得（内部用）
   */
  _getCustomerIdFromReservation: function(reservationId) {
    var reservation = ReservationRepository.findById(reservationId);
    return reservation.error ? null : reservation.customer_id;
  }
};

// ============================================================================
// テスト関数
// ============================================================================

/**
 * 決済作成テスト
 */
function testPaymentCreate() {
  console.log('=== Payment Create Test ===\n');
  
  // 予約を取得
  var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
  if (reservations.length === 0) {
    console.error('❌ No reservations found.');
    return;
  }
  
  var reservation = reservations[0];
  
  var testPayment = {
    reservation_id: reservation.reservation_id,
    customer_id: reservation.customer_id,
    amount: 10000, // 税抜金額
    payment_method: 'CREDIT_CARD'
  };
  
  var result = PaymentRepository.create(testPayment);
  
  if (result.error) {
    console.error('❌ Create failed:', result.message);
  } else {
    console.log('✅ Payment created:');
    console.log('  ID:', result.payment_id);
    console.log('  Amount:', result.amount);
    console.log('  Tax:', result.tax_amount);
    console.log('  Total:', result.total_amount);
    console.log('  Status:', result.payment_status);
  }
}

/**
 * 決済フローテスト
 */
function testPaymentFlow() {
  console.log('\n=== Payment Flow Test ===\n');
  
  // PENDING状態の決済を取得
  var payments = DB.fetchTable(CONFIG.SHEET.PAYMENTS);
  var pendingPayments = payments.filter(function(p) {
    return p.payment_status === 'PENDING';
  });
  
  if (pendingPayments.length === 0) {
    console.log('No PENDING payments found.');
    return;
  }
  
  var payment = pendingPayments[0];
  console.log('Testing with payment:', payment.payment_id);
  
  // Step 1: Authorize
  console.log('\nStep 1: Authorizing...');
  var authorized = PaymentRepository.authorize(payment.payment_id, 'sq_test_' + Utilities.getUuid());
  
  if (authorized.error) {
    console.error('❌ Authorization failed:', authorized.message);
    return;
  }
  console.log('✅ Payment authorized');
  
  // Step 2: Capture
  console.log('\nStep 2: Capturing...');
  var captured = PaymentRepository.capture(payment.payment_id);
  
  if (captured.error) {
    console.error('❌ Capture failed:', captured.message);
    return;
  }
  console.log('✅ Payment captured');
  console.log('  Status:', captured.payment_status);
  console.log('  Captured at:', captured.captured_at);
}

/**
 * 全テスト実行
 */
function testPaymentRepository() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Payment Repository Test Suite           ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  testPaymentCreate();
  testPaymentFlow();
  
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   Test Suite Completed                     ║');
  console.log('╚════════════════════════════════════════════╝');
}

// ============================================================================
// 返金処理機能（Phase 2 - Part 3 追加）
// ============================================================================

/**
 * 決済を返金する
 * 
 * @param {string} paymentId - 決済ID
 * @param {Object} refundData - 返金データ
 * @return {Object} 返金結果
 */
PaymentRepository.refund = function(paymentId, refundData) {
  var context = { service: 'PaymentRepository', action: 'refund' };
  
  try {
    log('INFO', 'PaymentRepository', 'Processing refund', { 
      paymentId: paymentId,
      amount: refundData.amount 
    });
    
    // 1. 決済情報取得
    var payment = this.findById(paymentId);
    if (payment.error) {
      throw createK9Error(
        ErrorCode.RECORD_NOT_FOUND,
        'Payment not found',
        { paymentId: paymentId }
      );
    }
    
    // 2. 返金可能性チェック
    if (payment.payment_status !== 'CAPTURED' && payment.payment_status !== 'AUTHORIZED') {
      throw createK9Error(
        ErrorCode.VALIDATION_ERROR,
        'Payment cannot be refunded. Status must be CAPTURED or AUTHORIZED.',
        { 
          paymentId: paymentId,
          currentStatus: payment.payment_status 
        }
      );
    }
    
    // 既に返金済みチェック
    if (payment.payment_status === 'REFUNDED') {
      throw createK9Error(
        ErrorCode.VALIDATION_ERROR,
        'Payment is already refunded',
        { paymentId: paymentId }
      );
    }
    
    // 3. 返金金額の確認（全額または一部）
    var refundAmount = refundData.amount !== undefined ? refundData.amount : payment.amount;
    
    if (refundAmount <= 0) {
      throw createK9Error(
        ErrorCode.VALIDATION_ERROR,
        'Refund amount must be greater than 0',
        { refundAmount: refundAmount }
      );
    }
    
    if (refundAmount > payment.amount) {
      throw createK9Error(
        ErrorCode.VALIDATION_ERROR,
        'Refund amount exceeds payment amount',
        { 
          refundAmount: refundAmount,
          paymentAmount: payment.amount 
        }
      );
    }
    
    // 4. Square API経由で実際の返金処理（手動返金でない場合）
    var squareRefundResult = null;
    
    if (!refundData.manualRefund && payment.square_payment_id && typeof SquareService !== 'undefined') {
      try {
        squareRefundResult = SquareService.refundPayment(
          payment.square_payment_id,
          refundAmount,
          refundData.reason || 'Customer requested refund'
        );
        
        if (squareRefundResult.error) {
          log('ERROR', 'PaymentRepository', 'Square refund failed', squareRefundResult);
          throw createK9Error(
            ErrorCode.EXTERNAL_API_ERROR,
            'Square refund failed: ' + squareRefundResult.message,
            squareRefundResult
          );
        }
      } catch (squareError) {
        log('ERROR', 'PaymentRepository', 'Square refund exception', { 
          error: squareError.message 
        });
        
        // Square連携失敗時でも、手動返金の場合は続行
        if (!refundData.manualRefund) {
          throw squareError;
        }
      }
    }
    
    // 5. 決済ステータスを更新（CAPTURED → REFUNDED）
    var updateData = {
      payment_status: 'REFUNDED',
      refunded_amount: refundAmount,
      refund_date: new Date(),
      refund_reason: refundData.reason || 'Refund requested',
      refund_by: refundData.refundBy || 'ADMIN',
      square_refund_id: squareRefundResult ? squareRefundResult.refund_id : null,
      is_manual_refund: refundData.manualRefund || false,
      updated_at: new Date()
    };
    
    var updateResult = DB.update(
      CONFIG.SHEET.PAYMENTS,
      'payment_id',
      paymentId,
      updateData
    );
    
    if (updateResult.error) {
      throw createK9Error(
        ErrorCode.DATABASE_ERROR,
        'Failed to update payment status',
        updateResult
      );
    }
    
    log('INFO', 'PaymentRepository', 'Payment status updated to REFUNDED', {
      paymentId: paymentId,
      refundAmount: refundAmount
    });
    
    // 6. 売上記録を作成（マイナス金額）
    this._createRefundSaleRecord(payment, refundAmount, refundData);
    
    // 7. 監査ログ記録
    this._logRefundAudit(payment, refundAmount, refundData, squareRefundResult);
    
    // 8. 更新された決済情報を取得
    var updatedPayment = this.findById(paymentId);
    
    log('INFO', 'PaymentRepository', 'Refund completed successfully', {
      paymentId: paymentId,
      refundAmount: refundAmount
    });
    
    return {
      success: true,
      payment: updatedPayment,
      refundAmount: refundAmount,
      squareRefundId: squareRefundResult ? squareRefundResult.refund_id : null,
      isManualRefund: refundData.manualRefund || false
    };
    
  } catch (error) {
    return ErrorHandler.handle(error, context);
  }
};

/**
 * 返金用の売上レコードを作成（マイナス金額）
 */
PaymentRepository._createRefundSaleRecord = function(payment, refundAmount, refundData) {
  try {
    // Sales シートが存在するか確認
    if (!CONFIG.SHEET || !CONFIG.SHEET.SALES) {
      log('WARN', 'PaymentRepository', 'SALES sheet not configured, skipping sale record');
      return;
    }
    
    var saleData = {
      sale_date: new Date(),
      customer_id: payment.customer_id,
      reservation_id: payment.reservation_id,
      product_id: payment.product_id || null,
      sale_type: 'REFUND',
      amount: -refundAmount,  // ★ マイナス金額
      payment_method: payment.payment_method,
      notes: 'Refund: ' + (refundData.reason || 'Customer requested'),
      original_payment_id: payment.payment_id,
      refund_reason: refundData.reason || 'Refund requested',
      refund_by: refundData.refundBy || 'ADMIN',
      is_manual_refund: refundData.manualRefund || false
    };
    
    var insertResult = DB.insert(CONFIG.SHEET.SALES, saleData);
    
    if (insertResult.error) {
      log('ERROR', 'PaymentRepository', 'Failed to create refund sale record', insertResult);
    } else {
      log('INFO', 'PaymentRepository', 'Refund sale record created', {
        amount: -refundAmount
      });
    }
    
  } catch (error) {
    log('ERROR', 'PaymentRepository', 'Exception creating refund sale record', {
      error: error.message
    });
  }
};

/**
 * 返金の監査ログを記録
 */
PaymentRepository._logRefundAudit = function(payment, refundAmount, refundData, squareRefundResult) {
  try {
    // 監査ログシートが存在するか確認
    if (!CONFIG.SHEET || !CONFIG.SHEET.AUDIT_LOGS) {
      log('WARN', 'PaymentRepository', 'AUDIT_LOGS sheet not configured, skipping audit log');
      return;
    }
    
    var auditData = {
      timestamp: new Date(),
      action: 'PAYMENT_REFUND',
      entity_type: 'Payment',
      entity_id: payment.payment_id,
      user_id: refundData.refundBy || 'ADMIN',
      details: JSON.stringify({
        payment_code: payment.payment_code,
        original_amount: payment.amount,
        refund_amount: refundAmount,  // ★ 返金額を記録
        refund_reason: refundData.reason || 'Refund requested',
        payment_method: payment.payment_method,
        square_payment_id: payment.square_payment_id || null,
        square_refund_id: squareRefundResult ? squareRefundResult.refund_id : null,
        manual_refund: refundData.manualRefund || false,
        refund_date: new Date()
      })
    };
    
    var insertResult = DB.insert(CONFIG.SHEET.AUDIT_LOGS, auditData);
    
    if (insertResult.error) {
      log('ERROR', 'PaymentRepository', 'Failed to log refund audit', insertResult);
    } else {
      log('INFO', 'PaymentRepository', 'Refund audit log recorded', {
        paymentId: payment.payment_id,
        refundAmount: refundAmount
      });
    }
    
  } catch (error) {
    log('ERROR', 'PaymentRepository', 'Failed to log refund audit', {
      error: error.message
    });
  }
};

/**
 * 返金済み決済を取得
 */
PaymentRepository.findRefunded = function(filters) {
  var context = { service: 'PaymentRepository', action: 'findRefunded' };
  
  try {
    var payments = DB.fetchTable(CONFIG.SHEET.PAYMENTS);
    
    var refundedPayments = payments.filter(function(payment) {
      return payment.payment_status === 'REFUNDED';
    });
    
    // フィルタリング
    if (filters) {
      if (filters.dateFrom) {
        var dateFrom = new Date(filters.dateFrom);
        refundedPayments = refundedPayments.filter(function(payment) {
          return new Date(payment.refund_date) >= dateFrom;
        });
      }
      
      if (filters.dateTo) {
        var dateTo = new Date(filters.dateTo);
        refundedPayments = refundedPayments.filter(function(payment) {
          return new Date(payment.refund_date) <= dateTo;
        });
      }
      
      if (filters.customerId) {
        refundedPayments = refundedPayments.filter(function(payment) {
          return payment.customer_id === filters.customerId;
        });
      }
    }
    
    return {
      success: true,
      payments: refundedPayments,
      count: refundedPayments.length
    };
    
  } catch (error) {
    return ErrorHandler.handle(error, context);
  }
};

/**
 * 返金統計を取得
 */
PaymentRepository.getRefundStatistics = function(days) {
  var context = { service: 'PaymentRepository', action: 'getRefundStatistics' };
  
  try {
    days = days || 30;
    
    var dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    
    var result = this.findRefunded({ dateFrom: dateFrom });
    
    if (result.error) {
      return result;
    }
    
    var refundedPayments = result.payments;
    
    var stats = {
      period_days: days,
      total_refunds: refundedPayments.length,
      total_refund_amount: 0,
      by_reason: {},
      by_method: {},
      manual_refunds: 0,
      auto_refunds: 0
    };
    
    refundedPayments.forEach(function(payment) {
      // 合計返金額
      stats.total_refund_amount += payment.refunded_amount || 0;
      
      // 理由別
      var reason = payment.refund_reason || 'UNKNOWN';
      if (!stats.by_reason[reason]) {
        stats.by_reason[reason] = { count: 0, amount: 0 };
      }
      stats.by_reason[reason].count++;
      stats.by_reason[reason].amount += payment.refunded_amount || 0;
      
      // 決済方法別
      var method = payment.payment_method || 'UNKNOWN';
      if (!stats.by_method[method]) {
        stats.by_method[method] = { count: 0, amount: 0 };
      }
      stats.by_method[method].count++;
      stats.by_method[method].amount += payment.refunded_amount || 0;
      
      // 手動/自動
      if (payment.is_manual_refund) {
        stats.manual_refunds++;
      } else {
        stats.auto_refunds++;
      }
    });
    
    return {
      success: true,
      statistics: stats
    };
    
  } catch (error) {
    return ErrorHandler.handle(error, context);
  }
};

/**
 * 返金処理テスト
 */
function testRefundProcessing() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Refund Processing Test                   ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  // Test 1: 返金可能な決済を検索
  console.log('【Test 1】返金可能な決済検索');
  
  var payments = DB.fetchTable(CONFIG.SHEET.PAYMENTS);
  var capturedPayments = payments.filter(function(p) {
    return p.payment_status === 'CAPTURED' || p.payment_status === 'AUTHORIZED';
  });
  
  if (capturedPayments.length === 0) {
    console.log('  ⚠️  返金可能な決済が見つかりません');
    console.log('  （CAPTURED または AUTHORIZED 状態の決済が必要）');
    return;
  }
  
  console.log('  ✅ 返金可能な決済:', capturedPayments.length + '件');
  
  var testPayment = capturedPayments[0];
  console.log('  テスト対象:', testPayment.payment_code || testPayment.payment_id);
  console.log('  金額:', testPayment.amount + '円');
  console.log('  ステータス:', testPayment.payment_status);
  
  console.log('');
  
  // Test 2: 返金統計
  console.log('【Test 2】返金統計（過去30日間）');
  var statsResult = PaymentRepository.getRefundStatistics(30);
  
  if (statsResult.error) {
    console.error('  ❌ Failed:', statsResult.message);
  } else {
    console.log('  ✅ Success');
    console.log('    総返金数:', statsResult.statistics.total_refunds + '件');
    console.log('    総返金額:', statsResult.statistics.total_refund_amount + '円');
    console.log('    手動返金:', statsResult.statistics.manual_refunds + '件');
    console.log('    自動返金:', statsResult.statistics.auto_refunds + '件');
  }
  
  console.log('');
  
  // Test 3: 返金処理（DRY RUN）
  console.log('【Test 3】返金処理（DRY RUN）');
  console.log('  ⚠️  実際の返金は実行しません');
  console.log('');
  console.log('  返金対象:');
  console.log('    Payment ID:', testPayment.payment_id);
  console.log('    Payment Code:', testPayment.payment_code || 'N/A');
  console.log('    Amount:', testPayment.amount + '円');
  console.log('    Status:', testPayment.payment_status);
  console.log('');
  console.log('  💡 実際に返金を実行する場合:');
  console.log('');
  console.log('  var refundData = {');
  console.log('    amount: ' + testPayment.amount + ',  // 全額返金');
  console.log('    reason: "Test refund",');
  console.log('    refundBy: "ADMIN",');
  console.log('    manualRefund: true  // Square API使わず手動');
  console.log('  };');
  console.log('');
  console.log('  var result = PaymentRepository.refund(');
  console.log('    "' + testPayment.payment_id + '",');
  console.log('    refundData');
  console.log('  );');
  
  console.log('');
  console.log('═'.repeat(48));
  console.log('Refund Processing Test Complete');
}