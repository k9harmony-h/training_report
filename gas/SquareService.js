/**
 * ============================================================================
 * K9 Harmony - Square Service (Error Handling Unified)
 * ============================================================================
 * バージョン: v2.0.0 - エラーハンドリング統一版
 * 最終更新: 2026-01-04
 * 
 * 変更内容:
 * - 全関数でErrorHandler.handle()を使用
 * - createK9Error()の使用を統一
 */

var SquareService = {
  
  processCardPayment: function(paymentData, sourceId) {
    var context = { service: 'SquareService', action: 'processCardPayment' };
    
    try {
      log('INFO', 'SquareService', 'Processing card payment');
      
      var env = CONFIG.SQUARE.ENVIRONMENT === 'sandbox' ? CONFIG.SQUARE.SANDBOX : CONFIG.SQUARE.PRODUCTION;
      var apiUrl = env.API_URL + '/payments';
      var accessToken = this._getAccessToken();
      
      var requestBody = {
        source_id: sourceId,
        idempotency_key: Utilities.getUuid(),
        amount_money: {
          amount: paymentData.total_amount,
          currency: 'JPY'
        },
        autocomplete: true,
        reference_id: paymentData.reservation_id || paymentData.payment_id,
        note: 'K9 Harmony レッスン予約'
      };
      
      var retryResult = RetryHandler.execute(function() {
        return UrlFetchApp.fetch(apiUrl, {
          method: 'post',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
            'Square-Version': '2024-12-18'
          },
          payload: JSON.stringify(requestBody),
          muteHttpExceptions: true
        });
      }, { maxRetries: 3, delay: 1000, context: { operation: 'squarePayment' } });

      // RetryHandler returns wrapped object: { success, result, ... }
      if (!retryResult.success) {
        throw createK9Error(
          ErrorCode.SQUARE_API_ERROR,
          'Square payment failed after retries: ' + (retryResult.error ? retryResult.error.message : 'Unknown error'),
          { retry_id: retryResult.retry_id, attempts: retryResult.attempts }
        );
      }

      var response = retryResult.result;
      var result = JSON.parse(response.getContentText());
      
      if (result.errors) {
        throw createK9Error(
          ErrorCode.SQUARE_API_ERROR,
          'Square payment failed: ' + result.errors[0].detail,
          { errors: result.errors }
        );
      }
      
      log('INFO', 'SquareService', 'Payment authorized: ' + result.payment.id);
      
      return {
        success: true,
        square_payment_id: result.payment.id,
        status: result.payment.status,
        amount: result.payment.amount_money.amount,
        card_last4: result.payment.card_details ? result.payment.card_details.card.last_4 : null,
        card_brand: result.payment.card_details ? result.payment.card_details.card.card_brand : null
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  createPaymentLink: function(eventData, amount, customerId) {
    var context = { service: 'SquareService', action: 'createPaymentLink' };
    
    try {
      log('INFO', 'SquareService', 'Creating payment link');
      
      var env = CONFIG.SQUARE.ENVIRONMENT === 'sandbox' ? CONFIG.SQUARE.SANDBOX : CONFIG.SQUARE.PRODUCTION;
      var apiUrl = env.API_URL + '/online-checkout/payment-links';
      var accessToken = this._getAccessToken();
      
      var requestBody = {
        idempotency_key: Utilities.getUuid(),
        order: {
          location_id: env.LOCATION_ID,
          line_items: [
            {
              name: eventData.event_name || 'K9 Harmony イベント',
              quantity: '1',
              base_price_money: {
                amount: amount,
                currency: 'JPY'
              }
            }
          ],
          reference_id: customerId
        },
        checkout_options: {
          redirect_url: CONFIG.LIFF.BASE_URL + '/payment-complete',
          ask_for_shipping_address: false,
          accepted_payment_methods: {
            apple_pay: true,
            google_pay: true
          }
        }
      };
      
      var retryResult = RetryHandler.execute(function() {
        return UrlFetchApp.fetch(apiUrl, {
          method: 'post',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
            'Square-Version': '2024-12-18'
          },
          payload: JSON.stringify(requestBody),
          muteHttpExceptions: true
        });
      }, { context: { operation: 'squarePayment' } });

      // RetryHandler returns wrapped object: { success, result, ... }
      if (!retryResult.success) {
        throw createK9Error(
          ErrorCode.SQUARE_API_ERROR,
          'Payment link creation failed after retries',
          { retry_id: retryResult.retry_id, attempts: retryResult.attempts }
        );
      }

      var response = retryResult.result;
      var result = JSON.parse(response.getContentText());

      if (result.errors) {
        throw createK9Error(
          ErrorCode.SQUARE_API_ERROR,
          'Payment link creation failed: ' + result.errors[0].detail,
          { errors: result.errors }
        );
      }

      log('INFO', 'SquareService', 'Payment link created: ' + result.payment_link.id);
      
      return {
        success: true,
        payment_link_id: result.payment_link.id,
        url: result.payment_link.url,
        order_id: result.payment_link.order_id
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  capturePayment: function(squarePaymentId) {
    var context = { service: 'SquareService', action: 'capturePayment' };
    
    try {
      log('INFO', 'SquareService', 'Capturing payment: ' + squarePaymentId);
      
      var env = CONFIG.SQUARE.ENVIRONMENT === 'sandbox' ? CONFIG.SQUARE.SANDBOX : CONFIG.SQUARE.PRODUCTION;
      var apiUrl = env.API_URL + '/payments/' + squarePaymentId + '/complete';
      var accessToken = this._getAccessToken();
      
      var response = UrlFetchApp.fetch(apiUrl, {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          'Square-Version': '2024-12-18'
        },
        muteHttpExceptions: true
      });
      
      var result = JSON.parse(response.getContentText());
      
      if (result.errors) {
        throw createK9Error(
          ErrorCode.SQUARE_API_ERROR,
          'Payment capture failed: ' + result.errors[0].detail,
          { errors: result.errors }
        );
      }
      
      log('INFO', 'SquareService', 'Payment captured: ' + squarePaymentId);
      
      return {
        success: true,
        status: result.payment.status
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  cancelPayment: function(squarePaymentId) {
    var context = { service: 'SquareService', action: 'cancelPayment' };
    
    try {
      log('INFO', 'SquareService', 'Cancelling payment: ' + squarePaymentId);
      
      var env = CONFIG.SQUARE.ENVIRONMENT === 'sandbox' ? CONFIG.SQUARE.SANDBOX : CONFIG.SQUARE.PRODUCTION;
      var apiUrl = env.API_URL + '/payments/' + squarePaymentId + '/cancel';
      var accessToken = this._getAccessToken();
      
      var response = UrlFetchApp.fetch(apiUrl, {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          'Square-Version': '2024-12-18'
        },
        muteHttpExceptions: true
      });
      
      var result = JSON.parse(response.getContentText());
      
      if (result.errors) {
        throw createK9Error(
          ErrorCode.SQUARE_API_ERROR,
          'Payment cancellation failed: ' + result.errors[0].detail,
          { errors: result.errors }
        );
      }
      
      log('INFO', 'SquareService', 'Payment cancelled: ' + squarePaymentId);
      
      return {
        success: true,
        status: result.payment.status
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  refundPayment: function(squarePaymentId, refundAmount, reason) {
    var context = { service: 'SquareService', action: 'refundPayment' };
    
    try {
      log('INFO', 'SquareService', 'Refunding payment: ' + squarePaymentId);
      
      var env = CONFIG.SQUARE.ENVIRONMENT === 'sandbox' ? CONFIG.SQUARE.SANDBOX : CONFIG.SQUARE.PRODUCTION;
      var apiUrl = env.API_URL + '/refunds';
      var accessToken = this._getAccessToken();
      
      var requestBody = {
        idempotency_key: Utilities.getUuid(),
        payment_id: squarePaymentId,
        amount_money: {
          amount: refundAmount,
          currency: 'JPY'
        },
        reason: reason || 'Customer request'
      };
      
      var response = UrlFetchApp.fetch(apiUrl, {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          'Square-Version': '2024-12-18'
        },
        payload: JSON.stringify(requestBody),
        muteHttpExceptions: true
      });
      
      var result = JSON.parse(response.getContentText());
      
      if (result.errors) {
        throw createK9Error(
          ErrorCode.SQUARE_API_ERROR,
          'Refund failed: ' + result.errors[0].detail,
          { errors: result.errors }
        );
      }
      
      log('INFO', 'SquareService', 'Refund completed: ' + result.refund.id);
      
      return {
        success: true,
        refund_id: result.refund.id,
        status: result.refund.status,
        amount: result.refund.amount_money.amount
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  handleWebhook: function(event) {
    var context = { service: 'SquareService', action: 'handleWebhook' };
    
    try {
      log('INFO', 'SquareService', 'Webhook received: ' + event.type);
      
      switch (event.type) {
        case 'payment.created':
        case 'payment.updated':
          return this._handlePaymentEvent(event.data.object.payment);
          
        case 'order.updated':
          return this._handleOrderEvent(event.data.object.order);
          
        default:
          log('WARN', 'SquareService', 'Unhandled webhook type: ' + event.type);
          return { success: true, message: 'Event ignored' };
      }
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  _handlePaymentEvent: function(payment) {
    try {
      var dbPayment = PaymentRepository.findBySquarePaymentId(payment.id);
      
      if (!dbPayment) {
        log('WARN', 'SquareService', 'Payment not found in DB: ' + payment.id);
        return { success: true };
      }
      
      var status = this._mapSquareStatus(payment.status);
      
      PaymentRepository.update(dbPayment.payment_id, {
        payment_status: status,
        square_payment_id: payment.id
      });
      
      log('INFO', 'SquareService', 'Payment status updated: ' + status);
      
      return { success: true };
    } catch (error) {
      log('ERROR', 'SquareService', 'Payment event handling failed: ' + error.message);
      return { success: false, error: error.message };
    }
  },
  
  _handleOrderEvent: function(order) {
    try {
      if (order.state === 'COMPLETED') {
        log('INFO', 'SquareService', 'Order completed: ' + order.id);
        
        var customerId = order.reference_id;
        
        if (customerId) {
          log('INFO', 'SquareService', 'Event payment completed for customer: ' + customerId);
        }
      }
      
      return { success: true };
    } catch (error) {
      log('ERROR', 'SquareService', 'Order event handling failed: ' + error.message);
      return { success: false, error: error.message };
    }
  },
  
  _mapSquareStatus: function(squareStatus) {
    var statusMap = {
      'APPROVED': 'AUTHORIZED',
      'COMPLETED': 'CAPTURED',
      'CANCELED': 'CANCELLED',
      'FAILED': 'FAILED'
    };
    
    return statusMap[squareStatus] || 'PENDING';
  },
  
  _getAccessToken: function() {
    var env = CONFIG.SQUARE.ENVIRONMENT === 'sandbox' ? CONFIG.SQUARE.SANDBOX : CONFIG.SQUARE.PRODUCTION;
    return env.ACCESS_TOKEN;
  }
};