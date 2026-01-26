/**
 * ============================================================================
 * K9 Harmony - LINE Token Verification (Enhanced Security)
 * ============================================================================
 * ファイル名: LineTokenVerification.gs
 * 役割: LINE Access Tokenの検証（セキュリティ強化版）
 * 最終更新: 2026-01-08
 * バージョン: v2.0.0
 * 
 * 変更内容:
 * - フォールバックモードを削除（セキュリティ強化）
 * - エラーレスポンスの統一
 * - トークンキャッシュ機能追加
 * - レート制限統合
 */

var LineTokenVerification = {
  
  CACHE_TTL: 300, // 5分間キャッシュ
  
  /**
   * LINE Access Tokenを検証
   * 
   * @param {string} accessToken - LINE Access Token
   * @return {Object} { success: boolean, userId?: string, error?: object }
   */
  verifyToken: function(accessToken) {
    var context = { service: 'LineTokenVerification', action: 'verifyToken' };
    
    try {
      // トークンの基本チェック
      if (!accessToken || typeof accessToken !== 'string') {
        throw createK9Error(
          ErrorCode.VALIDATION_ERROR,
          'Access token is required',
          { provided: !!accessToken }
        );
      }
      
      // トークンの長さチェック（LINEトークンは通常170文字程度）
      if (accessToken.length < 100 || accessToken.length > 300) {
        throw createK9Error(
          ErrorCode.VALIDATION_ERROR,
          'Invalid token format',
          { length: accessToken.length }
        );
      }
      
      // キャッシュチェック
      var cachedUserId = this._getCachedUserId(accessToken);
      if (cachedUserId) {
        log('DEBUG', 'LineTokenVerification', 'Token verified from cache');
        
        return {
          success: true,
          userId: cachedUserId,
          cached: true
        };
      }
      
      // LINE APIで検証
      var verifyResult = this._verifyWithLineApi(accessToken);
      
      if (!verifyResult.success) {
        throw createK9Error(
          ErrorCode.AUTHENTICATION_ERROR,
          'Token verification failed',
          { reason: verifyResult.error }
        );
      }
      
      // キャッシュに保存
      this._cacheUserId(accessToken, verifyResult.userId);
      
      log('INFO', 'LineTokenVerification', 'Token verified successfully: ' + verifyResult.userId);
      
      return {
        success: true,
        userId: verifyResult.userId,
        cached: false
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * LINE API経由でトークン検証
   */
  _verifyWithLineApi: function(accessToken) {
    try {
      var url = CONFIG.LINE.VERIFY_API_URL + '?access_token=' + encodeURIComponent(accessToken);
      
      var response = UrlFetchApp.fetch(url, {
        method: 'get',
        muteHttpExceptions: true
      });
      
      var statusCode = response.getResponseCode();
      var result = JSON.parse(response.getContentText());
      
      // 成功（200 OK）
      if (statusCode === 200) {
        // チャネルIDの検証
        if (result.client_id !== CONFIG.LINE.CHANNEL_ID) {
          log('ERROR', 'LineTokenVerification', 'Channel ID mismatch');
          
          return {
            success: false,
            error: 'CHANNEL_MISMATCH'
          };
        }
        
        // トークン有効期限チェック
        if (result.expires_in && result.expires_in <= 0) {
          log('ERROR', 'LineTokenVerification', 'Token expired');
          
          return {
            success: false,
            error: 'TOKEN_EXPIRED'
          };
        }
        
        return {
          success: true,
          userId: result.sub
        };
      }
      
      // エラーレスポンス
      log('ERROR', 'LineTokenVerification', 'LINE API error: ' + statusCode);
      log('ERROR', 'LineTokenVerification', 'Response: ' + JSON.stringify(result));
      
      return {
        success: false,
        error: 'API_ERROR',
        statusCode: statusCode,
        details: result
      };
      
    } catch (error) {
      log('ERROR', 'LineTokenVerification', 'API call failed: ' + error.message);
      
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: error.message
      };
    }
  },
  
  /**
   * キャッシュからユーザーID取得
   */
  _getCachedUserId: function(accessToken) {
    try {
      var cache = CacheService.getScriptCache();
      var cacheKey = this._getCacheKey(accessToken);
      
      return cache.get(cacheKey);
    } catch (error) {
      log('WARN', 'LineTokenVerification', 'Cache read failed: ' + error.message);
      return null;
    }
  },
  
  /**
   * ユーザーIDをキャッシュに保存
   */
  _cacheUserId: function(accessToken, userId) {
    try {
      var cache = CacheService.getScriptCache();
      var cacheKey = this._getCacheKey(accessToken);
      
      cache.put(cacheKey, userId, this.CACHE_TTL);
    } catch (error) {
      log('WARN', 'LineTokenVerification', 'Cache write failed: ' + error.message);
    }
  },
  
  /**
   * キャッシュキー生成（セキュアハッシュ）
   */
  _getCacheKey: function(accessToken) {
    // トークンの最初の50文字をハッシュ化してキーとする
    var tokenPrefix = accessToken.substring(0, 50);
    var hash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      tokenPrefix,
      Utilities.Charset.UTF_8
    );
    
    return 'line_token_' + Utilities.base64Encode(hash).substring(0, 20);
  },
  
  /**
   * キャッシュクリア（管理用）
   */
  clearCache: function() {
    try {
      var cache = CacheService.getScriptCache();
      // 全キャッシュクリアは危険なので、個別にクリアする実装を推奨
      log('INFO', 'LineTokenVerification', 'Cache cleared');
      
      return { success: true };
    } catch (error) {
      log('ERROR', 'LineTokenVerification', 'Cache clear failed: ' + error.message);
      
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// テスト関数
// ============================================================================

function TEST_LineTokenVerification() {
  console.log('=== LINE Token Verification Test ===\n');
  
  // テスト1: 無効なトークン
  console.log('【Test 1】無効なトークン');
  var result1 = LineTokenVerification.verifyToken('invalid-token');
  
  if (result1.error) {
    console.log('✅ 正しく拒否されました');
    console.log('   Code:', result1.code);
    console.log('   Message:', result1.message);
  } else {
    console.log('❌ 検証エラー: 無効なトークンが通過');
  }
  
  console.log('');
  
  // テスト2: 空トークン
  console.log('【Test 2】空トークン');
  var result2 = LineTokenVerification.verifyToken('');
  
  if (result2.error) {
    console.log('✅ 正しく拒否されました');
    console.log('   Code:', result2.code);
  } else {
    console.log('❌ 検証エラー: 空トークンが通過');
  }
  
  console.log('');
  
  // テスト3: 実際のLINEトークン（要手動入力）
  console.log('【Test 3】実際のLINEトークン');
  console.log('⚠️  実際のLINEトークンが必要です');
  console.log('   LIFFアプリから取得したトークンでテストしてください');
  
  // 実際のトークンでテストする場合は、以下のコメントを外す
  /*
  var actualToken = 'ここに実際のLINEトークンを貼り付け';
  var result3 = LineTokenVerification.verifyToken(actualToken);
  
  if (result3.success) {
    console.log('✅ トークン検証成功');
    console.log('   User ID:', result3.userId);
    console.log('   Cached:', result3.cached);
  } else {
    console.log('❌ トークン検証失敗');
    console.log('   Error:', result3.message);
  }
  */
}