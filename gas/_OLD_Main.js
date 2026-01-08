/**
 * ============================================================================
 * K9 Harmony Portal - Main Backend Logic (Cleaned & Integrated)
 * ============================================================================
 * @file    main.gs
 * @version v2025.12.27-Backend-Send-Addon
 * @desc    Utils.gsの機能を活用し、競合を解消したメインロジック。
 * DB拡張情報の取得(SquareID, Referral等)およびLINEプッシュ送信機能を含む。
 */

const ACTION_GET_TICKET_BALANCE = 'getTicketBalance';

// ▼▼▼ ログ出力関数 (CONFIG.SHEET.LOG を使用) ▼▼▼
function _log_Main(level, msg, data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // Utils.gs の CONFIG を参照
    const logSheetName = (typeof CONFIG !== 'undefined' && CONFIG.SHEET && CONFIG.SHEET.LOG) ? CONFIG.SHEET.LOG : 'System_Logs';
    let sheet = ss.getSheetByName(logSheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(logSheetName);
      sheet.appendRow(['Timestamp', 'Level', 'Message', 'Details']);
    }
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss');
    
    // 後方互換性
    if (data === undefined && (level && !msg)) {
        msg = level;
        level = 'INFO';
    }
    if (!level) level = 'INFO';

    const dataStr = data ? JSON.stringify(data) : '';
    sheet.appendRow([now, level, msg, dataStr]);
    console.log(`[${level}] ${msg}`);

  } catch(e) {
    console.error('Log failed: ' + e.message);
  }
}

/**
 * [Router] HTTP GET
 */
