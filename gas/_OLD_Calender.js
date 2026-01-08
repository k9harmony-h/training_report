/**
 * Calendar Integration
 * Google Calendar API Wrapper
 */

const Calendar = {
  /**
   * 予定を作成する
   * @param {Object} eventData
   * - title: 件名
   * - startTime: 開始日時 (Date)
   * - endTime: 終了日時 (Date)
   * - location: 場所
   * - description: 詳細
   * @return {string|null} eventId
   */
  createEvent: function(eventData) {
    // systemConfig.gs の関数を使用
    const calendarId = getCalendarId(); 
    const calendar = CalendarApp.getCalendarById(calendarId);
    
    if (!calendar) {
      SysUtils.log('ERROR', 'Calendar.createEvent', `Calendar not found: ${calendarId}`);
      return null;
    }

    try {
      const event = calendar.createEvent(
        eventData.title,
        eventData.startTime,
        eventData.endTime,
        {
          location: eventData.location,
          description: eventData.description
        }
      );
      return event.getId();

    } catch (e) {
      SysUtils.log('ERROR', 'Calendar.createEvent', e.message, eventData);
      return null;
    }
  },

  /**
   * 予約データからカレンダー用のフォーマットを作成して登録
   * @param {Object} reservation - 予約レコード
   * @param {Object} customer - 顧客レコード
   * @param {Object} dog - 犬レコード
   * @param {string} menuName - メニュー名
   */
  syncReservation: function(reservation, customer, dog, menuName) {
    // タイトル: 【K9】[顧客名] 様 / [犬名] / [メニュー名]
    const title = `【K9】${customer.customer_name} 様 / ${dog.dog_name} / ${menuName}`;
    
    // 詳細: 電話番号 / 領収書 / メモ
    const receiptStr = reservation.receipt_required ? `有 (宛名: ${reservation.receipt_addressee || '空欄'})` : '無';
    const desc = [
      `電話番号: ${customer.customer_phone}`,
      `領収書: ${receiptStr}`,
      `メモ: ${reservation.memo || 'なし'}`,
      `ResID: ${reservation.res_id}`
    ].join('\n');

    // 場所: 顧客住所 (連結)
    const location = `${customer.customer_address_1}${customer.customer_address_2}${customer.customer_address_3}`;

    return this.createEvent({
      title: title,
      startTime: new Date(reservation.start_time),
      endTime: new Date(reservation.end_time),
      location: location,
      description: desc
    });
  }
};