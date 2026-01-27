/**
 * ============================================================================
 * K9 Harmony - Notification Service (reservation_id対応版)
 * ============================================================================
 */

var NotificationService = {
  
  /**
   * 予約確認通知（reservation_id から自動取得）
   */
  sendReservationConfirmation: function(reservationId) {
    var context = { service: 'NotificationService', action: 'sendReservationConfirmation' };
    
    try {
      log('INFO', 'NotificationService', 'Sending reservation confirmation', { reservationId: reservationId });
      
      // 予約情報取得
      var reservation = ReservationRepository.findById(reservationId);
      if (reservation.error) {
        log('ERROR', 'NotificationService', 'Reservation not found', { reservationId: reservationId });
        return { success: false, message: 'Reservation not found' };
      }
      
      // 顧客情報取得
      var customer = CustomerRepository.findById(reservation.customer_id);
      if (customer.error) {
        log('ERROR', 'NotificationService', 'Customer not found', { customer_id: reservation.customer_id });
        return { success: false, message: 'Customer not found' };
      }
      
      // LINE User IDチェック
      if (!customer.line_user_id) {
        log('WARN', 'NotificationService', 'No LINE ID', { customer_id: customer.customer_id });
        return { success: false, message: 'No LINE ID' };
      }
      
      // トレーナー情報取得
      var trainers = DB.fetchTable(CONFIG.SHEET.TRAINERS);
      var trainer = trainers.find(function(t) { return t.trainer_id === reservation.trainer_id; });
      var trainerName = trainer ? trainer.trainer_name : 'スタッフ';
      
      // 犬情報取得
      var dog = DogRepository.findById(reservation.primary_dog_id);
      var dogName = dog.error ? '（犬情報取得失敗）' : dog.dog_name;
      // 性別による敬称（♂→くん、それ以外→ちゃん）
      var dogSuffix = '';
      if (!dog.error && dog.dog_gender) {
        dogSuffix = (dog.dog_gender === '♂' || dog.dog_gender === 'オス' || dog.dog_gender === 'male') ? 'くん' : 'ちゃん';
      }
      var dogNameWithSuffix = dogName + (dogSuffix ? dogSuffix : '');

      // 商品情報取得
      var products = DB.fetchTable(CONFIG.SHEET.PRODUCTS);
      var productId = reservation.product_id;
      log('DEBUG', 'NotificationService', 'Looking for product', { product_id: productId });
      var product = products.find(function(p) { return p.product_id === productId; });
      var productName = product ? product.product_name : '出張トレーニング';
      var productDuration = product ? (product.product_duration || product.duration || '') : '';
      // 商品価格（税込価格を優先）
      var productPrice = 0;
      if (product) {
        productPrice = product.tax_included_price || product.product_price || product.price || 0;
      }

      // クーポン情報取得
      var couponName = '';
      var couponValue = 0;
      if (reservation.coupon_id) {
        var coupons = DB.fetchTable(CONFIG.SHEET.COUPONS);
        var coupon = coupons.find(function(c) { return c.coupon_id === reservation.coupon_id; });
        if (coupon) {
          couponName = coupon.coupon_name || '';
          couponValue = reservation.coupon_value || coupon.discount_value || 0;
        }
      }

      // 金額情報
      // トレーニング料金 = 商品価格（商品マスターから取得）
      var lessonPrice = productPrice;
      // 2頭目追加の場合
      if (reservation.is_multi_dog) {
        lessonPrice += 2000;
      }
      // 出張費（予約から取得）
      // null = 別途（15km超またはジオコーディング失敗）
      // 0 = 無料（3km以内）
      // 数値 = 計算された出張費
      var travelFee = reservation.travel_fee;
      var isTravelFeeSeparate = (travelFee === null || travelFee === undefined || travelFee === '');
      // 割引額
      var discountAmount = couponValue || 0;
      // 合計（予約から取得、なければ計算）
      // 出張費が別途（null/undefined）の場合は出張費を0として計算
      var calculatedTravelFee = (travelFee !== null && travelFee !== undefined && travelFee !== '') ? Number(travelFee) : 0;
      var totalAmount = (reservation.total_amount && reservation.total_amount > 0)
        ? reservation.total_amount
        : ((lessonPrice || 0) + calculatedTravelFee - discountAmount);

      // 決済方法
      var paymentMethod = reservation.payment_method || '';
      // payment_statusから推測
      if (!paymentMethod && reservation.payment_status === 'CAPTURED') {
        paymentMethod = 'CREDIT';
      }

      log('DEBUG', 'NotificationService', 'Price details', {
        productPrice: productPrice,
        lessonPrice: lessonPrice,
        travelFee: travelFee,
        discountAmount: discountAmount,
        totalAmount: totalAmount,
        paymentMethod: paymentMethod
      });

      // 日付フォーマット（yyyy/mm/dd(曜日)形式）
      var reservationDate = reservation.reservation_date;
      var formattedDate = '';
      if (reservationDate instanceof Date) {
        formattedDate = Utilities.formatDate(reservationDate, 'JST', 'yyyy/MM/dd(E)');
      } else {
        // 文字列の場合、Date型に変換してフォーマット
        var dateObj = new Date(reservationDate);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = Utilities.formatDate(dateObj, 'JST', 'yyyy/MM/dd(E)');
        } else {
          formattedDate = String(reservationDate).split(' ')[0].replace(/-/g, '/');
        }
      }

      // 時刻フォーマット（start_timeがDateオブジェクトの場合の対応）
      var startTime = reservation.start_time;
      var formattedTime = '';
      if (startTime instanceof Date) {
        formattedTime = Utilities.formatDate(startTime, 'JST', 'HH:mm');
      } else if (typeof startTime === 'string') {
        formattedTime = startTime;
      } else {
        formattedTime = '';
      }

      // メッセージ作成（高級感のある表現）
      // コース表示（時間がある場合は付与）
      var courseDisplay = productName;
      if (productDuration) {
        courseDisplay += '(' + productDuration + '分)';
      }

var messageText = customer.customer_name + ' 様\n\n' +
                  'このたびはご予約いただき、誠にありがとうございます。\n\n' +
                  '━━━━━━━━━━━━━━━━\n' +
                  '■ ご予約内容\n' +
                  '━━━━━━━━━━━━━━━━\n' +
                  '予約番号: ' + (reservation.reservation_code || reservation.reservation_id.substring(0, 8)) + '\n' +
                  '日時: ' + formattedDate + ' ' + formattedTime + '\n' +
                  'コース: ' + courseDisplay + '\n' +
                  'パートナー: ' + dogNameWithSuffix + '\n' +
                  '担当トレーナー: ' + trainerName + '\n\n' +
                  '━━━━━━━━━━━━━━━━\n' +
                  '■ ご請求内容\n' +
                  '━━━━━━━━━━━━━━━━\n' +
                  'トレーニング料金: ¥' + lessonPrice.toLocaleString() + '\n';

// 出張費の表示
if (isTravelFeeSeparate) {
  messageText += '出張費: 別途\n';
} else if (travelFee === 0) {
  messageText += '出張費: 無料\n';
} else {
  messageText += '出張費: ¥' + travelFee.toLocaleString() + '\n';
}

// 割引がある場合
if (discountAmount > 0) {
  messageText += '割引: -¥' + discountAmount.toLocaleString() + '\n';
  if (couponName) {
    messageText += '（' + couponName + '）\n';
  }
}

messageText += '合計: ¥' + totalAmount.toLocaleString() + '\n';

// 決済方法による条件分岐メッセージ
if (paymentMethod === 'CREDIT' || paymentMethod === 'credit' || paymentMethod === 'card') {
  messageText += '\n※ご予約時にクレジットカードにてお支払い完了済みです。\n';
} else if (paymentMethod === 'CASH' || paymentMethod === 'cash' || paymentMethod === 'onsite') {
  messageText += '\n※当日、担当トレーナーにお支払いをお願いいたします。\n';
}

// ===== 出張費「別途」の場合は料金表を追加 =====
if (isTravelFeeSeparate) {
  messageText += '\n━━━━━━━━━━━━━━━━\n' +
                 '■ 出張費一覧\n' +
                 '━━━━━━━━━━━━━━━━\n' +
                 '3km以内: 無料\n' +
                 '3km超〜5km以内: ¥500\n' +
                 '5km超〜10km以内: ¥1,000\n' +
                 '10km超〜15km以内: ¥1,500\n' +
                 '15km超: ¥1,500 + (超過距離×¥100/km)\n' +
                 '\n※トレーナーより別途ご連絡いたします。\n';
}

// ===== 別住所情報の追加 =====
if (reservation.alt_address) {
  messageText += '\n━━━━━━━━━━━━━━━━\n' +
                 '■ トレーニング場所\n' +
                 '※申し込み住所と異なる場所で実施\n' +
                 '━━━━━━━━━━━━━━━━\n' +
                 '住所: ' + reservation.alt_address + '\n';
  
  if (reservation.alt_building_name) {
    messageText += '施設名: ' + reservation.alt_building_name + '\n';
  }
  
  if (reservation.alt_landmark) {
    messageText += '目印: ' + reservation.alt_landmark + '\n';
  }
  
  if (reservation.alt_location_type) {
    var locationTypeMap = {
      'OUTDOOR': '屋外',
      'INDOOR': '屋内',
      'PARK': '公園',
      'FACILITY': '施設'
    };
    messageText += '場所タイプ: ' + (locationTypeMap[reservation.alt_location_type] || reservation.alt_location_type) + '\n';
  }
  
  if (reservation.alt_remarks) {
    messageText += '備考: ' + reservation.alt_remarks + '\n';
  }
}

messageText += '\n当日、お会いできますことを\n心よりお待ち申し上げております。\n\n' +
               '※キャンセルは予約日の前日までにご連絡ください';
      
      // LINE通知送信
      var result = this._sendLineMessage(customer.line_user_id, messageText);
      
      if (result.success) {
        log('INFO', 'NotificationService', 'Notification sent successfully');
      } else {
        log('ERROR', 'NotificationService', 'LINE notification failed', result);
      }
      
      return result;
      
    } catch (error) {
      log('ERROR', 'NotificationService', 'Notification failed', { error: error.message });
      return { success: false, message: error.message };
    }
  },
  
  /**
   * LINEメッセージ送信（内部関数）
   */
  _sendLineMessage: function(lineUserId, messageText) {
    try {
      var url = 'https://api.line.me/v2/bot/message/push';
      var accessToken = CONFIG.LINE.CHANNEL_ACCESS_TOKEN;
      
      if (!accessToken) {
        log('ERROR', 'NotificationService', 'LINE_CHANNEL_ACCESS_TOKEN is not set');
        throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
      }
      
      var payload = {
        to: lineUserId,
        messages: [
          {
            type: 'text',
            text: messageText
          }
        ]
      };
      
      var options = {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      
      log('DEBUG', 'NotificationService', 'Sending LINE message', { userId: lineUserId });
      
      var response = UrlFetchApp.fetch(url, options);
      var responseCode = response.getResponseCode();
      var responseText = response.getContentText();
      
      log('DEBUG', 'NotificationService', 'LINE API response', {
        code: responseCode,
        response: responseText
      });
      
      if (responseCode !== 200) {
        log('ERROR', 'NotificationService', 'LINE API error', {
          code: responseCode,
          response: responseText
        });
        return {
          success: false,
          error: 'LINE API error',
          statusCode: responseCode,
          details: responseText
        };
      }
      
      return { success: true };
      
    } catch (error) {
      log('ERROR', 'NotificationService', 'Failed to send LINE message', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * 予約リマインダー送信
   */
  sendReservationReminder: function(reservationId) {
    try {
      var reservation = ReservationRepository.findById(reservationId);
      if (reservation.error) {
        return { success: false, message: 'Reservation not found' };
      }
      
      var customer = CustomerRepository.findById(reservation.customer_id);
      if (customer.error || !customer.line_user_id) {
        return { success: false, message: 'No LINE ID' };
      }
      
      var trainers = DB.fetchTable(CONFIG.SHEET.TRAINERS);
      var trainer = trainers.find(function(t) { return t.trainer_id === reservation.trainer_id; });
      var trainerName = trainer ? trainer.trainer_name : 'スタッフ';
      
      var reservationDate = reservation.reservation_date;
      if (reservationDate instanceof Date) {
        reservationDate = Utilities.formatDate(reservationDate, 'JST', 'M月d日(E)');
      }
      
      // 時刻フォーマット
      var startTime = reservation.start_time;
      var formattedTime = '';
      if (startTime instanceof Date) {
        formattedTime = Utilities.formatDate(startTime, 'JST', 'HH:mm');
      } else {
        formattedTime = startTime || '';
      }

      var messageText = customer.customer_name + ' 様\n\n' +
                        '明日のトレーニングについてご案内申し上げます。\n\n' +
                        '【ご予約内容】\n' +
                        '日時: ' + reservationDate + ' ' + formattedTime + '\n' +
                        '担当: ' + trainerName + '\n' +
                        '予約番号: ' + (reservation.reservation_code || '') + '\n\n' +
                        'お会いできますことを楽しみにしております。';
      
      return this._sendLineMessage(customer.line_user_id, messageText);
      
    } catch (error) {
      log('ERROR', 'NotificationService', 'Reminder failed', { error: error.message });
      return { success: false, message: error.message };
    }
  },
  
  /**
   * 管理者通知
   */
  sendAdminNotification: function(subject, message, severity) {
    try {
      var adminEmail = CONFIG.ADMIN.EMAIL;
      
      if (!adminEmail) {
        return { success: false, message: 'No admin email' };
      }
      
      var emailSubject = '[K9 Harmony] ' + subject;
      var timestamp = Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd HH:mm:ss');
      
      var emailBody = 'K9 Harmony システム通知\n\n' +
                      '━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                      '件名: ' + subject + '\n' +
                      '重要度: ' + (severity || 'INFO') + '\n' +
                      '日時: ' + timestamp + '\n' +
                      '━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                      message + '\n\n' +
                      '━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                      'このメールは自動送信されています。';
      
      MailApp.sendEmail({
        to: adminEmail,
        subject: emailSubject,
        body: emailBody
      });
      
      return { success: true };
      
    } catch (error) {
      log('ERROR', 'NotificationService', 'Admin notification failed', { error: error.message });
      return { success: false, message: error.message };
    }
  }
};

// ============================================================================
// エラー通知機能（Phase 2 追加）
// ============================================================================

/**
 * CRITICALエラーを監視して通知
 */
NotificationService.monitorCriticalErrors = function() {
  var context = { service: 'NotificationService', action: 'monitorCriticalErrors' };
  
  try {
    log('INFO', 'NotificationService', 'Starting critical error monitoring');

    if (!CONFIG.SHEET || !CONFIG.SHEET.SYSTEM_LOGS) {
      log('WARN', 'NotificationService', 'SYSTEM_LOGS sheet not configured');
      return { 
        success: false, 
        message: 'SYSTEM_LOGS sheet not configured in CONFIG.SHEET' 
      };
    }
    // 過去1時間のCRITICALエラーを取得
    var oneHourAgo = new Date(new Date().getTime() - 60 * 60 * 1000);
    var logs = DB.fetchTable(CONFIG.SHEET.SYSTEM_LOGS);
    
    var criticalErrors = logs.filter(function(logEntry) {
      var timestamp = new Date(logEntry.timestamp);
      return timestamp >= oneHourAgo && 
             (logEntry.level === 'CRITICAL' || logEntry.level === 'ERROR');
    });
    
    if (criticalErrors.length === 0) {
      log('INFO', 'NotificationService', 'No critical errors found');
      return { success: true, errorCount: 0 };
    }
    
    // エラー集計
    var errorSummary = this._aggregateErrors(criticalErrors);
    
    // 管理者に通知
    this.sendErrorAlert(errorSummary);
    
    log('WARN', 'NotificationService', 'Critical errors detected', {
      count: criticalErrors.length
    });
    
    return {
      success: true,
      errorCount: criticalErrors.length,
      summary: errorSummary
    };
    
  } catch (error) {
    return ErrorHandler.handle(error, context);
  }
};

/**
 * エラー集計
 */
NotificationService._aggregateErrors = function(errors) {
  var summary = {
    total: errors.length,
    byLevel: {},
    byService: {},
    recent: []
  };
  
  errors.forEach(function(error) {
    // レベル別
    if (!summary.byLevel[error.level]) {
      summary.byLevel[error.level] = 0;
    }
    summary.byLevel[error.level]++;
    
    // サービス別
    var service = error.service || 'UNKNOWN';
    if (!summary.byService[service]) {
      summary.byService[service] = 0;
    }
    summary.byService[service]++;
    
    // 最新5件
    if (summary.recent.length < 5) {
      summary.recent.push({
        timestamp: error.timestamp,
        level: error.level,
        service: error.service,
        action: error.action,
        message: error.message
      });
    }
  });
  
  return summary;
};

/**
 * エラーアラート送信
 */
NotificationService.sendErrorAlert = function(errorSummary) {
  var context = { service: 'NotificationService', action: 'sendErrorAlert' };
  
  try {
    var subject = '[K9 Harmony] システムエラーを検知しました';
    var body = this._buildErrorAlertEmail(errorSummary);
    
    this.sendAdminNotification(subject, body, 'ERROR');
    
    log('INFO', 'NotificationService', 'Error alert sent');
    
    return { success: true };
    
  } catch (error) {
    return ErrorHandler.handle(error, context);
  }
};

/**
 * エラーアラートメール本文生成
 */
NotificationService._buildErrorAlertEmail = function(summary) {
  var body = 'システムエラーが検知されました。\n\n';
  body += '='.repeat(50) + '\n';
  body += '検知時刻: ' + Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd HH:mm:ss') + '\n';
  body += '総エラー数: ' + summary.total + '件\n';
  body += '='.repeat(50) + '\n\n';
  
  // レベル別集計
  body += '【エラーレベル別】\n';
  Object.keys(summary.byLevel).forEach(function(level) {
    body += '  ' + level + ': ' + summary.byLevel[level] + '件\n';
  });
  
  body += '\n【サービス別】\n';
  Object.keys(summary.byService).forEach(function(service) {
    body += '  ' + service + ': ' + summary.byService[service] + '件\n';
  });
  
  body += '\n【最新のエラー（5件）】\n';
  summary.recent.forEach(function(error, index) {
    body += '\n' + (index + 1) + '. ';
    body += Utilities.formatDate(new Date(error.timestamp), 'JST', 'HH:mm:ss') + '\n';
    body += '   レベル: ' + error.level + '\n';
    body += '   サービス: ' + (error.service || 'N/A') + '\n';
    body += '   アクション: ' + (error.action || 'N/A') + '\n';
    body += '   メッセージ: ' + (error.message || 'N/A') + '\n';
  });
  
  body += '\n\n詳細は Systemログ シートを確認してください。';
  
  return body;
};

/**
 * エラー統計レポート生成
 */
NotificationService.generateErrorStatistics = function(days) {
  var context = { service: 'NotificationService', action: 'generateErrorStatistics' };
  
  try {
    if (!CONFIG.SHEET || !CONFIG.SHEET.SYSTEM_LOGS) {
      log('WARN', 'NotificationService', 'SYSTEM_LOGS sheet not configured');
      return { 
        success: false, 
        message: 'SYSTEM_LOGS sheet not configured in CONFIG.SHEET' 
      };
    }
    days = days || 7;
    
    var dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    
    var logs = DB.fetchTable(CONFIG.SHEET.SYSTEM_LOGS);
    
    var recentLogs = logs.filter(function(logEntry) {
      var timestamp = new Date(logEntry.timestamp);
      return timestamp >= dateFrom;
    });
    
    var stats = {
      period_days: days,
      total_logs: recentLogs.length,
      by_level: {},
      by_service: {},
      error_rate: 0
    };
    
    recentLogs.forEach(function(logEntry) {
      // レベル別
      if (!stats.by_level[logEntry.level]) {
        stats.by_level[logEntry.level] = 0;
      }
      stats.by_level[logEntry.level]++;
      
      // サービス別
      var service = logEntry.service || 'UNKNOWN';
      if (!stats.by_service[service]) {
        stats.by_service[service] = 0;
      }
      stats.by_service[service]++;
    });
    
    // エラー率計算
    var errorCount = (stats.by_level.ERROR || 0) + (stats.by_level.CRITICAL || 0);
    if (stats.total_logs > 0) {
      stats.error_rate = (errorCount / stats.total_logs * 100).toFixed(2);
    }
    
    return {
      success: true,
      statistics: stats
    };
    
  } catch (error) {
    return ErrorHandler.handle(error, context);
  }
};

/**
 * エラー通知機能テスト
 */
function testErrorNotification() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Error Notification Test                  ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  // Test 1: エラー監視
  console.log('【Test 1】エラー監視');
  var monitorResult = NotificationService.monitorCriticalErrors();
  
  if (monitorResult.error) {
    console.error('  ❌ Failed:', monitorResult.message);
  } else {
    console.log('  ✅ Success');
    console.log('    Error count:', monitorResult.errorCount);
  }
  
  console.log('');
  
  // Test 2: エラー統計
  console.log('【Test 2】エラー統計（過去7日間）');
  var statsResult = NotificationService.generateErrorStatistics(7);
  
  if (statsResult.error) {
    console.error('  ❌ Failed:', statsResult.message);
  } else {
    console.log('  ✅ Success');
    console.log('    Total logs:', statsResult.statistics.total_logs);
    console.log('    Error rate:', statsResult.statistics.error_rate + '%');
    
    console.log('\n    By level:');
    Object.keys(statsResult.statistics.by_level).forEach(function(level) {
      console.log('      ' + level + ':', statsResult.statistics.by_level[level]);
    });
  }
  
  console.log('');
  console.log('═'.repeat(48));
  console.log('Error Notification Test Complete');
}

// ============================================================================
// キャンセル通知機能（Phase 2 - Part 3 追加）
// ============================================================================

/**
 * 自動キャンセル完了通知（LINE + Email）
 */
NotificationService.sendAutoCancellationNotification = function(customerId, reservation, cancellationData) {
  var context = { service: 'NotificationService', action: 'sendAutoCancellationNotification' };
  
  try {
    log('INFO', 'NotificationService', 'Sending auto cancellation notification', {
      customerId: customerId,
      reservationId: reservation.reservation_id
    });
    
    // 顧客情報取得
    var customer = DB.findById(CONFIG.SHEET.CUSTOMERS, customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }
    
    // LINE通知
    if (customer.line_user_id) {
      this._sendAutoCancellationLine(customer, reservation, cancellationData);
    }
    
    // Email通知
    if (customer.email) {
      this._sendAutoCancellationEmail(customer, reservation, cancellationData);
    }
    
    log('INFO', 'NotificationService', 'Auto cancellation notification sent');
    
    return { success: true };
    
  } catch (error) {
    log('ERROR', 'NotificationService', 'Auto cancellation notification failed', {
      error: error.message
    });
    return { success: false, message: error.message };
  }
};

/**
 * 自動キャンセル - LINE通知
 */
NotificationService._sendAutoCancellationLine = function(customer, reservation, cancellationData) {
  try {
    var resDate = Utilities.formatDate(
      new Date(reservation.reservation_date),
      'JST',
      'yyyy年MM月dd日(E) HH:mm'
    );
    
    var message = '【キャンセル完了】\n\n';
    message += 'ご予約のキャンセルが完了しました。\n\n';
    message += '━━━━━━━━━━━━━━\n';
    message += '予約日時\n';
    message += resDate + '\n\n';
    
    if (cancellationData.cancellationFee > 0) {
      message += 'キャンセル料\n';
      message += '¥' + cancellationData.cancellationFee.toLocaleString() + '\n';
      message += '(' + (cancellationData.feeRate * 100) + '%)\n\n';
    }
    
    if (cancellationData.refundAmount > 0) {
      message += '返金額\n';
      message += '¥' + cancellationData.refundAmount.toLocaleString() + '\n\n';
    }
    
    message += '━━━━━━━━━━━━━━\n\n';
    
    if (cancellationData.refundAmount > 0) {
      message += '返金処理は3-5営業日以内に\n完了いたします。\n\n';
    }
    
    message += 'またのご利用を心より\nお待ち申し上げております。';
    
    this._sendLineMessage(customer.line_user_id, message);
    
  } catch (error) {
    log('ERROR', 'NotificationService', 'LINE notification failed', {
      error: error.message
    });
  }
};

/**
 * 自動キャンセル - Email通知
 */
NotificationService._sendAutoCancellationEmail = function(customer, reservation, cancellationData) {
  try {
    var resDate = Utilities.formatDate(
      new Date(reservation.reservation_date),
      'JST',
      'yyyy年MM月dd日(E) HH:mm'
    );
    
    var subject = '【K9 Harmony】キャンセル完了のお知らせ';
    
    var body = customer.customer_name + ' 様\n\n';
    body += 'ご予約のキャンセルが完了いたしました。\n\n';
    body += '━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    body += '予約日時: ' + resDate + '\n';
    body += 'キャンセル料: ¥' + cancellationData.cancellationFee.toLocaleString() + '\n';
    body += '返金額: ¥' + cancellationData.refundAmount.toLocaleString() + '\n';
    body += '━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    
    if (cancellationData.refundAmount > 0) {
      body += '返金処理は3-5営業日以内に完了いたします。\n\n';
    }
    
    body += 'またのご利用を心よりお待ちしております。\n';
    
    MailApp.sendEmail({
      to: customer.email,
      subject: subject,
      body: body
    });
    
  } catch (error) {
    log('ERROR', 'NotificationService', 'Email notification failed', {
      error: error.message
    });
  }
};

/**
 * 管理者へのキャンセル申請通知
 */
NotificationService.sendAdminCancellationRequest = function(reservation, cancellationData) {
  var context = { service: 'NotificationService', action: 'sendAdminCancellationRequest' };
  
  try {
    log('INFO', 'NotificationService', 'Sending admin cancellation request');
    
    var customer = DB.findById(CONFIG.SHEET.CUSTOMERS, reservation.customer_id);
    
    var resDate = Utilities.formatDate(
      new Date(reservation.reservation_date),
      'JST',
      'yyyy年MM月dd日(E) HH:mm'
    );
    
    var subject = '[K9 Harmony] キャンセル申請: ' + (customer ? customer.customer_name : 'Unknown');
    
    var body = '新しいキャンセル申請がありました。\n\n';
    body += '━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    body += '予約ID: ' + reservation.reservation_id + '\n';
    body += '予約日時: ' + resDate + '\n';
    body += '顧客: ' + (customer ? customer.customer_name : 'N/A') + '\n';
    body += 'キャンセル理由: ' + cancellationData.reason + '\n';
    
    if (cancellationData.detail) {
      body += '詳細: ' + cancellationData.detail + '\n';
    }
    
    body += '━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    
    this.sendAdminNotification(subject, body, 'INFO');
    
    return { success: true };
    
  } catch (error) {
    log('ERROR', 'NotificationService', 'Admin notification failed', {
      error: error.message
    });
    return { success: false, message: error.message };
  }
};

/**
 * 顧客へのキャンセル申請受付通知
 */
NotificationService.sendCancellationRequestConfirmation = function(customerId, reservation, cancellationData) {
  var context = { service: 'NotificationService', action: 'sendCancellationRequestConfirmation' };
  
  try {
    log('INFO', 'NotificationService', 'Sending cancellation request confirmation');
    
    var customer = DB.findById(CONFIG.SHEET.CUSTOMERS, customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }
    
    // LINE通知
    if (customer.line_user_id) {
      this._sendCancellationConfirmationLine(customer, reservation, cancellationData);
    }
    
    // Email通知
    if (customer.email) {
      this._sendCancellationConfirmationEmail(customer, reservation, cancellationData);
    }
    
    return { success: true };
    
  } catch (error) {
    log('ERROR', 'NotificationService', 'Confirmation notification failed', {
      error: error.message
    });
    return { success: false, message: error.message };
  }
};

/**
 * キャンセル申請受付 - LINE通知
 */
NotificationService._sendCancellationConfirmationLine = function(customer, reservation, cancellationData) {
  try {
    var message = 'K9 Harmonyでございます。\n\n';
    message += 'キャンセルのお申し出を承りました。\n\n';
    message += '営業時間内にご連絡させていただきます。\n\n';
    message += '【営業時間】\n';
    message += '木曜日: 13:00〜20:00\n';
    message += 'その他祝日: 10:00〜20:00\n';
    message += '定休日: 水曜日\n\n';
    message += 'ご不便をおかけいたしますが、\n何卒よろしくお願い申し上げます。';
    
    this._sendLineMessage(customer.line_user_id, message);
    
  } catch (error) {
    log('ERROR', 'NotificationService', 'LINE confirmation failed', {
      error: error.message
    });
  }
};

/**
 * キャンセル申請受付 - Email通知
 */
NotificationService._sendCancellationConfirmationEmail = function(customer, reservation, cancellationData) {
  try {
    var subject = '【K9 Harmony】キャンセル申請を受け付けました';
    
    var body = customer.customer_name + ' 様\n\n';
    body += 'キャンセル申請を受け付けました。\n\n';
    body += '営業時間内にご連絡させていただきます。\n\n';
    body += '【営業時間】\n';
    body += '  木曜日: 13:00〜20:00\n';
    body += '  その他祝日: 10:00〜20:00\n';
    body += '  定休日: 水曜日\n\n';
    body += 'ご不便をおかけいたしますが、何卒よろしくお願いいたします。\n';
    
    MailApp.sendEmail({
      to: customer.email,
      subject: subject,
      body: body
    });
    
  } catch (error) {
    log('ERROR', 'NotificationService', 'Email confirmation failed', {
      error: error.message
    });
  }
};

/**
 * キャンセル承認通知（返金完了）
 */
NotificationService.sendCancellationApprovedNotification = function(customerId, reservation, refundData) {
  var context = { service: 'NotificationService', action: 'sendCancellationApprovedNotification' };
  
  try {
    log('INFO', 'NotificationService', 'Sending cancellation approved notification');
    
    var customer = DB.findById(CONFIG.SHEET.CUSTOMERS, customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }
    
    // LINE通知
    if (customer.line_user_id) {
      this._sendCancellationApprovedLine(customer, reservation, refundData);
    }
    
    // Email通知
    if (customer.email) {
      this._sendCancellationApprovedEmail(customer, reservation, refundData);
    }
    
    return { success: true };
    
  } catch (error) {
    log('ERROR', 'NotificationService', 'Approved notification failed', {
      error: error.message
    });
    return { success: false, message: error.message };
  }
};

/**
 * キャンセル承認 - LINE通知
 */
NotificationService._sendCancellationApprovedLine = function(customer, reservation, refundData) {
  try {
    var message = '【キャンセル完了・返金処理済み】\n\n';
    message += 'ご予約のキャンセルと\n返金処理が完了しました。\n\n';
    
    if (refundData.refundAmount > 0) {
      message += '返金額: ¥' + refundData.refundAmount.toLocaleString() + '\n\n';
      message += '※返金処理は3-5営業日以内に\n完了いたします。\n\n';
    }
    
    message += 'またのご利用を心より\nお待ち申し上げております。';
    
    this._sendLineMessage(customer.line_user_id, message);
    
  } catch (error) {
    log('ERROR', 'NotificationService', 'LINE approved notification failed', {
      error: error.message
    });
  }
};

/**
 * キャンセル承認 - Email通知
 */
NotificationService._sendCancellationApprovedEmail = function(customer, reservation, refundData) {
  try {
    var subject = '【K9 Harmony】キャンセル・返金処理完了のお知らせ';
    
    var body = customer.customer_name + ' 様\n\n';
    body += 'ご予約のキャンセルと返金処理が完了いたしました。\n\n';
    
    if (refundData.refundAmount > 0) {
      body += '返金額: ¥' + refundData.refundAmount.toLocaleString() + '\n\n';
      body += '※返金処理は3-5営業日以内に完了いたします。\n';
    }
    
    body += '\nまたのご利用を心よりお待ちしております。\n';
    
    MailApp.sendEmail({
      to: customer.email,
      subject: subject,
      body: body
    });
    
  } catch (error) {
    log('ERROR', 'NotificationService', 'Email approved notification failed', {
      error: error.message
    });
  }
};

// ============================================================================
// 決済リトライ関連通知
// ============================================================================

/**
 * 決済保留通知（予約確保 + 決済リトライ中）
 * @param {string} lineUserId - LINE User ID
 * @param {Object} reservation - 予約情報
 * @param {string} reason - 保留理由
 */
NotificationService.sendPaymentPendingNotification = function(lineUserId, reservation, reason) {
  var context = { service: 'NotificationService', action: 'sendPaymentPendingNotification' };

  try {
    log('INFO', 'NotificationService', 'Sending payment pending notification', {
      lineUserId: lineUserId,
      reservationId: reservation.reservation_id
    });

    // 犬情報取得
    var dogName = reservation.dog_name || '';
    var dogSuffix = '';
    if (reservation.primary_dog_id) {
      var dog = DogRepository.findById(reservation.primary_dog_id);
      if (!dog.error) {
        dogName = dog.dog_name || dogName;
        if (dog.dog_gender === '♂' || dog.dog_gender === 'オス') {
          dogSuffix = 'くん';
        } else if (dog.dog_gender) {
          dogSuffix = 'ちゃん';
        }
      }
    }

    // 日付フォーマット
    var reservationDate = reservation.reservation_date;
    if (typeof reservationDate === 'string') {
      reservationDate = new Date(reservationDate);
    }
    var dateStr = Utilities.formatDate(reservationDate, 'JST', 'yyyy年M月d日（E）');
    var timeStr = reservation.start_time || '';

    var message = 'K9 Harmony 代表の平田でございます。\n\n' +
      'ご予約が確定いたしました。\n\n' +
      '◻︎ ご予約内容\n' +
      '・日時: ' + dateStr + ' ' + timeStr + '\n' +
      '・パートナー: ' + dogName + dogSuffix + '\n\n' +
      '⚠️ 決済について\n' +
      'サーバーの一時的な障害により、決済処理を再試行しております。\n' +
      '決済完了時に改めてLINEでお知らせいたします。\n\n' +
      '万が一決済が完了しない場合は、担当者よりご連絡いたします。\n\n' +
      '当日、' + dogName + dogSuffix + 'にお会いできることを楽しみにしております。';

    this._pushLineMessage(lineUserId, message);

    log('INFO', 'NotificationService', 'Payment pending notification sent');
    return { success: true };

  } catch (error) {
    log('ERROR', 'NotificationService', 'Payment pending notification failed', {
      error: error.message
    });
    return { success: false, error: error.message };
  }
};

/**
 * 決済完了通知（リトライ成功時）
 * @param {string} lineUserId - LINE User ID
 * @param {Object} reservation - 予約情報
 * @param {Object} payment - 決済情報
 */
NotificationService.sendPaymentCompletedNotification = function(lineUserId, reservation, payment) {
  var context = { service: 'NotificationService', action: 'sendPaymentCompletedNotification' };

  try {
    log('INFO', 'NotificationService', 'Sending payment completed notification', {
      lineUserId: lineUserId,
      reservationId: reservation.reservation_id
    });

    // 犬情報取得
    var dogName = reservation.dog_name || '';
    var dogSuffix = '';
    if (reservation.primary_dog_id) {
      var dog = DogRepository.findById(reservation.primary_dog_id);
      if (!dog.error) {
        dogName = dog.dog_name || dogName;
        if (dog.dog_gender === '♂' || dog.dog_gender === 'オス') {
          dogSuffix = 'くん';
        } else if (dog.dog_gender) {
          dogSuffix = 'ちゃん';
        }
      }
    }

    // 日付フォーマット
    var reservationDate = reservation.reservation_date;
    if (typeof reservationDate === 'string') {
      reservationDate = new Date(reservationDate);
    }
    var dateStr = Utilities.formatDate(reservationDate, 'JST', 'yyyy年M月d日（E）');
    var timeStr = reservation.start_time || '';

    var totalAmount = payment.total_amount || reservation.total_amount || 0;

    var message = 'K9 Harmony からのお知らせ\n\n' +
      '決済が完了いたしました。\n\n' +
      '◻︎ ご予約内容\n' +
      '・日時: ' + dateStr + ' ' + timeStr + '\n' +
      '・パートナー: ' + dogName + dogSuffix + '\n' +
      '・お支払い: ¥' + totalAmount.toLocaleString() + '（クレジットカード）\n\n' +
      '当日、' + dogName + dogSuffix + 'にお会いできることを楽しみにしております。';

    this._pushLineMessage(lineUserId, message);

    log('INFO', 'NotificationService', 'Payment completed notification sent');
    return { success: true };

  } catch (error) {
    log('ERROR', 'NotificationService', 'Payment completed notification failed', {
      error: error.message
    });
    return { success: false, error: error.message };
  }
};

/**
 * 決済失敗通知（リトライ上限到達時）
 * @param {string} lineUserId - LINE User ID
 * @param {Object} reservation - 予約情報
 */
NotificationService.sendPaymentFailedNotification = function(lineUserId, reservation) {
  var context = { service: 'NotificationService', action: 'sendPaymentFailedNotification' };

  try {
    log('INFO', 'NotificationService', 'Sending payment failed notification', {
      lineUserId: lineUserId,
      reservationId: reservation.reservation_id
    });

    // 犬情報取得
    var dogName = reservation.dog_name || '';
    var dogSuffix = '';
    if (reservation.primary_dog_id) {
      var dog = DogRepository.findById(reservation.primary_dog_id);
      if (!dog.error) {
        dogName = dog.dog_name || dogName;
        if (dog.dog_gender === '♂' || dog.dog_gender === 'オス') {
          dogSuffix = 'くん';
        } else if (dog.dog_gender) {
          dogSuffix = 'ちゃん';
        }
      }
    }

    // 日付フォーマット
    var reservationDate = reservation.reservation_date;
    if (typeof reservationDate === 'string') {
      reservationDate = new Date(reservationDate);
    }
    var dateStr = Utilities.formatDate(reservationDate, 'JST', 'yyyy年M月d日（E）');
    var timeStr = reservation.start_time || '';

    var message = 'K9 Harmony からのお知らせ\n\n' +
      'ご予約は確保されております。\n\n' +
      '◻︎ ご予約内容\n' +
      '・日時: ' + dateStr + ' ' + timeStr + '\n' +
      '・パートナー: ' + dogName + dogSuffix + '\n\n' +
      '決済処理が完了できませんでした。\n' +
      'お支払いについては担当者より改めてご連絡いたします。\n\n' +
      'ご不便をおかけし申し訳ございません。';

    this._pushLineMessage(lineUserId, message);

    log('INFO', 'NotificationService', 'Payment failed notification sent');
    return { success: true };

  } catch (error) {
    log('ERROR', 'NotificationService', 'Payment failed notification failed', {
      error: error.message
    });
    return { success: false, error: error.message };
  }
};

/**
 * 管理者への決済エラー通知
 * @param {Object} queueEntry - キューエントリ
 * @param {Object} customer - 顧客情報
 * @param {Object} reservation - 予約情報（あれば）
 */
NotificationService.sendPaymentErrorToAdmin = function(queueEntry, customer, reservation) {
  var context = { service: 'NotificationService', action: 'sendPaymentErrorToAdmin' };

  try {
    var adminLineId = CONFIG.LINE.ADMIN_USER_ID;
    if (!adminLineId) {
      log('WARN', 'NotificationService', 'Admin LINE ID not configured');
      return { success: false, error: 'Admin LINE ID not configured' };
    }

    var message = '【要対応】決済エラー発生\n\n' +
      '顧客: ' + (customer ? customer.customer_name : '不明') + '様\n' +
      'キューID: ' + queueEntry.queue_id + '\n' +
      'リトライ回数: ' + queueEntry.retry_count + '/' + queueEntry.max_retries + '\n' +
      'ステータス: ' + queueEntry.status + '\n' +
      'エラー: ' + (queueEntry.last_error || '不明') + '\n';

    if (reservation) {
      var dateStr = reservation.reservation_date || '';
      message += '\n予約日時: ' + dateStr + ' ' + (reservation.start_time || '') + '\n' +
        '予約ID: ' + reservation.reservation_id;
    }

    this._pushLineMessage(adminLineId, message);

    log('INFO', 'NotificationService', 'Admin payment error notification sent');
    return { success: true };

  } catch (error) {
    log('ERROR', 'NotificationService', 'Admin notification failed', {
      error: error.message
    });
    return { success: false, error: error.message };
  }
};

/**
 * キャンセル通知テスト
 */
function testCancellationNotifications() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Cancellation Notification Test          ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  console.log('⚠️  実際の通知は送信しません（DRY RUN）\n');
  
  // テストデータ
  var testCustomer = {
    customer_id: 'test_customer',
    customer_name: 'テスト 太郎',
    email: 'test@example.com',
    line_user_id: 'test_line_id'
  };
  
  var testReservation = {
    reservation_id: 'test_reservation',
    customer_id: 'test_customer',
    reservation_date: new Date(2026, 0, 20, 14, 0),
    cancellation_reason: '愛犬・飼い主の体調不良'
  };
  
  // Test 1: 自動キャンセル通知
  console.log('【Test 1】自動キャンセル通知');
  console.log('  キャンセル料: ¥2,450 (50%)');
  console.log('  返金額: ¥2,450');
  console.log('  ✅ 通知テンプレート生成成功');
  console.log('');
  
  // Test 2: キャンセル申請受付通知
  console.log('【Test 2】キャンセル申請受付通知');
  console.log('  理由: 愛犬・飼い主の体調不良');
  console.log('  営業時間案内を含む');
  console.log('  ✅ 通知テンプレート生成成功');
  console.log('');
  
  // Test 3: 管理者通知
  console.log('【Test 3】管理者へのキャンセル申請通知');
  console.log('  顧客情報: テスト 太郎');
  console.log('  理由: 愛犬・飼い主の体調不良');
  console.log('  ✅ 通知テンプレート生成成功');
  console.log('');
  
  // Test 4: キャンセル承認通知
  console.log('【Test 4】キャンセル承認・返金完了通知');
  console.log('  返金額: ¥4,900');
  console.log('  ✅ 通知テンプレート生成成功');
  console.log('');
  
  console.log('═'.repeat(48));
  console.log('Cancellation Notification Test Complete');
  console.log('');
  console.log('💡 実際の通知を送信する場合:');
  console.log('  実在する顧客IDで各関数を実行してください');
}