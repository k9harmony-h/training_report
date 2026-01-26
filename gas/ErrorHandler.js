/**
 * ============================================================================
 * K9 Harmony - Error Handler (Enhanced)
 * ============================================================================
 * ファイル名: ErrorHandler.gs
 * 役割: 統一的なエラーハンドリング
 * 最終更新: 2026-01-08
 * バージョン: v1.1.0 (認証・レート制限対応)
 * 
 * 変更内容:
 * - AUTHENTICATION_ERROR 追加
 * - RATE_LIMIT_EXCEEDED 追加
 * - SERVICE_UNAVAILABLE 追加
 * - TRANSACTION_FAILED 追加
 */

// ============================================================================
// エラーコード定義
// ============================================================================

var ErrorCode = {
  // バリデーションエラー（4xx系）
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  
  // 認証・認可エラー
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // 外部API エラー（5xx系）
  LINE_API_ERROR: 'LINE_API_ERROR',
  SQUARE_API_ERROR: 'SQUARE_API_ERROR',
  GOOGLE_MAPS_API_ERROR: 'GOOGLE_MAPS_API_ERROR',
  
  // システムエラー
  DATABASE_ERROR: 'DATABASE_ERROR',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// ============================================================================
// カスタムエラー生成関数
// ============================================================================

function createK9Error(code, message, details) {
  var error = new Error(message);
  error.name = 'K9Error';
  error.code = code;
  error.details = details || {};
  error.timestamp = new Date();
  
  error.toJSON = function() {
    return {
      error: true,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp
    };
  };
  
  return error;
}

// ============================================================================
// エラーハンドラ
// ============================================================================

var ErrorHandler = {
  
  /**
   * エラーをキャッチして処理
   */
  handle: function(error, context) {
    context = context || {};
    
    // カスタムエラーの場合
    if (error.name === 'K9Error') {
      this._logError(error, context);
      this._notifyIfCritical(error, context);
      return error.toJSON();
    }
    
    // 標準エラーの場合
    var k9Error = createK9Error(
      ErrorCode.UNKNOWN_ERROR,
      error.message || 'Unknown error occurred',
      { originalError: error.toString(), context: context }
    );
    
    this._logError(k9Error, context);
    this._notifyIfCritical(k9Error, context);
    
    return k9Error.toJSON();
  },
  
  /**
   * エラーログ記録
   */
  _logError: function(error, context) {
    log('ERROR', context.service || 'Unknown', error.message, {
      code: error.code,
      details: error.details,
      context: context
    });
    
    // 重要なエラーはSystemログシートに記録
    try {
      var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET.MASTER_ID);
      var sheet = ss.getSheetByName(CONFIG.SHEET.SYSTEM_LOGS);
      
      if (sheet) {
        sheet.appendRow([
          error.timestamp,
          'ERROR',
          context.service || 'Unknown',
          error.code,
          error.message,
          JSON.stringify(error.details),
          Session.getEffectiveUser().getEmail()
        ]);
      }
    } catch (e) {
      console.error('Failed to write error log:', e.message);
    }
  },
  
  /**
   * 重要なエラーは通知
   */
  _notifyIfCritical: function(error, context) {
    var criticalErrors = [
      ErrorCode.SQUARE_API_ERROR,
      ErrorCode.DATABASE_ERROR,
      ErrorCode.TRANSACTION_FAILED,
      ErrorCode.PERMISSION_DENIED,
      ErrorCode.SERVICE_UNAVAILABLE
    ];
    
    if (criticalErrors.indexOf(error.code) !== -1) {
      var message = 
        '🚨 システムエラー発生\n\n' +
        '【エラーコード】\n' + error.code + '\n\n' +
        '【エラーメッセージ】\n' + error.message + '\n\n' +
        '【発生場所】\n' + (context.service || 'Unknown') + '\n\n' +
        '【詳細】\n' + JSON.stringify(error.details, null, 2) + '\n\n' +
        '【発生日時】\n' + Utilities.formatDate(error.timestamp, 'JST', 'yyyy/MM/dd HH:mm:ss');
      
      try {
        // NotificationService が実装されている場合のみ通知
        if (typeof NotificationService !== 'undefined') {
          NotificationService.sendAdminNotification(
            'Critical Error: ' + error.code,
            message,
            'CRITICAL'
          );
        }
      } catch (e) {
        console.error('Failed to send error notification:', e.message);
      }
    }
  },
  
  /**
   * バリデーションエラー作成
   */
  validationError: function(field, message) {
    return createK9Error(
      ErrorCode.VALIDATION_ERROR,
      'Validation failed: ' + field,
      { field: field, message: message }
    );
  },
  
  /**
   * 必須フィールドエラー
   */
  requiredFieldError: function(field) {
    return createK9Error(
      ErrorCode.REQUIRED_FIELD_MISSING,
      'Required field is missing: ' + field,
      { field: field }
    );
  },
  
  /**
   * レコード未発見エラー
   */
  notFoundError: function(entityType, id) {
    return createK9Error(
      ErrorCode.RECORD_NOT_FOUND,
      entityType + ' not found',
      { entityType: entityType, id: id }
    );
  },
  
  /**
   * 重複エラー
   */
  duplicateError: function(entityType, field, value) {
    return createK9Error(
      ErrorCode.DUPLICATE_ENTRY,
      'Duplicate ' + entityType + ': ' + field + ' = ' + value,
      { entityType: entityType, field: field, value: value }
    );
  },
  
  /**
   * 認証エラー
   */
  authenticationError: function(reason) {
    return createK9Error(
      ErrorCode.AUTHENTICATION_ERROR,
      'Authentication failed',
      { reason: reason || 'Invalid credentials' }
    );
  },
  
  /**
   * レート制限エラー
   */
  rateLimitError: function(limit, resetAt) {
    return createK9Error(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      { 
        limit: limit,
        resetAt: resetAt,
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000)
      }
    );
  },
  
  /**
   * サービス利用不可エラー
   */
  serviceUnavailableError: function(service) {
    return createK9Error(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Service temporarily unavailable',
      { service: service }
    );
  },
  
  /**
   * トランザクション失敗エラー
   */
  transactionError: function(transactionId, reason) {
    return createK9Error(
      ErrorCode.TRANSACTION_FAILED,
      'Transaction failed',
      { 
        transactionId: transactionId,
        reason: reason
      }
    );
  }
};

