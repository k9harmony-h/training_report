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
    isNewUser: false,  // 新規ユーザーフラグ

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
    travelFeeStatus: null,  // 'CALCULATED' | 'OVER_AREA' | 'GEOCODE_FAILED' | 'NEW_USER'
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
    paymentToken: null,

    // クーポン
    appliedCoupon: null,

    // 新規ユーザー用ジオデータ
    newUserGeoData: null
  };

  /**
   * トースト通知表示
   */
  function showToast(message, type = 'info') {
    debugLog(`🔔 Toast: ${message}`, type === 'error' ? 'error' : 'info');
    // 簡易トースト表示
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#D0021B' : 'var(--c-main-turquoise)'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), CONFIG.UI.TOAST_DURATION || 3000);
  }

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
    await liff.init({ liffId: CONFIG.LIFF.ID });
    
    if (!liff.isLoggedIn()) {
      debugLog('⚠️ ユーザー未ログイン - ログイン画面へ', 'warn');
      liff.login({ redirectUri: window.location.href });
      return;
    }
    
    const profile = await liff.getProfile();
    AppState.lineUserId = profile.userId;
    debugLog(`✅ LIFF初期化完了 - UserID: ${profile.userId.substring(0, 8)}...`, 'success');
    
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
 * 必須データ読み込み（Priority 2）
 */
/**
 * 必須データ読み込み（Priority 2）
 */
async function loadEssentialData() {
  try {
    const startTime = performance.now();
    
    debugLog(`🔍 GAS URL: ${CONFIG.API.GAS_URL}`, 'info');
    
    // ===== 修正: lineUserIdをすべてのリクエストに追加 =====
    const [customerData, productsData, trainersData] = await Promise.all([
      fetch(`${CONFIG.API.GAS_URL}?type=data&lineUserId=${AppState.lineUserId}`)
        .then(res => res.json()),
      fetch(`${CONFIG.API.GAS_URL}?type=products&lineUserId=${AppState.lineUserId}`)
        .then(res => res.json()),
      fetch(`${CONFIG.API.GAS_URL}?action=getTrainerList&lineUserId=${AppState.lineUserId}`)
        .then(res => res.json())
    ]);
    
    // ===== 商品データの詳細確認 =====
    debugLog('🔍 ===== 商品データ詳細確認 =====', 'info');
    debugLog(`🔍 productsData: ${JSON.stringify(productsData).substring(0, 200)}...`, 'info');
    
    // 顧客データ処理
    if (customerData && customerData.customer) {
      AppState.userData = customerData.customer;
      AppState.userDogs = customerData.dogs || [];
      AppState.isNewUser = false;
      debugLog(`✅ 既存顧客: ${AppState.userData.name}`, 'success');
    } else {
      AppState.isNewUser = true;
      debugLog('📝 新規顧客', 'info');
    }
    
    // 商品データ処理
    if (productsData.products && Array.isArray(productsData.products)) {
      AppState.products = productsData.products;
    } else if (Array.isArray(productsData)) {
      AppState.products = productsData;
    } else {
      debugLog('⚠️ 商品データの形式が不明です', 'warn');
      AppState.products = [];
    }
    
    debugLog(`🔍 AppState.products.length: ${AppState.products.length}`, 'info');
    
    // 最初の商品を詳細確認
    if (AppState.products.length > 0) {
      const firstProduct = AppState.products[0];
      debugLog(`🔍 最初の商品:`, 'info');
      for (let key in firstProduct) {
        debugLog(`  - ${key}: ${firstProduct[key]}`, 'info');
      }
    }
    
    // ===== トレーナーデータ処理 =====
    debugLog('🔍 ===== トレーナーデータ詳細確認 =====', 'info');
    debugLog(`🔍 trainersData: ${JSON.stringify(trainersData).substring(0, 200)}...`, 'info');
    
    if (trainersData && trainersData.trainers && Array.isArray(trainersData.trainers)) {
      AppState.trainers = trainersData.trainers;
    } else if (trainersData && Array.isArray(trainersData)) {
      AppState.trainers = trainersData;
    } else {
      debugLog('⚠️ トレーナーデータの形式が不明です', 'warn');
      AppState.trainers = [];
    }
    
    debugLog(`🔍 AppState.trainers.length: ${AppState.trainers.length}`, 'info');
    
    // 最初のトレーナーを詳細確認
    if (AppState.trainers.length > 0) {
      const firstTrainer = AppState.trainers[0];
      debugLog(`🔍 最初のトレーナー:`, 'info');
      for (let key in firstTrainer) {
        debugLog(`  - ${key}: ${firstTrainer[key]}`, 'info');
      }
    }
    
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
  
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;
  const monthKey = `${year}-${month}`;
  
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
    
    // ===== 修正: CalendarService仕様に合わせる =====
    const data = await apiCall('POST', {
      action: 'getMonthAvailability',
      year: year,
      month: month,
      trainer_code: AppState.selectedTrainer || 'TRN-001',  // ← トレーナーコード
      is_multiple_dogs: AppState.isMultiDog || false
    });
    
    // エラーチェック
    if (!data.success) {
      throw new Error(data.error || 'カレンダーデータ取得失敗');
    }
    
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
    
    // ===== ローディング強制非表示 =====
    hideLoading();
    debugLog('✅ ローディング非表示', 'success');
    
    // ===== モーダル強制クローズ =====
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.classList.remove('open');
    });
    document.querySelectorAll('.center-modal, .bottom-modal, .top-sheet').forEach(modal => {
      modal.classList.remove('open');
    });
    debugLog('✅ 全モーダルクローズ', 'success');
    
    debugLog(`🔍 View${viewNumber}要素の確認開始`, 'info');
    
    // ===== 修正: 全View要素を明示的に非表示 =====
    for (let i = 1; i <= 5; i++) {
      const viewEl = document.getElementById(`view-${i}`);
      if (viewEl) {
        viewEl.classList.remove('active');
        viewEl.style.cssText = 'display: none !important;';
        debugLog(`🔍 view-${i} を非表示にしました`, 'info');
      }
    }
    
    // 指定Viewを表示
    const targetView = document.getElementById(`view-${viewNumber}`);
    
    if (!targetView) {
      debugLog(`❌ view-${viewNumber}要素が見つかりません`, 'error');
      return;
    }
    
    debugLog(`🔍 view-${viewNumber}要素が見つかりました`, 'info');
    
    // activeクラスを追加
    targetView.classList.add('active');
    
    // ===== 強制的にスタイルを上書き =====
    targetView.style.cssText = `
      display: block !important;
      opacity: 1 !important;
      visibility: visible !important;
      height: auto !important;
      max-height: none !important;
      transform: none !important;
      position: relative !important;
      z-index: 1 !important;
    `;
    
    debugLog(`✅ view-${viewNumber}にactiveクラスを追加しました`, 'success');
    
    // ===== デバッグ: 変更後の状態確認 =====
    setTimeout(() => {
      debugLog(`🔍 各Viewの表示状態確認:`, 'info');
      for (let i = 1; i <= 5; i++) {
        const v = document.getElementById(`view-${i}`);
        if (v) {
          const display = getComputedStyle(v).display;
          debugLog(`  - view-${i}: display=${display}`, i === viewNumber ? 'success' : 'info');
        }
      }
    }, 100);
    
    // プログレスバー更新
    updateProgressBar(viewNumber);
    
    // View固有の初期化処理
    initializeView(viewNumber);
    
    // 状態更新
    AppState.currentView = viewNumber;
    
    // トップへスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    debugLog(`✅ View切り替え完了: ${viewNumber}`, 'success');
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
        
        // ===== Step 2: トレーナー選択欄をレンダリング（追加）=====
        debugLog('📋 Step 1.5: renderTrainerSelect() 開始', 'info');
        renderTrainerSelect();
        debugLog('✅ Step 1.5: renderTrainerSelect() 完了', 'success');
        
        // ===== Step 3: イベントリスナー登録 =====
        debugLog('📋 Step 2: イベントリスナー登録開始', 'info');
        
        // 複数頭チェックボックス
        const multiDogCheck = document.getElementById('multi-dog-check');
        if (multiDogCheck) {
          multiDogCheck.removeEventListener('change', handleMultiDogChange);
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
              name: selectedOption.text,
              id: selectedOption.getAttribute('data-id'),
              type: selectedOption.getAttribute('data-type')
            };
            debugLog(`✅ 初期メニュー設定: ${AppState.selectedMenu.name}`, 'success');
          }
        }
        
        debugLog('✅ Step 2: イベントリスナー登録完了', 'success');
        
        // ===== Step 4: ユーザータイプ別の処理 =====
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
            debugLog('🐕 複数頭のため選択モーダル表示', 'info');
            document.getElementById('selected-dog-name').textContent = '---';
            
            // ===== 修正: 複数頭の場合、自動でモーダル表示 =====
            setTimeout(() => {
              showDogSelectModal();
            }, 500);
          } else {
            debugLog('⚠️ 犬データなし', 'warn');
            document.getElementById('selected-dog-name').textContent = '犬情報なし';
          }
          
        } else {
          // 新規顧客の場合
          debugLog('🆕 新規顧客として処理', 'info');

          // 犬選択カード全体を非表示
          const dogSelectionCard = document.getElementById('dog-selection-card');
          if (dogSelectionCard) {
            dogSelectionCard.style.display = 'none';
          }

          // 「すでに契約済みのお客様」リンクを表示
          document.getElementById('existing-customer-link-area').classList.remove('hidden');

          // 新規顧客用のプレースホルダーを設定
          AppState.selectedDog = { name: 'ご新規のお客様', isNew: true };
        }
        
        debugLog('✅ Step 3: ユーザー処理完了', 'success');
        
        // ===== Step 5: バリデーション =====
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
      validateView1();
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
 * トレーナー選択欄のレンダリング
 */
