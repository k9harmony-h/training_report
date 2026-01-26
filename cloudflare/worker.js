/**
 * ============================================================================
 * K9 Harmony - Cloudflare Workers (Fixed)
 * ============================================================================
 * 最終更新: 2026-01-26
 * 修正内容: ヘッダーのフィルタリング、エラーハンドリング強化
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export default {
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
        version: '1.0.1',
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
 * GASへのプロキシ処理（修正版）
 */
async function proxyToGAS(request, env, url) {
  try {
    // GAS URLの取得
    const gasBaseUrl = env.GAS_API_URL ||
      'https://script.google.com/macros/s/AKfycbya1cNbUgl_-iNlvk0RXOMeiL2ziQBeNyhPdEafZWoK7jk9cFKFA07AM0QiscJ80zZtiQ/exec';
    // 最新デプロイURL: 2026-01-26 18:15 更新
    
    const gasUrl = new URL(gasBaseUrl);
    
    // クエリパラメータをコピー
    url.searchParams.forEach((value, key) => {
      gasUrl.searchParams.append(key, value);
    });
    
    console.log(`[CF] Proxying to GAS: ${gasUrl.toString()}`);
    
    // ===== 修正: ヘッダーを安全にフィルタリング =====
    const safeHeaders = new Headers();
    safeHeaders.set('Content-Type', 'application/json');
    
    // Authorizationヘッダーがあればコピー（ASCII文字のみ）
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
      headers: safeHeaders,  // ← 安全なヘッダーのみ
      body: requestBody
    });
    
    console.log(`[CF] GAS Response: ${gasResponse.status}`);
    
    // レスポンスを取得
    const responseBody = await gasResponse.text();
    
    // レスポンスヘッダーを作成
    const responseHeaders = new Headers();
    
    // CORSヘッダーを設定
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
    
    // Content-Typeを確保
    const contentType = gasResponse.headers.get('Content-Type') || 'application/json';
    responseHeaders.set('Content-Type', contentType);
    
    // レスポンスを返す
    return new Response(responseBody, {
      status: gasResponse.status,
      statusText: gasResponse.statusText,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('[CF] Proxy error:', error);
    
    // エラーレスポンス
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