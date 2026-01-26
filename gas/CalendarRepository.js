/**
 * ============================================================================
 * K9 Harmony - Calendar Repository
 * ============================================================================
 * Googleカレンダー操作専用リポジトリ
 * 最終更新: 2026-01-18
 * バージョン: v1.0.0
 */

class CalendarRepository {
  
  constructor() {
    this.calendarId = CONFIG.GOOGLE_CALENDAR.CALENDAR_ID;
    
    try {
      this.calendar = CalendarApp.getCalendarById(this.calendarId);
      
      if (!this.calendar) {
        throw new Error('カレンダーが見つかりません: ' + this.calendarId);
      }
      
      Logger.log('✅ Googleカレンダー接続成功: ' + this.calendar.getName());
      
    } catch (error) {
      Logger.log('❌ Googleカレンダー接続エラー: ' + error.message);
      throw new Error('Googleカレンダーへの接続に失敗しました');
    }
  }
  
 /**
 * 予約イベントを作成
 * @param {Object} reservation - 予約データ
 * @return {Object} 作成結果
 */
createReservationEvent(reservation) {
  try {
    log('INFO', 'CalendarRepository', '========== カレンダーイベント作成開始 ==========');
    log('INFO', 'CalendarRepository', '予約データ: ' + JSON.stringify({
      reservation_id: reservation.reservation_id,
      customer_name: reservation.customer_name,
      dog_name: reservation.dog_name,
      product_name: reservation.product_name,
      reservation_date: reservation.reservation_date,
      start_time: reservation.start_time,
      end_time: reservation.end_time,
      duration_minutes: reservation.duration_minutes
    }));
    
    // ===== 1. イベントタイトル作成 =====
    const customerName = reservation.customer_name || '顧客名不明';
    const dogName = reservation.dog_name || 'パートナー不明';
    const productName = reservation.product_name || '単発トレーニング';
    const title = `【予約】${customerName}様 - ${dogName}（${productName}）`;
    
    log('INFO', 'CalendarRepository', 'タイトル: ' + title);
    
    // ===== 2. 開始日時の構築 =====
    var startDateTime;
    
    if (reservation.start_datetime instanceof Date) {
      startDateTime = reservation.start_datetime;
      log('INFO', 'CalendarRepository', 'start_datetime: Date型を使用');
    } else {
      var dateStr = reservation.reservation_date;
      var timeStr = reservation.start_time;
      
      log('INFO', 'CalendarRepository', 'dateStr: ' + dateStr + ' (type: ' + typeof dateStr + ')');
      log('INFO', 'CalendarRepository', 'timeStr: ' + timeStr + ' (type: ' + typeof timeStr + ')');
      
      // 日付を正規化
      if (dateStr instanceof Date) {
        dateStr = Utilities.formatDate(dateStr, 'JST', 'yyyy-MM-dd');
      }
      
      // 時刻を正規化
      if (timeStr instanceof Date) {
        timeStr = Utilities.formatDate(timeStr, 'JST', 'HH:mm');
      }
      
      // 結合してDate型に変換
      var dateTimeStr = dateStr + ' ' + timeStr + ':00';
      startDateTime = new Date(dateTimeStr);
      
      log('INFO', 'CalendarRepository', 'start_datetime構築: ' + startDateTime);
    }
    
    // ===== 3. 終了日時の構築 =====
    var endDateTime;
    
    if (reservation.end_datetime instanceof Date) {
      endDateTime = reservation.end_datetime;
      log('INFO', 'CalendarRepository', 'end_datetime: Date型を使用');
    } else {
      var durationMinutes = reservation.duration_minutes || 90;
      endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
      log('INFO', 'CalendarRepository', 'end_datetime構築: ' + endDateTime + ' (duration: ' + durationMinutes + '分)');
    }
    
    // ===== 4. バッファ時間を追加 =====
var bufferMinutes = parseInt(getConfigValue('RESERVATION', 'BUFFER_MINUTES')) || 30;
log('INFO', 'CalendarRepository', 'バッファ時間: ' + bufferMinutes + '分');

var businessHours = getBusinessHoursConfig();
var dayOfWeek = startDateTime.getDay();
var endHourKey = this._getDayKey(dayOfWeek) + '_END';
var businessEndTime = businessHours[endHourKey];

if (businessEndTime) {
  log('INFO', 'CalendarRepository', '営業終了時刻（元の値）: ' + businessEndTime + ' (type: ' + typeof businessEndTime + ')');
  
  // ===== 追加：Date型を文字列に正規化 =====
  if (businessEndTime instanceof Date) {
    businessEndTime = Utilities.formatDate(businessEndTime, 'JST', 'HH:mm');
    log('INFO', 'CalendarRepository', '営業終了時刻（正規化後）: ' + businessEndTime);
  }
  
  var endParts = businessEndTime.split(':');
  var endHour = parseInt(endParts[0]);
  var endMinute = parseInt(endParts[1]);
  var businessEnd = new Date(startDateTime);
  businessEnd.setHours(endHour, endMinute, 0, 0);
      
      if (endDateTime < businessEnd) {
        endDateTime = new Date(endDateTime.getTime() + bufferMinutes * 60 * 1000);
        log('INFO', 'CalendarRepository', 'バッファ追加後: ' + endDateTime);
      } else {
        log('INFO', 'CalendarRepository', '営業終了時刻のため、バッファなし');
      }
    }
    
   // ===== 5. イベント説明作成 =====
var description = '';
description += '【予約情報】\n';
description += `予約コード: ${reservation.reservation_code || 'なし'}\n`;
description += `顧客コード: ${reservation.customer_code || 'なし'}\n`;
description += `顧客連絡先: ${reservation.customer_phone || 'なし'}\n`;
description += `犬コード: ${reservation.dog_code || 'なし'}\n`;
description += `トレーナー: ${reservation.trainer_code || 'なし'} - ${reservation.trainer_name || 'なし'}\n`;
description += '\n';

// ===== 場所情報 =====
description += '【場所情報】\n';

if (reservation.alt_address) {
  // 別住所がある場合
  description += '⚠️ 申込住所と異なる場所で実施\n';
  description += `実施場所: ${reservation.alt_address}\n`;
  
  if (reservation.alt_building_name) {
    description += `施設名: ${reservation.alt_building_name}\n`;
  }
  
  if (reservation.alt_landmark) {
    description += `目印: ${reservation.alt_landmark}\n`;
  }
  
  var locationTypeMap = {
    'OUTDOOR': '屋外',
    'INDOOR': '屋内',
    'PARK': '公園',
    'FACILITY': '施設'
  };
  description += `場所タイプ: ${locationTypeMap[reservation.alt_location_type] || reservation.alt_location_type || 'OUTDOOR'}\n`;
  
  if (reservation.alt_remarks) {
    description += `備考: ${reservation.alt_remarks}\n`;
  }
  
  // 別住所の地図リンク
  if (reservation.alt_location_lat && reservation.alt_location_lng) {
    var mapUrl = 'https://www.google.com/maps?q=' + reservation.alt_location_lat + ',' + reservation.alt_location_lng;
    description += '📍 地図: ' + mapUrl + '\n';
    log('INFO', 'CalendarRepository', 'Alt address map link added: ' + mapUrl);
  }
  
  description += '\n顧客登録住所: ' + (reservation.location_address || 'なし') + '\n';
  
} else {
  // 顧客登録住所で実施
  description += `場所: ${reservation.location_address || reservation.address || 'なし'}\n`;
  
  // 顧客住所の地図リンク
  if (reservation.location_lat && reservation.location_lng) {
    var mapUrl = 'https://www.google.com/maps?q=' + reservation.location_lat + ',' + reservation.location_lng;
    description += '📍 地図: ' + mapUrl + '\n';
    log('INFO', 'CalendarRepository', 'Location map link added: ' + mapUrl);
  }
}

description += '\n';

if (reservation.notes || reservation.customer_memo) {
  description += '【備考】\n';
  description += `${reservation.notes || reservation.customer_memo}\n`;
  description += '\n';
}

description += '【支払い情報】\n';
description += `金額: ¥${(reservation.total_amount || 0).toLocaleString()}\n`;
description += `支払いステータス: ${reservation.payment_status || '未払い'}\n`;
    
    log('INFO', 'CalendarRepository', '説明文: ' + description.substring(0, 100) + '...');
    
    // ===== 6. カレンダーイベント作成 =====
    log('INFO', 'CalendarRepository', 'イベント作成実行: ' + startDateTime + ' 〜 ' + endDateTime);
    
    var event = this.calendar.createEvent(title, startDateTime, endDateTime, {
      description: description,
      location: reservation.location_address || reservation.address || ''
    });
    
    var eventId = event.getId();

log('INFO', 'CalendarRepository', '✅ カレンダーイベント作成成功!');
log('INFO', 'CalendarRepository', 'Event ID: ' + eventId);
log('INFO', 'CalendarRepository', '========== カレンダーイベント作成完了 ==========');

return {
  success: true,
  event_id: eventId
};
    
  } catch (error) {
    log('ERROR', 'CalendarRepository', '========== カレンダーイベント作成エラー ==========');
    log('ERROR', 'CalendarRepository', 'エラーメッセージ: ' + error.message);
    log('ERROR', 'CalendarRepository', 'スタックトレース: ' + error.stack);
    log('ERROR', 'CalendarRepository', '予約ID: ' + (reservation ? reservation.reservation_id : 'なし'));
    log('ERROR', 'CalendarRepository', '====================================================');
    
    return {
      success: false,
      error: error.message,
      error_stack: error.stack
    };
  }
}
  
