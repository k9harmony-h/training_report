/**
 * ============================================================================
 * K9 Harmony - Reservation Page
 * ============================================================================
 * 予約画面のメインロジック
 * 最終更新: 2026-01-08
 */

class ReservationApp {
    constructor() {
      // ステップ管理
      this.currentStep = 1;
      this.totalSteps = 4;
      
      // データ管理
      this.customerData = null;
      this.dogs = [];
      this.products = [];
      this.availableSlots = [];
      
      // 選択データ
      this.selectedDog = null;
      this.selectedDate = null;
      this.selectedTime = null;
      this.selectedProduct = null;
      this.lockId = null;
      
      // カレンダー用
      this.calendarMonth = null;
      this.calendarYear = null;
      
      // Square Payments
      this.payments = null;
      this.card = null;
      
      // UI要素
      this.loadingOverlay = null;
      this.lottieAnimation = null;
    }
  
    /**
     * アプリ初期化
     */
    async init() {
      try {
        this.showLoading('初期化中...');
        
        // LIFF初期化
        const liffSuccess = await liffHandler.init();
        if (!liffSuccess) {
          return; // ログイン画面にリダイレクト済み
        }
        
        // データ読み込み
        await this.loadInitialData();
        
        // Square初期化
        await this.initSquarePayments();
        
        // UI初期化
        this.initUI();
        
        // ステップ1表示
        this.showStep(1);
        
        this.hideLoading();
        
      } catch (error) {
        console.error('[App] Initialization failed:', error);
        this.hideLoading();
        this.showError(error.message);
      }
    }
  
    /**
     * 初期データ読み込み
     */
    async loadInitialData() {
      try {
        // 顧客・犬情報取得
        const customerResponse = await apiClient.getCustomerData();
        this.customerData = customerResponse.customer;
        this.dogs = customerResponse.dogs || [];
        
        if (this.dogs.length === 0) {
          throw new Error('犬の登録情報が見つかりません。先にマイページから犬を登録してください。');
        }
        
        // 商品一覧取得
        const productResponse = await apiClient.getProductList();
        this.products = productResponse.products || [];
        
        console.log('[App] Initial data loaded:', {
          customer: this.customerData,
          dogs: this.dogs.length,
          products: this.products.length
        });
        
      } catch (error) {
        console.error('[App] Failed to load initial data:', error);
        throw error;
      }
    }
  
    /**
     * Square Web Payments SDK初期化
     */
    async initSquarePayments() {
      try {
        const squareConfig = getCurrentSquareConfig();
        
        this.payments = Square.payments(
          squareConfig.APPLICATION_ID,
          squareConfig.LOCATION_ID
        );
        
        console.log('[Square] Payments SDK initialized');
        
      } catch (error) {
        console.error('[Square] Initialization failed:', error);
        throw new Error('決済システムの初期化に失敗しました。');
      }
    }
  
    /**
     * UI初期化
     */
    initUI() {
      // ローディングオーバーレイ取得
      this.loadingOverlay = document.getElementById('loading-overlay');
      
      // Lottieアニメーション初期化
      this.initLottieAnimation();
      
      // イベントリスナー設定
      this.attachEventListeners();
      
      console.log('[App] UI initialized');
    }
  
    /**
     * Lottieアニメーション初期化
     */
    initLottieAnimation() {
      const container = document.getElementById('lottie-animation');
      
      if (container) {
        this.lottieAnimation = lottie.loadAnimation({
          container: container,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: FRONTEND_CONFIG.LOTTIE.LOADING_DOG
        });
      }
    }
  
