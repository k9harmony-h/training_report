/**
 * ============================================================================
 * K9 Harmony - API Client
 * ============================================================================
 * GASバックエンドとの通信を管理
 * 最終更新: 2026-01-10（トレーナー選択対応）
 */

class ApiClient {
    constructor() {
      this.baseUrl = FRONTEND_CONFIG.API.BASE_URL;
      this.timeout = FRONTEND_CONFIG.API.TIMEOUT;
    }
  
    /**
     * GETリクエスト
     * @param {string} action - APIアクション名
     * @param {Object} params - クエリパラメータ
     * @returns {Promise<Object>} APIレスポンス
     */
    async get(action, params = {}) {
      try {
        const url = new URL(this.baseUrl);
        url.searchParams.append('action', action);
        url.searchParams.append('lineAccessToken', liffHandler.getAccessToken());
        
        Object.keys(params).forEach(key => {
          url.searchParams.append(key, params[key]);
        });
        
        console.log('[API] GET request:', action, params);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('[API] GET response:', action, data);
        
        if (data.error) {
          throw new Error(data.message || FRONTEND_CONFIG.ERROR_MESSAGES.API_ERROR);
        }
        
        return data;
        
      } catch (error) {
        console.error('[API] GET request failed:', error);
        
        if (error.name === 'AbortError') {
          throw new Error('リクエストがタイムアウトしました。');
        }
        
        throw new Error(error.message || FRONTEND_CONFIG.ERROR_MESSAGES.NETWORK_ERROR);
      }
    }
  
    /**
     * POSTリクエスト
     * @param {string} action - APIアクション名
     * @param {Object} data - 送信データ
     * @returns {Promise<Object>} APIレスポンス
     */
    async post(action, data = {}) {
      try {
        const payload = {
          action: action,
          ...data
        };
        
        console.log('[API] POST request:', action, payload);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseData = await response.json();
        
        console.log('[API] POST response:', action, responseData);
        
        if (responseData.error) {
          throw new Error(responseData.message || FRONTEND_CONFIG.ERROR_MESSAGES.API_ERROR);
        }
        
        return responseData;
        
      } catch (error) {
        console.error('[API] POST request failed:', error);
        
        if (error.name === 'AbortError') {
          throw new Error('リクエストがタイムアウトしました。');
        }
        
        throw new Error(error.message || FRONTEND_CONFIG.ERROR_MESSAGES.NETWORK_ERROR);
      }
    }
  
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 予約関連API
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
    /**
     * 顧客・犬情報取得
     * @returns {Promise<Object>} 顧客・犬データ
     */
    async getCustomerData() {
      return await this.get('getCustomerData', {
        userId: liffHandler.getUserId()
      });
    }
  
    /**
     * トレーナー一覧取得
     * @returns {Promise<Object>} トレーナーリスト
     */
    async getTrainerList() {
      return await this.get('getTrainerList');
    }
  
    /**
     * 商品一覧取得
     * @returns {Promise<Array>} 商品リスト
     */
    async getProductList() {
      return await this.get('getProductList');
    }
  
    /**
     * 空き枠取得
     * @param {string} trainerId - トレーナーID
     * @param {string} date - 日付（YYYY-MM-DD）
     * @returns {Promise<Array>} 空き枠リスト
     */
    async getAvailableSlots(trainerId, date) {
      return await this.get('getAvailableSlots', {
        trainerId: trainerId,
        date: date
      });
    }
  
    /**
     * 予約枠ロック
     * @param {Object} slotData - 予約枠データ
     * @returns {Promise<Object>} ロック結果
     */
    async lockSlot(slotData) {
      const response = await this.post('lockSlot', {
        userId: slotData.userId,
        trainerId: slotData.trainerId,
        officeId: slotData.officeId,
        reservationDate: slotData.date,
        customerId: slotData.customerId,
        dogId: slotData.dogId
      });
      
      return response;
    }
  
    /**
     * 予約+決済作成
     * @param {Object} reservationData - 予約データ
     * @param {Object} paymentData - 決済データ
     * @param {string} lockId - ロックID
     * @returns {Promise<Object>} 予約結果
     */
    async createReservationWithPayment(reservationData, paymentData, lockId) {
      return await this.post('createReservationWithPayment', {
        userId: liffHandler.getUserId(),
        reservationData: JSON.stringify(reservationData),
        paymentData: JSON.stringify(paymentData),
        lockId: lockId
      });
    }
  
    /**
     * 自分の予約一覧取得
     * @returns {Promise<Array>} 予約リスト
     */
    async getMyReservations() {
      return await this.get('getMyReservations', {
        userId: liffHandler.getUserId()
      });
    }
  
    /**
     * 予約キャンセル
     * @param {string} reservationId - 予約ID
     * @param {string} reason - キャンセル理由
     * @returns {Promise<Object>} キャンセル結果
     */
    async cancelReservation(reservationId, reason) {
      return await this.post('cancelReservation', {
        userId: liffHandler.getUserId(),
        reservationId: reservationId,
        reason: reason
      });
    }
  }
  
  // グローバルインスタンス
  const apiClient = new ApiClient();