  /**
   * 予約イベントを更新
   * @param {string} eventId - カレンダーイベントID
   * @param {Object} updateData - 更新データ
   * @return {Object} 更新結果
   */
  updateReservationEvent(eventId, updateData) {
    try {
      Logger.log('📅 カレンダーイベント更新開始: ' + eventId);
      
      const event = this.calendar.getEventById(eventId);
      
      if (!event) {
        throw new Error('イベントが見つかりません: ' + eventId);
      }
      
      // タイトル更新
      if (updateData.title) {
        event.setTitle(updateData.title);
      }
      
      // 説明更新
      if (updateData.description) {
        event.setDescription(updateData.description);
      }
      
      // 時刻更新
      if (updateData.start_datetime && updateData.end_datetime) {
        event.setTime(
          new Date(updateData.start_datetime),
          new Date(updateData.end_datetime)
        );
      }
      
      Logger.log('✅ カレンダーイベント更新成功');
      
      return {
        success: true,
        event_id: event.getId()
      };
      
    } catch (error) {
      Logger.log('❌ カレンダーイベント更新エラー: ' + error.message);
      throw new Error('カレンダーイベントの更新に失敗しました: ' + error.message);
    }
  }
  
  /**
   * 予約イベントを削除
   * @param {string} eventId - カレンダーイベントID
   * @return {Object} 削除結果
   */
  deleteReservationEvent(eventId) {
    try {
      Logger.log('📅 カレンダーイベント削除開始: ' + eventId);
      
      const event = this.calendar.getEventById(eventId);
      
      if (!event) {
        Logger.log('⚠️ イベントが既に削除されています: ' + eventId);
        return {
          success: true,
          message: 'イベントは既に削除されています'
        };
      }
      
      event.deleteEvent();
      
      Logger.log('✅ カレンダーイベント削除成功');
      
      return {
        success: true,
        event_id: eventId
      };
      
    } catch (error) {
      Logger.log('❌ カレンダーイベント削除エラー: ' + error.message);
      throw new Error('カレンダーイベントの削除に失敗しました: ' + error.message);
    }
  }
  