function renderTrainerSelect() {
  debugLog('📋 renderTrainerSelect() 開始', 'info');
  debugLog(`🔍 AppState.trainers.length: ${AppState.trainers ? AppState.trainers.length : 0}`, 'info');
  
  const select = document.getElementById('trainer-select');
  if (!select) {
    debugLog('⚠️ trainer-select要素が見つかりません', 'warn');
    return;
  }
  
  // トレーナーデータがない場合は非表示
  const trainerCard = document.getElementById('trainer-select-card');
  if (!AppState.trainers || AppState.trainers.length === 0) {
    debugLog('⚠️ トレーナーデータなし - 選択欄を非表示', 'warn');
    if (trainerCard) {
      trainerCard.style.display = 'none';
    }
    return;
  }
  
  // トレーナーが1人の場合は非表示
  if (AppState.trainers.length === 1) {
    debugLog('📋 トレーナー1人のため自動選択', 'info');
    AppState.selectedTrainer = AppState.trainers[0].trainer_id || AppState.trainers[0].id;
    if (trainerCard) {
      trainerCard.style.display = 'none';
    }
    return;
  }
  
  // トレーナーが2人以上の場合は表示
  debugLog('📋 トレーナー複数 - 選択欄を表示', 'info');
  if (trainerCard) {
    trainerCard.style.display = '';
  }
  
  select.innerHTML = '<option value="">トレーナーを選択してください</option>';
  
  AppState.trainers.forEach((trainer, index) => {
    const name = trainer.trainer_name || trainer.name;
    const id = trainer.trainer_id || trainer.id;
    
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name;
    select.appendChild(option);
    
    debugLog(`✅ トレーナー追加: ${name}`, 'success');
  });
  
  debugLog(`✅ renderTrainerSelect() 完了 (options: ${select.options.length})`, 'success');
}
  /**
 * メニュー選択欄のレンダリング
 */
