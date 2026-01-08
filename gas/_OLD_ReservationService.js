/**
 * ============================================================================
 * K9 Harmony - Reservation Service Core
 * ============================================================================
 * @file    reservationService.gs
 * @version v2025.12.23-Phase2_Transit_Mode
 * @desc    予約枠の算出(移動時間計算含む)、および予約確定処理を担当するコアサービス。
 * 移動時間算出を公共交通機関(transit)モードに変更。
 */

// ============================================================================
// 1. Availability Logic (予約枠検索)
// ============================================================================

/**
 * 指定日の予約可能枠を取得する
 * @param {string} targetDateStr - 対象日 (yyyy-MM-dd)
 * @param {number} baseDurationMin - メニュー基本所要時間(分)
 * @param {string} targetAddress - 出張先住所 (オプション)
 * @return {Array} スロット情報の配列
 */
function getAvailableSlots(targetDateStr, baseDurationMin, targetAddress) {
  const timestamp = new Date();
  console.log(`[${timestamp.toISOString()}] [getAvailableSlots] Date:${targetDateStr}, Dur:${baseDurationMin}, Addr:${targetAddress}`);

  const slots = [];
  
  try {
    const targetDate = new Date(targetDateStr);
    if (isNaN(targetDate.getTime())) throw new Error('Invalid Date Format');

    // 設定読み込み
    const config = SYS_CONFIG.RESERVATION;
    const calendarId = getCalendarId();
    
    // カレンダーイベント取得
    const events = _fetchCalendarEvents(calendarId, targetDate);

    // 枠生成ループ
    // 10:00開始, 20:00終了
    let current = new Date(targetDate);
    current.setHours(config.START_HOUR, 0, 0, 0);
    
    const endTime = new Date(targetDate);
    endTime.setHours(config.END_HOUR, 0, 0, 0);

    while (current.getTime() + (baseDurationMin * 60000) <= endTime.getTime()) {
      const slotStart = new Date(current);
      const slotEnd = new Date(current.getTime() + (baseDurationMin * 60000));
      
      // 判定ロジック実行
      const checkResult = _checkSlotAvailability(slotStart, slotEnd, events, targetAddress, config);

      if (checkResult.available) {
        slots.push({
          start: Utilities.formatDate(slotStart, Session.getScriptTimeZone(), 'HH:mm'),
          end:   Utilities.formatDate(slotEnd, Session.getScriptTimeZone(), 'HH:mm'),
          travel_time: checkResult.travelTime,
          is_travel_ok: true
        });
      }

      // 次の枠へ (30分単位)
      current = new Date(current.getTime() + (config.SLOT_UNIT_MIN * 60000));
    }

  } catch (e) {
    console.error(`[getAvailableSlots Error] ${e.stack}`);
    // エラー時は空配列を返す（フロントエンドでハンドリング）
    return [];
  }

  return slots;
}

/**
 * [Private] 個別スロットの有効性判定
 * 時間重複、および移動時間を考慮して判定を行う
 */