// ============================================================================
// Retry ロジック（外部API用）
// ============================================================================

var RetryHandler = {
  
  /**
   * リトライ付き実行
   * @param {Function} fn 実行する関数
   * @param {Object} options オプション
   */
  execute: function(fn, options) {
    options = options || {};
    var maxRetries = options.maxRetries || 3;
    var delay = options.delay || 1000;
    var backoff = options.backoff || 2;
    
    var lastError;
    
    for (var i = 0; i < maxRetries; i++) {
      try {
        return fn();
      } catch (error) {
        lastError = error;
        
        log('WARN', 'RetryHandler', 'Attempt ' + (i + 1) + '/' + maxRetries + ' failed', {
          error: error.message
        });
        
        // 最後の試行でなければ待機
        if (i < maxRetries - 1) {
          var waitTime = delay * Math.pow(backoff, i);
          Utilities.sleep(waitTime);
        }
      }
    }
    
    // 全リトライ失敗
    throw lastError;
  }
};

// ============================================================================
// テスト関数
// ============================================================================

/**
 * エラーハンドリングテスト
 */
function testErrorHandling() {
  console.log('=== Error Handling Test ===\n');
  
  // テスト1: バリデーションエラー
  console.log('Test 1: Validation Error');
  try {
    throw ErrorHandler.validationError('customer_email', 'Invalid email format');
  } catch (e) {
    var result = ErrorHandler.handle(e, { service: 'CustomerService' });
    console.log('Result:', JSON.stringify(result, null, 2));
  }
  
  // テスト2: 必須フィールドエラー
  console.log('\nTest 2: Required Field Error');
  try {
    throw ErrorHandler.requiredFieldError('customer_name');
  } catch (e) {
    var result = ErrorHandler.handle(e, { service: 'CustomerService' });
    console.log('Result:', JSON.stringify(result, null, 2));
  }
  
  // テスト3: レコード未発見エラー
  console.log('\nTest 3: Not Found Error');
  try {
    throw ErrorHandler.notFoundError('Customer', 'invalid-id-123');
  } catch (e) {
    var result = ErrorHandler.handle(e, { service: 'CustomerRepository' });
    console.log('Result:', JSON.stringify(result, null, 2));
  }
  
  // テスト4: 認証エラー
  console.log('\nTest 4: Authentication Error');
  try {
    throw ErrorHandler.authenticationError('Invalid token');
  } catch (e) {
    var result = ErrorHandler.handle(e, { service: 'AuthService' });
    console.log('Result:', JSON.stringify(result, null, 2));
  }
  
  // テスト5: レート制限エラー
  console.log('\nTest 5: Rate Limit Error');
  try {
    var resetAt = Date.now() + 60000; // 60秒後
    throw ErrorHandler.rateLimitError(100, resetAt);
  } catch (e) {
    var result = ErrorHandler.handle(e, { service: 'RateLimiter' });
    console.log('Result:', JSON.stringify(result, null, 2));
  }
  
  // テスト6: Retryテスト
  console.log('\nTest 6: Retry Logic');
  var attemptCount = 0;
  try {
    RetryHandler.execute(function() {
      attemptCount++;
      console.log('Attempt ' + attemptCount);
      if (attemptCount < 3) {
        throw new Error('Simulated API error');
      }
      return 'Success!';
    }, { maxRetries: 3, delay: 500 });
    
    console.log('✅ Retry succeeded on attempt ' + attemptCount);
    
  } catch (e) {
    console.log('❌ Retry failed after 3 attempts');
  }
  
  console.log('\n✅ Error Handling Test Completed');
}

/**
 * 新規エラーコードテスト
 */
function TEST_NewErrorCodes() {
  console.log('=== New Error Codes Test ===\n');
  
  console.log('【Test 1】AUTHENTICATION_ERROR');
  console.log('Code:', ErrorCode.AUTHENTICATION_ERROR);
  
  console.log('\n【Test 2】RATE_LIMIT_EXCEEDED');
  console.log('Code:', ErrorCode.RATE_LIMIT_EXCEEDED);
  
  console.log('\n【Test 3】SERVICE_UNAVAILABLE');
  console.log('Code:', ErrorCode.SERVICE_UNAVAILABLE);
  
  console.log('\n【Test 4】TRANSACTION_FAILED');
  console.log('Code:', ErrorCode.TRANSACTION_FAILED);
  
  console.log('\n✅ All new error codes defined');
}