    /**
     * イベントリスナー設定
     */
    attachEventListeners() {
      // 次へボタン
      const nextBtn = document.getElementById('btn-next');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => this.handleNext());
      }
      
      // 戻るボタン
      const backBtn = document.getElementById('btn-back');
      if (backBtn) {
        backBtn.addEventListener('click', () => this.handleBack());
      }
      
      // 予約確定ボタン
      const confirmBtn = document.getElementById('btn-confirm');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => this.handleConfirm());
      }
    }
  
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ステップ管理
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
    /**
     * ステップ表示
     * @param {number} step - 表示するステップ番号
     */
    showStep(step) {
      this.currentStep = step;
      
      // 全ステップ非表示
      for (let i = 1; i <= this.totalSteps; i++) {
        const stepElement = document.getElementById(`step-${i}`);
        if (stepElement) {
          stepElement.classList.add('hidden');
        }
      }
      
      // 指定ステップ表示
      const currentStepElement = document.getElementById(`step-${step}`);
      if (currentStepElement) {
        currentStepElement.classList.remove('hidden');
      }
      
      // ステップインジケーター更新
      this.updateStepIndicator();
      
      // ボタン表示制御
      this.updateButtons();
      
      // ステップ別の初期化処理
      switch (step) {
        case 1:
          this.renderDogSelection();
          break;
        case 2:
          this.renderDateTimeSelection();
          break;
        case 3:
          this.renderProductSelection();
          break;
        case 4:
          this.renderConfirmation();
          break;
      }
      
      // ページトップにスクロール
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  
    /**
     * ステップインジケーター更新
     */
    updateStepIndicator() {
      for (let i = 1; i <= this.totalSteps; i++) {
        const stepIndicator = document.querySelector(`.step[data-step="${i}"]`);
        
        if (stepIndicator) {
          stepIndicator.classList.remove('active', 'completed');
          
          if (i < this.currentStep) {
            stepIndicator.classList.add('completed');
          } else if (i === this.currentStep) {
            stepIndicator.classList.add('active');
          }
        }
      }
    }
  
    /**
     * ボタン表示制御
     */
    updateButtons() {
      const backBtn = document.getElementById('btn-back');
      const nextBtn = document.getElementById('btn-next');
      const confirmBtn = document.getElementById('btn-confirm');
      
      // 戻るボタン
      if (backBtn) {
        backBtn.classList.toggle('hidden', this.currentStep === 1);
      }
      
      // 次へボタン
      if (nextBtn) {
        nextBtn.classList.toggle('hidden', this.currentStep === this.totalSteps);
      }
      
      // 確定ボタン
      if (confirmBtn) {
        confirmBtn.classList.toggle('hidden', this.currentStep !== this.totalSteps);
      }
    }
  
    /**
     * 次へボタンハンドラ
     */
    async handleNext() {
      try {
        // バリデーション
        if (!this.validateCurrentStep()) {
          return;
        }
        
        // ステップ2（日時選択）→ステップ3（商品選択）の場合、予約枠をロック
        if (this.currentStep === 2) {
          await this.lockReservationSlot();
        }
        
        // 次のステップへ
        this.showStep(this.currentStep + 1);
        
      } catch (error) {
        console.error('[App] Failed to proceed to next step:', error);
        this.showError(error.message);
      }
    }
  
    /**
     * 戻るボタンハンドラ
     */
    handleBack() {
      if (this.currentStep > 1) {
        this.showStep(this.currentStep - 1);
      }
    }
  
    /**
     * 現在のステップのバリデーション
     */
    validateCurrentStep() {
      switch (this.currentStep) {
        case 1:
          if (!this.selectedDog) {
            this.showError('犬を選択してください。');
            return false;
          }
          return true;
          
        case 2:
          if (!this.selectedDate || !this.selectedTime) {
            this.showError('日時を選択してください。');
            return false;
          }
          return true;
          
        case 3:
          if (!this.selectedProduct) {
            this.showError('商品を選択してください。');
            return false;
          }
          return true;
          
        default:
          return true;
      }
    }
  
    /**
     * 予約枠ロック
     */
    async lockReservationSlot() {
      try {
        this.showLoading('予約枠を確保中...');
        
        const slotData = {
          trainerId: 'default-trainer', // TODO: トレーナー選択機能追加時に変更
          date: this.selectedDate,
          time: this.selectedTime,
          customerId: this.customerData.customer_id,
          dogId: this.selectedDog.dog_id
        };
        
        const response = await apiClient.lockSlot(slotData);
        this.lockId = response.lockId;
        
        this.hideLoading();
        this.showSuccess(FRONTEND_CONFIG.SUCCESS_MESSAGES.SLOT_LOCKED);
        
      } catch (error) {
        this.hideLoading();
        throw error;
      }
    }
  
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ローディング・通知
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
    /**
     * ローディング表示
     * @param {string} message - 表示メッセージ
     */
    showLoading(message = '読み込み中...') {
      if (this.loadingOverlay) {
        const loadingText = this.loadingOverlay.querySelector('.loading-text');
        if (loadingText) {
          loadingText.textContent = message;
        }
        this.loadingOverlay.classList.remove('hidden');
      }
    }
  
    /**
     * ローディング非表示
     */
    hideLoading() {
      if (this.loadingOverlay) {
        this.loadingOverlay.classList.add('hidden');
      }
    }
  
    /**
     * エラーメッセージ表示
     * @param {string} message - エラーメッセージ
     */
    showError(message) {
      this.showToast(message, 'error');
    }
  
    /**
     * 成功メッセージ表示
     * @param {string} message - 成功メッセージ
     */
    showSuccess(message) {
      this.showToast(message, 'success');
    }
  
    /**
     * トースト表示
     * @param {string} message - メッセージ
     * @param {string} type - タイプ（success/error/info）
     */
    showToast(message, type = 'info') {
      // 既存のトーストを削除
      const existingToast = document.querySelector('.toast');
      if (existingToast) {
        existingToast.remove();
      }
      
      // 新しいトースト作成
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      
      document.body.appendChild(toast);
      
      // 自動削除
      setTimeout(() => {
        toast.remove();
      }, FRONTEND_CONFIG.UI.TOAST_DURATION);
    }
  
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ステップ1: 犬選択
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
    /**
     * 犬選択画面レンダリング
     */
    renderDogSelection() {
      const container = document.getElementById('dog-list');
      if (!container) return;
      
      container.innerHTML = '';
      
      this.dogs.forEach(dog => {
        const card = this.createDogCard(dog);
        container.appendChild(card);
      });
    }
  
    /**
     * 犬カード作成
     */
    createDogCard(dog) {
      const card = document.createElement('div');
      card.className = 'dog-card';
      
      if (this.selectedDog && this.selectedDog.dog_id === dog.dog_id) {
        card.classList.add('selected');
      }
      
      card.innerHTML = `
        <div class="dog-avatar">🐕</div>
        <div class="dog-info">
          <div class="dog-name">${dog.dog_name}</div>
          <div class="dog-details">${dog.breed} / ${dog.age}歳 / ${dog.gender === 'male' ? 'オス' : 'メス'}</div>
        </div>
      `;
      
      card.addEventListener('click', () => {
        this.selectDog(dog);
      });
      
      return card;
    }
  
    /**
     * 犬選択
     */
    selectDog(dog) {
      this.selectedDog = dog;
      this.renderDogSelection();
      
      console.log('[App] Dog selected:', dog);
    }
  }
  
  // グローバルインスタンス
  const app = new ReservationApp();
  
  // DOMContentLoaded時に初期化
  document.addEventListener('DOMContentLoaded', () => {
    app.init();
  });