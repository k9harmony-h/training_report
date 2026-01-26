/**
 * ============================================================================
 * K9 Harmony - Rate Limiter
 * ============================================================================
 * ファイル名: RateLimiter.gs
 * 役割: APIリクエストのレート制限
 * 最終更新: 2026-01-08
 * バージョン: v1.0.0
 * 
 * 機能:
 * - ユーザー単位のレート制限
 * - IPアドレス単位のレート制限
 * - バースト制限
 * - 自動リセット
 */

var RateLimiter = {
  
  // レート制限設定
  LIMITS: {
    USER: {
      requests: 100,     // 100リクエスト
      window: 60         // 1分間
    },
    IP: {
      requests: 200,     // 200リクエスト
      window: 60         // 1分間
    },
    BURST: {
      requests: 10,      // 10リクエスト
      window: 1          // 1秒間
    }
  },
  
  /**
   * レート制限チェック（ユーザー単位）
   * 
   * @param {string} userId - ユーザーID
   * @return {Object} { allowed: boolean, limit: number, remaining: number, resetAt: number }
   */
  checkUserLimit: function(userId) {
    var context = { service: 'RateLimiter', action: 'checkUserLimit' };
    
    try {
      var key = 'rate_user_' + userId;
      var limit = this.LIMITS.USER;
      
      return this._checkLimit(key, limit);
      
    } catch (error) {
      log('ERROR', 'RateLimiter', 'User limit check failed: ' + error.message);
      
      // エラー時は許可（サービス継続を優先）
      return {
        allowed: true,
        limit: this.LIMITS.USER.requests,
        remaining: this.LIMITS.USER.requests,
        resetAt: Date.now() + (this.LIMITS.USER.window * 1000),
        error: true
      };
    }
  },
  
  /**
   * レート制限チェック（IP単位）
   * 
   * @param {string} ipAddress - IPアドレス
   * @return {Object} { allowed: boolean, limit: number, remaining: number, resetAt: number }
   */
  checkIpLimit: function(ipAddress) {
    var context = { service: 'RateLimiter', action: 'checkIpLimit' };
    
    try {
      if (!ipAddress) {
        // IPアドレスが取得できない場合は許可
        return {
          allowed: true,
          limit: this.LIMITS.IP.requests,
          remaining: this.LIMITS.IP.requests,
          resetAt: Date.now() + (this.LIMITS.IP.window * 1000)
        };
      }
      
      var key = 'rate_ip_' + ipAddress.replace(/[^0-9.]/g, '');
      var limit = this.LIMITS.IP;
      
      return this._checkLimit(key, limit);
      
    } catch (error) {
      log('ERROR', 'RateLimiter', 'IP limit check failed: ' + error.message);
      
      // エラー時は許可
      return {
        allowed: true,
        limit: this.LIMITS.IP.requests,
        remaining: this.LIMITS.IP.requests,
        resetAt: Date.now() + (this.LIMITS.IP.window * 1000),
        error: true
      };
    }
  },
  
  /**
   * バースト制限チェック
   * 
   * @param {string} userId - ユーザーID
   * @return {Object} { allowed: boolean }
   */
  checkBurstLimit: function(userId) {
    var context = { service: 'RateLimiter', action: 'checkBurstLimit' };
    
    try {
      var key = 'rate_burst_' + userId;
      var limit = this.LIMITS.BURST;
      
      return this._checkLimit(key, limit);
      
    } catch (error) {
      log('ERROR', 'RateLimiter', 'Burst limit check failed: ' + error.message);
      
      // エラー時は許可
      return {
        allowed: true,
        limit: this.LIMITS.BURST.requests,
        remaining: this.LIMITS.BURST.requests,
        resetAt: Date.now() + (this.LIMITS.BURST.window * 1000),
        error: true
      };
    }
  },
  
  /**
   * レート制限チェック（内部処理）
   */
  _checkLimit: function(key, limit) {
    var cache = CacheService.getScriptCache();
    
    // 現在のカウントを取得
    var dataStr = cache.get(key);
    var now = Date.now();
    
    var data;
    
    if (dataStr) {
      data = JSON.parse(dataStr);
      
      // ウィンドウが経過していればリセット
      if (now >= data.resetAt) {
        data = {
          count: 0,
          resetAt: now + (limit.window * 1000)
        };
      }
    } else {
      // 初回
      data = {
        count: 0,
        resetAt: now + (limit.window * 1000)
      };
    }
    
    // カウント増加
    data.count++;
    
    // キャッシュに保存
    cache.put(key, JSON.stringify(data), limit.window);
    
    // 制限チェック
    var allowed = data.count <= limit.requests;
    var remaining = Math.max(0, limit.requests - data.count);
    
    if (!allowed) {
      log('WARN', 'RateLimiter', 'Rate limit exceeded', {
        key: key,
        count: data.count,
        limit: limit.requests
      });
    }
    
    return {
      allowed: allowed,
      limit: limit.requests,
      remaining: remaining,
      resetAt: data.resetAt,
      current: data.count
    };
  },
  
  /**
   * レート制限リセット（管理用）
   */
  resetLimit: function(type, identifier) {
    var context = { service: 'RateLimiter', action: 'resetLimit' };
    
    try {
      var key;
      
      if (type === 'user') {
        key = 'rate_user_' + identifier;
      } else if (type === 'ip') {
        key = 'rate_ip_' + identifier.replace(/[^0-9.]/g, '');
      } else if (type === 'burst') {
        key = 'rate_burst_' + identifier;
      } else {
        throw createK9Error(
          ErrorCode.VALIDATION_ERROR,
          'Invalid type',
          { type: type }
        );
      }
      
      var cache = CacheService.getScriptCache();
      cache.remove(key);
      
      log('INFO', 'RateLimiter', 'Limit reset: ' + key);
      
      return {
        success: true,
        message: 'Rate limit reset successfully'
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * レート制限状態取得（管理用）
   */
  getStatus: function(type, identifier) {
    var context = { service: 'RateLimiter', action: 'getStatus' };
    
    try {
      var key;
      var limit;
      
      if (type === 'user') {
        key = 'rate_user_' + identifier;
        limit = this.LIMITS.USER;
      } else if (type === 'ip') {
        key = 'rate_ip_' + identifier.replace(/[^0-9.]/g, '');
        limit = this.LIMITS.IP;
      } else if (type === 'burst') {
        key = 'rate_burst_' + identifier;
        limit = this.LIMITS.BURST;
      } else {
        throw createK9Error(
          ErrorCode.VALIDATION_ERROR,
          'Invalid type',
          { type: type }
        );
      }
      
      var cache = CacheService.getScriptCache();
      var dataStr = cache.get(key);
      
      if (!dataStr) {
        return {
          success: true,
          status: {
            active: false,
            count: 0,
            limit: limit.requests,
            remaining: limit.requests,
            resetAt: null
          }
        };
      }
      
      var data = JSON.parse(dataStr);
      var now = Date.now();
      
      // ウィンドウ経過チェック
      if (now >= data.resetAt) {
        return {
          success: true,
          status: {
            active: false,
            count: 0,
            limit: limit.requests,
            remaining: limit.requests,
            resetAt: null
          }
        };
      }
      
      return {
        success: true,
        status: {
          active: true,
          count: data.count,
          limit: limit.requests,
          remaining: Math.max(0, limit.requests - data.count),
          resetAt: data.resetAt,
          secondsUntilReset: Math.ceil((data.resetAt - now) / 1000)
        }
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  }
};

// ============================================================================
// テスト関数
// ============================================================================

function TEST_RateLimiter() {
  console.log('=== Rate Limiter Test ===\n');
  
  var testUserId = 'test-user-' + Date.now();
  
  console.log('【Test 1】通常リクエスト（許可）');
  
  for (var i = 1; i <= 5; i++) {
    var result = RateLimiter.checkUserLimit(testUserId);
    
    console.log('  Request ' + i + ':');
    console.log('    Allowed:', result.allowed ? '✅' : '❌');
    console.log('    Remaining:', result.remaining + '/' + result.limit);
  }
  
  console.log('');
  console.log('【Test 2】レート制限状態確認');
  
  var status = RateLimiter.getStatus('user', testUserId);
  
  if (status.success) {
    console.log('  ✅ Status取得成功');
    console.log('    Active:', status.status.active);
    console.log('    Count:', status.status.count);
    console.log('    Remaining:', status.status.remaining);
  }
  
  console.log('');
  console.log('【Test 3】レート制限リセット');
  
  var resetResult = RateLimiter.resetLimit('user', testUserId);
  
  if (resetResult.success) {
    console.log('  ✅ リセット成功');
    
    var statusAfter = RateLimiter.getStatus('user', testUserId);
    console.log('    Count after reset:', statusAfter.status.count);
  }
  
  console.log('');
  console.log('【Test 4】バースト制限');
  
  var burstResults = [];
  
  for (var j = 0; j < 12; j++) {
    var burstResult = RateLimiter.checkBurstLimit(testUserId);
    burstResults.push(burstResult.allowed);
  }
  
  var allowedCount = burstResults.filter(function(r) { return r; }).length;
  var deniedCount = burstResults.filter(function(r) { return !r; }).length;
  
  console.log('  12回のリクエスト:');
  console.log('    Allowed:', allowedCount);
  console.log('    Denied:', deniedCount);
  
  if (deniedCount > 0) {
    console.log('  ✅ バースト制限が正常に動作');
  }
}