function _checkSlotAvailability(slotStart, slotEnd, events, targetAddress, config) {
  // 1. 単純な時間重複チェック (カレンダー予定と被っていないか)
  // バッファ(前後15分)を含めてチェック
  const bufferMs = config.DEFAULT_BUFFER_MIN * 60000;
  const reqStart = new Date(slotStart.getTime() - bufferMs);
  const reqEnd   = new Date(slotEnd.getTime() + bufferMs);

  const hasOverlap = events.some(event => {
    if (event.isAllDayEvent()) return false; // 終日予定は無視（あるいは仕様によりブロック）
    const eStart = event.getStartTime();
    const eEnd   = event.getEndTime();
    return (reqStart < eEnd && reqEnd > eStart);
  });

  if (hasOverlap) return { available: false, reason: 'OVERLAP' };

  // 2. 移動時間チェック (住所指定時のみ)
  let travelTime = 0;
  if (targetAddress && getMapsApiKey()) {
    // 前の予定を探す
    const prevEvent = _findPrevEvent(events, slotStart);
    // 次の予定を探す
    const nextEvent = _findNextEvent(events, slotEnd);

    // (実装例) 直前予定からの移動
    if (prevEvent) {
      const pLoc = prevEvent.getLocation();
      if (pLoc) {
        // _calculateTravelTime は高コストなので、本来はCacheService必須
        const t = _calculateTravelTime(pLoc, targetAddress); 
        // 判定: 前予定終了 + 移動 + バッファ > スロット開始 ならNG
        const pEnd = prevEvent.getEndTime();
        if (pEnd.getTime() + (t * 60000) + bufferMs > slotStart.getTime()) {
           return { available: false, reason: 'TRAVEL_PREV' };
        }
      }
    }
    
    // (実装例) 直後予定への移動
    if (nextEvent) {
      const nLoc = nextEvent.getLocation();
      if (nLoc) {
        const t = _calculateTravelTime(targetAddress, nLoc);
        // 判定: スロット終了 + バッファ + 移動 > 次予定開始 ならNG
        const nStart = nextEvent.getStartTime();
        if (slotEnd.getTime() + bufferMs + (t * 60000) > nStart.getTime()) {
           return { available: false, reason: 'TRAVEL_NEXT' };
        }
      }
    }
  }

  return { available: true, travelTime: travelTime };
}


// ============================================================================
// 2. Reservation Logic (予約作成)
// ============================================================================

/**
 * 予約を作成する (排他制御・決済分岐・カレンダー同期)
 * @param {Object} data - リクエストデータ
 */
