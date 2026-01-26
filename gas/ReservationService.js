/**
 * ============================================================================
 * ReservationService.gs - オブジェクト形式
 * ============================================================================
 */

var ReservationService = {
  
  /**
   * 予約作成 + 決済処理
   * @param {Object} params - パラメータオブジェクト
   * @param {Object} params.reservationData - 予約データ
   * @param {Object} params.paymentData - 決済データ
   * @param {string} params.lockId - ロックID（オプション）
   */
  createReservationWithPayment: function(params) {
    var reservationData = params.reservationData;
    var paymentData = params.paymentData;
    var lockId = params.lockId;
    
    var context = {
      operation: 'createReservationWithPayment',
      customer_id: reservationData.customer_id
    };
    
    // TransactionManagerを使用
    var result = Transaction.execute(function(tx) {
      
      // 1. 空き枠確認
      log('DEBUG', 'ReservationService', 'Checking slot availability');
      
      var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
      var conflictingReservation = reservations.find(function(r) {
        if (!r.trainer_id || !r.reservation_date || !r.start_time) return false;
        
        var resDate = r.reservation_date;
        if (resDate instanceof Date) {
          resDate = Utilities.formatDate(resDate, 'JST', 'yyyy-MM-dd');
        } else if (typeof resDate !== 'string') {
          resDate = String(resDate);
        }
        
        return r.trainer_id === reservationData.trainer_id &&
               resDate.indexOf(reservationData.reservation_date) === 0 &&
               r.start_time === reservationData.start_time &&
               (r.reservation_status === 'PENDING' || r.reservation_status === 'CONFIRMED');
      });
      
      if (conflictingReservation) {
        throw createK9Error(
          ErrorCode.VALIDATION_ERROR,
          '申し訳ございません。選択された時間は既に予約されています。',
          { trainer_id: reservationData.trainer_id }
        );
      }
      
      // 2. Square決済処理
      log('INFO', 'ReservationService', 'Processing payment');
      
      var paymentResult = SquareService.processCardPayment(
        { 
          total_amount: Math.round(paymentData.amount),
          reservation_id: null
        },
        paymentData.square_source_id || paymentData.source_id
      );
      
      if (paymentResult.error) {
        throw paymentResult;
      }
      
      Transaction.recordOperation(tx, 'Square payment processed', {
        payment_id: paymentResult.square_payment_id,
        amount: paymentData.amount
      });
      
      // 3. 予約レコード作成
      var reservation = ReservationRepository.create({
        customer_id: reservationData.customer_id,
        primary_dog_id: reservationData.primary_dog_id,
        trainer_id: reservationData.trainer_id,
        office_id: reservationData.office_id,
        product_id: reservationData.product_id,
        reservation_date: reservationData.reservation_date,
        start_time: reservationData.start_time,
        duration_minutes: reservationData.duration || 90,
        status: 'CONFIRMED',
        notes: reservationData.notes || ''
      });
      
      if (reservation.error) {
        throw reservation;
      }
      
      Transaction.recordOperation(tx, 'Reservation created', {
        reservation_id: reservation.reservation_id
      });
      
      // ロールバック登録: 予約削除
      Transaction.registerRollback(
        tx,
        'Delete reservation: ' + reservation.reservation_code,
        function() {
          try {
            SquareService.refundPayment(
              paymentResult.square_payment_id,
              Math.round(paymentData.amount),
              'Reservation creation rollback'
            );
          } catch (e) {
            log('ERROR', 'ReservationService', 'Refund failed during rollback', { error: e.message });
          }
        }
      );
      
      // 4. 決済レコード作成
      var payment = PaymentRepository.create({
        reservation_id: reservation.reservation_id,
        customer_id: reservationData.customer_id,
        amount: paymentData.amount,
        tax_amount: 0,
        total_amount: paymentData.amount,
        currency: 'JPY',
        payment_method: 'CREDIT_CARD',
        payment_status: 'CAPTURED',
        square_payment_id: paymentResult.square_payment_id
      });
      
      if (payment.error) {
        throw payment;
      }
      
      Transaction.recordOperation(tx, 'Payment record created', {
        payment_id: payment.payment_id
      });
      
      // 5. 通知送信（失敗してもロールバックしない）
      try {
        if (typeof NotificationService !== 'undefined') {
          NotificationService.sendReservationConfirmation(reservation.reservation_id);
        }
      } catch (notificationError) {
        log('WARN', 'ReservationService', 'Notification failed', { error: notificationError.message });
      }
      
      return {
        reservation: reservation,
        payment: payment
      };
      
    }, context);
    
    if (result.success) {
      return {
        success: true,
        reservation: result.result.reservation,
        payment: result.result.payment
      };
    } else {
      // エラーをcreateK9Error形式で返す
      return createK9Error(
        ErrorCode.TRANSACTION_FAILED,
        result.error ? result.error.message : 'Transaction failed',
        { 
          transaction_id: result.transaction_id,
          rollback_status: result.rollback_result ? result.rollback_result.status : null
        }
      );
    }
  }
};