/**
 * ============================================================================
 * K9 Harmony - Cloudflare Workers (Fixed)
 * ============================================================================
 * 最終更新: 2026-02-09
 * 修正内容: 提案D - Edge Cache + Cron Keep-Warm
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// ============================================================================
// 提案D: Edge Cache設定
// ============================================================================
const CACHE_CONFIG = {
  // キャッシュ可能なアクション（GET リクエストのみ）
  cacheableActions: [
    'data',           // 顧客データ
    'getMyReservations', // 予約一覧
    'getEvaluationBundle', // 評価データ
    'getMyPageBundle', // MyPage統合データ（最重要）
    'products',       // 商品一覧
    'getTrainerList', // トレーナー一覧
  ],
  // キャッシュTTL（秒）
  ttl: {
    data: 300,              // 顧客データ: 5分
    getMyReservations: 300, // 予約: 5分
    getEvaluationBundle: 7200, // 評価: 2時間（データ更新頻度が低いため長TTL）
    getMyPageBundle: 900,  // MyPage統合: 15分（最重要）
    products: 3600,        // 商品: 1時間
    getTrainerList: 3600,  // トレーナー: 1時間
  },
  defaultTtl: 300,
};

/**
 * キャッシュキー生成
 */
function getCacheKey(action, lineUserId, params) {
  const keyParts = [action, lineUserId];
  // 追加パラメータ（dogIdなど）
  if (params.dogId) keyParts.push(params.dogId);
  return `cache:${keyParts.join(':')}`;
}

/**
 * Edgeキャッシュからの取得を試みる
 */
async function getFromEdgeCache(env, cacheKey) {
  // KVが設定されていない場合はスキップ
  if (!env.K9_CACHE) return null;

  try {
    const cached = await env.K9_CACHE.get(cacheKey, 'json');
    if (cached) {
      console.log(`[CF] Edge Cache HIT: ${cacheKey}`);
      return cached;
    }
  } catch (e) {
    console.error(`[CF] Edge Cache Error: ${e.message}`);
  }
  return null;
}

/**
 * Edgeキャッシュに保存
 */
async function setEdgeCache(env, cacheKey, data, ttlSeconds) {
  if (!env.K9_CACHE) return;

  try {
    await env.K9_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: ttlSeconds,
    });
    console.log(`[CF] Edge Cache SET: ${cacheKey} (TTL: ${ttlSeconds}s)`);
  } catch (e) {
    console.error(`[CF] Edge Cache Write Error: ${e.message}`);
  }
}