  /**
   * イベントタイトルを構築（内部メソッド）
   * @private
   */
  _buildEventTitle(reservation) {
    const customerName = reservation.customer_name || '顧客名不明';
    const dogName = reservation.dog_name || 'パートナー不明';
    const productName = reservation.product_name || '単発トレーニング';
    
    return `【予約】${customerName}様 - ${dogName}（${productName}）`;
  }
  
  /**
   * イベント説明を構築（内部メソッド）
   * @private
   */
  _buildEventDescription(reservation) {
    let description = '';
    
    description += '【予約情報】\n';
    description += `予約ID: ${reservation.reservation_id}\n`;
    description += `顧客ID: ${reservation.customer_id}\n`;
    description += `犬ID: ${reservation.dog_id}\n`;
    description += `トレーナーID: ${reservation.trainer_id}\n`;
    description += '\n';
    
    if (reservation.address) {
      description += '【トレーニング場所】\n';
      description += `${reservation.address}\n`;
      description += '\n';
    }
    
    if (reservation.notes) {
      description += '【備考】\n';
      description += `${reservation.notes}\n`;
      description += '\n';
    }
    
    description += '【支払い情報】\n';
    description += `金額: ¥${reservation.total_amount?.toLocaleString() || '0'}\n`;
    description += `支払いステータス: ${reservation.payment_status || '未払い'}\n`;
    
    return description;
  }
  
  /**
   * 曜日キーを取得（内部メソッド）
   * @private
   */
  _getDayKey(dayOfWeek) {
    const dayKeys = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return dayKeys[dayOfWeek];
  }
}