function doGet(e) {
  _log_Main('INFO', '[doGet] Request received.');

  let result = {};
  
  try {
    const params   = e.parameter;
    const userId   = params.userId;
    const type     = params.type || 'data';
    const dogId    = params.dogId;

    if(!userId && type !== 'check_voucher') throw new Error('No User ID provided');

    // ▼▼▼ [追記] クーポン照合 ▼▼▼
    if (type === 'check_voucher') {
        result = checkVoucherCode_(params.code);
    } 
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
    // --- PDF Generation ---
    else if (type.startsWith('pdf_')) {
      if (typeof generatePdfForApi !== 'function') throw new Error('Disaster module not loaded.');
      const docType = type.replace('pdf_', ''); 
      result = generatePdfForApi(userId, dogId, docType);
    } 
    // --- Image Retrieval ---
    else if (type === 'img_profile') {
      result = getProfileImage(userId, dogId);
    } 
    // --- Lesson Image Retrieval ---
    else if (type === 'img_latest') {
      result = getLatestLessonImages(userId, dogId);
    }
    // --- Milestone Retrieval ---
    else if (type === 'milestone') {
      if (typeof getMilestoneService !== 'function') throw new Error('Milestone module not loaded.');
      result = getMilestoneService(dogId);
    }
    // --- Main Data Retrieval ---
    else {
      result = getAllData(userId, dogId);
    }

  } catch (err) {
    const errMsg = err.toString();
    _log_Main('ERROR', '[doGet Error]', errMsg);
    result = { error: 'System Error: ' + errMsg };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * [Router] HTTP POST
 */
function doPost(e) {
  _log_Main('INFO', '[doPost] START');

  const result = { status: 'error', message: 'Invalid request' };

  try {
    if (!e || !e.postData) throw new Error('No post data');
    
    let requestData;
    try {
        requestData = JSON.parse(e.postData.contents);
    } catch(err) {
        try { requestData = JSON.parse(e.postData.contents); } 
        catch(e2) { throw new Error('JSON Parse Error'); }
    }

    const action = requestData.action;
    _log_Main('INFO', `[doPost] Action identified: ${action}`);

    if (action === ACTION_GET_TICKET_BALANCE) {
        if (typeof PaymentService !== 'undefined') {
             const balanceData = PaymentService.getTicketBalance(requestData.customer_unique_key);
             result.status = 'success';
             result.data = balanceData;
        } else {
             const balanceData = calculateTicketBalanceService_(requestData.customer_unique_key);
             result.status = 'success';
             result.data = balanceData;
        }
    } else if (action === 'markMilestoneSeen') {
        if (typeof markMilestoneAsSeen !== 'function') throw new Error('Milestone module not loaded.');
        const mResult = markMilestoneAsSeen(requestData.dogId, requestData.milestoneId);
        result.status = mResult.success ? 'success' : 'error';
    } else if (action === 'get_slots') {
        if (typeof getAvailableSlots !== 'function') throw new Error('Reservation module (getAvailableSlots) not loaded.');
        const slots = getAvailableSlots(requestData.targetDate, Number(requestData.menuDuration), requestData.targetAddress);
        result.status = 'success';
        result.data = slots;
    // ▼▼▼ [追記] 週間空き状況取得 ▼▼▼
    } else if (action === 'get_week_availability') {
        result.status = 'success';
        result.data = getWeekAvailability_(requestData.startDate, Number(requestData.menuDuration), requestData.targetAddress);
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
    // ▼▼▼ [追記] LINEプッシュ送信 ▼▼▼
    } else if (action === 'send_line_msg') {
        const sendRes = sendLinePushMessage_(requestData.userId, requestData.message);
        if (sendRes.success) {
            result.status = 'success';
        } else {
            result.status = 'error';
            result.message = sendRes.error;
        }
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
    } else if (action === 'add_reservation') {
        if (typeof createReservation !== 'function') throw new Error('Reservation module (createReservation) not loaded.');
        const resultData = createReservation(requestData);
        result.status = resultData.success ? 'success' : 'error';
        result.message = resultData.message;
        result.data = { reservationId: resultData.reservationId };
    } else if (action === 'get_admin_dashboard' || action === 'admin_toggle_maintenance') {
        if (action === 'get_admin_dashboard' && typeof getAdminDashboardData === 'function') {
            result.status = 'success';
            result.data = getAdminDashboardData();
        }
    } else {
        result.message = 'Unknown action: ' + action;
        _log_Main('WARN', 'Unknown action', action);
    }
  } catch (error) {
    const errMsg = error.toString();
    _log_Main('ERROR', '[doPost Error]', errMsg);
    result.message = errMsg;
  }
  
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * ----------------------------------------------------------------------------
 * [Logic] 全データ取得 (Utils.gs 連携・DB拡張版)
 * ----------------------------------------------------------------------------
 */
function getAllData(lineUserId, targetDogId) {
  _log_Main('INFO', `[getAllData] Start. User: ${lineUserId}`);
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Utils.gs の CONFIG を使用
  const shCust = ss.getSheetByName(CONFIG.SHEET.CUSTOMER);
  const shDog  = ss.getSheetByName(CONFIG.SHEET.DOG);
  const shLog  = ss.getSheetByName(CONFIG.SHEET.LESSON);
  
  if (!shCust || !shDog || !shLog) {
      _log_Main('ERROR', 'Required sheets not found.');
      throw new Error('Required sheets not found. Check Utils.gs CONFIG.');
  }
  
  // 1. 顧客特定
  const custData = shCust.getDataRange().getValues();
  // Utils.gs の getColumnMap を使用
  const cMap = getColumnMap(shCust);

  // 必須カラムチェック (Two-Step Verification Step 1)
  if (cMap['line_user_id'] === undefined || cMap['customer_unique_key'] === undefined) {
      _log_Main('ERROR', '[CRITICAL] Essential columns missing in Customer Sheet.', cMap);
      throw new Error('System Config Error: Essential columns missing.');
  }

  let targetCust = null;
  
  for (let i = 1; i < custData.length; i++) {
    // Utils.gs の getVal を使用
    const rowLineId = String(getVal(custData[i], cMap, 'line_user_id'));
    if (rowLineId.indexOf(lineUserId) > -1) {
      targetCust = {
        id:          String(getVal(custData[i], cMap, 'customer_unique_key')), 
        unique_key:  String(getVal(custData[i], cMap, 'customer_unique_key')), 
        code:        getVal(custData[i], cMap, 'customer_code'),
        name:        getVal(custData[i], cMap, 'customer_name'),
        phone:       getVal(custData[i], cMap, 'customer_phone'),
        address:     getVal(custData[i], cMap, 'customer_address_1') + getVal(custData[i], cMap, 'customer_address_2'),
        em_name:     getVal(custData[i], cMap, 'em_contact_name'), 
        em_phone:    getVal(custData[i], cMap, 'em_contact_phone'),
        
        // Utils.gs の valOrNone を使用
        proxy_name: valOrNone(getVal(custData[i], cMap, 'em_proxy_name')), 
        proxy_phone:valOrNone(getVal(custData[i], cMap, 'em_proxy_phone')),
        evac_site:  valOrNone(getVal(custData[i], cMap, 'evacuation_site')),
        
        // Utils.gs の formatDateSafe を使用
        birth_date: formatDateSafe(getVal(custData[i], cMap, 'customer_birth_date'), 'yyyy/MM/dd'),
        
        // ▼ [Phase 1] DB拡張 (Utils.gs ヘルパー使用)
        shared_folder_id: getVal(custData[i], cMap, 'shared_folder_id'),
        square_id:      valOrNone(getVal(custData[i], cMap, 'square_cust_id')),
        referral_code:  valOrNone(getVal(custData[i], cMap, 'referral_code')),
        referred_by:    valOrNone(getVal(custData[i], cMap, 'referred_by')),
        is_blacklisted: getVal(custData[i], cMap, 'is_blacklisted'),
        line_blocked:   getVal(custData[i], cMap, 'line_blocked_flag'),
        
        base_lat:       getVal(custData[i], cMap, 'base_lat'),
        base_lng:       getVal(custData[i], cMap, 'base_lng')
      };
      break;
    }
  }
  
  // 新規顧客の場合 (productsリストだけは返す)
  if (!targetCust) {
      _log_Main('WARN', `[getAllData] User Unregistered.`);
      return { 
          customer: null, // 新規フラグ
          products: getProductsList_() 
      };
  }

  // Two-Step Verification Step 2: Fallback
  if (!targetCust.unique_key) {
      targetCust.unique_key = lineUserId;
      targetCust.id = lineUserId;
  }

  // 2. 犬情報の取得
  const dogData = shDog.getDataRange().getValues();
  const dMap = getColumnMap(shDog);
  let userDogs = [];

  for (let i = 1; i < dogData.length; i++) {
    const rowCustKey = String(getVal(dogData[i], dMap, 'customer_unique_key'));
    if (rowCustKey === targetCust.unique_key) {
      const gender = getVal(dogData[i], dMap, 'dog_gender');
      const rawName = getVal(dogData[i], dMap, 'dog_name');
      let honorific = (['オス','Male','♂'].includes(gender)) ? 'くん' : 'ちゃん';
      const bDateStr = formatDateSafe(getVal(dogData[i], dMap, 'dog_birth_date'), 'yyyy/MM/dd');
      
      let age = '-';
      if(bDateStr) {
          const bDate = new Date(bDateStr);
          const today = new Date();
          let y = today.getFullYear() - bDate.getFullYear();
          let m = today.getMonth() - bDate.getMonth();
          if (today.getDate() < bDate.getDate()) m--;
          if (m < 0) { y--; m += 12; }
          age = `${y}歳${m}ヶ月`;
      }

      userDogs.push({
        id:          String(getVal(dogData[i], dMap, 'dog_unique_key')),
        code:        getVal(dogData[i], dMap, 'dog_code'),
        name:        rawName,
        name_disp:   rawName + honorific,
        birth_date: bDateStr,
        age:        age,
        breed:      valOrNone(getVal(dogData[i], dMap, 'breed')),
        gender:     valOrNone(gender),
        color:      valOrNone(getVal(dogData[i], dMap, 'coat_color')),
        neutered:   valOrNone(getVal(dogData[i], dMap, 'neutered')),
        vet_name:   valOrNone(getVal(dogData[i], dMap, 'vet_name')),
        vet_address: valOrNone(getVal(dogData[i], dMap, 'vet_address')),
        vet_phone:   valOrNone(getVal(dogData[i], dMap, 'vet_phone')),
        history:     valOrNone(getVal(dogData[i], dMap, 'dog_medical_history')),
        medicine:    valOrNone(getVal(dogData[i], dMap, 'dog_medicine')),
        allergy:     valOrNone(getVal(dogData[i], dMap, 'dog_allergy')),
        caution:     valOrNone(getVal(dogData[i], dMap, 'dog_caution')),
        license_no:  valOrNone(getVal(dogData[i], dMap, 'dog_license_no')),
        microchip:   valOrNone(getVal(dogData[i], dMap, 'dog_microchip')),
        food:        valOrNone(getVal(dogData[i], dMap, 'dog_food')),
        photo_val:   getVal(dogData[i], dMap, 'dog_photo') 
      });
    }
  }

  // 犬がいない場合も、商品リストは返す
  if (userDogs.length === 0) {
      return { 
          customer: targetCust,
          products: getProductsList_(),
          error: 'No Dog Found'
      };
  }
  
  let targetDog = userDogs[0];
  if (targetDogId) { 
    const found = userDogs.find(d => d.id === targetDogId); 
    if (found) targetDog = found; 
  }

  // 3. レッスン履歴 & 最新
  const lessonData = getLessonData_(ss, targetDog.id);
  const latestLesson = lessonData.latest;
  const history = lessonData.history;
  const totalTrainingTime = history.length * 1.5;

  // 4. チケット残数計算
  let ticketInfo = { balance: 0 };
  try {
      if (typeof PaymentService !== 'undefined') {
          ticketInfo = PaymentService.getTicketBalance(targetCust.unique_key);
      } else {
          ticketInfo = calculateTicketBalanceService_(targetCust.unique_key);
      }
  } catch (e) {
      _log_Main('WARN', "Ticket calc warning: " + e.toString());
      ticketInfo.balance = 0; 
  }

  // ▼▼▼ [追記] 商品情報の取得 (予約画面メニュー用) ▼▼▼
  const products = getProductsList_();
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  return { 
    customer: targetCust, 
    dog: targetDog, 
    ticket_count: ticketInfo.balance, 
    total_training_time: totalTrainingTime,
    latest: latestLesson, 
    history: history, 
    score_history: history, 
    multiple_dogs: (userDogs.length > 1 && !targetDogId) ? userDogs : null,
    all_dogs: userDogs,
    products: products // [追記] フロントへ渡す
  };
}

/**
 * レッスンデータ取得ロジック
 */
function getLessonData_(ss, dogId) {
  const shLog = ss.getSheetByName(CONFIG.SHEET.LESSON);
  if (!shLog) return { latest: null, history: [] };

  const data = shLog.getDataRange().getValues();
  const map = getColumnMap(shLog);
  
  let logs = [];
  for (let i = 1; i < data.length; i++) {
    if (String(getVal(data[i], map, 'dog_unique_key')) === String(dogId)) {
      logs.push(data[i]);
    }
  }
  
  logs.sort((a, b) => new Date(getVal(b, map, 'training_date')) - new Date(getVal(a, map, 'training_date')));
  
  const history = [];
  let latestLesson = null;

  for (const row of logs) {
      const scores = [];
      for(let j=1; j<=10; j++) scores.push(Number(getVal(row, map, `score_${j}`)) || 0);
      const details = [];
      for(let j=1; j<=10; j++) details.push(String(getVal(row, map, `score_detail_${j}`) || ''));
      const dVal = new Date(getVal(row, map, 'training_date'));
      const dStr = formatDateSafe(dVal, 'yyyy/MM/dd');
      const hasPhoto = !!getVal(row, map, 'training_photo_1');

      const lessonObj = {
          id: getVal(row, map, 'training_unique_key'),
          date: dStr,
          scores: scores,
          details: details,
          comment: getVal(row, map, 'comment_trainer'),
          homework: getVal(row, map, 'next_homework'),
          goal: getVal(row, map, 'goal'),
          done: getVal(row, map, 'done'),
          unable: getVal(row, map, 'unable'),
          next_goal: getVal(row, map, 'next_goal'),
          has_photos: hasPhoto
      };

      history.push(lessonObj);
      if (!latestLesson) latestLesson = lessonObj; 
  }

  if (latestLesson) {
      const dVal = new Date(latestLesson.date);
      const d7 = new Date(dVal); d7.setDate(dVal.getDate() + 7);
      const d10 = new Date(dVal); d10.setDate(dVal.getDate() + 10);
      latestLesson.recommend_date = `${d7.getMonth()+1}/${d7.getDate()} 〜 ${d10.getMonth()+1}/${d10.getDate()}`;
      
      const latestRow = logs[0];
      const photoKeys = [1,2,3,4,5];
      latestLesson.image_paths = photoKeys.map(k => getVal(latestRow, map, `training_photo_${k}`));
  }
  return { latest: latestLesson, history: history };
}

// --- Helpers (Images) ---
function getProfileImage(lineUserId, dogId) {
  const all = getAllData(lineUserId, dogId);
  if (all.error || !all.dog) return { image: null };
  const rawPath = all.dog.photo_val; 
  // Utils.gs の CONFIG を使用
  const folderId = CONFIG.FOLDER.DOG_SEARCH_FALLBACK;
  const b64 = getImageBase64(rawPath, folderId);
  return { image: b64 };
}

function getLatestLessonImages(lineUserId, dogId) {
  const all = getAllData(lineUserId, dogId);
  if (all.error || !all.latest) return { images: [] };

  const paths = all.latest.image_paths || [];
  const images = [];
  // Utils.gs の CONFIG を使用
  const folderId = CONFIG.FOLDER.DOG_SEARCH_FALLBACK;

  for(const path of paths) {
      if(path) {
          const b64 = getImageBase64(path, folderId); 
          if (b64) images.push(b64);
      }
  }
  return { images: images };
}

// --- 旧チケット計算関数 (FallBack用) ---
function calculateTicketBalanceService_(customerUniqueKey) {
  if (!customerUniqueKey) throw new Error('customer_unique_key is required.');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const productSheet = ss.getSheetByName(CONFIG.SHEET.PRODUCT);
  if (!productSheet) return { purchased: 0, used: 0, balance: 0 };
  
  // Utils.gs の getSheetDataAsObjects_ が無い場合があるのでローカル定義は削除せず、
  // ただし Utils.gs にあればそれを使いたいが、Utils.gsには無いようなので
  // このファイル下部にあるローカル関数を利用する。
  const products = getSheetDataAsObjects_(productSheet);
  const productTicketMap = {};
  products.forEach(row => {
    const count = row['ticket_count'] ? Number(row['ticket_count']) : 0;
    productTicketMap[row['product_unique_key']] = count;
  });

  const salesSheet = ss.getSheetByName(CONFIG.SHEET.SALES);
  if (!salesSheet) return { purchased: 0, used: 0, balance: 0 };
  
  const sales = getSheetDataAsObjects_(salesSheet);
  let totalPurchased = 0;
  sales.forEach(row => {
    if (row['customer_unique_key'] === customerUniqueKey) {
      const pKey = row['product_unique_key'];
      if (productTicketMap.hasOwnProperty(pKey)) {
        totalPurchased += productTicketMap[pKey];
      }
    }
  });

  const trainingSheet = ss.getSheetByName(CONFIG.SHEET.LESSON);
  if (!trainingSheet) return { purchased: 0, used: 0, balance: 0 };
  
  const trainings = getSheetDataAsObjects_(trainingSheet);
  let totalUsed = 0;
  trainings.forEach(row => {
    if (row['customer_unique_key'] === customerUniqueKey) {
      totalUsed++;
    }
  });

  return { purchased: totalPurchased, used: totalUsed, balance: totalPurchased - totalUsed };
}

// ローカルヘルパー: シート全体をオブジェクト配列化
function getSheetDataAsObjects_(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const data = [];
  const map = {};
  headers.forEach((h, i) => map[String(h).trim()] = i);
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowObj = {};
    for (let key in map) {
      rowObj[key] = row[map[key]];
    }
    data.push(rowObj);
  }
  return data;
}

// ▼▼▼ [追記] 商品一覧取得ヘルパー関数 ▼▼▼
function getProductsList_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET.PRODUCT);
    if(!sheet) return [];
    
    const data = getSheetDataAsObjects_(sheet);
    const list = [];
    
    data.forEach(row => {
      // 販売中のトレーニングまたはオプション商品を取得
      if(row['product_status'] === '販売中' && row['product_name']) {
        list.push({
          key: row['product_code'], 
          name: row['product_name'],
          price: Number(row['product_price']) || 0,
          category: row['product_category']
        });
      }
    });
    return list;
  } catch(e) {
    _log_Main('ERROR', 'Product Fetch Error: ' + e.message);
    return [];
  }
}
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// ▼▼▼ [追記] クーポン/紹介コード照合関数 ▼▼▼
function checkVoucherCode_(code) {
    if (!code) return { valid: false, message: 'コードが空です' };
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. クーポンシート検索
    const shCoupon = ss.getSheetByName('クーポン'); 
    if (shCoupon) {
        const coupons = getSheetDataAsObjects_(shCoupon);
        const today = new Date();
        const target = coupons.find(c => String(c['coupon_code']) === code && c['coupon_status'] === '有効');
        
        if (target) {
            // 期限チェック
            const start = target['coupon_start_date'] ? new Date(target['coupon_start_date']) : null;
            const end = target['coupon_end_date'] ? new Date(target['coupon_end_date']) : null;
            if (start && today < start) return { valid: false, message: '有効期間前です' };
            if (end && today > end) return { valid: false, message: '有効期限切れです' };
            
            return {
                valid: true,
                type: 'COUPON',
                name: target['coupon_name'],
                discount_type: target['discount_type'], // '定額' or '定率'
                discount_value: Number(target['discount_value'])
            };
        }
    }

    // 2. 友人紹介コード検索 (Customerシート)
    const shCust = ss.getSheetByName(CONFIG.SHEET.CUSTOMER);
    if (shCust) {
        const customers = getSheetDataAsObjects_(shCust);
        // referral_code列が存在すると仮定
        const referrer = customers.find(c => String(c['referral_code']) === code);
        if (referrer) {
            return {
                valid: true,
                type: 'REFERRAL',
                name: 'お友達紹介特典',
                discount_type: '定額',
                discount_value: 1000 // 仮: 紹介割引額
            };
        }
    }

    return { valid: false, message: '無効なコードです' };
}
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// ▼▼▼ [追記] 週間空き状況取得関数 (予約枠ブロック用) ▼▼▼
function getWeekAvailability_(startDateStr, duration, address) {
    if (typeof getAvailableSlots !== 'function') return {};
    
    const start = new Date(startDateStr);
    const result = {};
    
    // 7日分ループして各日の空きスロットを取得
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const dStr = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        
        try {
            // 既存のgetAvailableSlotsを活用
            // duration, addressはリクエストから渡された値を使用
            const slots = getAvailableSlots(dStr, duration, address);
            // 時間(startプロパティ)だけの配列に変換
            result[dStr] = slots.map(s => s.start);
        } catch (e) {
            result[dStr] = []; // エラー時は空きなし
        }
    }
    return result;
}
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// ▼▼▼ [追記] LINEプッシュメッセージ送信関数 (Messaging API) ▼▼▼
function sendLinePushMessage_(userId, message) {
    // 【重要】ここにMessaging APIのチャネルアクセストークンを設定してください
    const CHANNEL_ACCESS_TOKEN = 'YOUR_CHANNEL_ACCESS_TOKEN'; 

    if (!userId || !message) return { success: false, error: 'No userID or message' };

    const url = 'https://api.line.me/v2/bot/message/push';
    const payload = {
        to: userId,
        messages: [{ type: 'text', text: message }]
    };

    const options = {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    try {
        const response = UrlFetchApp.fetch(url, options);
        const code = response.getResponseCode();
        if (code === 200) {
            return { success: true };
        } else {
            return { success: false, error: `API Error: ${code} - ${response.getContentText()}` };
        }
    } catch (e) {
        return { success: false, error: e.toString() };
    }
}
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// ※以下、Utils.gsと重複するヘルパー関数 (getColumnMap, getVal, valOrNone, formatDateSafe, getImageBase64) は全て削除済み。
// main.gs は Utils.gs を自動的に参照します。