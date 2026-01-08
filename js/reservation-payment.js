/**
 * ============================================================================
 * K9 Harmony - Reservation Payment
 * ============================================================================
 * 予約画面の決済処理
 * 最終更新: 2026-01-08
 */

/**
 * 予約確定処理
 */
ReservationApp.prototype.handleConfirm = async function() {
    try {
      // ボタン無効化
      const confirmBtn = document.getElementById('btn-confirm');
      if (confirmBtn) {
        confirmBtn.disabled = true;
      }
      
      this.showLoading('決済処理中...');
      
      // Square決済トークン化
      const tokenResult = await this.card.tokenize();
      
      if (tokenResult.status === 'OK') {
        // 予約+決済作成
        await this.createReservation(tokenResult.token);
        
        this.hideLoading();
        
        // 成功画面表示
        this.showSuccessPage();
        
      } else {
        throw new Error(tokenResult.errors?.[0]?.message || FRONTEND_CONFIG.ERROR_MESSAGES.PAYMENT_ERROR);
      }
      
    } catch (error) {
      console.error('[App] Reservation failed:', error);
      this.hideLoading();
      this.showError(error.message);
      
      // ボタン再有効化
      const confirmBtn = document.getElementById('btn-confirm');
      if (confirmBtn) {
        confirmBtn.disabled = false;
      }
    }
  };
  
  /**
   * 予約作成
   */
  ReservationApp.prototype.createReservation = async function(sourceId) {
    try {
      const reservationData = {
        customer_id: this.customerData.customer_id,
        dog_id: this.selectedDog.dog_id,
        product_id: this.selectedProduct.product_id,
        reservation_date: this.selectedDate,
        start_time: this.selectedTime,
        duration: this.selectedProduct.duration,
        trainer_id: 'default-trainer', // TODO: トレーナー選択機能追加時に変更
        status: 'confirmed'
      };
      
      const paymentData = {
        source_id: sourceId,
        amount: this.selectedProduct.tax_included_price,
        currency: 'JPY',
        customer_id: this.customerData.customer_id
      };
      
      const response = await apiClient.createReservationWithPayment(
        reservationData,
        paymentData,
        this.lockId
      );
      
      console.log('[App] Reservation created:', response);
      
      return response;
      
    } catch (error) {
      console.error('[App] Failed to create reservation:', error);
      throw error;
    }
  };
  
  /**
   * 成功画面表示
   */
  ReservationApp.prototype.showSuccessPage = function() {
    // 全ステップ非表示
    for (let i = 1; i <= this.totalSteps; i++) {
      const stepElement = document.getElementById(`step-${i}`);
      if (stepElement) {
        stepElement.classList.add('hidden');
      }
    }
    
    // 成功画面表示
    const successPage = document.getElementById('success-page');
    if (successPage) {
      successPage.classList.remove('hidden');
    }
    
    // ボタン非表示
    document.getElementById('action-buttons').classList.add('hidden');
    
    // 成功メッセージ
    this.showSuccess(FRONTEND_CONFIG.SUCCESS_MESSAGES.RESERVATION_CREATED);
  };
  
  /**
   * 完了ボタンハンドラ
   */
  ReservationApp.prototype.handleComplete = function() {
    // LINEアプリを閉じる
    liffHandler.closeWindow();
  };