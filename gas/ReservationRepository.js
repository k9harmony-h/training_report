/**
 * ============================================================================
 * K9 Harmony - Reservation Repository
 * ============================================================================
 * ファイル名: ReservationRepository.gs
 * 役割: 予約情報のCRUD操作 + ステータス管理
 * 最終更新: 2026-01-18
 * バージョン: v1.0.2
 */

// ============================================================================
// 予約リポジトリ
// ============================================================================
var ReservationActorType = {
  WEB_RESERVATION: 'WEB_RESERVATION',  // Web予約フォームから
  ADMIN_APP: 'ADMIN_APP',              // 管理者アプリから
  SYSTEM: 'SYSTEM',                     // システム自動処理
  LINE_CHATBOT: 'LINE_CHATBOT',        // LINEチャットボット
  CUSTOMER: 'CUSTOMER'                  // 顧客による変更
};
var ReservationRepository = {
  
  /**
   * 予約作成
   * @param {Object} data 予約データ
   * @return {Object} 作成された予約データ
   */
  create: function(data) {
  var context = { service: 'ReservationRepository', action: 'create' };
  
  try {
    // 1. バリデーション
    var errors = ValidationRules.reservation(data);
    if (errors.length > 0) {
      throw errors[0];
    }
    
    // 2. ダブルブッキングチェック
    this._checkDoubleBooking(data);
    
    // 3. 関連データ存在確認
    this._validateRelatedEntities(data);
    
    // 4. 予約コード自動採番
    if (!data.reservation_code) {
      data.reservation_code = this._generateReservationCode();
    }
    
    // 5. ID生成
    data.reservation_id = Utilities.getUuid();
    
    // 6. デフォルト値設定
    data.status = data.status || 'PENDING';
    data.requires_receipt = data.requires_receipt || false;
    data.created_at = new Date();
    data.updated_at = new Date();
    
    // ===== 7. DB保存用データ作成 =====
var now = new Date();
var dbData = {
  reservation_id: data.reservation_id,
  reservation_code: data.reservation_code,
  customer_id: data.customer_id,
  primary_dog_id: data.primary_dog_id,
  additional_dog_ids: data.additional_dog_ids || '',
  trainer_id: data.trainer_id,
  office_id: data.office_id,
  product_id: data.product_id,
  reservation_date: data.reservation_date,
  start_time: data.start_time,
  end_time: data.end_time,
  duration_minutes: data.duration_minutes,
  reservation_type: data.reservation_type || 'SINGLE',
  is_multi_dog: data.is_multi_dog || false,
  location_type: data.location_type || 'OUTDOOR',
  location_address: data.location_address || '',
  location_lat: data.location_lat || null,
  location_lng: data.location_lng || null,
  
  // ===== 別住所情報 =====
  alt_address: data.alt_address || null,
  alt_location_lat: data.alt_location_lat || null,
  alt_location_lng: data.alt_location_lng || null,
  alt_building_name: data.alt_building_name || null,
  alt_landmark: data.alt_landmark || null,
  alt_location_type: data.alt_location_type || null,
  alt_remarks: data.alt_remarks || null,

  // ===== クーポン情報 =====
  coupon_id: data.coupon_id || null,
  coupon_code: data.coupon_code || null,
  coupon_value: data.coupon_value || 0,

  // ===== 金額情報 =====
  lesson_amount: data.lesson_amount || 0,
  travel_fee: data.travel_fee || 0,
  total_amount: data.total_amount || 0,
  payment_method: data.payment_method || null,

  status: data.status,
  payment_status: data.payment_status,
  cancellation_reason: '',
  cancelled_at: null,
  cancelled_by: null,
  google_calendar_id: null,
  requires_receipt: data.requires_receipt || false,
  receipt_addressee: data.receipt_addressee || null,
  receipt_issued_at: null,
  customer_memo: data.notes || '',
  trainer_memo: '',
  created_at: now,
  updated_at: now,
  created_by: data.created_by || ReservationActorType.SYSTEM,
  updated_by: ReservationActorType.SYSTEM
};

// ===== デバッグログ追加 =====
log('INFO', 'ReservationRepository', 'DB insert data check', {
  reservation_id: dbData.reservation_id,
  alt_address: dbData.alt_address,
  alt_location_lat: dbData.alt_location_lat,
  alt_location_lng: dbData.alt_location_lng,
  alt_building_name: dbData.alt_building_name,
  alt_landmark: dbData.alt_landmark,
  alt_location_type: dbData.alt_location_type,
  alt_remarks: dbData.alt_remarks
});

// ===== DB挿入（1回のみ）=====
DB.insert(CONFIG.SHEET.RESERVATIONS, dbData);
    
// ===== 8. Googleカレンダー登録 =====
try {
  log('INFO', 'ReservationRepository', 'Starting calendar event creation');
  
  // ===== 重要：dataをdbDataにマージしてから渡す =====
  var calendarData = {};
  for (var key in data) {
    if (data.hasOwnProperty(key)) {
      calendarData[key] = data[key];
    }
  }
  for (var key in dbData) {
    if (dbData.hasOwnProperty(key)) {
      calendarData[key] = dbData[key];
    }
  }
  
  var calendarRepo = new CalendarRepository();
  var calendarResult = calendarRepo.createReservationEvent(calendarData);
  
  log('INFO', 'ReservationRepository', 'Calendar result: ' + JSON.stringify(calendarResult));
  
  if (calendarResult.success) {
    // カレンダーイベントIDを保存
    DB.update(CONFIG.SHEET.RESERVATIONS, data.reservation_id, {
      google_calendar_id: calendarResult.event_id
    });
    log('INFO', 'ReservationRepository', 'Calendar event created: ' + calendarResult.event_id);
  } else {
    log('ERROR', 'ReservationRepository', 'Calendar event creation failed: ' + calendarResult.error);
  }
} catch (calendarError) {
  // カレンダー登録失敗はエラーログのみ（予約自体は成功）
  log('ERROR', 'ReservationRepository', 'Calendar exception: ' + calendarError.message);
  log('ERROR', 'ReservationRepository', 'Stack: ' + calendarError.stack);
}
    
    // 9. 監査ログ記録
    if (typeof AuditService !== 'undefined') {
      AuditService.logSafe('reservation', data.reservation_id, 'CREATE', null, data, 'CUSTOMER', data.customer_id);
    }
    
    log('INFO', 'ReservationRepository', 'Reservation created: ' + data.reservation_code);
    
    return data;
    
  } catch (error) {
    return ErrorHandler.handle(error, context);
  }
},
  
  /**
   * 仮予約作成（10分間確保）
   * @param {Object} data 予約データ
   * @return {Object} 作成された仮予約データ
   */
  createTempReservation: function(data) {
    var context = { service: 'ReservationRepository', action: 'createTempReservation' };
    
    try {
      // ダブルブッキングチェック
      this._checkDoubleBooking(data);
      
      data.reservation_id = Utilities.getUuid();
      data.reservation_code = this._generateReservationCode();
      data.status = 'TEMP'; // 仮予約ステータス
      data.temp_reserved_at = new Date();
      data.temp_expires_at = new Date(new Date().getTime() + 10 * 60 * 1000); // 10分後
      data.created_at = new Date();
      data.updated_at = new Date();
      
      DB.insert(CONFIG.SHEET.RESERVATIONS, data);
      
      log('INFO', 'ReservationRepository', 'Temp reservation created: ' + data.reservation_code);
      
      return data;
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 仮予約を本予約に昇格
   * @param {string} reservationId 予約ID
   * @return {Object} 更新された予約データ
   */
  confirmTempReservation: function(reservationId) {
    return this.update(reservationId, {
      status: 'CONFIRMED',
      temp_expires_at: null
    });
  },
  
  /**
   * 期限切れ仮予約の自動削除
   * トリガー: 毎分実行
   */
  cleanupExpiredTempReservations: function() {
    try {
      var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
      var now = new Date();
      var cleanedCount = 0;
      
      reservations.forEach(function(reservation) {
        if (reservation.status === 'TEMP' && reservation.temp_expires_at) {
          var expiresAt = new Date(reservation.temp_expires_at);
          
          if (now > expiresAt) {
            DB.update(CONFIG.SHEET.RESERVATIONS, reservation.reservation_id, {
              status: 'EXPIRED',
              updated_at: new Date()
            });
            
            cleanedCount++;
          }
        }
      });
      
      if (cleanedCount > 0) {
        log('INFO', 'ReservationRepository', 'Cleaned up ' + cleanedCount + ' expired temp reservations');
      }
      
      return { success: true, count: cleanedCount };
      
    } catch (error) {
      log('ERROR', 'ReservationRepository', 'Cleanup failed: ' + error.message);
      return { error: true, message: error.message };
    }
  },
  
  /**
   * ダブルブッキングチェック
   */
  _checkDoubleBooking: function(data) {
    var existingReservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
    
    var conflicts = existingReservations.filter(function(r) {
      // 同じトレーナー・同じ日時・有効なステータス
      return r.trainer_id === data.trainer_id &&
             r.reservation_date === data.reservation_date &&
             ['PENDING', 'CONFIRMED', 'TEMP'].indexOf(r.status) !== -1;
    });
    
    if (conflicts.length > 0) {
      throw ErrorHandler.validationError(
        'reservation_date',
        'This time slot is already reserved'
      );
    }
  },
  
  /**
   * 予約検索（ID）
   */
  findById: function(reservationId) {
    try {
      var reservation = DB.findById(CONFIG.SHEET.RESERVATIONS, reservationId);
      
      if (!reservation) {
        throw ErrorHandler.notFoundError('Reservation', reservationId);
      }
      
      return reservation;
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'ReservationRepository', action: 'findById' });
    }
  },
  
  /**
   * 顧客の予約一覧取得
   */
  findByCustomerId: function(customerId) {
    try {
      return DB.findBy(CONFIG.SHEET.RESERVATIONS, 'customer_id', customerId);
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'ReservationRepository', action: 'findByCustomerId' });
    }
  },
  
  /**
   * 日付範囲で予約検索
   */
  findByDateRange: function(startDate, endDate) {
    try {
      var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
      
      return reservations.filter(function(r) {
        var reservationDate = new Date(r.reservation_date);
        return reservationDate >= startDate && reservationDate <= endDate;
      });
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'ReservationRepository', action: 'findByDateRange' });
    }
  },
  
  /**
   * ステータス別予約取得
   */
  findByStatus: function(status) {
    try {
      return DB.findBy(CONFIG.SHEET.RESERVATIONS, 'status', status);
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'ReservationRepository', action: 'findByStatus' });
    }
  },
  
  /**
   * 予約更新
   */
  update: function(reservationId, data, actorType) {
  var context = { service: 'ReservationRepository', action: 'update' };
  
  try {
    var oldData = this.findById(reservationId);
    
    if (oldData.error) {
      throw oldData;
    }
    
    // ステータス変更時のバリデーション
    if (data.status) {
      this._validateStatusTransition(oldData.status, data.status);
    }
    
    data.updated_at = new Date();
    data.updated_by = actorType || ReservationActorType.SYSTEM;  // ← 追加
    
    DB.update(CONFIG.SHEET.RESERVATIONS, reservationId, data);
    
    if (typeof AuditService !== 'undefined') {
      AuditService.logSafe('reservation', reservationId, 'UPDATE', oldData, data, actorType, this._getCurrentUser());
    }
    
    log('INFO', 'ReservationRepository', 'Reservation updated: ' + reservationId);
    
    return this.findById(reservationId);
    
  } catch (error) {
    return ErrorHandler.handle(error, context);
  }
},
  
  /**
   * 予約キャンセル
   */
  cancel: function(reservationId, reason, actorType) {
  var context = { service: 'ReservationRepository', action: 'cancel' };
  
  try {
    var reservation = this.findById(reservationId);
    
    if (reservation.error) {
      throw reservation;
    }
    
    // キャンセル可能なステータスか確認
    var cancellableStatuses = ['PENDING', 'CONFIRMED'];
    if (cancellableStatuses.indexOf(reservation.status) === -1) {
      throw ErrorHandler.validationError(
        'status',
        'Cannot cancel reservation with status: ' + reservation.status
      );
    }
    
    var cancelData = {
      status: 'CANCELLED',
      cancellation_reason: reason || '',
      cancelled_at: new Date(),
      cancelled_by: actorType || ReservationActorType.CUSTOMER,  // ← 追加
      updated_at: new Date(),
      updated_by: actorType || ReservationActorType.CUSTOMER  // ← 追加
    };
    
    DB.update(CONFIG.SHEET.RESERVATIONS, reservationId, cancelData);
    
    if (typeof AuditService !== 'undefined') {
      AuditService.logSafe('reservation', reservationId, 'CANCEL', reservation, cancelData, actorType, reservation.customer_id);
    }
    
    log('INFO', 'ReservationRepository', 'Reservation cancelled: ' + reservationId);
    
    return this.findById(reservationId);
    
  } catch (error) {
    return ErrorHandler.handle(error, context);
  }
},
  
  /**
   * 予約完了
   */
  complete: function(reservationId) {
    return this.update(reservationId, {
      status: 'COMPLETED',
      completed_at: new Date()
    });
  },
  
  /**
   * No Show処理
   */
  markAsNoShow: function(reservationId) {
    return this.update(reservationId, {
      status: 'NO_SHOW',
      no_show_at: new Date()
    });
  },
  
  /**
   * 関連エンティティの存在確認
   */
  _validateRelatedEntities: function(data) {
    // 顧客確認
    var customer = CustomerRepository.findById(data.customer_id);
    if (customer.error) {
      throw ErrorHandler.notFoundError('Customer', data.customer_id);
    }
    
    // 犬確認
    var dog = DogRepository.findById(data.primary_dog_id);
    if (dog.error) {
      throw ErrorHandler.notFoundError('Dog', data.dog_id);
    }
    
    // トレーナー確認（実装予定）
    // var trainer = TrainerRepository.findById(data.trainer_id);
    
    // 事業所確認（実装予定）
    // var office = OfficeRepository.findById(data.office_id);
  },
  
  /**
   * ステータス遷移のバリデーション
   */
  _validateStatusTransition: function(oldStatus, newStatus) {
    var validTransitions = {
      'PENDING': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
      'COMPLETED': [],
      'CANCELLED': [],
      'NO_SHOW': []
    };
    
    var allowed = validTransitions[oldStatus] || [];
    
    if (allowed.indexOf(newStatus) === -1) {
      throw ErrorHandler.validationError(
        'status',
        'Invalid status transition: ' + oldStatus + ' -> ' + newStatus
      );
    }
  },
  
  /**
   * 予約コード自動採番
   * 形式: YYYYMMDD-XXXX
   */
  _generateReservationCode: function() {
    var today = new Date();
    var dateStr = Utilities.formatDate(today, 'JST', 'yyyyMMdd');
    
    var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
    
    // 今日の予約の最大番号を取得
    var maxNumber = 0;
    reservations.forEach(function(r) {
      if (r.reservation_code && r.reservation_code.startsWith(dateStr)) {
        var num = parseInt(r.reservation_code.split('-')[1]);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });
    
    var nextNumber = maxNumber + 1;
    var paddedNumber = ('0000' + nextNumber).slice(-4);
    
    return dateStr + '-' + paddedNumber;
  },
  
  /**
   * 現在のユーザー取得
   */
  _getCurrentUser: function() {
    try {
      return Session.getEffectiveUser().getEmail();
    } catch (e) {
      return 'SYSTEM';
    }
  },
  
  /**
   * 日付範囲で予約を取得（年またぎ対応・トレーナー指定可能）
   */
  getReservationsByDateRange: function(startDate, endDate, trainerId, statuses) {
    try {
      log('INFO', 'ReservationRepository', 'Fetching reservations by date range', {
        startDate: startDate,
        endDate: endDate,
        trainerId: trainerId
      });
      
      var startYear = startDate.getFullYear();
      var endYear = endDate.getFullYear();
      
      var allReservations = [];
      
      if (startYear === endYear) {
        allReservations = this._getReservationsFromYear(startYear, startDate, endDate, trainerId, statuses);
      } else {
        log('INFO', 'ReservationRepository', 'Year crossing detected: ' + startYear + ' - ' + endYear);
        
        var endOfStartYear = new Date(startYear, 11, 31, 23, 59, 59);
        var reservations1 = this._getReservationsFromYear(startYear, startDate, endOfStartYear, trainerId, statuses);
        
        var startOfEndYear = new Date(endYear, 0, 1, 0, 0, 0);
        var reservations2 = this._getReservationsFromYear(endYear, startOfEndYear, endDate, trainerId, statuses);
        
        allReservations = reservations1.concat(reservations2);
        
        log('INFO', 'ReservationRepository', 'Year crossing results: ' + startYear + '(' + reservations1.length + ') + ' + endYear + '(' + reservations2.length + ')');
      }
      
      log('INFO', 'ReservationRepository', 'Total reservations found: ' + allReservations.length);
      return allReservations;
      
    } catch (error) {
      log('ERROR', 'ReservationRepository', 'Failed to fetch reservations: ' + error.message);
      return [];
    }
  },

/**
 * 指定年の予約台帳から予約を取得（内部メソッド）
 */
_getReservationsFromYear: function(year, startDate, endDate, trainerId, statuses) {
  try {
    var spreadsheetId = CONFIG.SPREADSHEET.getTransIdForYear(year);
    
    if (!spreadsheetId) {
      log('WARN', 'ReservationRepository', 'No spreadsheet found for year: ' + year);
      return [];
    }
    
    log('INFO', 'ReservationRepository', 'Opening spreadsheet for year ' + year + ': ' + spreadsheetId);
    
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheetName = CONFIG.SHEET.RESERVATIONS;
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      log('WARN', 'ReservationRepository', 'Reservation sheet not found: ' + sheetName + ' in year ' + year);
      return [];
    }
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      log('INFO', 'ReservationRepository', 'No reservation data in sheet for year ' + year);
      return [];
    }
    
    var headers = data[0];
    var reservations = [];
    
    var indices = {};
    for (var i = 0; i < headers.length; i++) {
      indices[headers[i]] = i;
    }
    
    if (!statuses) {
      statuses = ['PENDING', 'CONFIRMED', 'TEMP'];
    }
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      if (!row[indices['reservation_id']]) {
        continue;
      }
      
      var status = row[indices['status']];
      if (statuses && statuses.indexOf(status) === -1) {
        continue;
      }
      
      if (trainerId && row[indices['trainer_id']] !== trainerId) {
        continue;
      }
      
      var reservationDate = new Date(row[indices['reservation_date']]);
      
      if (isNaN(reservationDate.getTime())) {
        continue;
      }
      
      if (reservationDate < startDate || reservationDate > endDate) {
        continue;
      }
      
      // ===== 修正: start_datetime と end_datetime を計算 =====
      var startTime = row[indices['start_time']];
      var endTime = row[indices['end_time']];
      var durationMinutes = row[indices['duration_minutes']];
      
      // start_datetimeを構築（reservation_date + start_time）
      var startDateTime;
      if (startTime instanceof Date) {
        // Date型の場合、時刻部分のみを取得
        startDateTime = new Date(reservationDate);
        startDateTime.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
      } else if (typeof startTime === 'string') {
        // 文字列の場合（"15:00"形式）
        var timeParts = startTime.split(':');
        startDateTime = new Date(reservationDate);
        startDateTime.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
      } else {
        // start_timeが不正な場合はスキップ
        log('WARN', 'ReservationRepository', 'Invalid start_time for reservation: ' + row[indices['reservation_id']]);
        continue;
      }
      
      // end_datetimeを構築
      var endDateTime;
      if (endTime instanceof Date && endTime.getHours() > 0) {
        // end_timeが設定されている場合
        endDateTime = new Date(reservationDate);
        endDateTime.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
      } else if (durationMinutes) {
        // duration_minutesから計算
        endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
      } else {
        // デフォルトは90分後
        endDateTime = new Date(startDateTime.getTime() + 90 * 60 * 1000);
      }
      
      var reservation = {
        reservation_id: row[indices['reservation_id']],
        reservation_code: row[indices['reservation_code']],
        customer_id: row[indices['customer_id']],
        primary_dog_id: row[indices['primary_dog_id']],
        trainer_id: row[indices['trainer_id']],
        reservation_date: reservationDate,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        start_datetime: startDateTime,
        end_datetime: endDateTime,
        status: status
      };
      
      reservations.push(reservation);
    }
    
    log('INFO', 'ReservationRepository', 'Found ' + reservations.length + ' reservations for year ' + year);
    return reservations;
    
  } catch (error) {
    log('ERROR', 'ReservationRepository', 'Failed to get reservations from year ' + year + ': ' + error.message);
    return [];
  }
}
};

