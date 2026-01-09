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
        const lockData = {
            userId: this.customerData.line_user_id,  // ← 追加
            trainerId: this.selectedTrainer?.trainer_id || 'default-trainer',
            officeId: this.selectedOffice?.office_id || 'default-office',
            date: this.selectedDate,
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
  /**
   * ============================================================================
   * K9 Harmony - Reservation Steps (Part 2)
   * ============================================================================
   * 予約画面のステップ2-4処理
   * 最終更新: 2026-01-08
   */
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ステップ2: 日時選択
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  ReservationApp.prototype.renderDateTimeSelection = function() {
    this.renderCalendar();
  };
  
  /**
   * カレンダーレンダリング
   */
  ReservationApp.prototype.renderCalendar = function() {
    const container = document.getElementById('calendar-dates');
    if (!container) return;
    
    const today = new Date();
    const currentMonth = this.calendarMonth || today.getMonth();
    const currentYear = this.calendarYear || today.getFullYear();
    
    // 月表示更新
    const monthLabel = document.getElementById('calendar-month');
    if (monthLabel) {
      const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
      monthLabel.textContent = `${currentYear}年 ${monthNames[currentMonth]}`;
    }
    
    // カレンダー生成
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const prevLastDay = new Date(currentYear, currentMonth, 0);
    
    const firstDayOfWeek = firstDay.getDay();
    const lastDate = lastDay.getDate();
    const prevLastDate = prevLastDay.getDate();
    
    container.innerHTML = '';
    
    // 前月の日付
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = prevLastDate - i;
      const dateElement = this.createDateElement(date, 'other-month');
      container.appendChild(dateElement);
    }
    
    // 当月の日付
    for (let date = 1; date <= lastDate; date++) {
      const dateObj = new Date(currentYear, currentMonth, date);
      const isToday = dateObj.toDateString() === today.toDateString();
      const isPast = dateObj < today && !isToday;
      const isFuture = dateObj > new Date(today.getTime() + FRONTEND_CONFIG.UI.MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000);
      
      let className = '';
      if (isToday) className = 'today';
      if (isPast || isFuture) className += ' disabled';
      
      const dateElement = this.createDateElement(date, className, dateObj);
      container.appendChild(dateElement);
    }
    
    // 次月の日付（6週分まで埋める）
    const totalCells = container.children.length;
    const remainingCells = 42 - totalCells; // 6週 × 7日
    
    for (let date = 1; date <= remainingCells; date++) {
      const dateElement = this.createDateElement(date, 'other-month');
      container.appendChild(dateElement);
    }
    
    // ナビゲーションボタンイベント
    this.attachCalendarNav();
  };
  
  /**
   * 日付要素作成
   */
  ReservationApp.prototype.createDateElement = function(date, className = '', dateObj = null) {
    const element = document.createElement('div');
    element.className = `calendar-date ${className}`;
    element.textContent = date;
    
    if (dateObj && !className.includes('disabled') && !className.includes('other-month')) {
      element.addEventListener('click', () => {
        this.selectDate(dateObj);
      });
      
      // 選択中の日付をハイライト
      if (this.selectedDate && this.selectedDate === dateObj.toISOString().split('T')[0]) {
        element.classList.add('selected');
      }
    }
    
    return element;
  };
  
  /**
   * カレンダーナビゲーション
   */
  ReservationApp.prototype.attachCalendarNav = function() {
    const prevBtn = document.getElementById('calendar-prev');
    const nextBtn = document.getElementById('calendar-next');
    
    if (prevBtn) {
      prevBtn.onclick = () => {
        this.changeMonth(-1);
      };
    }
    
    if (nextBtn) {
      nextBtn.onclick = () => {
        this.changeMonth(1);
      };
    }
  };
  
  /**
   * 月変更
   */
  ReservationApp.prototype.changeMonth = function(delta) {
    const today = new Date();
    const currentMonth = this.calendarMonth || today.getMonth();
    const currentYear = this.calendarYear || today.getFullYear();
    
    const newDate = new Date(currentYear, currentMonth + delta, 1);
    
    this.calendarMonth = newDate.getMonth();
    this.calendarYear = newDate.getFullYear();
    
    this.renderCalendar();
  };
  
  /**
   * 日付選択
   */
  ReservationApp.prototype.selectDate = async function(dateObj) {
    try {
      this.selectedDate = dateObj.toISOString().split('T')[0];
      this.selectedTime = null; // 時間選択をリセット
      
      this.renderCalendar();
      
      // 空き枠取得
      await this.loadAvailableSlots();
      
      // 時間選択表示
      this.renderTimeSlots();
      
      console.log('[App] Date selected:', this.selectedDate);
      
    } catch (error) {
      console.error('[App] Failed to select date:', error);
      this.showError(error.message);
    }
  };
  
  /**
   * 空き枠取得
   */
  ReservationApp.prototype.loadAvailableSlots = async function() {
    try {
      this.showLoading('空き枠を確認中...');
      
      const response = await apiClient.getAvailableSlots('default-trainer', this.selectedDate);
      this.availableSlots = response.slots || [];
      
      this.hideLoading();
      
    } catch (error) {
      this.hideLoading();
      throw error;
    }
  };
  
  /**
   * 時間スロットレンダリング
   */
  ReservationApp.prototype.renderTimeSlots = function() {
    const container = document.getElementById('time-slots');
    if (!container) return;
    
    container.innerHTML = '';
    
    // 営業時間内の時間スロットを生成
    const start = FRONTEND_CONFIG.UI.BUSINESS_HOURS.START;
    const end = FRONTEND_CONFIG.UI.BUSINESS_HOURS.END;
    
    for (let hour = start; hour < end; hour++) {
      const timeStr = `${hour.toString().padStart(2, '0')}:00`;
      const isAvailable = this.availableSlots.includes(timeStr);
      
      const slot = document.createElement('div');
      slot.className = `time-slot${isAvailable ? '' : ' disabled'}`;
      slot.textContent = timeStr;
      
      if (this.selectedTime === timeStr) {
        slot.classList.add('selected');
      }
      
      if (isAvailable) {
        slot.addEventListener('click', () => {
          this.selectTime(timeStr);
        });
      }
      
      container.appendChild(slot);
    }
  };
  
  /**
   * 時間選択
   */
  ReservationApp.prototype.selectTime = function(time) {
    this.selectedTime = time;
    this.renderTimeSlots();
    
    console.log('[App] Time selected:', time);
  };
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ステップ3: 商品選択
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  ReservationApp.prototype.renderProductSelection = function() {
    const container = document.getElementById('product-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    this.products.forEach(product => {
      const card = this.createProductCard(product);
      container.appendChild(card);
    });
  };
  
  /**
   * 商品カード作成
   */
  ReservationApp.prototype.createProductCard = function(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    if (this.selectedProduct && this.selectedProduct.product_id === product.product_id) {
      card.classList.add('selected');
    }
    
    const price = Number(product.price).toLocaleString('ja-JP');
    const tax = Number(product.tax_included_price - product.price).toLocaleString('ja-JP');
    const total = Number(product.tax_included_price).toLocaleString('ja-JP');
    
    card.innerHTML = `
      <div class="product-header">
        <div class="product-name">${product.product_name}</div>
        <div class="product-price">
          ¥${total}
          <span class="product-price-unit">(税込)</span>
        </div>
      </div>
      <div class="product-description">${product.description || ''}</div>
      <div class="product-duration">
        ⏱️ ${product.duration}分
      </div>
    `;
    
    card.addEventListener('click', () => {
      this.selectProduct(product);
    });
    
    return card;
  };
  
  /**
   * 商品選択
   */
  ReservationApp.prototype.selectProduct = function(product) {
    this.selectedProduct = product;
    this.renderProductSelection();
    
    console.log('[App] Product selected:', product);
  };
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ステップ4: 確認・決済
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  ReservationApp.prototype.renderConfirmation = async function() {
    // 確認情報表示
    this.renderConfirmationDetails();
    
    // Square決済フォーム初期化
    await this.initSquareCardForm();
  };
  
  /**
   * 確認情報表示
   */
  ReservationApp.prototype.renderConfirmationDetails = function() {
    // 犬情報
    document.getElementById('confirm-dog').textContent = this.selectedDog.dog_name;
    
    // 日時情報
    const dateStr = new Date(this.selectedDate).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
    document.getElementById('confirm-datetime').textContent = `${dateStr} ${this.selectedTime}`;
    
    // 商品情報
    document.getElementById('confirm-product').textContent = this.selectedProduct.product_name;
    
    // 料金サマリー
    const price = Number(this.selectedProduct.price);
    const tax = Number(this.selectedProduct.tax_included_price - this.selectedProduct.price);
    const total = Number(this.selectedProduct.tax_included_price);
    
    document.getElementById('summary-price').textContent = `¥${price.toLocaleString('ja-JP')}`;
    document.getElementById('summary-tax').textContent = `¥${tax.toLocaleString('ja-JP')}`;
    document.getElementById('summary-total').textContent = `¥${total.toLocaleString('ja-JP')}`;
  };
  
  /**
   * Square決済フォーム初期化
   */
  ReservationApp.prototype.initSquareCardForm = async function() {
    try {
      if (this.card) {
        await this.card.destroy();
      }
      
      this.card = await this.payments.card();
      await this.card.attach('#card-container');
      
      console.log('[Square] Card form initialized');
      
    } catch (error) {
      console.error('[Square] Failed to initialize card form:', error);
      this.showError('決済フォームの初期化に失敗しました。');
    }
  };
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