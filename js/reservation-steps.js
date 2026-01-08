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