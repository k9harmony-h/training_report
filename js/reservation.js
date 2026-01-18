/**
 * ============================================================================
 * K9 Harmony - Reservation App
 * ============================================================================
 * 予約システムのメインロジック
 * 最終更新: 2026-01-18 00:05
 * バージョン: v2.0.0
 */

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   グローバル変数・状態管理
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

   const AppState = {
    // ユーザー情報
    lineUserId: null,
    userData: null,
    userDogs: [],
    
    // 選択情報
    selectedDog: null,
    selectedTrainer: null,
    selectedMenu: null,
    selectedDate: null,
    selectedTime: null,
    isMultiDog: false,
    
    // 別住所
    useAltAddress: false,
    altAddress: null,
    
    // 料金情報
    lessonPrice: 0,
    travelFee: 0,
    voucherDiscount: 0,
    totalPrice: 0,
    voucherData: null,
    
    // その他
    trainers: [],
    products: [],
    calendarCache: new Map(),
    currentMonth: new Date(),
    currentView: 1,
    
    // Square
    squareCard: null,
    paymentToken: null
  };
  
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     初期化処理
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  
  /**
   * アプリケーション起動
   */
  window.onload = async () => {
    debugLog('🚀 App Start', 'info');
    
    try {
      // ローディングTips開始
      startLoadingTips();
      
      // Priority 1: LIFF初期化
      debugLog('📱 Priority 1: LIFF初期化', 'info');
      await initializeLiff();
      
      // Priority 2: 必須データ読み込み
      debugLog('📊 Priority 2: 必須データ読み込み', 'info');
      await loadEssentialData();
      
      // 画面表示
      hideLoading();
      goToView(1);
      
      // Priority 3: カレンダーデータ（当月）
      debugLog('📅 Priority 3: 当月カレンダー読み込み', 'info');
      loadCalendarData(0);
      
      // Priority 4: 事前読み込み
      prefetchData();
      
    } catch (error) {
      debugLog(`❌ 初期化エラー: ${error.message}`, 'error');
      showError('アプリケーションの起動に失敗しました。ページを再読み込みしてください。');
    }
  };
  
  /**
   * LIFF初期化
   */
  async function loadEssentialData() {
    try {
      const startTime = performance.now();
      
      // 並列読み込みで高速化
      const [customerData, productsData] = await Promise.all([
        apiCall('GET', { type: 'data', userId: AppState.lineUserId }),
        apiCall('GET', { type: 'products' })
      ]);
      
      // ===== 商品データの構造を詳細確認 =====
      debugLog('🔍 ===== 商品データ詳細確認 =====', 'info');
      debugLog(`🔍 productsData 全体: ${JSON.stringify(productsData)}`, 'info');
      debugLog(`🔍 productsData.products: ${JSON.stringify(productsData.products)}`, 'info');
      
      if (productsData.products && productsData.products.length > 0) {
        debugLog(`🔍 最初の商品の全フィールド:`, 'info');
        const firstProduct = productsData.products[0];
        for (let key in firstProduct) {
          debugLog(`  - ${key}: ${firstProduct[key]}`, 'info');
        }
      }
      debugLog('🔍 ===== 確認終了 =====', 'info');
      
      // 顧客データ処理（データの保存のみ）
      if (customerData && customerData.customer) {
        AppState.userData = customerData.customer;
        AppState.userDogs = customerData.dogs || [];
        debugLog(`✅ 既存顧客: ${AppState.userData.name}`, 'success');
      } else {
        debugLog('📝 新規顧客', 'info');
      }
      
      // 商品データ処理（データの保存のみ）
      AppState.products = productsData.products || [];
      
      const endTime = performance.now();
      debugLog(`✅ データ読み込み完了 (${Math.round(endTime - startTime)}ms)`, 'success');
      
    } catch (error) {
      debugLog(`❌ データ読み込みエラー: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * カレンダーデータ読み込み（Priority 3）
   * @param {number} monthOffset - 月のオフセット（0=当月, 1=翌月, -1=前月）
   */
  async function loadCalendarData(monthOffset) {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + monthOffset);
    
    const monthKey = `${targetDate.getFullYear()}-${targetDate.getMonth() + 1}`;
    
    // キャッシュチェック
    if (AppState.calendarCache.has(monthKey)) {
      const cached = AppState.calendarCache.get(monthKey);
      const now = Date.now();
      
      if (now - cached.timestamp < CONFIG.UI.CALENDAR.CACHE_DURATION) {
        debugLog(`📅 カレンダーキャッシュ使用: ${monthKey}`, 'info');
        return cached.data;
      }
    }
    
    try {
      debugLog(`📅 カレンダーデータ取得: ${monthKey}`, 'info');
      
      const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const data = await apiCall('POST', {
        action: 'get_month_availability',
        startDate: startDate.toISOString().split('T')[0],
        menuDuration: 90 // TODO: 選択されたメニューの時間を使用
      });
      
      // キャッシュに保存
      AppState.calendarCache.set(monthKey, {
        data: data.availability || {},
        timestamp: Date.now()
      });
      
      debugLog(`✅ カレンダーデータ取得完了: ${monthKey}`, 'success');
      return data.availability || {};
      
    } catch (error) {
      debugLog(`❌ カレンダーデータ取得エラー: ${error.message}`, 'error');
      return {};
    }
  }
  
  /**
   * 事前読み込み（Priority 4）
   */
  function prefetchData() {
    // 翌月・翌々月のカレンダーをバックグラウンドで読み込み
    setTimeout(() => loadCalendarData(1), 2000);  // 翌月
    setTimeout(() => loadCalendarData(2), 4000);  // 翌々月
    
    debugLog('📦 事前読み込み開始（翌月・翌々月）', 'info');
  }
  
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     View切り替え
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  
  /**
   * View切り替え
   * @param {number} viewNumber - 表示するViewの番号（1-5）
   */
  function goToView(viewNumber) {
    debugLog(`🔄 View切り替え: ${AppState.currentView} → ${viewNumber}`, 'info');
    
    // 全Viewを非表示
    document.querySelectorAll('.view-section').forEach(el => {
      el.classList.remove('active');
    });
    
    // 指定Viewを表示
    const targetView = document.getElementById(`view-${viewNumber}`);
    if (targetView) {
      targetView.classList.add('active');
    }
    
    // プログレスバー更新
    updateProgressBar(viewNumber);
    
    // View固有の初期化処理
    initializeView(viewNumber);
    
    // 状態更新
    AppState.currentView = viewNumber;
    
    // トップへスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  /**
   * プログレスバー更新
   * @param {number} step - 現在のステップ（1-5）
   */
  function updateProgressBar(step) {
    const percentage = ((step - 1) / 4) * 100;
    document.getElementById('progress-fill').style.width = `${percentage}%`;
    
    for (let i = 1; i <= 5; i++) {
      const dot = document.getElementById(`dot-${i}`);
      dot.classList.remove('active', 'done');
      
      if (i < step) {
        dot.classList.add('done');
      } else if (i === step) {
        dot.classList.add('active');
      }
    }
  }
  
  /**
   * View固有の初期化処理
   * @param {number} viewNumber - Viewの番号
   */
  function initializeView(viewNumber) {
    switch (viewNumber) {
      case 1:
        initializeView1();
        break;
      case 2:
        initializeView2();
        break;
      case 3:
        initializeView3();
        break;
      case 4:
        initializeView4();
        break;
      case 5:
        initializeView5();
        break;
    }
  }
  
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     View 1: 犬・コース・トレーナー選択
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  
     function initializeView1() {
      debugLog('📋 View 1 初期化', 'info');
      
      try {
        // ===== Step 1: メニュー選択欄をレンダリング =====
        debugLog('📋 Step 1: renderMenuSelect() 開始', 'info');
        renderMenuSelect();
        debugLog('✅ Step 1: renderMenuSelect() 完了', 'success');
        
        // ===== Step 2: イベントリスナー登録 =====
        debugLog('📋 Step 2: イベントリスナー登録開始', 'info');
        
        // 複数頭チェックボックス
        const multiDogCheck = document.getElementById('multi-dog-check');
        if (multiDogCheck) {
          multiDogCheck.removeEventListener('change', handleMultiDogChange); // 重複防止
          multiDogCheck.addEventListener('change', handleMultiDogChange);
          debugLog('✅ 複数頭チェックボックス: イベント登録完了', 'success');
        }
        
        // トレーナー選択
        const trainerSelect = document.getElementById('trainer-select');
        if (trainerSelect) {
          trainerSelect.removeEventListener('change', handleTrainerChange);
          trainerSelect.addEventListener('change', handleTrainerChange);
          debugLog('✅ トレーナー選択: イベント登録完了', 'success');
        }
        
        // メニュー選択
        const menuSelect = document.getElementById('menu-select');
        if (menuSelect) {
          menuSelect.removeEventListener('change', handleMenuChange);
          menuSelect.addEventListener('change', handleMenuChange);
          debugLog('✅ メニュー選択: イベント登録完了', 'success');
          
          // 初期値を手動で設定
          if (menuSelect.options.length > 0) {
            const selectedOption = menuSelect.options[menuSelect.selectedIndex];
            AppState.selectedMenu = {
              duration: parseInt(menuSelect.value),
              price: parseInt(selectedOption.getAttribute('data-price')),
              name: selectedOption.text
            };
            debugLog(`✅ 初期メニュー設定: ${AppState.selectedMenu.name}`, 'success');
          }
        }
        
        debugLog('✅ Step 2: イベントリスナー登録完了', 'success');
        
        // ===== Step 3: ユーザータイプ別の処理 =====
        debugLog('📋 Step 3: ユーザータイプ確認', 'info');
        debugLog(`🔍 AppState.userData: ${AppState.userData ? 'あり' : 'なし'}`, 'info');
        debugLog(`🔍 AppState.userDogs.length: ${AppState.userDogs.length}`, 'info');
        
        if (AppState.userData) {
          // 既存顧客の場合
          debugLog('👤 既存顧客として処理', 'info');
          
          if (AppState.userDogs.length === 1) {
            debugLog('🐕 犬1頭のため自動選択', 'info');
            selectDog(0);
          } else if (AppState.userDogs.length > 1) {
            debugLog('🐕 複数頭のため手動選択待ち', 'info');
            document.getElementById('selected-dog-name').textContent = '---';
          } else {
            debugLog('⚠️ 犬データなし', 'warn');
            document.getElementById('selected-dog-name').textContent = '犬情報なし';
          }
          
        } else {
          // 新規顧客の場合
          debugLog('🆕 新規顧客として処理', 'info');
          document.getElementById('selected-dog-name').textContent = 'ご新規のお客様';
          document.getElementById('btn-change-dog').style.display = 'none';
          document.getElementById('existing-customer-link-area').classList.remove('hidden');
        }
        
        debugLog('✅ Step 3: ユーザー処理完了', 'success');
        
        // ===== Step 4: バリデーション =====
        debugLog('📋 Step 4: バリデーション実行', 'info');
        validateView1();
        debugLog('✅ Step 4: バリデーション完了', 'success');
        
        debugLog('✅ View 1 初期化完了', 'success');
        
      } catch (error) {
        debugLog(`❌ View 1 初期化エラー: ${error.message}`, 'error');
        console.error('initializeView1 Error:', error);
      }
    }
    
    // イベントハンドラー（グローバルに定義）
    function handleMultiDogChange(e) {
      AppState.isMultiDog = e.target.checked;
      debugLog(`🐕 複数頭: ${AppState.isMultiDog}`, 'info');
      validateView1();
    }
    
    function handleTrainerChange(e) {
      AppState.selectedTrainer = e.target.value;
      debugLog(`👨‍🏫 トレーナー: ${AppState.selectedTrainer}`, 'info');
    }
    
    function handleMenuChange(e) {
      const selectedOption = e.target.options[e.target.selectedIndex];
      AppState.selectedMenu = {
        duration: parseInt(e.target.value),
        price: parseInt(selectedOption.getAttribute('data-price')),
        name: selectedOption.text
      };
      debugLog(`📋 メニュー選択: ${AppState.selectedMenu.name} (¥${AppState.selectedMenu.price})`, 'info');
      validateView1();
    }
  
  /**
   * メニュー選択欄のレンダリング
   */
  function renderMenuSelect() {
    debugLog('📋 renderMenuSelect() 開始', 'info');
    debugLog(`🔍 AppState.products.length: ${AppState.products.length}`, 'info');
    
    const select = document.getElementById('menu-select');
    if (!select) {
      debugLog('❌ menu-select要素が見つかりません', 'error');
      return;
    }
    
    select.innerHTML = '';
    
    if (AppState.products.length > 0) {
      debugLog('📦 商品データからメニュー生成', 'info');
      
      AppState.products.forEach((product, index) => {
        debugLog(`🔍 商品${index}: ${product.name}, カテゴリ: ${product.category}`, 'info');
        
        if (product.category === 'トレーニング') {
          const option = document.createElement('option');
          option.value = 90; // TODO: product.duration
          option.setAttribute('data-price', product.price);
          option.textContent = `${product.name} (¥${product.price.toLocaleString()})`;
          select.appendChild(option);
          debugLog(`✅ メニュー追加: ${product.name}`, 'success');
        }
      });
      
    } else {
      debugLog('⚠️ 商品データなし - デフォルトメニュー使用', 'warn');
      
      const option = document.createElement('option');
      option.value = 90;
      option.setAttribute('data-price', 4900);
      option.textContent = '単発レッスン (¥4,900)';
      select.appendChild(option);
    }
    
    debugLog(`✅ renderMenuSelect() 完了 (options: ${select.options.length})`, 'success');
  }
  
  /**
   * 犬を選択
   * @param {number} index - 犬のインデックス
   */
  function selectDog(index) {
    debugLog(`🐕 selectDog(${index}) 開始`, 'info');
    debugLog(`🔍 AppState.userDogs.length: ${AppState.userDogs.length}`, 'info');
    
    if (index < 0 || index >= AppState.userDogs.length) {
      debugLog(`❌ 無効なインデックス: ${index}`, 'error');
      return;
    }
    
    AppState.selectedDog = AppState.userDogs[index];
    debugLog(`🔍 selectedDog: ${JSON.stringify(AppState.selectedDog)}`, 'info');
    
    const element = document.getElementById('selected-dog-name');
    if (!element) {
      debugLog('❌ selected-dog-name要素が見つかりません', 'error');
      return;
    }
    
    const dogName = AppState.selectedDog.name_disp || AppState.selectedDog.name || AppState.selectedDog.dog_name;
    element.textContent = dogName;
    
    debugLog(`✅ 犬選択完了: ${dogName}`, 'success');
    validateView1();
  }
  
  /**
   * View 1のバリデーション
   */
  function validateView1() {
    const isValid = AppState.selectedDog && AppState.selectedMenu;
    document.getElementById('btn-next-view2').disabled = !isValid;
  }
  
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     View 2: 月間カレンダー・日時選択
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  
  function initializeView2() {
    debugLog('📅 View 2 初期化', 'info');
    renderCalendar();
    
    // 別住所チェックボックス
    document.getElementById('alt-address-check').addEventListener('change', (e) => {
      AppState.useAltAddress = e.target.checked;
    });
  }
  
  /**
   * 月間カレンダーのレンダリング
   */
  async function renderCalendar() {
    const year = AppState.currentMonth.getFullYear();
    const month = AppState.currentMonth.getMonth();
    
    // ヘッダー更新
    document.getElementById('calendar-month-label').textContent = 
      `${year}年 ${month + 1}月`;
    
    // カレンダーデータ取得
    const monthKey = `${year}-${month + 1}`;
    let availability = {};
    
    if (AppState.calendarCache.has(monthKey)) {
      availability = AppState.calendarCache.get(monthKey).data;
    } else {
      showCalendarLoader();
      availability = await loadCalendarData(0);
      hideCalendarLoader();
    }
    
    // カレンダーグリッド生成
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    // ヘッダー（曜日）
    const dayHeaders = ['日', '月', '火', '水', '木', '金', '土'];
    const headerRow = document.createElement('div');
    headerRow.className = 'calendar-header';
    
    dayHeaders.forEach((day, index) => {
      const header = document.createElement('div');
      header.className = 'calendar-day-header';
      if (index === 0) header.classList.add('sunday');
      if (index === 6) header.classList.add('saturday');
      header.textContent = day;
      grid.appendChild(header);
    });
    
    // 日付セル生成
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    // 前月の余白
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      addCalendarDay(grid, day, true, null, false);
    }
    
    // 当月の日付
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = date.getDay();
      const isToday = isSameDay(date, new Date());
      const slots = availability[dateStr] || [];
      
      addCalendarDay(grid, day, false, dateStr, isToday, dayOfWeek, slots);
    }
    
    // 次月の余白
    const totalCells = startDayOfWeek + daysInMonth;
    const remainingCells = 42 - totalCells; // 6週間分
    for (let day = 1; day <= remainingCells; day++) {
      addCalendarDay(grid, day, true, null, false);
    }
  }
  
  /**
   * カレンダー日付セルを追加
   */
  function addCalendarDay(grid, dayNumber, isOtherMonth, dateStr, isToday, dayOfWeek, slots = []) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    
    if (isOtherMonth) {
      cell.classList.add('calendar-day-other-month');
    }
    if (isToday) {
      cell.classList.add('calendar-day-today');
    }
    if (dayOfWeek === 0) {
      cell.classList.add('sunday');
    }
    if (dayOfWeek === 6) {
      cell.classList.add('saturday');
    }
    
    // 日付番号
    const numberEl = document.createElement('div');
    numberEl.className = 'calendar-day-number';
    numberEl.textContent = dayNumber;
    cell.appendChild(numberEl);
    
    // 空き状況シンボル
    if (!isOtherMonth && slots.length > 0) {
      const symbolEl = document.createElement('div');
      symbolEl.className = 'availability-symbol';
      
      if (slots.length >= 5) {
        symbolEl.classList.add('symbol-available');
        symbolEl.textContent = '●';
      } else if (slots.length >= 2) {
        symbolEl.classList.add('symbol-few');
        symbolEl.textContent = '◐';
      } else {
        symbolEl.classList.add('symbol-full');
        symbolEl.textContent = '○';
      }
      
      cell.appendChild(symbolEl);
      
      // クリックイベント
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => {
        openTimeModal(dateStr, slots);
      });
    }
    
    grid.appendChild(cell);
  }
  
  /**
   * 月をシフト
   * @param {number} offset - 月のオフセット（+1 or -1）
   */
  function shiftMonth(offset) {
    AppState.currentMonth.setMonth(AppState.currentMonth.getMonth() + offset);
    renderCalendar();
  }
  
  /**
   * 日付が同じかチェック
   */
  function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
  
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     View 3: 料金計算・規約確認
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  
  function initializeView3() {
    debugLog('💰 View 3 初期化', 'info');
    
    // 予約内容表示
    renderReservationSummary();
    
    // 料金計算
    calculatePricing();
    
    // キャンセル料表示
    updateCancellationInfo();
    
    // 規約チェックボックスのイベント
    document.querySelectorAll('.term-check').forEach(checkbox => {
      checkbox.addEventListener('change', checkAllTerms);
    });
    
    document.getElementById('chk-all').addEventListener('change', toggleAllTerms);
  }
  
  /**
   * 予約内容サマリーのレンダリング
   */
  function renderReservationSummary() {
    // 日時
    document.getElementById('conf-datetime').textContent = 
      `${AppState.selectedDate} ${AppState.selectedTime}`;
    
    // 場所
    let place = '';
    if (AppState.useAltAddress && AppState.altAddress) {
      place = AppState.altAddress.address;
    } else if (AppState.userData) {
      place = AppState.userData.address || '未登録';
    } else {
      place = '新規登録住所';
    }
    document.getElementById('conf-place').textContent = place;
    
    // 犬名
    let dogName = '';
    if (AppState.selectedDog) {
      dogName = AppState.selectedDog.name_disp || AppState.selectedDog.name;
    } else {
      dogName = '新規登録犬';
    }
    document.getElementById('conf-dog').textContent = dogName;
    
    // コース
    let courseName = AppState.selectedMenu.name;
    if (AppState.isMultiDog) {
      courseName += ' (+2頭目)';
    }
    document.getElementById('conf-course').textContent = courseName;
  }
  
  /**
   * 料金計算
   */
  async function calculatePricing() {
    // レッスン料金
    AppState.lessonPrice = AppState.selectedMenu.price;
    document.getElementById('price-lesson').textContent = 
      `¥${AppState.lessonPrice.toLocaleString()}`;
    
    // 複数頭料金
    const multiDogRow = document.getElementById('price-multi-row');
    if (AppState.isMultiDog) {
      multiDogRow.style.display = '';
    } else {
      multiDogRow.style.display = 'none';
    }
    
    // 小計
    const subtotal = AppState.lessonPrice + (AppState.isMultiDog ? CONFIG.PRICING.MULTI_DOG_FEE : 0);
    document.getElementById('price-subtotal').textContent = `¥${subtotal.toLocaleString()}`;
    
    // 出張費計算
    document.getElementById('price-travel-fee').textContent = '計算中...';
    AppState.travelFee = await calculateTravelFee();
    document.getElementById('price-travel-fee').textContent = 
      AppState.travelFee === 0 ? '無料' : `¥${AppState.travelFee.toLocaleString()}`;
    
    // 合計
    updateTotalPrice();
  }
  
  /**
   * 出張費計算
   */
  async function calculateTravelFee() {
    // 住所取得
    let targetLat, targetLng;
    
    if (AppState.useAltAddress && AppState.altAddress) {
      // 別住所の場合（ジオコーディングが必要）
      // TODO: ジオコーディングAPI実装
      return 1000; // 仮の値
    } else if (AppState.userData && AppState.userData.base_lat) {
      targetLat = AppState.userData.base_lat;
      targetLng = AppState.userData.base_lng;
    } else {
      // 新規ユーザーの場合
      return 0;
    }
    
    // 距離計算
    const distance = CONFIG.calculateDistance(
      CONFIG.OFFICE.LAT,
      CONFIG.OFFICE.LNG,
      targetLat,
      targetLng
    );
    
    // 距離表示
    document.getElementById('travel-km').textContent = distance.toFixed(1);
    
    // 料金計算
    return CONFIG.calculateTravelFee(distance);
  }
  
  /**
   * 合計金額更新
   */
  function updateTotalPrice() {
    const subtotal = AppState.lessonPrice + (AppState.isMultiDog ? CONFIG.PRICING.MULTI_DOG_FEE : 0);
    AppState.totalPrice = subtotal + AppState.travelFee - AppState.voucherDiscount;
    
    if (AppState.totalPrice < 0) AppState.totalPrice = 0;
    
    document.getElementById('price-total').textContent = `¥${AppState.totalPrice.toLocaleString()}`;
  }
  
  /**
   * Voucher適用
   */
  async function applyVoucher() {
    const code = document.getElementById('voucher-code').value.trim();
    if (!code) return;
    
    const resultEl = document.getElementById('voucher-result');
    const discountRow = document.getElementById('price-discount-row');
    
    try {
      resultEl.textContent = '確認中...';
      resultEl.className = 'voucher-result';
      
      const result = await apiCall('GET', {
        type: 'check_voucher',
        code: code,
        userId: AppState.lineUserId || 'GUEST'
      });
      
      if (result.valid) {
        AppState.voucherData = result;
        AppState.voucherDiscount = result.discount_value;
        
        resultEl.textContent = `適用: ${result.name} (-¥${result.discount_value.toLocaleString()})`;
        resultEl.style.color = 'var(--c-main-turquoise)';
        
        discountRow.style.display = '';
        document.getElementById('price-discount').textContent = `-¥${result.discount_value.toLocaleString()}`;
        
        updateTotalPrice();
        debugLog(`✅ Voucher適用: ${result.name}`, 'success');
        
      } else {
        AppState.voucherData = null;
        AppState.voucherDiscount = 0;
        
        resultEl.textContent = result.message || '無効なコードです';
        resultEl.style.color = '#D0021B';
        
        discountRow.style.display = 'none';
        updateTotalPrice();
      }
      
    } catch (error) {
      resultEl.textContent = 'エラーが発生しました';
      resultEl.style.color = '#D0021B';
    }
  }
  
  /**
   * キャンセル料情報更新
   */
  function updateCancellationInfo() {
    if (!AppState.selectedDate) return;
    
    const cancellationInfo = CONFIG.getCancellationRate(AppState.selectedDate);
    
    document.getElementById('days-until-reservation').textContent = cancellationInfo.days;
    document.getElementById('current-cancellation-rate').textContent = cancellationInfo.label;
  }
  
  /**
   * 規約チェック確認
   */
  function checkAllTerms() {
    const allChecks = document.querySelectorAll('.term-check');
    const checkedCount = document.querySelectorAll('.term-check:checked').length;
    const isAllChecked = allChecks.length === checkedCount;
    
    document.getElementById('chk-all').checked = isAllChecked;
    document.getElementById('btn-next-view4').disabled = !isAllChecked;
  }
  
  /**
   * 全規約同意トグル
   */
  function toggleAllTerms() {
    const isChecked = document.getElementById('chk-all').checked;
    document.querySelectorAll('.term-check').forEach(checkbox => {
      checkbox.checked = isChecked;
    });
    checkAllTerms();
  }
  
  /**
   * View4へ遷移（ユーザータイプによって分岐）
   */
  function checkUserAndNext() {
    const paymentMethod = document.getElementById('payment-method').value;
    
    if (AppState.userData) {
      // 既存ユーザー
      if (paymentMethod === 'CARD') {
        showView4Pattern('existing-card');
      } else if (paymentMethod === 'CASH') {
        showView4Pattern('cash');
      } else {
        showView4Pattern('existing-card'); // QUICPay, iD, IC も同様
      }
    } else {
      // 新規ユーザー
      if (paymentMethod === 'CARD') {
        showView4Pattern('new-card');
      } else if (paymentMethod === 'CASH') {
        showView4Pattern('cash');
      }
    }
    
    goToView(4);
  }
  
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     View 4: 決済・情報入力
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  
  function initializeView4() {
    debugLog('💳 View 4 初期化', 'info');
    renderFinalPricing();
  }
  
  /**
   * View 4のパターン表示
   * @param {string} pattern - 'existing-card' | 'new-card' | 'cash'
   */
  function showView4Pattern(pattern) {
    // 全パターンを非表示
    document.querySelectorAll('.view4-pattern').forEach(el => {
      el.classList.remove('active');
    });
    
    // 指定パターンを表示
    document.getElementById(`view4-${pattern}`).classList.add('active');
    
    debugLog(`💳 View 4 パターン: ${pattern}`, 'info');
    
    // Square初期化（カード決済の場合）
    if (pattern === 'existing-card') {
      initializeSquare('square-card-container');
    } else if (pattern === 'new-card') {
      // 新規ユーザーは最初情報入力画面
      document.getElementById('view4-new-info').classList.add('active');
      document.getElementById('view4-new-card-input').classList.remove('active');
    }
  }
  
  /**
   * 新規ユーザー：カードフォーム表示
   */
  function showNewUserCardForm() {
    // TODO: フォームバリデーション
    
    document.getElementById('view4-new-info').classList.remove('active');
    document.getElementById('view4-new-card-input').classList.add('active');
    
    initializeSquare('square-card-container-new');
  }
  
  /**
   * 新規ユーザー：情報入力に戻る
   */
  function backToNewUserInfo() {
    document.getElementById('view4-new-card-input').classList.remove('active');
    document.getElementById('view4-new-info').classList.add('active');
  }
  
  /**
   * 確定料金表示
   */
  function renderFinalPricing() {
    const lessonPrice = AppState.lessonPrice;
    const travelFee = AppState.travelFee;
    const discount = AppState.voucherDiscount;
    const total = AppState.totalPrice;
    
    // 既存ユーザー + カード
    document.getElementById('final-price-lesson').textContent = `¥${lessonPrice.toLocaleString()}`;
    document.getElementById('final-price-travel').textContent = 
      travelFee === 0 ? '無料' : `¥${travelFee.toLocaleString()}`;
    document.getElementById('final-price-total').textContent = `¥${total.toLocaleString()}`;
    
    if (AppState.isMultiDog) {
      document.getElementById('final-price-multi-row').style.display = '';
    }
    
    if (discount > 0) {
      document.getElementById('final-price-discount-row').style.display = '';
      document.getElementById('final-price-discount').textContent = `-¥${discount.toLocaleString()}`;
    }
    
    // 現地決済
    document.getElementById('cash-price-lesson').textContent = `¥${lessonPrice.toLocaleString()}`;
    document.getElementById('cash-price-travel').textContent = 
      travelFee === 0 ? '無料' : `¥${travelFee.toLocaleString()}`;
    document.getElementById('cash-price-total').textContent = `¥${total.toLocaleString()}`;
    
    if (AppState.isMultiDog) {
      document.getElementById('cash-price-multi-row').style.display = '';
    }
    
    if (discount > 0) {
      document.getElementById('cash-price-discount-row').style.display = '';
      document.getElementById('cash-price-discount').textContent = `-¥${discount.toLocaleString()}`;
    }
  }
  
  /**
   * Square初期化
   * @param {string} containerId - コンテナ要素のID
   */
  async function initializeSquare(containerId) {
    try {
      if (!AppState.squareCard) {
        debugLog('💳 Square SDK初期化中...', 'info');
        
        const payments = Square.payments(CONFIG.SQUARE.APP_ID, CONFIG.SQUARE.LOCATION_ID);
        AppState.squareCard = await payments.card();
        
        await AppState.squareCard.attach(`#${containerId}`);
        
        debugLog('✅ Square SDK初期化完了', 'success');
      } else {
        // 既に初期化済みの場合は移動
        const container = document.getElementById(containerId);
        const cardEl = document.querySelector('#square-card-container, #square-card-container-new');
        if (cardEl) {
          container.innerHTML = '';
          container.appendChild(cardEl);
        }
      }
    } catch (error) {
      debugLog(`❌ Square初期化エラー: ${error.message}`, 'error');
      alert('決済システムの初期化に失敗しました。ページを再読み込みしてください。');
    }
  }
  
  /**
   * カードトークン化と決済
   */
  async function handleCardTokenize() {
    if (!AppState.squareCard) {
      alert('決済システムが準備できていません');
      return;
    }
    
    try {
      showLoading('カード情報を確認中...');
      
      const result = await AppState.squareCard.tokenize();
      
      if (result.status === 'OK') {
        AppState.paymentToken = result.token;
        debugLog('✅ カードトークン生成成功', 'success');
        
        // 決済実行
        await executePayment();
        
      } else {
        hideLoading();
        let errorMsg = 'カード情報に誤りがあります';
        if (result.errors) {
          errorMsg += ': ' + result.errors.map(e => e.message).join(', ');
        }
        alert(errorMsg);
      }
      
    } catch (error) {
      hideLoading();
      debugLog(`❌ カード処理エラー: ${error.message}`, 'error');
      alert('カード処理中にエラーが発生しました');
    }
  }
  
  /**
   * 決済実行
   */
  async function executePayment() {
    try {
      showLoading('決済処理中...');
      
      const result = await apiCall('POST', {
        action: 'execute_payment',
        amount: AppState.totalPrice,
        token: AppState.paymentToken,
        note: `K9 Harmony予約 (${AppState.lineUserId})`
      });
      
      if (result.status === 'success') {
        debugLog(`✅ 決済成功: ${result.data.paymentId}`, 'success');
        
        // 予約確定へ
        await submitReservation(true);
        
      } else {
        hideLoading();
        alert(`決済に失敗しました: ${result.message}`);
      }
      
    } catch (error) {
      hideLoading();
      debugLog(`❌ 決済エラー: ${error.message}`, 'error');
      alert('決済処理中にエラーが発生しました');
    }
  }
  
  /**
   * 予約確定（現地決済 or 決済完了後）
   * @param {boolean} isPaid - 決済済みかどうか
   */
  async function submitReservation(isPaid = false) {
    try {
      showLoading('予約を確定中...');
      
      // 新規ユーザーの登録情報
      let regData = null;
      if (!AppState.userData) {
        regData = {
          name: document.getElementById('reg-name').value,
          phone: document.getElementById('reg-phone').value,
          zip: document.getElementById('reg-zip').value,
          address: document.getElementById('reg-addr').value,
          landmark: document.getElementById('reg-landmark').value,
          dogName: document.getElementById('reg-dog-name').value,
          dogBreed: document.getElementById('reg-dog-breed').value,
          dogAge: document.getElementById('reg-dog-age').value,
          neutered: document.getElementById('reg-dog-neutered').checked,
          concerns: document.getElementById('reg-concerns').value,
          remarks: document.getElementById('reg-remarks').value
        };
      }
      
      // 予約データ
      const payload = {
        action: 'add_reservation',
        userId: AppState.userData ? AppState.userData.unique_key : 'NEW_USER',
        lineUserId: AppState.lineUserId,
        date: AppState.selectedDate,
        time: AppState.selectedTime,
        dogId: AppState.selectedDog ? AppState.selectedDog.id : null,
        trainerId: AppState.selectedTrainer,
        menuId: AppState.selectedMenu.id,
        isMultiDog: AppState.isMultiDog,
        useAltAddress: AppState.useAltAddress,
        altAddress: AppState.altAddress,
        voucherCode: AppState.voucherData ? AppState.voucherData.code : null,
        remarks: document.getElementById('conf-remarks').value,
        paymentMethod: document.getElementById('payment-method').value,
        paymentStatus: isPaid ? 'PAID' : 'UNPAID',
        totalPrice: AppState.totalPrice,
        regData: regData
      };
      
      const result = await apiCall('POST', payload);
      
      if (result.status === 'success') {
        debugLog('✅ 予約確定成功', 'success');
        hideLoading();
        goToView(5);
      } else {
        hideLoading();
        alert(`予約の確定に失敗しました: ${result.message}`);
      }
      
    } catch (error) {
      hideLoading();
      debugLog(`❌ 予約確定エラー: ${error.message}`, 'error');
      alert('予約処理中にエラーが発生しました');
    }
  }
  
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     View 5: サンクスページ
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  
  function initializeView5() {
    debugLog('🎉 View 5 初期化', 'info');
    renderThanksPage();
  }
  
  /**
   * サンクスページのレンダリング
   */
  function renderThanksPage() {
    document.getElementById('thanks-datetime').textContent = 
      `${AppState.selectedDate} ${AppState.selectedTime}`;
    
    let place = '';
    if (AppState.useAltAddress && AppState.altAddress) {
      place = AppState.altAddress.address;
    } else if (AppState.userData) {
      place = AppState.userData.address || '未登録';
    } else {
      place = document.getElementById('reg-addr').value;
    }
    document.getElementById('thanks-place').textContent = place;
    
    let dogName = '';
    if (AppState.selectedDog) {
      dogName = AppState.selectedDog.name_disp || AppState.selectedDog.name;
    } else {
      dogName = document.getElementById('reg-dog-name').value;
    }
    document.getElementById('thanks-dog').textContent = dogName;
    
    let courseName = AppState.selectedMenu.name;
    if (AppState.isMultiDog) {
      courseName += ' (+2頭目)';
    }
    document.getElementById('thanks-course').textContent = courseName;
    
    document.getElementById('thanks-total').textContent = `¥${AppState.totalPrice.toLocaleString()}`;
  }
  
  /**
   * LINEでシェア
   */
  async function shareLine() {
    debugLog('📤 LINEシェア開始', 'info');
    
    try {
      // メッセージ組み立て
      const message = buildShareMessage();
      
      // バックエンドPush優先
      try {
        const result = await apiCall('POST', {
          action: 'send_line_msg',
          userId: AppState.lineUserId,
          message: message
        });
        
        if (result.status === 'success') {
          debugLog('✅ バックエンドPush成功', 'success');
          alert('トークルームに送信しました');
          return;
        }
      } catch (error) {
        debugLog(`⚠️ バックエンドPush失敗: ${error.message}`, 'warn');
      }
      
      // フォールバック: LIFF SDK
      if (liff.isInClient()) {
        debugLog('📤 LIFF SDK使用', 'info');
        await liff.sendMessages([{ type: 'text', text: message }]);
        alert('トークルームに送信しました');
      } else {
        // 最終フォールバック: URLスキーム
        debugLog('📤 URLスキーム使用', 'info');
        window.location.href = 'https://line.me/R/msg/text/?' + encodeURIComponent(message);
      }
      
    } catch (error) {
      debugLog(`❌ LINEシェアエラー: ${error.message}`, 'error');
      alert('LINEへの送信中にエラーが発生しました');
    }
  }
  
  /**
   * シェアメッセージ組み立て
   */
  function buildShareMessage() {
    let dogName = '';
    if (AppState.selectedDog) {
      dogName = AppState.selectedDog.name_disp || AppState.selectedDog.name;
    } else {
      dogName = document.getElementById('reg-dog-name').value + 'ちゃん';
    }
    
    let custName = '';
    if (AppState.userData) {
      custName = AppState.userData.name;
    } else {
      custName = document.getElementById('reg-name').value;
    }
    
    let place = document.getElementById('thanks-place').textContent;
    
    // 目印情報追加
    let landmarkInfo = '';
    if (AppState.useAltAddress) {
      const building = document.getElementById('alt-building').value;
      const landmark = document.getElementById('alt-landmark').value;
      if (building) landmarkInfo += ` (${building})`;
      if (landmark) landmarkInfo += ` ※目印: ${landmark}`;
    } else if (!AppState.userData) {
      const landmark = document.getElementById('reg-landmark').value;
      if (landmark) landmarkInfo += ` ※目印: ${landmark}`;
    }
    place += landmarkInfo;
    
    const course = document.getElementById('thanks-course').textContent;
    const travelFee = AppState.travelFee === 0 ? '無料' : `¥${AppState.travelFee.toLocaleString()}`;
    const total = `¥${AppState.totalPrice.toLocaleString()}`;
    const payMethod = document.getElementById('payment-method').options[
      document.getElementById('payment-method').selectedIndex
    ].text;
    
    const voucherInfo = AppState.voucherData ? 
      `・割引: ${AppState.voucherData.name} (-¥${AppState.voucherData.discount_value})\n` : '';
    
    let remarks = document.getElementById('conf-remarks').value;
    if (!AppState.userData) {
      const regRemarks = document.getElementById('reg-remarks').value;
      if (regRemarks) {
        remarks += (remarks ? '\n' : '') + '登録時備考: ' + regRemarks;
      }
    }
    if (!remarks) remarks = '特になし';
    
    return `K9 Harmony 代表の平田でございます。
  この度は、大切なパートナーのトレーニングをお任せいただき、心より感謝申し上げます。
  
  当日は ${dogName}、${custName}様にお目にかかれますことを、楽しみにしております。
  
  ご予約内容を以下の通り承りました。
  
  ◻︎ご予約内容
  ・愛犬名: ${dogName}
  ・日時: ${AppState.selectedDate} ${AppState.selectedTime}
  ・場所: ${place}
  ・コース: ${course}
  ・出張費: ${travelFee}
  ${voucherInfo}・合計: ${total}
  ・お支払: ${payMethod}
  ・備考: ${remarks}
  
  【当日のご準備について】
  ・狂犬病・混合ワクチンの証明書（初回のみ）
  ・大好きなおやつやおもちゃ
  ・首輪とリード（普段お使いのもの）
  
  【日程の変更・キャンセルについて】
  私どもは ${dogName} との時間を大切にするため、万全の準備を整えてお待ちしております。
  もし体調不良や急なご事情で変更が必要な際は、遠慮なくお知らせくださいませ。
  
  ${dogName} の健康と安全を最優先とさせていただきたく存じます。
  恐れ入りますが、以下の規定に基づき調整料を頂戴する場合もございますので、予めご了承ください。
  
  ・4日前まで: 無料
  ・3日前〜2日前: 50%
  ・前日〜当日: 100%
  
  ご不安な点や、事前に伝えておきたいことがございましたら、このLINEにていつでもお申し付けください。
  当日、皆様にお会いできる日を心待ちにしております。`;
  }
  
  /**
   * Googleカレンダーに登録
   */
  function addToGoogleCalendar() {
    const title = 'K9 Harmonyレッスン';
    const date = AppState.selectedDate.replace(/-/g, '');
    const time = AppState.selectedTime.replace(':', '');
    const duration = AppState.selectedMenu.duration + (AppState.isMultiDog ? CONFIG.PRICING.MULTI_DOG_DURATION : 0);
    const endTime = addMinutesToTime(AppState.selectedTime, duration).replace(':', '');
    
    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${date}T${time}00/${date}T${endTime}00`;
    window.open(url, '_blank');
  }
  
  /**
   * ネイティブシェア
   */
  function shareNative() {
    if (navigator.share) {
      navigator.share({
        title: 'K9 Harmony予約完了',
        text: `予約が完了しました\n日時: ${AppState.selectedDate} ${AppState.selectedTime}`,
        url: window.location.href
      }).catch(error => {
        debugLog(`❌ ネイティブシェアエラー: ${error.message}`, 'error');
      });
    } else {
      alert('このブラウザはシェア機能に対応していません');
    }
  }
  
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     モーダル制御
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  
  /**
   * 犬選択モーダル表示
   */
  function showDogSelectModal() {
    const container = document.getElementById('dog-list-container');
    container.innerHTML = '';
    
    AppState.userDogs.forEach((dog, index) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline btn-block';
      btn.textContent = dog.name_disp || dog.name;
      btn.onclick = () => {
        selectDog(index);
        closeDogModal();
      };
      container.appendChild(btn);
    });
    
    openModal('dog-modal-overlay');
  }
  
  function closeDogModal() {
    closeModal('dog-modal-overlay');
  }
  
  /**
   * UIDモーダル表示（新規顧客用）
   */
  function openUidModal() {
    document.getElementById('uid-display').textContent = AppState.lineUserId || '読み込み中...';
    openModal('uid-modal-overlay');
  }
  
  function closeUidModal() {
    closeModal('uid-modal-overlay');
  }
  
  /**
   * UIDをコピー
   */
  function copyUid() {
    const uid = document.getElementById('uid-display').textContent;
    navigator.clipboard.writeText(uid).then(() => {
      alert('IDをコピーしました');
    }).catch(error => {
      debugLog(`❌ コピーエラー: ${error.message}`, 'error');
    });
  }
  
  /**
   * 時間選択モーダル表示
   * @param {string} dateStr - 日付（YYYY-MM-DD）
   * @param {Array} slots - 利用可能な時間スロット
   */
  function openTimeModal(dateStr, slots) {
    const title = document.getElementById('time-modal-title');
    const container = document.getElementById('time-slot-buttons');
    
    title.textContent = `${dateStr} - 時間を選択してください`;
    container.innerHTML = '';
    
    slots.forEach(time => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline btn-block';
      btn.textContent = `${time} 開始`;
      btn.onclick = () => {
        selectTime(dateStr, time);
        closeTimeModal();
      };
      container.appendChild(btn);
    });
    
    openModal('time-modal-overlay');
  }
  
  function closeTimeModal() {
    closeModal('time-modal-overlay');
  }
  
  /**
   * 時間選択
   * @param {string} date - 日付
   * @param {string} time - 時間
   */
  function selectTime(date, time) {
    AppState.selectedDate = date;
    AppState.selectedTime = time;
    
    document.getElementById('btn-next-view3').disabled = false;
    document.getElementById('btn-next-view3').textContent = `${date} ${time}〜 次へ`;
    
    debugLog(`📅 日時選択: ${date} ${time}`, 'info');
  }
  
  /**
   * 規約モーダル表示
   * @param {string} type - 'policy' | 'privacy' | 'terms' | 'law'
   */
  function openTerms(type) {
    const titles = {
      policy: 'キャンセルポリシー',
      privacy: '個人情報の取扱について',
      terms: '利用規約',
      law: '特定商取引法に基づく表記'
    };
    
    const contents = {
      policy: '【キャンセルポリシー】\n\n受付締切: 予約日前日の18:00まで\n\nキャンセル料:\n・4日前まで: 無料\n・3日前〜2日前: レッスン料金の50%\n・前日〜当日: レッスン料金の100%\n\n※天候不良等による中止の場合はキャンセル料は発生しません。',
      privacy: '【個人情報の取扱について】\n\nお客様からお預かりした個人情報は、レッスンの実施および関連サービスの提供のみに使用いたします。\n\n第三者への開示は、法令に基づく場合を除き、お客様の同意なく行うことはございません。',
      terms: '【利用規約】\n\n本サービスをご利用いただく際は、以下の規約に同意いただいたものとみなします。\n\n1. レッスンは予約制です\n2. 時間厳守をお願いします\n3. ワクチン接種証明書が必要です\n4. キャンセルポリシーに従います',
      law: '【特定商取引法に基づく表記】\n\n事業者名: K9 Harmony\n代表者: 平田\n所在地: 〒174-0063 東京都板橋区前野町6-55-1\n電話番号: 070-9043-1109\n\nお支払い方法: クレジットカード、QUICPay、iD、交通系IC、現金\nサービスの提供時期: 予約日時'
    };
    
    document.getElementById('terms-title').textContent = titles[type];
    document.getElementById('terms-content').textContent = contents[type];
    
    document.getElementById('terms-overlay').classList.add('open');
    document.getElementById('terms-sheet').classList.add('open');
  }
  
  function closeTerms() {
    document.getElementById('terms-overlay').classList.remove('open');
    document.getElementById('terms-sheet').classList.remove('open');
  }
  
  /**
   * アコーディオントグル
   * @param {string} id - コンテンツのID
   */
  function toggleAccordion(id) {
    const content = document.getElementById(id);
    const header = content.previousElementSibling;
    
    if (content.classList.contains('open')) {
      content.classList.remove('open');
      header.classList.remove('open');
    } else {
      content.classList.add('open');
      header.classList.add('open');
    }
  }
  
  /**
   * 別住所入力エリアのトグル
   */
  function toggleAltAddress() {
    const area = document.getElementById('alt-address-area');
    const isChecked = document.getElementById('alt-address-check').checked;
    
    if (isChecked) {
      area.classList.remove('hidden');
    } else {
      area.classList.add('hidden');
    }
  }
  
  /**
   * モーダルを開く
   */
  function openModal(overlayId) {
    const overlay = document.getElementById(overlayId);
    overlay.classList.add('open');
    
    const modal = overlay.querySelector('.center-modal, .bottom-modal');
    if (modal) {
      modal.classList.add('open');
    }
  }
  
  /**
   * モーダルを閉じる
   */
  function closeModal(overlayId) {
    const overlay = document.getElementById(overlayId);
    overlay.classList.remove('open');
    
    const modal = overlay.querySelector('.center-modal, .bottom-modal');
    if (modal) {
      modal.classList.remove('open');
    }
  }
  
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ヘルパー関数
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  
  /**
   * API呼び出し
   * @param {string} method - 'GET' | 'POST'
   * @param {Object} params - パラメータ
   */
  async function apiCall(method, params) {
    const startTime = performance.now();
    
    try {
      let url = CONFIG.API.GAS_URL;
      let options = {
        method: method,
        headers: { 'Content-Type': 'application/json' }
      };
      
      if (method === 'GET') {
        const queryString = new URLSearchParams(params).toString();
        url += '?' + queryString;
      } else {
        options.body = JSON.stringify(params);
      }
      
      debugLog(`🌐 API呼び出し: ${method} ${params.action || params.type}`, 'info');
      
      const response = await fetch(url, options);
      const data = await response.json();
      
      const endTime = performance.now();
      debugLog(`✅ API応答 (${Math.round(endTime - startTime)}ms)`, 'success');
      
      return data;
      
    } catch (error) {
      debugLog(`❌ API エラー: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * 郵便番号検索と住所自動入力
   * @param {HTMLInputElement} zipInput - 郵便番号入力欄
   * @param {string} addressInputId - 住所入力欄のID
   */
  async function formatZipAndFetch(zipInput, addressInputId) {
    // フォーマット
    let value = zipInput.value.replace(/\D/g, '');
    if (value.length > 3) {
      value = value.replace(/(\d{3})(\d{0,4})/, '$1-$2');
    }
    zipInput.value = value;
    
    // 7桁揃ったら住所検索
    const cleanZip = value.replace(/-/g, '');
    if (cleanZip.length === 7) {
      try {
        const response = await fetch(`${CONFIG.EXTERNAL.ZIP_CLOUD_API}?zipcode=${cleanZip}`);
        const data = await response.json();
        
        if (data.results) {
          const result = data.results[0];
          const address = result.address1 + result.address2 + result.address3;
          document.getElementById(addressInputId).value = address;
          debugLog(`📮 住所自動入力: ${address}`, 'info');
        }
      } catch (error) {
        debugLog(`⚠️ 郵便番号検索エラー: ${error.message}`, 'warn');
      }
    }
  }
  
  /**
   * 電話番号フォーマット
   */
  function formatPhone(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 10) {
      value = value.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    } else if (value.length > 6) {
      value = value.replace(/(\d{3})(\d{4})/, '$1-$2');
    }
    input.value = value;
  }
  
  /**
   * 時間に分を加算
   * @param {string} time - 時間（HH:MM）
   * @param {number} minutes - 加算する分数
   * @returns {string} 加算後の時間（HH:MM）
   */
  function addMinutesToTime(time, minutes) {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
  }
  
  /**
   * ローディング表示
   * @param {string} text - 表示テキスト
   */
  function showLoading(text = '処理中...') {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').classList.remove('hidden');
  }
  
  /**
   * ローディング非表示
   */
  function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
  }
  
  /**
   * カレンダーローダー表示
   */
  function showCalendarLoader() {
    document.getElementById('calendar-overlay-loader').classList.remove('hidden');
  }
  
  /**
   * カレンダーローダー非表示
   */
  function hideCalendarLoader() {
    document.getElementById('calendar-overlay-loader').classList.add('hidden');
  }
  
  /**
   * エラー表示
   * @param {string} message - エラーメッセージ
   */
  function showError(message) {
    document.getElementById('loading-text').textContent = message;
    document.getElementById('loading-text').style.color = '#D0021B';
  }
  
  /**
   * ローディングTips開始
   */
  function startLoadingTips() {
    const tips = CONFIG.UI.LOADING_TIPS;
    const el = document.getElementById('loading-tips');
    let index = Math.floor(Math.random() * tips.length);
    
    el.textContent = tips[index];
    
    const timer = setInterval(() => {
      index = (index + 1) % tips.length;
      el.textContent = tips[index];
    }, CONFIG.UI.TIP_ROTATION_INTERVAL);
    
    // グローバルに保存（停止用）
    window.tipsTimer = timer;
  }
  
  debugLog('📦 reservation.js ロード完了', 'success');