function createReservation(data) {
  const lock = LockService.getScriptLock();
  const timestamp = new Date();
  
  // 1. 排他制御 (Wait 10sec)
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'アクセス集中により処理できませんでした。再試行してください。' };
  }

  try {
    console.log(`[${timestamp.toISOString()}] [createReservation] Start. User:${data.userId}`);

    // 2. データ整形・計算
    const dateStr = data.targetDate;
    const timeStr = data.startTime;
    const startDateTime = new Date(`${dateStr} ${timeStr}`); // "2025/12/25 10:00"
    
    let duration = Number(data.menuDuration);
    let price = 0; // 仮計算

    // 多頭飼いオプション処理
    if (data.multiDog) {
      duration += SYS_CONFIG.RESERVATION.MULTI_DOG_EXTRA_MIN; // +30分
      price += SYS_CONFIG.RESERVATION.MULTI_DOG_PRICE;        // +2000円
    }
    
    const endDateTime = new Date(startDateTime.getTime() + (duration * 60000));

    // 3. 最終重複チェック (ダブルブッキング防止)
    // ここでは厳密にチェック
    const calendarId = getCalendarId();
    const cal = CalendarApp.getCalendarById(calendarId);
    const conflicts = cal.getEvents(startDateTime, endDateTime);
    if (conflicts.length > 0) {
      return { success: false, message: '申し訳ありません。タッチの差で予約枠が埋まりました。' };
    }

    // 4. 決済ステータス判定 (チケット vs Square)
    let paymentStatus = 'PENDING'; // デフォルトは現地払い/Square待ち
    let consumedTicket = false;

    // チケット残数確認 (main.gsの関数を利用)
    if (data.customerKey) {
       const tInfo = calculateTicketBalanceService_(data.customerKey);
       if (tInfo.balance > 0) {
         paymentStatus = 'TICKET';
         consumedTicket = true;
       }
    }

    // 5. カレンダー登録
    const title = `【K9】${data.customerName}様 / ${data.dogName || '犬なし'} / ${data.menuName}`;
    const desc = [
      `ResID: (Pending)`,
      `メニュー: ${data.menuName} (${duration}分)`,
      `多頭: ${data.multiDog ? 'あり' : 'なし'}`,
      `電話: ${data.customerPhone || '-'}`,
      `支払い: ${paymentStatus}`,
      `領収書: ${data.receiptRequired ? '要 (' + data.receiptAddressee + ')' : '不要'}`,
      `紹介コード: ${data.referralCode || '-'}`,
      `メモ: ${data.userNotes || '-'}`
    ].join('\n');

    const event = cal.createEvent(title, startDateTime, endDateTime, {
      description: desc,
      location: data.targetAddress || '出張先未定'
    });

    // 6. DB保存 (Reservations_2025 シート)
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SYS_CONFIG.SHEETS.RESERVATIONS);
    if (!sheet) {
      sheet = ss.insertSheet(SYS_CONFIG.SHEETS.RESERVATIONS);
      // Header作成
      sheet.appendRow(['res_id', 'customer_unique_key', 'dog_unique_key', 'start_time', 'end_time', 'status', 'payment_status', 'multi_dog_flag', 'receipt_required', 'receipt_addressee', 'referral_code', 'memo', 'google_calendar_id', 'created_at']);
    }

    const resId = 'RES-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    
    sheet.appendRow([
      resId,
      data.customerKey || '',
      data.dogId || '',
      Utilities.formatDate(startDateTime, Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss'),
      Utilities.formatDate(endDateTime, Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss'),
      'CONFIRMED',      // 予約確定
      paymentStatus,    // TICKET or PENDING
      data.multiDog ? 'TRUE' : 'FALSE',
      data.receiptRequired ? 'TRUE' : 'FALSE',
      data.receiptAddressee || '',
      data.referralCode || '',
      data.userNotes || '',
      event.getId(),
      new Date()
    ]);

    // カレンダーイベントにResIDを追記(Update)
    event.setDescription(`ResID: ${resId}\n` + desc);

    return { 
      success: true, 
      message: '予約が完了しました', 
      reservationId: resId 
    };

  } catch (e) {
    console.error(`[createReservation Error] ${e.stack}`);
    return { success: false, message: 'システムエラー: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 3. Helpers (Private)
// ============================================================================

function _fetchCalendarEvents(calId, date) {
  const start = new Date(date); start.setHours(0,0,0,0);
  const end = new Date(date); end.setHours(23,59,59,999);
  const cal = CalendarApp.getCalendarById(calId);
  return cal ? cal.getEvents(start, end) : [];
}

function _findPrevEvent(events, time) {
  // timeより前に終わるイベントの中で一番遅いもの
  const c = events.filter(e => e.getEndTime().getTime() <= time.getTime());
  c.sort((a,b) => b.getEndTime() - a.getEndTime());
  return c[0];
}

function _findNextEvent(events, time) {
  // timeより後に始まるイベントの中で一番早いもの
  const c = events.filter(e => e.getStartTime().getTime() >= time.getTime());
  c.sort((a,b) => a.getStartTime() - b.getStartTime());
  return c[0];
}

/**
 * Distance Matrix API (簡易版)
 */
function _calculateTravelTime(origin, dest) {
  if (!origin || !dest || origin === dest) return 0;
  
  const key = getMapsApiKey();
  if (!key) return 30; // キー無しは安全策で30分

  // キャッシュキー生成
  const cache = CacheService.getScriptCache();
  const cacheKey = `DIST_${Utilities.base64Encode(origin + '_' + dest)}`;
  const cached = cache.get(cacheKey);
  if (cached) return Number(cached);

  try {
    // 【修正箇所】mode=transit (公共交通機関) に変更
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(dest)}&mode=transit&language=ja&key=${key}`;
    const res = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
    const json = JSON.parse(res.getContentText());
    
    if (json.status === 'OK' && json.rows[0].elements[0].status === 'OK') {
      const sec = json.rows[0].elements[0].duration.value;
      const min = Math.ceil(sec / 60);
      // キャッシュ保存(6時間)
      cache.put(cacheKey, String(min), 21600);
      return min;
    }
  } catch(e) {
    console.warn('DistanceMatrix Error:', e);
  }
  return 60; // エラー時は安全策で60分
}