// ============================================================================
// テスト関数
// ============================================================================

/**
 * 予約作成テスト
 */
function testReservationCreate() {
  console.log('=== Reservation Create Test ===\n');
  
  // 顧客と犬を取得
  var customers = CustomerRepository.findAll();
  if (customers.length === 0) {
    console.error('❌ No customers found.');
    return;
  }
  
  var customer = customers[0];
  var dogs = DogRepository.findByCustomerId(customer.customer_id);
  
  if (dogs.length === 0) {
    console.error('❌ No dogs found for customer.');
    return;
  }
  
  var dog = dogs[0];
  
  var testReservation = {
    customer_id: customer.customer_id,
    dog_id: dog.dog_id,
    trainer_id: 'e44b0184', // サンプルトレーナーID
    office_id: '0721fa20', // サンプル事業所ID
    reservation_date: '2026/03/01 10:00:00',
    requires_receipt: false
  };
  
  var result = ReservationRepository.create(testReservation);
  
  if (result.error) {
    console.error('❌ Create failed:', result.message);
  } else {
    console.log('✅ Reservation created:');
    console.log('  ID:', result.reservation_id);
    console.log('  Code:', result.reservation_code);
    console.log('  Date:', result.reservation_date);
    console.log('  Status:', result.status);
  }
}

/**
 * 予約ステータス変更テスト
 */
function testReservationStatusChange() {
  console.log('\n=== Reservation Status Change Test ===\n');
  
  var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
  var pendingReservations = reservations.filter(function(r) {
    return r.status === 'PENDING';
  });
  
  if (pendingReservations.length === 0) {
    console.log('No PENDING reservations found.');
    return;
  }
  
  var reservation = pendingReservations[0];
  console.log('Testing with reservation:', reservation.reservation_code);
  
  // PENDING → CONFIRMED
  var confirmed = ReservationRepository.update(reservation.reservation_id, {
    status: 'CONFIRMED'
  });
  
  if (confirmed.error) {
    console.error('❌ Status change failed:', confirmed.message);
  } else {
    console.log('✅ Status changed: PENDING → CONFIRMED');
  }
}

/**
 * 全テスト実行
 */
function testReservationRepository() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Reservation Repository Test Suite       ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  testReservationCreate();
  testReservationStatusChange();
  
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   Test Suite Completed                     ║');
  console.log('╚════════════════════════════════════════════╝');
}