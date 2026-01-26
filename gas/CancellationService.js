/**
 * ============================================================================
 * K9 Harmony - Cancellation Service
 * ============================================================================
 * ファイル名: CancellationService.gs
 * 役割: キャンセル処理の統合管理
 * 最終更新: 2026-01-16
 * バージョン: v1.0.0
 */

var CancellationService = {
  
  // キャンセル理由の定数
  REASON: {
    HEALTH: '愛犬・飼い主の体調不良',
    MISTAKE: '間違えて予約した',
    SCHEDULE: '都合が悪くなった',
    OTHER: 'その他'
  },
  
  // キャンセルステータス
  STATUS: {
    NONE: 'NONE',
    REQUESTED: 'CANCELLATION_REQUESTED',
    PROCESSING: 'CANCELLATION_PROCESSING',
    COMPLETED: 'CANCELLED'
  },
  
  /**
   * キャンセル申請を処理
   * 
   * @param {string} reservationId - 予約ID
   * @param {Object} cancellationData - キャンセルデータ
   * @return {Object} 処理結果
   */
  requestCancellation: function(reservationId, cancellationData) {
    var context = { service: 'CancellationService', action: 'requestCancellation' };
    
    try {
      log('INFO', 'CancellationService', 'Processing cancellation request', {
        reservationId: reservationId,
        reason: cancellationData.reason
      });
      
      // 1. 予約情報取得
      var reservation = DB.findById(CONFIG.SHEET.RESERVATIONS, reservationId);
      if (!reservation) {
        throw createK9Error(
          ErrorCode.RECORD_NOT_FOUND,
          'Reservation not found',
          { reservationId: reservationId }
        );
      }
      
      // 2. キャンセル可能性チェック
      if (reservation.status === 'CANCELLED') {
        throw createK9Error(
          ErrorCode.VALIDATION_ERROR,
          'Reservation is already cancelled',
          { reservationId: reservationId }
        );
      }
      
      // 3. キャンセル常習者チェック
      var isFrequentCanceller = this._checkFrequentCanceller(reservation.customer_id);
      if (isFrequentCanceller.isFrequent) {
        return {
          success: true,
          type: 'FREQUENT_CANCELLER',
          message: 'お手数ですが、キャンセルについては直接ご連絡をお願いいたします。',
          cancelCount: isFrequentCanceller.count
        };
      }
      
      // 4. バリデーション
      var validationResult = this._validateCancellationData(cancellationData);
      if (validationResult.error) {
        throw createK9Error(
          ErrorCode.VALIDATION_ERROR,
          validationResult.message,
          validationResult.details
        );
      }
      
      // 5. キャンセル理由による処理分岐
      if (cancellationData.reason === this.REASON.MISTAKE) {
        // 即時自動キャンセル
        return this._processAutoCancellation(reservation, cancellationData);
      } else {
        // 管理者確認が必要
        return this._requestAdminConfirmation(reservation, cancellationData);
      }
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * キャンセル常習者チェック
   */
  _checkFrequentCanceller: function(customerId) {
    try {
      // 過去6ヶ月のキャンセル数を取得
      var sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
      
      var cancelCount = reservations.filter(function(r) {
        if (r.customer_id !== customerId) return false;
        if (r.reservation_status !== 'CANCELLED') return false;
        
        var cancelDate = r.cancellation_requested_at ? 
          new Date(r.cancellation_requested_at) : 
          new Date(r.updated_at);
        
        return cancelDate >= sixMonthsAgo;
      }).length;
      
      return {
        isFrequent: cancelCount >= 5,
        count: cancelCount
      };
      
    } catch (error) {
      log('ERROR', 'CancellationService', 'Failed to check frequent canceller', {
        error: error.message
      });
      return { isFrequent: false, count: 0 };
    }
  },
  
  /**
   * キャンセルデータのバリデーション
   */
  _validateCancellationData: function(data) {
    var errors = [];
    
    // 理由の必須チェック
    if (!data.reason) {
      errors.push('Cancellation reason is required');
    }
    
    // 理由の値チェック
    var validReasons = Object.values(this.REASON);
    if (data.reason && validReasons.indexOf(data.reason) === -1) {
      errors.push('Invalid cancellation reason');
    }
    
    // 詳細理由の必須チェック（理由による）
    if (data.reason === this.REASON.HEALTH && !data.detail) {
      errors.push('Detail is required for health-related cancellations');
    }
    
    if (data.reason === this.REASON.OTHER && !data.detail) {
      errors.push('Detail is required for other reasons');
    }
    
    // 「都合が悪くなった」は詳細不要（ユーザー要件）
    
    if (errors.length > 0) {
      return {
        error: true,
        message: 'Cancellation data validation failed',
        details: { errors: errors }
      };
    }
    
    return { error: false };
  },
  
  /**
   * 即時自動キャンセル処理
   */
  _processAutoCancellation: function(reservation, cancellationData) {
    var context = { service: 'CancellationService', action: '_processAutoCancellation' };
    
    try {
      log('INFO', 'CancellationService', 'Processing auto cancellation', {
        reservationId: reservation.reservation_id
      });
      
      // 1. キャンセル料計算
      var feeResult = this.calculateCancellationFee(
        reservation.reservation_date,
        new Date()
      );
      
      var payment = PaymentRepository.findByReservationId(reservation.reservation_id);
      if (payment.error || payment.payments.length === 0) {
        throw createK9Error(
          ErrorCode.RECORD_NOT_FOUND,
          'Payment not found for reservation',
          { reservationId: reservation.reservation_id }
        );
      }
      
      var paymentRecord = payment.payments[0];
      var totalAmount = paymentRecord.amount || 0;
      var cancellationFee = Math.round(totalAmount * feeResult.feeRate);
      var refundAmount = totalAmount - cancellationFee;
      
      // 2. 予約ステータス更新
      var reservationUpdate = {
        status: 'CANCELLED',
        cancellation_status: this.STATUS.COMPLETED,
        cancellation_reason: cancellationData.reason,
        cancellation_detail: cancellationData.detail || null,
        cancellation_requested_at: new Date(),
        cancellation_completed_at: new Date(),
        cancellation_fee: cancellationFee,
        cancellation_fee_rate: feeResult.feeRate,
        refund_amount: refundAmount,
        updated_at: new Date()
      };
      
      var updateResult = DB.update(
        CONFIG.SHEET.RESERVATIONS,
        'reservation_id',
        reservation.reservation_id,
        reservationUpdate
      );
      
      if (updateResult.error) {
        throw createK9Error(
          ErrorCode.DATABASE_ERROR,
          'Failed to update reservation status',
          updateResult
        );
      }
      
      // 3. 返金処理（refundAmount > 0の場合のみ）
      var refundResult = null;
      if (refundAmount > 0) {
        refundResult = PaymentRepository.refund(paymentRecord.payment_id, {
          amount: refundAmount,
          reason: 'Auto cancellation: ' + cancellationData.reason,
          refundBy: 'SYSTEM_AUTO',
          manualRefund: true  // Square API は使わず、DB上のみ処理
        });
        
        if (refundResult.error) {
          log('ERROR', 'CancellationService', 'Refund failed', refundResult);
          // 返金失敗時でもキャンセルは完了とする（管理者が後で手動対応）
        }
      }
      
      // 4. 通知送信（LINE + Email）
      NotificationService.sendAutoCancellationNotification(
        reservation.customer_id,
        reservation,
        {
          cancellationFee: cancellationFee,
          refundAmount: refundAmount,
          feeRate: feeResult.feeRate,
          reason: cancellationData.reason
        }
      );
      
      log('INFO', 'CancellationService', 'Auto cancellation completed', {
        reservationId: reservation.reservation_id,
        cancellationFee: cancellationFee,
        refundAmount: refundAmount
      });
      
      return {
        success: true,
        type: 'AUTO_CANCELLED',
        reservation: reservation,
        cancellationFee: cancellationFee,
        refundAmount: refundAmount,
        feeRate: feeResult.feeRate,
        message: feeResult.message
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 管理者確認リクエスト
   */
  _requestAdminConfirmation: function(reservation, cancellationData) {
    var context = { service: 'CancellationService', action: '_requestAdminConfirmation' };
    
    try {
      log('INFO', 'CancellationService', 'Requesting admin confirmation', {
        reservationId: reservation.reservation_id,
        reason: cancellationData.reason
      });
      
      // 1. 予約ステータス更新
      var reservationUpdate = {
        cancellation_status: this.STATUS.REQUESTED,
        cancellation_reason: cancellationData.reason,
        cancellation_detail: cancellationData.detail || null,
        cancellation_requested_at: new Date(),
        updated_at: new Date()
      };
      
      var updateResult = DB.update(
        CONFIG.SHEET.RESERVATIONS,
        'reservation_id',
        reservation.reservation_id,
        reservationUpdate
      );
      
      if (updateResult.error) {
        throw createK9Error(
          ErrorCode.DATABASE_ERROR,
          'Failed to update cancellation status',
          updateResult
        );
      }
      
      // 2. 管理者に通知
      NotificationService.sendAdminCancellationRequest(reservation, cancellationData);
      
      // 3. 顧客に確認通知（営業時間案内）
      NotificationService.sendCancellationRequestConfirmation(
        reservation.customer_id,
        reservation,
        cancellationData
      );
      
      log('INFO', 'CancellationService', 'Admin confirmation requested', {
        reservationId: reservation.reservation_id
      });
      
      return {
        success: true,
        type: 'ADMIN_CONFIRMATION_REQUESTED',
        reservation: reservation,
        message: 'キャンセル申請を受け付けました。営業時間内にご連絡いたします。'
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
/**
 * キャンセル料を計算
 * 
 * @param {Date} reservationDate - 予約日時
 * @param {Date} cancelDate - キャンセル日時
 * @return {Object} 計算結果
 */
calculateCancellationFee: function(reservationDate, cancelDate) {
  try {
    cancelDate = cancelDate || new Date();
    
    // ★★★ 修正: レッスン日の00:00を基準にする ★★★
    var resDate = new Date(reservationDate);
    resDate.setHours(0, 0, 0, 0);
    
    // キャンセル日の00:00
    var canDate = new Date(cancelDate);
    canDate.setHours(0, 0, 0, 0);
    
    // 日数差を計算（レッスン予定日を含まず計算）
    var diffTime = resDate.getTime() - canDate.getTime();
    var daysUntilReservation = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    var feeRate = 0;
    var message = '';
    
    if (daysUntilReservation >= 4) {
      // 4日前まで: 無料
      feeRate = 0;
      message = 'キャンセル料はかかりません（4日前まで）';
    } else if (daysUntilReservation >= 2) {
      // 3日前〜2日前: 50%
      feeRate = 0.5;
      message = 'キャンセル料50%が発生します（3日前〜2日前）';
    } else if (daysUntilReservation >= 1) {
      // 前日: 100%
      feeRate = 1.0;
      message = 'キャンセル料100%が発生します（前日）';
    } else {
      // 当日: 100%
      feeRate = 1.0;
      message = 'キャンセル料100%が発生します（当日）';
    }
    
    return {
      success: true,
      feeRate: feeRate,
      daysUntilReservation: daysUntilReservation,
      message: message
    };
    
  } catch (error) {
    log('ERROR', 'CancellationService', 'Fee calculation failed', {
      error: error.message
    });
    return {
      success: false,
      feeRate: 1.0,  // エラー時は100%
      message: 'Error calculating fee'
    };
  }
},
  
  /**
   * キャンセル申請一覧を取得（管理者用）
   */
  getPendingCancellations: function() {
    var context = { service: 'CancellationService', action: 'getPendingCancellations' };
    
    try {
      var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
      
      var pending = reservations.filter(function(r) {
        return r.cancellation_status === CancellationService.STATUS.REQUESTED;
      });
      
      // 顧客情報を付加
      var enriched = pending.map(function(r) {
        var customer = DB.findById(CONFIG.SHEET.CUSTOMERS, r.customer_id);
        return {
          reservation: r,
          customer: customer || {},
          requestedAt: r.cancellation_requested_at,
          reason: r.cancellation_reason,
          detail: r.cancellation_detail
        };
      });
      
      // リクエスト日時で降順ソート
      enriched.sort(function(a, b) {
        return new Date(b.requestedAt) - new Date(a.requestedAt);
      });
      
      return {
        success: true,
        cancellations: enriched,
        count: enriched.length
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 管理者がキャンセルを承認（返金実行）
   * 
   * @param {string} reservationId - 予約ID
   * @param {Object} adminData - 管理者データ
   * @return {Object} 処理結果
   */
  approveCancellation: function(reservationId, adminData) {
    var context = { service: 'CancellationService', action: 'approveCancellation' };
    
    try {
      log('INFO', 'CancellationService', 'Admin approving cancellation', {
        reservationId: reservationId
      });
      
      // 1. 予約情報取得
      var reservation = DB.findById(CONFIG.SHEET.RESERVATIONS, reservationId);
      if (!reservation) {
        throw createK9Error(
          ErrorCode.RECORD_NOT_FOUND,
          'Reservation not found',
          { reservationId: reservationId }
        );
      }
      
      // 2. ステータスチェック
      if (reservation.cancellation_status !== this.STATUS.REQUESTED) {
        throw createK9Error(
          ErrorCode.VALIDATION_ERROR,
          'Cancellation is not in requested status',
          { 
            reservationId: reservationId,
            currentStatus: reservation.cancellation_status 
          }
        );
      }
      
      // 3. 決済情報取得
      var payment = PaymentRepository.findByReservationId(reservationId);
      if (payment.error || payment.payments.length === 0) {
        throw createK9Error(
          ErrorCode.RECORD_NOT_FOUND,
          'Payment not found',
          { reservationId: reservationId }
        );
      }
      
      var paymentRecord = payment.payments[0];
      
      // 4. 返金金額計算（管理者が指定可能）
      var refundAmount = adminData.refundAmount !== undefined ? 
        adminData.refundAmount : 
        paymentRecord.amount;
      
      // 5. 予約ステータス更新
      var reservationUpdate = {
        status: 'CANCELLED',
        cancellation_status: this.STATUS.COMPLETED,
        cancellation_completed_at: new Date(),
        cancellation_approved_by: adminData.approvedBy || 'ADMIN',
        refund_amount: refundAmount,
        admin_notes: adminData.notes || null,
        updated_at: new Date()
      };
      
      var updateResult = DB.update(
        CONFIG.SHEET.RESERVATIONS,
        'reservation_id',
        reservationId,
        reservationUpdate
      );
      
      if (updateResult.error) {
        throw createK9Error(
          ErrorCode.DATABASE_ERROR,
          'Failed to update reservation',
          updateResult
        );
      }
      
      // 6. 返金処理実行
      var refundResult = null;
      if (refundAmount > 0) {
        refundResult = PaymentRepository.refund(paymentRecord.payment_id, {
          amount: refundAmount,
          reason: adminData.reason || 'Admin approved cancellation',
          refundBy: adminData.approvedBy || 'ADMIN',
          manualRefund: true
        });
        
        if (refundResult.error) {
          throw createK9Error(
            ErrorCode.PAYMENT_ERROR,
            'Refund processing failed',
            refundResult
          );
        }
      }
      
      // 7. 顧客に通知
      NotificationService.sendCancellationApprovedNotification(
        reservation.customer_id,
        reservation,
        { refundAmount: refundAmount }
      );
      
      log('INFO', 'CancellationService', 'Cancellation approved and refunded', {
        reservationId: reservationId,
        refundAmount: refundAmount
      });
      
      return {
        success: true,
        reservation: reservation,
        refundAmount: refundAmount,
        message: 'Cancellation approved and refund processed'
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  }
};