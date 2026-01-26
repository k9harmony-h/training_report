/**
 * ============================================================================
 * K9 Harmony - Calendar Service
 * ============================================================================
 * カレンダー空き枠取得・予約作成サービス
 * HolidayService機能を統合
 * 最終更新: 2026-01-18
 * バージョン: v1.0.1
 */

class CalendarService {
  
  constructor() {
    this.reservationRepo = ReservationRepository;
    this.trainerRepo = TrainerRepository;
    this.calendarRepo = new CalendarRepository();
    
    this.businessHours = getBusinessHoursConfig();
    this.reservationConfig = getReservationConfig();
    
    this.holidayCacheKey = 'HOLIDAY_CACHE';
    this.holidayCacheExpiry = 30 * 24 * 60 * 60 * 1000;
  }
  
  getMonthAvailability(params) {
    try {
      Logger.log('📅 ========== 空き状況取得開始 ==========');
      Logger.log('📋 パラメータ: ' + JSON.stringify(params));
      
      this._validateParams(params);
      
      var year = params.year;
      var month = params.month;
      var trainerCode = params.trainer_code;
      var isMultipleDogs = params.is_multiple_dogs;
      
      var trainer = this.trainerRepo.findByTrainerCode(trainerCode);
      if (!trainer || trainer.error) {
        throw new Error('トレーナーが見つかりません: ' + trainerCode);
      }
      
      Logger.log('✅ トレーナー: ' + trainer.trainer_name + ' (' + trainerCode + ')');
      
      var singleDuration = parseInt(this.reservationConfig.SINGLE_LESSON_DURATION) || 90;
      var multiAdditional = parseInt(this.reservationConfig.MULTI_DOG_ADDITIONAL) || 30;
      var lessonDuration = isMultipleDogs ? singleDuration + multiAdditional : singleDuration;
      
      Logger.log('⏱️ レッスン時間: ' + lessonDuration + '分');
      
      var searchRange = this._calculateSearchRange(year, month);
      
      Logger.log('📅 検索範囲: ' + searchRange.startDate.toISOString() + ' - ' + searchRange.endDate.toISOString());
      
      var existingReservations = this.reservationRepo.getReservationsByDateRange(
        searchRange.startDate,
        searchRange.endDate,
        trainer.trainer_id,
        ['PENDING', 'CONFIRMED']
      );
      
      Logger.log('📝 既存予約: ' + existingReservations.length + '件');
      
      var availability = {};
      var currentDate = new Date(searchRange.startDate);
      
      while (currentDate <= searchRange.endDate) {
        var dateKey = this._formatDate(currentDate);
        
        if (this._isPastDate(currentDate)) {
          Logger.log('⏭️ 過去の日付をスキップ: ' + dateKey);
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
        
        var businessHours = this._getBusinessHoursForDate(currentDate);
        
        if (!businessHours) {
          availability[dateKey] = [];
          Logger.log('🚫 定休日: ' + dateKey);
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
        
        var timeSlots = this._generateTimeSlots(currentDate, businessHours, lessonDuration);
        
        var availableSlots = this._filterAvailableSlots(
          currentDate,
          timeSlots,
          existingReservations,
          lessonDuration
        );
        
        availability[dateKey] = availableSlots;
        
        Logger.log('✅ ' + dateKey + ': ' + availableSlots.length + '枠');
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      Logger.log('📅 ========== 空き状況取得完了 ==========');
      
      return {
        success: true,
        year: year,
        month: month,
        trainer_code: trainerCode,
        trainer_name: trainer.trainer_name,
        lesson_duration: lessonDuration,
        max_advance_days: parseInt(this.reservationConfig.MAX_ADVANCE_DAYS) || 60,
        availability: availability
      };
      
    } catch (error) {
      Logger.log('❌ 空き状況取得エラー: ' + error.message);
      Logger.log('❌ スタックトレース: ' + error.stack);
      
      return {
        success: false,
        error: error.message,
        error_details: error.stack
      };
    }
  }
  
  _validateParams(params) {
    if (!params.year || !params.month || !params.trainer_code) {
      throw new Error('必須パラメータが不足しています: year, month, trainer_code');
    }
    
    var year = parseInt(params.year);
    var month = parseInt(params.month);
    
    if (year < 2020 || year > 2100) {
      throw new Error('無効な年です: ' + year);
    }
    
    if (month < 1 || month > 12) {
      throw new Error('無効な月です: ' + month);
    }
  }
  
  _calculateSearchRange(year, month) {
    var now = new Date();
    var maxAdvanceDays = parseInt(this.reservationConfig.MAX_ADVANCE_DAYS) || 60;
    
    var monthStart = new Date(year, month - 1, 1, 0, 0, 0);
    var startDate = monthStart > now ? monthStart : now;
    
    var monthEnd = new Date(year, month, 0, 23, 59, 59);
    var maxDate = new Date(now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000);
    var endDate = monthEnd < maxDate ? monthEnd : maxDate;
    
    return { startDate: startDate, endDate: endDate };
  }
  
  _getBusinessHoursForDate(date) {
  var dayOfWeek = date.getDay();
  var dayKey = this._getDayKey(dayOfWeek);
  
  var closedKey = dayKey + '_CLOSED';
  if (this.businessHours[closedKey] === 'TRUE' || this.businessHours[closedKey] === true) {
    return null;
  }
  
  if (this._isHoliday(date)) {
    var holidayStart = this.businessHours.HOLIDAY_START;
    var holidayEnd = this.businessHours.HOLIDAY_END;
    
    if (holidayStart && holidayEnd) {
      return {
        start: this._normalizeTime(holidayStart),
        end: this._normalizeTime(holidayEnd)
      };
    }
  }
  
  var startKey = dayKey + '_START';
  var endKey = dayKey + '_END';
  
  var start = this.businessHours[startKey];
  var end = this.businessHours[endKey];
  
  if (!start || !end) {
    return null;
  }
  
  return { 
    start: this._normalizeTime(start), 
    end: this._normalizeTime(end) 
  };
}

/**
 * 時刻を文字列に正規化（Date/数値型のTime値を"HH:mm"形式に変換）
 * @private
 */
_normalizeTime(timeValue) {
  // 既に文字列の場合はそのまま返す
  if (typeof timeValue === 'string') {
    return timeValue;
  }
  
  // Dateオブジェクトの場合
  if (timeValue instanceof Date) {
    return Utilities.formatDate(timeValue, 'JST', 'HH:mm');
  }
  
  // 数値型（Time型のシリアル値）の場合は文字列に変換
  if (typeof timeValue === 'number') {
    var date = new Date(0);
    date.setTime(date.getTime() + timeValue * 24 * 60 * 60 * 1000);
    return Utilities.formatDate(date, 'JST', 'HH:mm');
  }
  
  // その他の場合はnull
  return null;
}
  
  _generateTimeSlots(date, businessHours, lessonDuration) {
  var slots = [];
  
  // この時点でbusinessHours.startとbusinessHours.endは文字列（"HH:mm"形式）
  var startParts = businessHours.start.split(':');
  var startHour = parseInt(startParts[0]);
  var startMinute = parseInt(startParts[1]);
  
  var endParts = businessHours.end.split(':');
  var endHour = parseInt(endParts[0]);
  var endMinute = parseInt(endParts[1]);
  
  var intervalMinutes = parseInt(this.reservationConfig.TIME_SLOT_INTERVAL) || 30;
  
  var currentTime = new Date(date);
  currentTime.setHours(startHour, startMinute, 0, 0);
  
  var businessEnd = new Date(date);
  businessEnd.setHours(endHour, endMinute, 0, 0);
  
  var lastAcceptance = new Date(businessEnd.getTime() - lessonDuration * 60 * 1000);
  
  while (currentTime <= lastAcceptance) {
    var timeStr = this._formatTime(currentTime);
    slots.push(timeStr);
    
    currentTime.setMinutes(currentTime.getMinutes() + intervalMinutes);
  }
  
  return slots;
}
  
  _filterAvailableSlots(date, slots, existingReservations, lessonDuration) {
  var dateStr = this._formatDate(date);
  Logger.log('🔍 ========== _filterAvailableSlots: ' + dateStr + ' ==========');
  Logger.log('🔍 入力スロット数: ' + slots.length);
  Logger.log('🔍 既存予約数: ' + existingReservations.length);
  
  existingReservations.forEach(function(res, index) {
    Logger.log('🔍 予約' + (index + 1) + ':');
    Logger.log('  - reservation_id: ' + res.reservation_id);
    Logger.log('  - start_datetime: ' + res.start_datetime);
    Logger.log('  - end_datetime: ' + res.end_datetime);
  });
  
  var availableSlots = [];
  var bufferMinutes = parseInt(this.reservationConfig.BUFFER_MINUTES) || 30;
  
  Logger.log('⏱️ レッスン時間: ' + lessonDuration + '分');
  Logger.log('⏱️ バッファ時間: ' + bufferMinutes + '分');
  
  var businessHours = this._getBusinessHoursForDate(date);
  var endParts = businessHours.end.split(':');
  var endHour = parseInt(endParts[0]);
  var endMinute = parseInt(endParts[1]);
  var businessEnd = new Date(date);
  businessEnd.setHours(endHour, endMinute, 0, 0);
  
  var removedSlots = [];
  
  for (var j = 0; j < slots.length; j++) {
    var slot = slots[j];
    var slotParts = slot.split(':');
    var hour = parseInt(slotParts[0]);
    var minute = parseInt(slotParts[1]);
    
    var slotStart = new Date(date);
    slotStart.setHours(hour, minute, 0, 0);
    
    var slotEnd = new Date(slotStart.getTime() + lessonDuration * 60 * 1000);
    
    // 新規予約の終了後バッファ（営業時間内のみ）
    var slotBufferEnd = slotEnd;
    if (slotEnd < businessEnd) {
      slotBufferEnd = new Date(slotEnd.getTime() + bufferMinutes * 60 * 1000);
    }
    
    var isAvailable = true;
    var conflictReason = '';
    
    for (var k = 0; k < existingReservations.length; k++) {
      var reservation = existingReservations[k];
      
      var resStart = new Date(reservation.start_datetime);
      var resEnd = new Date(reservation.end_datetime);
      
      // 既存予約の終了後バッファ
      var resBufferEnd = new Date(resEnd.getTime() + bufferMinutes * 60 * 1000);
      
      // ===== デバッグログ: 重複チェック対象スロットのみ詳細出力 =====
      // 14:00前後のスロット（12:00-16:30）をデバッグ
      if (slot >= '12:00' && slot <= '16:30') {
        Logger.log('🔍 詳細チェック: ' + slot);
        Logger.log('  新規予約: ' + slotStart + ' 〜 ' + slotEnd + ' (+バッファ: ' + slotBufferEnd + ')');
        Logger.log('  既存予約: ' + resStart + ' 〜 ' + resEnd + ' (+バッファ: ' + resBufferEnd + ')');
        Logger.log('  判定1: slotStart(' + slotStart + ') < resBufferEnd(' + resBufferEnd + ') = ' + (slotStart < resBufferEnd));
        Logger.log('  判定2: slotBufferEnd(' + slotBufferEnd + ') > resStart(' + resStart + ') = ' + (slotBufferEnd > resStart));
      }
      
      // 重複チェック
      if (slotStart < resBufferEnd && slotBufferEnd > resStart) {
        isAvailable = false;
        conflictReason = '予約' + (k + 1) + '(' + reservation.reservation_id + ')と重複';
        
        if (slot >= '12:00' && slot <= '16:30') {
          Logger.log('  ❌ 結果: 選択不可（' + conflictReason + '）');
        }
        
        break;
      } else {
        if (slot >= '12:00' && slot <= '16:30') {
          Logger.log('  ✅ 結果: この予約とは重複なし');
        }
      }
    }
    
    if (isAvailable) {
      availableSlots.push(slot);
    } else {
      removedSlots.push({ slot: slot, reason: conflictReason });
    }
  }
  
  Logger.log('🔍 結果: ' + availableSlots.length + '/' + slots.length + '枠が利用可能');
  if (removedSlots.length > 0) {
    Logger.log('🔍 除外されたスロット:');
    removedSlots.forEach(function(item) {
      Logger.log('  - ' + item.slot + ': ' + item.reason);
    });
  }
  Logger.log('🔍 ========================================');
  
  return availableSlots;
}
  
  _isHoliday(date) {
    try {
      var holidays = this._getHolidays();
      var dateKey = this._formatDate(date);
      
      return holidays.hasOwnProperty(dateKey);
      
    } catch (error) {
      Logger.log('⚠️ 祝日判定エラー: ' + error.message);
      return false;
    }
  }
  
  _getHolidays() {
    try {
      var cache = PropertiesService.getScriptProperties();
      var cachedData = cache.getProperty(this.holidayCacheKey);
      
      if (cachedData) {
        var parsed = JSON.parse(cachedData);
        var now = new Date().getTime();
        
        if (parsed.expiry > now) {
          Logger.log('✅ 祝日データをキャッシュから取得');
          return parsed.holidays;
        }
      }
      
      Logger.log('📡 祝日データを内閣府から取得中...');
      var holidays = this._fetchHolidaysFromGovernment();
      
      var cacheData = {
        holidays: holidays,
        expiry: new Date().getTime() + this.holidayCacheExpiry
      };
      cache.setProperty(this.holidayCacheKey, JSON.stringify(cacheData));
      
      Logger.log('✅ 祝日データをキャッシュに保存（' + Object.keys(holidays).length + '件）');
      
      return holidays;
      
    } catch (error) {
      Logger.log('❌ 祝日データ取得エラー: ' + error.message);
      return {};
    }
  }
  
  _fetchHolidaysFromGovernment() {
    try {
      var url = 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv';
      var response = UrlFetchApp.fetch(url);
      var csvText = response.getContentText('Shift_JIS');
      
      var holidays = {};
      var lines = csvText.split('\n');
      
      for (var i = 1; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        
        var parts = line.split(',');
        var dateStr = parts[0];
        var name = parts[1];
        
        if (dateStr && name) {
          var formattedDate = dateStr.replace(/\//g, '-');
          holidays[formattedDate] = name;
        }
      }
      
      Logger.log('✅ 内閣府から祝日を取得: ' + Object.keys(holidays).length + '件');
      
      return holidays;
      
    } catch (error) {
      Logger.log('❌ 内閣府CSV取得エラー: ' + error.message);
      throw error;
    }
  }
  
  _getDayKey(dayOfWeek) {
    var dayKeys = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return dayKeys[dayOfWeek];
  }
  
  _formatDate(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
  
  _formatTime(date) {
    var hour = String(date.getHours()).padStart(2, '0');
    var minute = String(date.getMinutes()).padStart(2, '0');
    return hour + ':' + minute;
  }
  
  _isPastDate(date) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    return checkDate < today;
  }
}

function getMonthAvailability(params) {
  var service = new CalendarService();
  return service.getMonthAvailability(params);
}