export default {
  /**
   * Cron Trigger: GAS Keep-Warm（5分間隔）
   * GASのV8コールドスタート（~8秒）を防止し、コアテーブルをCacheServiceに事前ロード
   *
   * 効果: ユーザーリクエスト時の応答を ~14秒 → ~1-2秒に改善
   */
  async scheduled(event, env, ctx) {
    console.log(`[CF] Cron trigger fired: ${event.cron} at ${new Date().toISOString()}`);

    const gasBaseUrl = env.GAS_API_URL ||
      'https://script.google.com/macros/s/AKfycbyMxUAy7no3D8Y0wL54h3KkwFzjYx8CfKsrfkWiKUGAasfO5ut2zqoDc74xhuIBwrI40w/exec';

    const gasUrl = new URL(gasBaseUrl);
    gasUrl.searchParams.set('action', 'keepWarm');

    const startTime = Date.now();
    try {
      const response = await fetch(gasUrl.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const elapsed = Date.now() - startTime;
      const body = await response.text();
      console.log(`[CF] Keep-warm response (${elapsed}ms): ${body.substring(0, 200)}`);
    } catch (e) {
      const elapsed = Date.now() - startTime;
      console.error(`[CF] Keep-warm failed (${elapsed}ms): ${e.message}`);
    }
  },

  async fetch(request, env) {
    // OPTIONS (Preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    console.log(`[CF] Request: ${request.method} ${url.pathname}${url.search}`);

    // ========================================================================
    // Health Check
    // ========================================================================
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        version: '1.0.2',
        environment: env.ENVIRONMENT || 'sandbox'
      }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    // ========================================================================
    // 決済API (既存)
    // ========================================================================
    if (url.pathname === '/api/createReservationWithPayment') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'POST required' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
      
      try {
        if (!env.GAS_API_URL) {
          return new Response(JSON.stringify({ 
            error: 'Server configuration error' 
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
          });
        }
        
        const body = await request.json();
        
        const gasUrl = new URL(env.GAS_API_URL);
        gasUrl.searchParams.append('action', 'createReservationWithPayment');
        gasUrl.searchParams.append('userId', body.userId);
        gasUrl.searchParams.append('lineUserId', body.lineUserId);  // LINE IDを追加
        gasUrl.searchParams.append('reservationData', JSON.stringify(body.reservationData));
        gasUrl.searchParams.append('paymentData', JSON.stringify(body.paymentData));
        gasUrl.searchParams.append('lockId', body.lockId || 'null');
        gasUrl.searchParams.append('lineAccessToken', body.lineAccessToken);
        gasUrl.searchParams.append('environment', env.ENVIRONMENT || 'sandbox');
        
        const gasResponse = await fetch(gasUrl.toString());
        
        if (!gasResponse.ok) {
          const errorText = await gasResponse.text();
          return new Response(JSON.stringify({ 
            error: 'GAS API error',
            status: gasResponse.status,
            message: errorText
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
          });
        }
        
        const result = await gasResponse.json();
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Internal server error',
          message: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
    }
    
    // ========================================================================
    // GASプロキシ（全てのリクエスト）
    // ========================================================================
    return await proxyToGAS(request, env, url);
  }
};

/**
 * GASへのプロキシ処理（提案D: Edgeキャッシュ対応）
 */
async function proxyToGAS(request, env, url) {
  try {
    const startTime = Date.now();

    // アクション・パラメータ取得
    const action = url.searchParams.get('action') || url.searchParams.get('type');
    const lineUserId = url.searchParams.get('lineUserId') || url.searchParams.get('userId');
    const dogId = url.searchParams.get('dogId');

    // ========== 提案D: Edge Cache チェック ==========
    const forceRefresh = url.searchParams.get('forceRefresh') === '1';
    const isCacheable = request.method === 'GET' &&
                        action &&
                        lineUserId &&
                        CACHE_CONFIG.cacheableActions.includes(action) &&
                        !forceRefresh;  // forceRefresh時はキャッシュスキップ

    if (isCacheable) {
      const cacheKey = getCacheKey(action, lineUserId, { dogId });
      const cachedData = await getFromEdgeCache(env, cacheKey);

      if (cachedData) {
        const elapsedMs = Date.now() - startTime;
        // キャッシュヒット: 即座にレスポンス
        return new Response(JSON.stringify({
          ...cachedData,
          _cache: { hit: true, elapsed_ms: elapsedMs }
        }), {
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
            ...CORS_HEADERS
          }
        });
      }
    }

    // GAS URLの取得
    const gasBaseUrl = env.GAS_API_URL ||
      'https://script.google.com/macros/s/AKfycbyMxUAy7no3D8Y0wL54h3KkwFzjYx8CfKsrfkWiKUGAasfO5ut2zqoDc74xhuIBwrI40w/exec';
    // 最新デプロイURL: 2026-02-09 - Fix keepWarm: use CONFIG.SHEET constants for correct table names

    const gasUrl = new URL(gasBaseUrl);

    // クエリパラメータをコピー
    url.searchParams.forEach((value, key) => {
      gasUrl.searchParams.append(key, value);
    });

    console.log(`[CF] Proxying to GAS: ${gasUrl.toString()}`);

    // ===== ヘッダーを安全にフィルタリング =====
    const safeHeaders = new Headers();
    safeHeaders.set('Content-Type', 'application/json');

    const authHeader = request.headers.get('Authorization');
    if (authHeader && /^[\x00-\x7F]*$/.test(authHeader)) {
      safeHeaders.set('Authorization', authHeader);
    }

    // リクエストボディの取得（GETとHEAD以外）
    let requestBody = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        requestBody = await request.text();
      } catch (error) {
        console.error('[CF] Failed to read request body:', error);
      }
    }

    // GASへリクエスト送信
    const gasResponse = await fetch(gasUrl.toString(), {
      method: request.method,
      headers: safeHeaders,
      body: requestBody
    });

    console.log(`[CF] GAS Response: ${gasResponse.status}`);

    // レスポンスを取得
    const responseBody = await gasResponse.text();
    const elapsedMs = Date.now() - startTime;

    // ========== 提案D: 成功時はEdgeキャッシュに保存 ==========
    if (isCacheable && gasResponse.status === 200) {
      try {
        const responseData = JSON.parse(responseBody);
        // エラーでない場合のみキャッシュ
        if (!responseData.error) {
          const cacheKey = getCacheKey(action, lineUserId, { dogId });
          const ttl = CACHE_CONFIG.ttl[action] || CACHE_CONFIG.defaultTtl;
          await setEdgeCache(env, cacheKey, responseData, ttl);
        }
      } catch (e) {
        // JSONパースエラーは無視
      }
    }

    // レスポンスヘッダーを作成
    const responseHeaders = new Headers();
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    const contentType = gasResponse.headers.get('Content-Type') || 'application/json';
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('X-Cache', 'MISS');
    responseHeaders.set('X-Response-Time', `${elapsedMs}ms`);

    return new Response(responseBody, {
      status: gasResponse.status,
      statusText: gasResponse.statusText,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('[CF] Proxy error:', error);

    return new Response(JSON.stringify({
      error: true,
      code: 'PROXY_ERROR',
      message: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      }
    });
  }
}