function renderMenuSelect() {
  debugLog('📋 renderMenuSelect() 開始', 'info');
  debugLog(`🔍 AppState.products.length: ${AppState.products.length}`, 'info');
  debugLog(`🔍 AppState.isNewUser: ${AppState.isNewUser}`, 'info');

  const select = document.getElementById('menu-select');
  if (!select) {
    debugLog('❌ menu-select要素が見つかりません', 'error');
    return;
  }

  select.innerHTML = '';

  if (AppState.products.length > 0) {
    debugLog('📦 商品データからメニュー生成', 'info');

    AppState.products.forEach((product, index) => {
      // 複数のフィールド名パターンに対応
      const name = product.product_name || product.name;
      const category = product.product_category || product.category;
      const price = product.product_price || product.price;
      const duration = product.product_duration || product.duration || 90;
      const productType = product.product_type || product.type;
      const customerType = product.customer_type || 'ALL';

      debugLog(`🔍 商品${index}: name=${name}, category=${category}, type=${productType}, customerType=${customerType}, price=${price}`, 'info');

      // product_status=ACTIVEのみ表示（GAS側で既にフィルタ済みだが念のため）
      const status = product.product_status || 'ACTIVE';

      // 新規ユーザーフィルタリング
      // 新規ユーザー: customer_type='NEW' または 'ALL' のみ
      // 既存ユーザー: customer_type='EXISTING' または 'ALL' のみ
      let customerTypeMatch = false;
      if (AppState.isNewUser) {
        customerTypeMatch = (customerType === 'NEW' || customerType === 'ALL');
      } else {
        customerTypeMatch = (customerType === 'EXISTING' || customerType === 'ALL');
      }

      if (name && status === 'ACTIVE' && customerTypeMatch) {
        const option = document.createElement('option');
        option.value = duration;
        option.setAttribute('data-price', price);
        option.setAttribute('data-id', product.product_id || product.id || index);
        option.setAttribute('data-type', productType || 'SINGLE');
        option.textContent = `${name} (¥${Number(price).toLocaleString()})`;
        select.appendChild(option);
        debugLog(`✅ メニュー追加: ${name}`, 'success');
      } else {
        debugLog(`⏭️ スキップ: ${name} (status=${status}, customerType=${customerType}, match=${customerTypeMatch})`, 'info');
      }
    });

  }
  
  // オプションが1つも追加されなかった場合、デフォルトを追加
  if (select.options.length === 0) {
    debugLog('⚠️ 商品なし - デフォルトメニュー使用', 'warn');
    
    const option = document.createElement('option');
    option.value = 90;
    option.setAttribute('data-price', 4900);
    option.textContent = '単発トレーニング (¥4,900)';
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
    // トレーナーが複数いる場合は選択必須
    const needsTrainerSelection = AppState.trainers && AppState.trainers.length > 1;
    const trainerValid = !needsTrainerSelection || AppState.selectedTrainer;

    const isValid = AppState.selectedDog && AppState.selectedMenu && trainerValid;
    document.getElementById('btn-next-view2').disabled = !isValid;
  }
  
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     View 2: 月間カレンダー・日時選択
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  
  function initializeView2() {
    debugLog('📅 View 2 初期化', 'info');
    renderCalendar();

    // 新規ユーザーの場合は別住所セクションを非表示
    const altAddressCard = document.getElementById('alt-address-check')?.closest('.card');
    if (AppState.isNewUser) {
      debugLog('🆕 新規ユーザー: 別住所セクション非表示', 'info');
      if (altAddressCard) {
        altAddressCard.style.display = 'none';
      }
      // 新規ユーザーはView4で住所入力するので事前計算しない
      AppState.travelFeeStatus = 'NEW_USER';
      return;
    }

    // ①View2読み込み時に出張費を事前計算（既存ユーザーのみ）
    preCalculateTravelFee();

    // 別住所チェックボックス（既存ユーザーのみ）
    if (altAddressCard) {
      altAddressCard.style.display = '';
    }
    document.getElementById('alt-address-check').addEventListener('change', (e) => {
      AppState.useAltAddress = e.target.checked;
      toggleAltAddress();

      // ②別住所の場合は再計算をリセット
      if (e.target.checked) {
        AppState.travelFee = null;
      } else {
        preCalculateTravelFee();
      }
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

    // 月内の最大スロット数を計算（動的に判定）
    const maxSlotsInMonth = Math.max(
      ...Object.values(availability).map(slots => Array.isArray(slots) ? slots.length : 0),
      0
    );
    debugLog(`📅 月内最大スロット数: ${maxSlotsInMonth}`, 'info');

    // 前月の余白
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      addCalendarDay(grid, day, true, null, false, null, [], maxSlotsInMonth);
    }

    // 当月の日付
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = date.getDay();
      const isToday = isSameDay(date, new Date());
      const slots = availability[dateStr] || [];

      addCalendarDay(grid, day, false, dateStr, isToday, dayOfWeek, slots, maxSlotsInMonth);
    }
    
    // 次月の余白
    const totalCells = startDayOfWeek + daysInMonth;
    const remainingCells = 42 - totalCells; // 6週間分
    for (let day = 1; day <= remainingCells; day++) {
      addCalendarDay(grid, day, true, null, false, null, [], maxSlotsInMonth);
    }
  }
  
  /**
   * カレンダー日付セルを追加
   */
  /**
 * カレンダー日付セルを追加
 * @param {HTMLElement} grid - カレンダーグリッド
 * @param {number} dayNumber - 日付
 * @param {boolean} isOtherMonth - 他の月かどうか
 * @param {string} dateStr - 日付文字列 (YYYY-MM-DD)
 * @param {boolean} isToday - 今日かどうか
 * @param {number} dayOfWeek - 曜日
 * @param {Array} slots - 空き時間枠
 * @param {number} maxSlots - 月内の最大スロット数
 */
function addCalendarDay(grid, dayNumber, isOtherMonth, dateStr, isToday, dayOfWeek, slots = [], maxSlots = 8) {
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

    // 全枠空いている場合のみ「空きあり」、それ以外は「残り僅か」
    // maxSlots と比較して判定（動的に計算された最大値を使用）
    if (slots.length >= maxSlots && maxSlots > 0) {
      symbolEl.classList.add('symbol-available');
      symbolEl.textContent = '●';
      symbolEl.title = '空きあり';
    } else {
      // 1件でも予約があれば「残り僅か」
      symbolEl.classList.add('symbol-few');
      symbolEl.textContent = '◐';
      symbolEl.title = '残り僅か';
    }

    cell.appendChild(symbolEl);

    // クリックイベント
    cell.style.cursor = 'pointer';
    cell.addEventListener('click', () => {
      debugLog(`📅 日付クリック: ${dateStr}`, 'info');
      openTimeModal(dateStr, slots);
    });
  } else if (!isOtherMonth) {
    // 空き枠がない場合は無効化
    cell.classList.add('calendar-day-disabled');
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
  
     async function initializeView3() {
    debugLog('💰 View 3 初期化', 'info');

  try {
    // 新規ユーザー向けセクション表示切り替え
    const importantSection = document.getElementById('important-notice-section');
    const noticeSection = document.getElementById('notice-section-new-user');

    if (AppState.isNewUser) {
      // 重要事項説明セクション表示
      if (importantSection) {
        importantSection.classList.remove('hidden');
        debugLog('🆕 重要事項説明セクション表示（新規ユーザー）', 'info');
      }
      // 注意事項セクション表示
      if (noticeSection) {
        noticeSection.classList.remove('hidden');
        debugLog('🆕 注意事項セクション表示（新規ユーザー）', 'info');
      }
    } else {
      // 既存ユーザーは非表示
      if (importantSection) importantSection.classList.add('hidden');
      if (noticeSection) noticeSection.classList.add('hidden');
    }

    // 予約内容表示
    renderReservationSummary();

    // 料金計算（非同期処理をawait）
    await calculatePricing();

    // キャンセル料表示
    updateCancellationInfo();

    // 規約チェックボックスのイベント
    document.querySelectorAll('.term-check').forEach(checkbox => {
      checkbox.addEventListener('change', checkAllTerms);
    });

    document.getElementById('chk-all').addEventListener('change', toggleAllTerms);

    debugLog('✅ View 3 初期化完了', 'success');

  } catch (error) {
    debugLog(`❌ View 3 初期化エラー: ${error.message}`, 'error');
    console.error('initializeView3 Error:', error);
  }
}
  
  /**
   * 予約内容サマリーのレンダリング
   */
  function renderReservationSummary() {
    debugLog('📋 予約内容サマリー生成開始', 'info');
    
    try {
      // 日時
      const datetimeStr = `${AppState.selectedDate} ${AppState.selectedTime}`;
      document.getElementById('conf-datetime').textContent = datetimeStr;
      debugLog(`✅ 日時: ${datetimeStr}`, 'success');
      
      // 場所
      let place = '';
      if (AppState.useAltAddress && AppState.altAddress) {
        place = AppState.altAddress.address;
      } else if (AppState.userData) {
        place = AppState.userData.address || '未登録';
      } else {
        place = '住所入力後に表示します';
      }
      document.getElementById('conf-place').textContent = place;
      debugLog(`✅ 場所: ${place}`, 'success');

      // 犬名
      let dogName = '';
      if (AppState.selectedDog && !AppState.selectedDog.isNew) {
        dogName = AppState.selectedDog.name_disp || AppState.selectedDog.name;
      } else if (AppState.isNewUser) {
        dogName = '次のステップで登録';
      } else {
        dogName = '新規登録犬';
      }
      document.getElementById('conf-dog').textContent = dogName;
      debugLog(`✅ 犬名: ${dogName}`, 'success');
      
      // コース
      let courseName = AppState.selectedMenu.name;
      if (AppState.isMultiDog) {
        courseName += ' (+2頭目)';
      }
      document.getElementById('conf-course').textContent = courseName;
      debugLog(`✅ コース: ${courseName}`, 'success');
      
      debugLog('✅ 予約内容サマリー生成完了', 'success');
      
    } catch (error) {
      debugLog(`❌ 予約内容サマリー生成エラー: ${error.message}`, 'error');
      console.error('renderReservationSummary Error:', error);
      throw error;
    }
  }
  
  /**
   * 料金計算
   */
  async function calculatePricing() {
    debugLog('💰 料金計算開始', 'info');
    
    try {
      // レッスン料金
      AppState.lessonPrice = AppState.selectedMenu.price;
      document.getElementById('price-lesson').textContent = 
        `¥${AppState.lessonPrice.toLocaleString()}`;
      debugLog(`✅ レッスン料金: ¥${AppState.lessonPrice}`, 'success');
      
      // 複数頭料金
      const multiDogRow = document.getElementById('price-multi-row');
      if (AppState.isMultiDog) {
        multiDogRow.style.display = '';
        debugLog('✅ 複数頭料金: 表示', 'success');
      } else {
        multiDogRow.style.display = 'none';
        debugLog('✅ 複数頭料金: 非表示', 'success');
      }
      
      // 小計
      const subtotal = AppState.lessonPrice + (AppState.isMultiDog ? CONFIG.PRICING.MULTI_DOG_FEE : 0);
      document.getElementById('price-subtotal').textContent = `¥${subtotal.toLocaleString()}`;
      debugLog(`✅ 小計: ¥${subtotal}`, 'success');
      
      // 出張費計算
      debugLog('💰 出張費計算開始', 'info');
      document.getElementById('price-travel-fee').textContent = '計算中...';
      const travelResult = await calculateTravelFee();

      // リトライ必要な場合は処理中断
      if (travelResult.status === 'RETRY_NEEDED') {
        document.getElementById('price-travel-fee').textContent = '-';
        return;
      }

      AppState.travelFee = travelResult.fee;
      AppState.travelFeeStatus = travelResult.status;

      // 表示更新
      if (travelResult.status === 'NEW_USER') {
        document.getElementById('price-travel-fee').textContent = 'お客様情報入力後に計算いたします';
        document.getElementById('price-total').textContent = 'お客様情報入力後に確定';
        debugLog(`✅ 出張費: 新規ユーザー - お客様情報入力後に計算`, 'success');
        return; // 新規ユーザーは合計計算をスキップ
      } else if (travelResult.status === 'OVER_AREA' || travelResult.status === 'GEOCODE_FAILED') {
        document.getElementById('price-travel-fee').textContent = '別途';
      } else if (travelResult.fee === 0) {
        document.getElementById('price-travel-fee').textContent = '無料';
      } else {
        document.getElementById('price-travel-fee').textContent = `¥${travelResult.fee.toLocaleString()}`;
      }
      debugLog(`✅ 出張費: ${travelResult.status} / ¥${AppState.travelFee}`, 'success');

      // 合計
      updateTotalPrice();
      debugLog(`✅ 料金計算完了`, 'success');
      
    } catch (error) {
      debugLog(`❌ 料金計算エラー: ${error.message}`, 'error');
      console.error('calculatePricing Error:', error);
      throw error;
    }
  }
  
  /**
   * 出張費計算
   * @returns {Object} { fee: number, status: 'CALCULATED'|'OVER_AREA'|'GEOCODE_FAILED'|'NEW_USER', distance: number|null }
   */
  async function calculateTravelFee() {
    let targetLat, targetLng;

    // ===== 座標取得 =====
    if (AppState.useAltAddress) {
      // 別住所の場合 - ジオコーディングで座標取得
      const altAddr = document.getElementById('alt-addr')?.value?.trim();
      if (!altAddr) {
        debugLog('⚠️ 別住所が入力されていません', 'warn');
        return { fee: 0, status: 'GEOCODE_FAILED', distance: null };
      }

      // ジオコーディング（最大2回）
      const geoResult = await geocodeWithRetry(altAddr);
      if (!geoResult.success) {
        AppState.travelFeeStatus = 'GEOCODE_FAILED';
        return { fee: 0, status: 'GEOCODE_FAILED', distance: null };
      }

      targetLat = geoResult.lat;
      targetLng = geoResult.lng;
      AppState.altAddress = {
        address: altAddr,
        lat: targetLat,
        lng: targetLng,
        formattedAddress: geoResult.formattedAddress
      };

    } else if (AppState.userData && AppState.userData.base_lat) {
      // 登録住所の場合
      targetLat = AppState.userData.base_lat;
      targetLng = AppState.userData.base_lng;
    } else {
      // 新規ユーザー（View4で住所入力後に再計算）
      debugLog('⚠️ 新規ユーザー - View4で住所入力後に計算', 'warn');
      AppState.travelFeeStatus = 'NEW_USER';
      return { fee: 0, status: 'NEW_USER', distance: null };
    }

    // ===== 距離計算 =====
    const distance = CONFIG.calculateDistance(
      CONFIG.OFFICE.LAT,
      CONFIG.OFFICE.LNG,
      targetLat,
      targetLng
    );
    debugLog(`📏 距離: ${distance.toFixed(2)}km`, 'info');

    // ===== 15km超チェック =====
    if (distance > 15) {
      debugLog(`⚠️ サービスエリア外: ${distance.toFixed(1)}km`, 'warn');
      AppState.travelFeeStatus = 'OVER_AREA';
      return { fee: 0, status: 'OVER_AREA', distance: distance };
    }

    // ===== 料金計算 =====
    const fee = CONFIG.calculateTravelFee(distance);
    debugLog(`✅ 出張費計算完了: ${distance.toFixed(1)}km = ¥${fee}`, 'success');
    AppState.travelFeeStatus = 'CALCULATED';
    return { fee: fee, status: 'CALCULATED', distance: distance };
  }

  /**
   * ジオコーディング（2回リトライ）
   */
  async function geocodeWithRetry(address) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      debugLog(`📍 ジオコーディング試行 ${attempt}/2: ${address}`, 'info');

      try {
        const geoResult = await apiCall('GET', { action: 'geocodeAddress', address: address });

        if (geoResult.success) {
          debugLog(`✅ 座標取得成功: ${geoResult.lat}, ${geoResult.lng}`, 'success');
          return geoResult;
        }

        debugLog(`⚠️ ジオコーディング失敗 (${attempt}回目): ${geoResult.error}`, 'warn');

        if (attempt === 1) {
          // 1回目失敗 - 再入力を促す
          alert('住所が見つかりませんでした。正確な住所を再度入力してください。');
          document.getElementById('alt-addr')?.focus();
          // ユーザーが修正して再度calculateTravelFeeを呼ぶまで待つ
          return { success: false, retry: true };
        }
      } catch (error) {
        debugLog(`❌ ジオコーディングエラー (${attempt}回目): ${error.message}`, 'error');
      }
    }

    // 2回失敗
    alert('サービスエラーにより位置情報が読み込めませんでした。\n出張費は後日トレーナーからご連絡いたします。');
    return { success: false, retry: false };
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
      resultEl.textContent = 'Voucherを検索しています...';
      resultEl.className = 'voucher-result';
      resultEl.style.color = 'var(--c-text-gray)';
      
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
 * 出張費を事前計算（View2読み込み時）
 */
async function preCalculateTravelFee() {
  if (!AppState.userData || !AppState.userData.base_lat) {
    AppState.travelFee = 0;
    AppState.travelFeeStatus = 'NEW_USER';
    debugLog('⚠️ 顧客データなし - 新規ユーザー', 'warn');
    return;
  }

  try {
    const distance = CONFIG.calculateDistance(
      CONFIG.OFFICE.LAT,
      CONFIG.OFFICE.LNG,
      AppState.userData.base_lat,
      AppState.userData.base_lng
    );

    // 15km超チェック
    if (distance > 15) {
      AppState.travelFee = 0;
      AppState.travelFeeStatus = 'OVER_AREA';
      debugLog(`⚠️ 出張費事前計算: ${distance.toFixed(1)}km - サービスエリア外`, 'warn');
      return;
    }

    AppState.travelFee = CONFIG.calculateTravelFee(distance);
    AppState.travelFeeStatus = 'CALCULATED';
    debugLog(`✅ 出張費事前計算: ${distance.toFixed(1)}km = ¥${AppState.travelFee}`, 'success');
  } catch (error) {
    debugLog(`❌ 出張費計算エラー: ${error.message}`, 'error');
    AppState.travelFee = 0;
    AppState.travelFeeStatus = 'GEOCODE_FAILED';
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
    // 別住所チェックがONの場合、必須項目を検証（既存ユーザーのみ）
    if (!AppState.isNewUser && AppState.useAltAddress) {
      const altAddr = document.getElementById('alt-addr')?.value?.trim();
      if (!altAddr) {
        alert('別住所を使用する場合は、住所を入力してください');
        document.getElementById('alt-addr')?.focus();
        return;
      }
    }

    if (AppState.isNewUser) {
      // 新規ユーザー → アコーディオン形式の登録フォーム
      debugLog('🆕 新規ユーザー → アコーディオンフォームへ', 'info');
      showView4Pattern('new-card');
      goToView(4);
      // 最初のアコーディオンを開く
      setTimeout(() => {
        goToAccordionSection('owner');
      }, 100);
      return;
    }

    // 既存ユーザー
    const paymentMethod = document.getElementById('payment-method').value;

    if (paymentMethod === 'CARD') {
      showView4Pattern('existing-card');
    } else if (paymentMethod === 'CASH') {
      showView4Pattern('cash');
    } else {
      showView4Pattern('existing-card'); // QUICPay, iD, IC も同様
    }

    goToView(4);
  }
  
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     View 4: 決済・情報入力
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  
  async function initializeView4() {
    debugLog('💳 View 4 初期化', 'info');

    // クーポン自動適用チェック
    await checkAutoApplicableCoupon();

    renderFinalPricing();
  }

  /**
   * 自動適用可能なクーポンをチェック
   */
  async function checkAutoApplicableCoupon() {
    try {
      const productId = AppState.selectedMenu?.id;
      const amount = AppState.lessonPrice + AppState.travelFee + (AppState.isMultiDog ? CONFIG.PRICING.MULTI_DOG_FEE : 0);

      if (!productId || !amount) return;

      debugLog('🎫 クーポン自動適用チェック', 'info');

      const params = new URLSearchParams({
        action: 'getApplicableCoupon',
        productId: productId,
        amount: amount,
        reservationDate: AppState.selectedDate
      });

      const response = await fetch(`${CONFIG.API.GAS_URL}?${params}`);
      const result = await response.json();

      if (result.coupon) {
        debugLog(`✅ 自動適用クーポン: ${result.coupon.coupon_name}`, 'success');
        AppState.appliedCoupon = result.coupon;
        AppState.voucherDiscount = result.coupon.discount_amount;
        // 合計金額を再計算
        AppState.totalPrice = amount - result.coupon.discount_amount;
      } else {
        debugLog('ℹ️ 適用可能なクーポンなし', 'info');
        AppState.appliedCoupon = null;
      }
    } catch (error) {
      debugLog(`⚠️ クーポンチェックエラー: ${error.message}`, 'warn');
    }
  }

  /**
   * クーポンコード手動入力・検証
   */
  async function applyCouponCode() {
    const couponInput = document.getElementById('coupon-code-input');
    const couponCode = couponInput?.value?.trim();

    if (!couponCode) {
      showToast('クーポンコードを入力してください');
      return;
    }

    try {
      showLoading();
      debugLog(`🎫 クーポンコード検証: ${couponCode}`, 'info');

      const productId = AppState.selectedMenu?.id;
      const amount = AppState.lessonPrice + AppState.travelFee + (AppState.isMultiDog ? CONFIG.PRICING.MULTI_DOG_FEE : 0);

      const params = new URLSearchParams({
        action: 'validateCouponCode',
        couponCode: couponCode,
        productId: productId,
        amount: amount
      });

      const response = await fetch(`${CONFIG.API.GAS_URL}?${params}`);
      const result = await response.json();

      if (result.valid) {
        debugLog(`✅ クーポン適用: ${result.coupon.coupon_name}`, 'success');
        AppState.appliedCoupon = result.coupon;
        AppState.voucherDiscount = result.coupon.discount_amount;
        AppState.totalPrice = amount - result.coupon.discount_amount;
        renderFinalPricing();
        showToast(`${result.coupon.coupon_name}を適用しました`);
      } else {
        debugLog(`❌ クーポン無効: ${result.message}`, 'error');
        showToast(result.message);
      }
    } catch (error) {
      debugLog(`⚠️ クーポン検証エラー: ${error.message}`, 'error');
      showToast('クーポンの検証中にエラーが発生しました');
    } finally {
      hideLoading();
    }
  }

  /**
   * 適用中クーポンを削除
   */
  function removeCoupon() {
    if (AppState.appliedCoupon) {
      debugLog(`🗑️ クーポン削除: ${AppState.appliedCoupon.coupon_name}`, 'info');
      const discountAmount = AppState.appliedCoupon.discount_amount;
      AppState.appliedCoupon = null;
      AppState.voucherDiscount = 0;
      AppState.totalPrice += discountAmount;
      renderFinalPricing();
      showToast('クーポンを削除しました');
    }
  }
  
  /**
 * View 4のパターン表示
 * @param {string} pattern - 'existing-card' | 'new-card' | 'cash'
 */
function showView4Pattern(pattern) {
  debugLog(`💳 View 4 パターン切替: ${pattern}`, 'info');
  
  // 全パターンを非表示
  document.querySelectorAll('.view4-pattern').forEach(el => {
    el.classList.remove('active');
    el.classList.add('hidden');  // ← hidden追加
  });
  
  // 指定パターンを表示
  const targetPattern = document.getElementById(`view4-${pattern}`);
  if (targetPattern) {
    targetPattern.classList.add('active');
    targetPattern.classList.remove('hidden');  // ← hidden削除（重要）
    debugLog(`✅ view4-${pattern}を表示`, 'success');
  } else {
    debugLog(`❌ view4-${pattern}が見つかりません`, 'error');
  }
  
  // Square初期化（カード決済の場合）
  if (pattern === 'existing-card') {
    initializeSquare('square-card-container');
  }
  // 新規ユーザーのSquare初期化はgoToAccordionSection('payment')で行う
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
  debugLog('💰 確定料金表示開始', 'info');

  const lessonPrice = AppState.lessonPrice;
  const travelFee = AppState.travelFee;
  const discount = AppState.voucherDiscount;
  const total = AppState.totalPrice;
  const multiDogFee = CONFIG.PRICING.MULTI_DOG_FEE;
  const travelFeeStatus = AppState.travelFeeStatus;

  // 出張費表示文字列
  const travelFeeText = (travelFeeStatus === 'OVER_AREA' || travelFeeStatus === 'GEOCODE_FAILED')
    ? '別途'
    : (travelFee === 0 ? '無料' : `¥${travelFee.toLocaleString()}`);

  // ===== 既存ユーザー + カード =====
  document.getElementById('final-price-lesson').textContent = `¥${lessonPrice.toLocaleString()}`;
  document.getElementById('final-price-travel').textContent = travelFeeText;
  document.getElementById('final-price-total').textContent = `¥${total.toLocaleString()}`;
  
  // 複数頭料金（条件付き表示）
  const finalMultiRow = document.getElementById('final-price-multi-row');
  if (AppState.isMultiDog) {
    finalMultiRow.style.display = '';
    document.getElementById('final-price-multi').textContent = `¥${multiDogFee.toLocaleString()}`;  // ← 追加
    debugLog('✅ 複数頭料金: 表示', 'success');
  } else {
    finalMultiRow.style.display = 'none';
    debugLog('✅ 複数頭料金: 非表示', 'success');
  }
  
  // 割引（条件付き表示）
  const finalDiscountRow = document.getElementById('final-price-discount-row');
  const discountLabel = document.getElementById('final-price-discount-label');
  if (discount > 0) {
    finalDiscountRow.style.display = '';
    document.getElementById('final-price-discount').textContent = `-¥${discount.toLocaleString()}`;
    // クーポン名を表示
    if (discountLabel && AppState.appliedCoupon) {
      discountLabel.textContent = `割引（${AppState.appliedCoupon.coupon_name}）`;
    }
    debugLog('✅ 割引: 表示', 'success');
  } else {
    finalDiscountRow.style.display = 'none';
    if (discountLabel) {
      discountLabel.textContent = '割引';
    }
    debugLog('✅ 割引: 非表示', 'success');
  }
  
  // ===== 現地決済 =====
  document.getElementById('cash-price-lesson').textContent = `¥${lessonPrice.toLocaleString()}`;
  document.getElementById('cash-price-travel').textContent = travelFeeText;
  document.getElementById('cash-price-total').textContent = `¥${total.toLocaleString()}`;
  
  // 複数頭料金（条件付き表示）
  const cashMultiRow = document.getElementById('cash-price-multi-row');
  if (AppState.isMultiDog) {
    cashMultiRow.style.display = '';
    document.getElementById('cash-price-multi').textContent = `¥${multiDogFee.toLocaleString()}`;  // ← 追加
  } else {
    cashMultiRow.style.display = 'none';
  }
  
  // 割引（条件付き表示）
  const cashDiscountRow = document.getElementById('cash-price-discount-row');
  if (discount > 0) {
    cashDiscountRow.style.display = '';
    document.getElementById('cash-price-discount').textContent = `-¥${discount.toLocaleString()}`;
  } else {
    cashDiscountRow.style.display = 'none';
  }
  
  debugLog('✅ 確定料金表示完了', 'success');
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
 * 決済実行（アトミックトランザクション）
 */
async function executePayment() {
  try {
    showLoading('決済処理中...');

    debugLog('💳 決済処理開始（アトミックトランザクション）', 'info');

    // 新規ユーザーの場合は専用の送信関数を使用
    if (AppState.isNewUser) {
      await submitNewUserReservation(true);
      return;
    }

    // 既存ユーザー: submitReservation(true)に統合
    // Square Tokenizeは既に完了しているので、
    // submitReservation内でcreateReservationWithPaymentを呼び出す
    await submitReservation(true);
    
  } catch (error) {
    hideLoading();
    debugLog(`❌ 決済エラー: ${error.message}`, 'error');
    alert('決済処理中にエラーが発生しました: ' + error.message);
  }
}
  
  /**
 * 予約確定（既存ユーザー用：現地決済 or 決済完了後）
 * ※ 新規ユーザーは submitNewUserReservation() を使用
 * @param {boolean} isPaid - 決済済みかどうか
 */
  async function submitReservation(isPaid = false) {
    try {
      showLoading('予約を確定中...');

      // ===== userId取得 =====
      let userId;
      if (AppState.userData && AppState.userData.customer_id) {
        userId = AppState.userData.customer_id;
      } else if (AppState.userData && AppState.userData.unique_key) {
        userId = AppState.userData.unique_key;
      } else if (AppState.lineUserId) {
        userId = AppState.lineUserId;
      } else {
        throw new Error('ユーザーIDが取得できません');
      }
      
      debugLog(`📋 userId: ${userId}`, 'info');
      
      // ===== 別住所データ収集 =====
      let altAddressData = null;
      if (AppState.useAltAddress) {
        debugLog('📍 別住所データ収集開始', 'info');
        
        const altAddrEl = document.getElementById('alt-addr');
        const altBuildingEl = document.getElementById('alt-building');
        const altLandmarkEl = document.getElementById('alt-landmark');
        const altRemarksEl = document.getElementById('alt-remarks');
        
        const altLocationTypeRadios = document.getElementsByName('alt-location-type');
        let altLocationType = 'OUTDOOR';
        for (let i = 0; i < altLocationTypeRadios.length; i++) {
          if (altLocationTypeRadios[i].checked) {
            altLocationType = altLocationTypeRadios[i].value.toUpperCase();
            break;
          }
        }
        
        if (!altAddrEl) {
          hideLoading();
          alert('別住所入力フォームが見つかりません。ページを再読み込みしてください。');
          debugLog('❌ alt-addr要素が見つかりません', 'error');
          return;
        }
        
        const altAddr = altAddrEl.value.trim();
        const altBuilding = altBuildingEl ? altBuildingEl.value.trim() : '';
        const altLandmark = altLandmarkEl ? altLandmarkEl.value.trim() : '';
        const altRemarks = altRemarksEl ? altRemarksEl.value.trim() : '';
        
        if (!altAddr) {
          hideLoading();
          alert('別住所を使用する場合は、住所を入力してください');
          return;
        }
        
        altAddressData = {
          address: altAddr,
          buildingName: altBuilding || null,
          landmark: altLandmark || null,
          locationType: altLocationType,
          remarks: altRemarks || null
        };
        
        debugLog(`✅ 別住所データ収集: ${JSON.stringify(altAddressData)}`, 'success');
      }
      
      // ===== 決済方法による処理分岐 =====
      const paymentMethod = document.getElementById('payment-method').value;
      
      if (isPaid && paymentMethod === 'CARD' && AppState.paymentToken) {
        // ★★★ カード決済: アトミックトランザクション ★★★
        debugLog('💳 カード決済: createReservationWithPaymentを使用', 'info');
        
        // クーポン情報を統合（voucherDataまたはappliedCouponから取得）
        const couponInfo = AppState.voucherData || AppState.appliedCoupon;

        // 予約データ構築
        const reservationData = {
          customer_id: userId,
          primary_dog_id: AppState.selectedDog ? AppState.selectedDog.dog_id : null,
          trainer_id: AppState.selectedTrainer,
          office_id: 'default-office',
          product_id: AppState.selectedMenu.id,
          reservation_date: AppState.selectedDate,
          start_time: AppState.selectedTime,
          duration: AppState.selectedMenu.duration + (AppState.isMultiDog ? 30 : 0),
          is_multi_dog: AppState.isMultiDog,
          use_alt_address: AppState.useAltAddress,
          alt_address: altAddressData,
          coupon_id: couponInfo ? (couponInfo.coupon_id || null) : null,
          coupon_code: couponInfo ? (couponInfo.code || couponInfo.coupon_code || null) : null,
          coupon_value: couponInfo ? (couponInfo.discount_value || couponInfo.discount_amount || 0) : 0,
          lesson_amount: AppState.lessonPrice + (AppState.isMultiDog ? 2000 : 0),
          travel_fee: (AppState.travelFeeStatus === 'OVER_AREA' || AppState.travelFeeStatus === 'GEOCODE_FAILED') ? null : AppState.travelFee,
          total_amount: AppState.totalPrice,
          payment_method: 'CREDIT',
          notes: document.getElementById('conf-remarks').value,
          reg_data: null  // 既存ユーザーは登録データなし
        };
        
        // 決済データ構築
        const paymentData = {
          amount: AppState.lessonPrice + (AppState.isMultiDog ? 2000 : 0),
          tax_amount: Math.floor((AppState.lessonPrice + (AppState.isMultiDog ? 2000 : 0)) * 0.1),
          total_amount: AppState.totalPrice,
          payment_method: 'CREDIT_CARD',
          square_source_id: AppState.paymentToken
        };
        
        const payload = {
          action: 'createReservationWithPayment',
          userId: userId,
          lineUserId: AppState.lineUserId,
          reservationData: JSON.stringify(reservationData),
          paymentData: JSON.stringify(paymentData),
          lockId: null
        };
        
        debugLog('📤 送信データ (createReservationWithPayment):', 'info');
        debugLog(JSON.stringify(payload, null, 2), 'info');
        
        const result = await apiCall('POST', payload);

        // ===== 詳細なレスポンスログ =====
        debugLog('📥 APIレスポンス:', 'info');
        debugLog(JSON.stringify(result, null, 2), 'info');

        if (result.success) {
          debugLog('✅ 決済+予約確定成功', 'success');
          hideLoading();
          goToView(5);
        } else {
          // エラー詳細をデバッグコンソールに出力
          debugLog('❌ 決済エラー詳細:', 'error');
          debugLog(`  - error: ${result.error}`, 'error');
          debugLog(`  - code: ${result.code || 'N/A'}`, 'error');
          debugLog(`  - message: ${result.message || 'N/A'}`, 'error');
          if (result.debug) {
            debugLog(`  - debug: ${JSON.stringify(result.debug)}`, 'error');
          }

          hideLoading();
          const errorMsg = result.message || (typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
          alert(`決済に失敗しました: ${errorMsg}`);
        }
        
      } else {
        // ★★★ 現地決済: 従来のadd_reservation ★★★
        debugLog('💵 現地決済: add_reservationを使用', 'info');

        // クーポン情報を統合（voucherDataまたはappliedCouponから取得）
        const couponInfoCash = AppState.voucherData || AppState.appliedCoupon;

        const payload = {
          action: 'add_reservation',
          userId: userId,
          lineUserId: AppState.lineUserId,
          date: AppState.selectedDate,
          time: AppState.selectedTime,
          dogId: AppState.selectedDog ? AppState.selectedDog.dog_id : null,
          trainerId: AppState.selectedTrainer,
          menuId: AppState.selectedMenu.id,
          isMultiDog: AppState.isMultiDog,
          useAltAddress: AppState.useAltAddress,
          altAddress: altAddressData,
          voucherCode: AppState.voucherData ? AppState.voucherData.code : null,
          coupon_id: couponInfoCash ? (couponInfoCash.coupon_id || null) : null,
          coupon_code: couponInfoCash ? (couponInfoCash.code || couponInfoCash.coupon_code || null) : null,
          coupon_value: couponInfoCash ? (couponInfoCash.discount_value || couponInfoCash.discount_amount || 0) : 0,
          lesson_amount: AppState.lessonPrice + (AppState.isMultiDog ? 2000 : 0),
          travel_fee: (AppState.travelFeeStatus === 'OVER_AREA' || AppState.travelFeeStatus === 'GEOCODE_FAILED') ? null : AppState.travelFee,
          remarks: document.getElementById('conf-remarks').value,
          paymentMethod: 'CASH',
          paymentStatus: 'UNPAID',
          totalPrice: AppState.totalPrice,
          regData: null  // 既存ユーザーは登録データなし
        };
        
        debugLog('📤 送信データ (add_reservation):', 'info');
        debugLog(JSON.stringify(payload, null, 2), 'info');
        
        const result = await apiCall('POST', payload);
        
        if (result.status === 'success') {
          debugLog('✅ 予約確定成功', 'success');
          hideLoading();
          goToView(5);
        } else {
          hideLoading();
          alert(`予約の確定に失敗しました: ${result.message}`);
        }
      }
      
    } catch (error) {
      hideLoading();
      debugLog(`❌ 予約確定エラー: ${error.message}`, 'error');
      alert('予約処理中にエラーが発生しました: ' + error.message);
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

    // 場所の表示（別住所 > 登録住所 > 新規入力住所）
    let place = '';
    if (AppState.useAltAddress) {
      // 別住所使用時：入力フォームまたはAppState.altAddressから取得
      const altAddrEl = document.getElementById('alt-addr');
      if (altAddrEl && altAddrEl.value) {
        place = altAddrEl.value;
      } else if (AppState.altAddress && AppState.altAddress.address) {
        place = AppState.altAddress.address;
      }
    } else if (AppState.userData && AppState.userData.address) {
      place = AppState.userData.address;
    } else {
      const regAddrEl = document.getElementById('reg-addr');
      if (regAddrEl && regAddrEl.value) {
        place = regAddrEl.value;
      }
    }
    document.getElementById('thanks-place').textContent = place || '登録住所';

    // 犬名に敬称を追加（♂→くん、それ以外→ちゃん）
    let dogName = '';
    let dogSuffix = '';
    if (AppState.selectedDog) {
      dogName = AppState.selectedDog.name_disp || AppState.selectedDog.dog_name || AppState.selectedDog.name;
      const gender = AppState.selectedDog.dog_gender || AppState.selectedDog.gender || '';
      if (gender === '♂' || gender === 'オス' || gender === 'male') {
        dogSuffix = 'くん';
      } else if (gender) {
        dogSuffix = 'ちゃん';
      }
    } else {
      dogName = document.getElementById('reg-dog-name').value;
      // 新規登録の場合は敬称なし（性別情報がないため）
    }
    document.getElementById('thanks-dog').textContent = dogName + dogSuffix;

    // コース名
    let courseName = AppState.selectedMenu.name;
    if (AppState.selectedMenu.duration) {
      courseName += ` (${AppState.selectedMenu.duration}分)`;
    }
    if (AppState.isMultiDog) {
      courseName += ' +2頭目';
    }
    document.getElementById('thanks-course').textContent = courseName;

    // クーポン情報の表示
    const couponInfo = AppState.voucherData || AppState.appliedCoupon;
    const couponRow = document.getElementById('thanks-coupon-row');
    if (couponInfo && (couponInfo.discount_value || couponInfo.discount_amount)) {
      const couponName = couponInfo.name || couponInfo.coupon_name || 'クーポン';
      const couponValue = couponInfo.discount_value || couponInfo.discount_amount || 0;
      document.getElementById('thanks-coupon').textContent = `${couponName} (-¥${couponValue.toLocaleString()})`;
      couponRow.style.display = 'flex';
    } else {
      couponRow.style.display = 'none';
    }

    // 合計金額
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
  ・パートナー: ${dogName}
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
    const title = 'K9 Harmonyトレーニング';
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
  debugLog(`📅 時間選択モーダル表示: ${dateStr}`, 'info');
  debugLog(`🔍 利用可能な時間: ${slots.join(', ')}`, 'info');
  
  AppState.selectedDate = dateStr;
  
  const date = new Date(dateStr);
  const dateFormatted = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${['日','月','火','水','木','金','土'][date.getDay()]}）`;
  document.getElementById('time-modal-title').textContent = dateFormatted;
  
  const container = document.getElementById('time-slot-buttons');
  container.className = 'time-slot-grid';
  container.innerHTML = '';
  
  // 営業時間の全時間帯をループ（10:00-18:30）
  const startHour = 10;
  const endHour = 18;
  
  for (let hour = startHour; hour <= endHour; hour++) {
    const hourStr = hour.toString().padStart(2, '0');
    
    const slot00 = `${hourStr}:00`;
    const slot30 = `${hourStr}:30`;
    
    const has00 = slots.includes(slot00);
    const has30 = slots.includes(slot30);
    
    // 両方選択不可の場合は非表示
    if (!has00 && !has30) {
      continue;
    }
    
    // 00分開始ボタン
    const btn00 = document.createElement('button');
    btn00.className = has00 ? 'time-slot-btn' : 'time-slot-btn disabled';
    btn00.textContent = `${hourStr}:00開始`;
    btn00.disabled = !has00;
    
    if (has00) {
      btn00.onclick = () => {
        selectTime(dateStr, slot00);
        closeTimeModal();
      };
    }
    
    container.appendChild(btn00);
    
    // 30分開始ボタン
    const btn30 = document.createElement('button');
    btn30.className = has30 ? 'time-slot-btn half' : 'time-slot-btn half disabled';
    btn30.textContent = `${hourStr}:30開始`;
    btn30.disabled = !has30;
    
    if (has30) {
      btn30.onclick = () => {
        selectTime(dateStr, slot30);
        closeTimeModal();
      };
    }
    
    container.appendChild(btn30);
  }
  
  openModal('time-modal-overlay');
  
  debugLog(`✅ 時間選択モーダル表示完了 (${slots.length}件)`, 'success');
}

/**
 * 時間選択モーダルを閉じる
 */
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
  
  // ボタンテキスト更新
  const btn = document.getElementById('btn-next-view3');
  if (btn) {
    btn.textContent = `${date} ${time}〜 次へ`;
    btn.disabled = false;
  }
  
  // カレンダー再レンダリング（選択状態を反映）
  renderCalendar();
  
  debugLog(`✅ 時間選択: ${date} ${time}`, 'success');
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
      policy: `
        <h3>受付締切</h3>
        <p>予約日前日の <strong>18:00</strong> まで</p>

        <h3>キャンセル料</h3>
        <table class="terms-table">
          <tr><th>キャンセル時期</th><th>キャンセル料</th></tr>
          <tr><td>4日前の23:59まで</td><td class="free">無料</td></tr>
          <tr><td>3日前〜2日前の23:59</td><td class="warn">トレーニング料金の50%</td></tr>
          <tr><td>前日〜当日</td><td class="alert">トレーニング料金の100%</td></tr>
        </table>

        <div class="terms-note">
          <i class="fa-solid fa-info-circle"></i>
          天候不良等による中止の場合、キャンセル料は発生しません。
        </div>
      `,
      privacy: `
        <h3>収集する情報</h3>
        <ul>
          <li>お名前、ご連絡先（電話番号・メールアドレス）</li>
          <li>ご住所（出張サービスのため）</li>
          <li>パートナー（犬）の情報</li>
          <li>LINE ユーザーID（通知のため）</li>
        </ul>

        <h3>利用目的</h3>
        <ul>
          <li>トレーニングサービスの提供</li>
          <li>予約確認・リマインド通知</li>
          <li>サービス向上のための分析</li>
        </ul>

        <h3>第三者への開示</h3>
        <p>法令に基づく場合を除き、お客様の同意なく第三者への開示は行いません。</p>

        <h3>お問い合わせ</h3>
        <p>個人情報に関するお問い合わせは、LINE公式アカウントまでご連絡ください。</p>
      `,
      terms: `
        <h3>第1条（適用）</h3>
        <p>本規約は、K9 Harmonyが提供するトレーニングサービス（以下「本サービス」）の利用に関する条件を定めます。</p>

        <h3>第2条（予約）</h3>
        <ul>
          <li>本サービスは完全予約制です</li>
          <li>予約時間の厳守をお願いいたします</li>
          <li>遅刻の場合、トレーニング時間が短縮される場合があります</li>
        </ul>

        <h3>第3条（ワクチン接種）</h3>
        <p>安全なトレーニングのため、混合ワクチン・狂犬病予防接種の証明書をご提示いただく場合があります。</p>

        <h3>第4条（キャンセル）</h3>
        <p>キャンセルポリシーに従い、キャンセル料が発生する場合があります。詳細は「キャンセルポリシー」をご確認ください。</p>

        <h3>第5条（免責事項）</h3>
        <p>トレーニング中の事故・怪我について、当方の故意または重大な過失による場合を除き、責任を負いかねます。</p>
      `,
      law: `
        <table class="terms-table law-table">
          <tr><th>事業者名</th><td>K9 Harmony</td></tr>
          <tr><th>代表者</th><td>平田</td></tr>
          <tr><th>所在地</th><td>〒174-0063<br>東京都板橋区前野町6-55-1</td></tr>
          <tr><th>電話番号</th><td>070-9043-1109</td></tr>
          <tr><th>メール</th><td>LINE公式アカウントにてお問い合わせください</td></tr>
          <tr><th>サービス料金</th><td>各メニューページに記載</td></tr>
          <tr><th>お支払い方法</th><td>クレジットカード、QUICPay、iD、交通系IC、現金</td></tr>
          <tr><th>サービス提供時期</th><td>予約日時にサービスを提供</td></tr>
          <tr><th>返品・交換</th><td>サービスの性質上、返品・交換はお受けできません</td></tr>
        </table>
      `
    };

    document.getElementById('terms-title').textContent = titles[type];
    document.getElementById('terms-content').innerHTML = contents[type];
    
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
    
    AppState.useAltAddress = isChecked;
    
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
  
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     新規ユーザー用アコーディオンフォーム
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  /**
   * 新規ユーザーアコーディオントグル
   */
  function toggleNewUserAccordion(section) {
    const sections = ['owner', 'dog', 'payment'];
    sections.forEach(s => {
      const header = document.querySelector(`#accordion-${s} .accordion-header-new`);
      const content = document.getElementById(`accordion-${s}-content`);
      if (s === section) {
        header.classList.toggle('open');
        content.classList.toggle('open');
      }
    });
  }

  /**
   * アコーディオンセクション移動
   */
  function goToAccordionSection(section) {
    const sections = ['owner', 'dog', 'payment'];
    sections.forEach(s => {
      const header = document.querySelector(`#accordion-${s} .accordion-header-new`);
      const content = document.getElementById(`accordion-${s}-content`);
      if (s === section) {
        header.classList.add('open');
        content.classList.add('open');
      } else {
        header.classList.remove('open');
        content.classList.remove('open');
      }
    });

    // 料金確認セクションに移動時はサマリーを更新
    if (section === 'payment') {
      updateNewUserPaymentSummary();
      initializeSquare('square-card-container-new');
    }

    // スクロール
    const targetSection = document.getElementById(`accordion-${section}`);
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * 飼い主情報バリデーション
   */
  function validateOwnerSection() {
    const name = document.getElementById('reg-name')?.value?.trim();
    const phone = document.getElementById('reg-phone')?.value?.trim();
    const email = document.getElementById('reg-email')?.value?.trim();
    const zip = document.getElementById('reg-zip')?.value?.trim();
    const addr = document.getElementById('reg-addr')?.value?.trim();

    // 電話番号バリデーション
    const phoneClean = phone?.replace(/-/g, '') || '';
    const phoneValid = /^0\d{9,10}$/.test(phoneClean);

    // メールバリデーション
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    // 郵便番号バリデーション
    const zipClean = zip?.replace(/-/g, '') || '';
    const zipValid = zipClean.length === 7;

    const isValid = name && phoneValid && emailValid && zipValid && addr;

    const btn = document.getElementById('btn-to-dog-section');
    if (btn) {
      btn.disabled = !isValid;
    }

    return isValid;
  }

  /**
   * 犬情報バリデーション
   */
  function validateDogSection() {
    const dogName = document.getElementById('reg-dog-name')?.value?.trim();
    const dogBreed = document.getElementById('reg-dog-breed')?.value?.trim();
    const dogAgeYear = document.getElementById('reg-dog-age-year')?.value;
    const dogAgeMonth = document.getElementById('reg-dog-age-month')?.value;
    const dogGender = document.querySelector('input[name="reg-dog-gender"]:checked');

    const isValid = dogName && dogBreed && dogAgeYear !== '' && dogAgeMonth !== '' && dogGender;

    const btn = document.getElementById('btn-to-payment-section');
    if (btn) {
      btn.disabled = !isValid;
    }

    return isValid;
  }

  /**
   * 新規ユーザー住所ジオコーディング
   */
  async function geocodeNewUserAddress() {
    const addr = document.getElementById('reg-addr')?.value?.trim();
    const building = document.getElementById('reg-building')?.value?.trim();

    if (!addr) return;

    const fullAddress = building ? `${addr} ${building}` : addr;
    debugLog(`📍 新規ユーザー住所ジオコーディング: ${fullAddress}`, 'info');

    const confirmationEl = document.getElementById('address-confirmation');
    const confirmedAddrEl = document.getElementById('confirmed-address');
    const travelFeeEl = document.getElementById('travel-fee-result');

    // 確認エリア表示
    confirmationEl.classList.remove('hidden', 'error');
    confirmedAddrEl.textContent = fullAddress;
    travelFeeEl.textContent = '出張費: 計算中...';

    try {
      const geoResult = await geocodeWithRetry(fullAddress);

      if (geoResult.success) {
        // 座標保存
        AppState.newUserGeoData = {
          lat: geoResult.lat,
          lng: geoResult.lng,
          formattedAddress: geoResult.formattedAddress || fullAddress
        };

        // 距離計算
        const distance = CONFIG.calculateDistance(
          CONFIG.OFFICE.LAT,
          CONFIG.OFFICE.LNG,
          geoResult.lat,
          geoResult.lng
        );

        // 15km超チェック
        if (distance > 15) {
          AppState.travelFee = 0;
          AppState.travelFeeStatus = 'OVER_AREA';
          travelFeeEl.textContent = '出張費: 別途（担当者よりご連絡）';
          confirmationEl.classList.add('error');
        } else {
          AppState.travelFee = CONFIG.calculateTravelFee(distance);
          AppState.travelFeeStatus = 'CALCULATED';
          if (AppState.travelFee === 0) {
            travelFeeEl.textContent = '出張費: 無料（3km以内）';
          } else {
            travelFeeEl.textContent = `出張費: ¥${AppState.travelFee.toLocaleString()}`;
          }
        }

        debugLog(`✅ ジオコーディング成功: ${distance.toFixed(1)}km / ¥${AppState.travelFee}`, 'success');

      } else if (geoResult.retry) {
        // 再入力待ち
        travelFeeEl.textContent = '出張費: 住所を確認してください';
        confirmationEl.classList.add('error');
        return;
      } else {
        // 2回失敗
        AppState.travelFee = 0;
        AppState.travelFeeStatus = 'GEOCODE_FAILED';
        travelFeeEl.textContent = '出張費: 別途（担当者よりご連絡）';
        confirmationEl.classList.add('error');
      }

    } catch (error) {
      debugLog(`❌ ジオコーディングエラー: ${error.message}`, 'error');
      AppState.travelFee = 0;
      AppState.travelFeeStatus = 'GEOCODE_FAILED';
      travelFeeEl.textContent = '出張費: 別途（担当者よりご連絡）';
      confirmationEl.classList.add('error');
    }
  }

  /**
   * 郵便番号から住所検索
   */
  async function searchAddressByZip() {
    const zipInput = document.getElementById('reg-zip');
    const zip = zipInput?.value?.replace(/-/g, '') || '';

    if (zip.length !== 7) {
      showToast('郵便番号を7桁で入力してください', 'error');
      return;
    }

    try {
      const response = await fetch(`${CONFIG.EXTERNAL.ZIP_CLOUD_API}?zipcode=${zip}`);
      const data = await response.json();

      if (data.results) {
        const result = data.results[0];
        const address = result.address1 + result.address2 + result.address3;
        document.getElementById('reg-addr').value = address;
        debugLog(`📮 住所自動入力: ${address}`, 'info');
        validateOwnerSection();
      } else {
        showToast('該当する住所が見つかりませんでした', 'error');
      }
    } catch (error) {
      debugLog(`⚠️ 郵便番号検索エラー: ${error.message}`, 'warn');
      showToast('住所検索に失敗しました', 'error');
    }
  }

  /**
   * 新規ユーザー支払い方法切り替え
   */
  function toggleNewUserPaymentMethod() {
    const method = document.getElementById('new-user-payment-method')?.value;
    const cardSection = document.getElementById('new-user-card-section');

    if (method === 'CARD') {
      cardSection.style.display = '';
      initializeSquare('square-card-container-new');
    } else {
      cardSection.style.display = 'none';
    }
  }

  /**
   * 新規ユーザー料金サマリー更新
   */
  function updateNewUserPaymentSummary() {
    // 日時
    document.getElementById('new-user-conf-datetime').textContent =
      `${AppState.selectedDate} ${AppState.selectedTime}`;

    // 場所
    const addr = document.getElementById('reg-addr')?.value?.trim() || '';
    const building = document.getElementById('reg-building')?.value?.trim() || '';
    document.getElementById('new-user-conf-place').textContent =
      building ? `${addr} ${building}` : addr;

    // パートナー名
    const dogName = document.getElementById('reg-dog-name')?.value?.trim() || '';
    document.getElementById('new-user-conf-dog').textContent = dogName;

    // コース
    document.getElementById('new-user-conf-course').textContent =
      AppState.selectedMenu?.name || '初回体験トレーニング';

    // 料金
    document.getElementById('new-user-price-lesson').textContent =
      `¥${AppState.lessonPrice?.toLocaleString() || '---'}`;

    // 出張費
    if (AppState.travelFeeStatus === 'OVER_AREA' || AppState.travelFeeStatus === 'GEOCODE_FAILED') {
      document.getElementById('new-user-price-travel').textContent = '別途';
    } else if (AppState.travelFee === 0) {
      document.getElementById('new-user-price-travel').textContent = '無料';
    } else {
      document.getElementById('new-user-price-travel').textContent =
        `¥${AppState.travelFee?.toLocaleString() || '---'}`;
    }

    // 合計
    const total = AppState.lessonPrice + (AppState.travelFee || 0);
    AppState.totalPrice = total;
    document.getElementById('new-user-price-total').textContent = `¥${total.toLocaleString()}`;
  }

  /**
   * 新規ユーザー予約確定
   */
  async function confirmNewUserReservation() {
    const paymentMethod = document.getElementById('new-user-payment-method')?.value;

    if (paymentMethod === 'CARD') {
      // カード決済
      await handleCardTokenize();
    } else {
      // 現金決済
      await submitNewUserReservation(false);
    }
  }

  /**
   * 新規ユーザー予約送信
   */
  async function submitNewUserReservation(isPaid) {
    try {
      showLoading('予約を確定中...');

      // 登録データ収集
      const regData = {
        name: document.getElementById('reg-name')?.value?.trim(),
        phone: document.getElementById('reg-phone')?.value?.trim(),
        email: document.getElementById('reg-email')?.value?.trim(),
        zip: document.getElementById('reg-zip')?.value?.trim(),
        address: document.getElementById('reg-addr')?.value?.trim(),
        building: document.getElementById('reg-building')?.value?.trim(),
        lat: AppState.newUserGeoData?.lat || null,
        lng: AppState.newUserGeoData?.lng || null,
        dogName: document.getElementById('reg-dog-name')?.value?.trim(),
        dogBreed: document.getElementById('reg-dog-breed')?.value?.trim(),
        dogAgeYears: document.getElementById('reg-dog-age-year')?.value,
        dogAgeMonths: document.getElementById('reg-dog-age-month')?.value,
        dogGender: document.querySelector('input[name="reg-dog-gender"]:checked')?.value,
        neutered: document.querySelector('input[name="reg-dog-neutered"]:checked')?.value === 'true',
        vaccinations: Array.from(document.querySelectorAll('input[name="reg-vaccine"]:checked')).map(cb => cb.value),
        concerns: document.getElementById('reg-concerns')?.value?.trim()
      };

      // 予約送信
      const payload = {
        action: isPaid ? 'createReservationWithPayment' : 'add_reservation',
        userId: AppState.lineUserId,
        lineUserId: AppState.lineUserId,
        date: AppState.selectedDate,
        time: AppState.selectedTime,
        trainerId: AppState.selectedTrainer,
        menuId: AppState.selectedMenu?.id,
        lesson_amount: AppState.lessonPrice,
        travel_fee: (AppState.travelFeeStatus === 'OVER_AREA' || AppState.travelFeeStatus === 'GEOCODE_FAILED') ? null : AppState.travelFee,
        totalPrice: AppState.totalPrice,
        paymentMethod: isPaid ? 'CREDIT' : 'CASH',
        paymentStatus: isPaid ? 'PAID' : 'UNPAID',
        regData: regData,
        isNewUser: true
      };

      if (isPaid && AppState.paymentToken) {
        payload.paymentData = JSON.stringify({
          amount: AppState.lessonPrice,
          total_amount: AppState.totalPrice,
          payment_method: 'CREDIT_CARD',
          square_source_id: AppState.paymentToken
        });
      }

      debugLog('📤 新規ユーザー予約送信:', 'info');
      debugLog(JSON.stringify(payload, null, 2), 'info');

      const result = await apiCall('POST', payload);

      if (result.success || result.status === 'success') {
        debugLog('✅ 新規ユーザー予約確定成功', 'success');

        // AppStateに登録情報を保存（View5表示用）
        AppState.userData = { name: regData.name, address: regData.address };
        AppState.selectedDog = { name: regData.dogName, dog_gender: regData.dogGender };

        hideLoading();
        goToView(5);
      } else {
        hideLoading();
        alert(`予約の確定に失敗しました: ${result.message || result.error}`);
      }

    } catch (error) {
      hideLoading();
      debugLog(`❌ 新規ユーザー予約エラー: ${error.message}`, 'error');
      alert('予約処理中にエラーが発生しました: ' + error.message);
    }
  }

  debugLog('📦 reservation.js ロード完了', 'success');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // グローバルエクスポート（HTMLのonclickから呼び出す関数）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  window.goToView = goToView;
  window.shiftMonth = shiftMonth;
  window.showDogSelectModal = showDogSelectModal;
  window.closeDogModal = closeDogModal;
  window.selectDogFromModal = selectDogFromModal;
  window.openTimeModal = openTimeModal;
  window.closeTimeModal = closeTimeModal;
  window.selectTime = selectTime;
  window.toggleAltAddress = toggleAltAddress;
  window.validateCoupon = validateCoupon;
  window.removeCoupon = removeCoupon;
  window.openTerms = openTerms;
  window.closeTerms = closeTerms;
  window.toggleAllTerms = toggleAllTerms;
  window.checkAllTerms = checkAllTerms;
  window.checkUserAndNext = checkUserAndNext;
  window.processPayment = processPayment;
  window.submitReservation = submitReservation;
  window.shareLine = shareLine;
  window.addToGoogleCalendar = addToGoogleCalendar;
  window.shareNative = shareNative;
  window.toggleAccordion = toggleAccordion;

  // 新規ユーザー用
  window.toggleNewUserAccordion = toggleNewUserAccordion;
  window.goToAccordionSection = goToAccordionSection;
  window.validateOwnerSection = validateOwnerSection;
  window.validateDogSection = validateDogSection;
  window.geocodeNewUserAddress = geocodeNewUserAddress;
  window.searchAddressByZip = searchAddressByZip;
  window.toggleNewUserPaymentMethod = toggleNewUserPaymentMethod;
  window.confirmNewUserReservation = confirmNewUserReservation;