/**
 * ============================================================================
 * K9 Harmony - API Client with Token Authentication
 * ============================================================================
 * Token検証対応版
 */

class ApiClient {
    constructor() {
      this.baseUrl = FRONTEND_CONFIG.API.BASE_URL;
      this.timeout = FRONTEND_CONFIG.API.TIMEOUT;
    }
  
    /**
     * GETリクエスト
     */
    async get(action, params = {}) {
      try {
        // ★★★ Token検証対応: lineAccessToken を追加 ★★★
        const accessToken = liffHandler.getAccessToken();
        if (accessToken) {
          params.lineAccessToken = accessToken;
        }
        
        const queryParams = new URLSearchParams({
          action,
          ...params
        });
  
        const url = `${this.baseUrl}?${queryParams}`;
  
        console.log(`[API] GET request: ${action}`, params);
  
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
  
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal
        });
  
        clearTimeout(timeoutId);
  
        const data = await response.json();
  
        console.log(`[API] GET response: ${action}`, data);
  
        if (data.error) {
          throw new Error(data.message || 'API request failed');
        }
  
        return data;
  
      } catch (error) {
        console.error(`[API] GET request failed:`, error);
        throw error;
      }
    }
  
    /**
     * POSTリクエスト
     */
    async post(action, payload = {}) {
      try {
        // ★★★ Token検証対応: lineAccessToken を追加 ★★★
        const accessToken = liffHandler.getAccessToken();
        if (accessToken) {
          payload.lineAccessToken = accessToken;
        }
        
        const requestBody = {
          action,
          ...payload
        };
  
        console.log(`[API] POST request: ${action}`, payload);
  
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
  
        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
  
        clearTimeout(timeoutId);
  
        const data = await response.json();
  
        console.log(`[API] POST response: ${action}`, data);
  
        if (data.error) {
          throw new Error(data.message || 'API request failed');
        }
  
        return data;
  
      } catch (error) {
        console.error(`[API] POST request failed:`, error);
        throw error;
      }
    }
  
    // ===== 顧客関連 =====
    
    async getCustomerData(params = {}) {
      return await this.get('getCustomerData', {
        userId: liffHandler.getUserId()
      });
    }
  
    async getMyReservations() {
      return await this.get('getMyReservations', {
        userId: liffHandler.getUserId()
      });
    }
  
    async updateProfile(updateData) {
      return await this.post('updateProfile', {
        userId: liffHandler.getUserId(),
        updateData
      });
    }
  
    // ===== 犬関連 =====
  
    async updateDog(dogId, updateData) {
      return await this.post('updateDog', {
        userId: liffHandler.getUserId(),
        dogId,
        updateData
      });
    }
  
    // ===== 商品・トレーナー =====
  
    async getProductList() {
      return await this.get('getProductList');
    }
  
    async getTrainerList() {
      return await this.get('getTrainerList');
    }
  
    // ===== 空き枠・予約 =====
  
    async getAvailableSlots(trainerId, date) {
      return await this.get('getAvailableSlots', {
        trainerId,
        date
      });
    }
/**
 * 予約枠ロック（GETリクエストに変更 - GAS CORS制約回避）
 */
async lockSlot(trainerId, officeId, date, customerId) {
    console.log('[API] Locking slot with GET request (CORS workaround)');
    
    return this.get('lockSlot', {
      trainerId,
      officeId,
      reservationDate: date,
      customerId
    });
  }
  
  async createReservationWithPayment(reservationData, paymentData, lockId) {
    console.log('[API] Creating reservation with payment (GET method - CORS workaround)');
    
    const reservationDataStr = JSON.stringify(reservationData);
    const paymentDataStr = JSON.stringify(paymentData);
    
    return this.get('createReservationWithPayment', {
      userId: liffHandler.getUserId(),
      reservationData: reservationDataStr,
      paymentData: paymentDataStr,
      lockId: lockId
    });
  }
  
    async cancelReservation(reservationId, reason) {
      return await this.post('cancelReservation', {
        userId: liffHandler.getUserId(),
        reservationId,
        reason
      });
    }
  
    // ===== ヘルスチェック =====
  
    async healthCheck() {
      return await this.get('healthCheck');
    }
  }
  
  // グローバルインスタンス
  const apiClient = new ApiClient();