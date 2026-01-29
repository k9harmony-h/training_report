/**
 * ============================================================================
 * K9 Harmony - Main API Handler (Token Verification Enabled)
 * ============================================================================
 * LINE Token検証: 段階的実装版
 * - フラグでToken検証をON/OFF可能
 * - 開発: ENABLE_TOKEN_VERIFICATION = false
 * - 本番: ENABLE_TOKEN_VERIFICATION = true
 * 最終更新: 2026-01-18
 */

// ============================================================================
// Token検証フラグ
// ============================================================================

/**
 * Token検証を有効化するフラグ
 * 開発時: false(既存のuserId方式)
 * 本番時: true(LINE Token検証)
 */
var ENABLE_TOKEN_VERIFICATION = false;  // 一時的にOFF（開発モード）

// ============================================================================
// OPTIONS - CORS対応（GASでは直接ヘッダー設定不可）
// ============================================================================

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================================
// GET - データ取得API
// ============================================================================

function doGet(e) {
  try {
    log('INFO', 'Main', 'GET request received', { action: e.parameter.action || e.parameter.type });
    
    // typeパラメータとactionパラメータの両方に対応
    var action = e.parameter.action || e.parameter.type;
    
    // ============================================================================
    // Token検証(段階的実装)
    // ============================================================================
    // ============================================================================
// Token検証(段階的実装)
// ============================================================================
var lineUserId;

log('DEBUG', 'Main', 'Token verification check', {
  enabled: ENABLE_TOKEN_VERIFICATION,
  action: action
});

if (ENABLE_TOKEN_VERIFICATION) {
  // Token検証が有効な場合
  var actionsWithoutAuth = ['getProductList', 'getTrainerList', 'healthCheck', 'products'];
  
  log('DEBUG', 'Main', 'Checking if action requires auth', {
    action: action,
    requiresAuth: actionsWithoutAuth.indexOf(action) === -1
  });
  
  if (actionsWithoutAuth.indexOf(action) === -1) {
    // 認証が必要なアクション
    var accessToken = e.parameter.lineAccessToken || '';
    
    log('DEBUG', 'Main', 'Access token check', {
      hasToken: !!accessToken,
      tokenLength: accessToken.length
    });
    
    if (!accessToken) {
      log('WARN', 'Main', 'Access token missing');
      return ContentService.createTextOutput(JSON.stringify({
        error: true,
        code: 'AUTHENTICATION_ERROR',
        message: 'Access token is required',
        debug: {
          action: action,
          parameters: Object.keys(e.parameter)
        }
      }));
    }
    
    // LINE Token検証
    log('DEBUG', 'Main', 'Calling LineTokenVerification.verifyToken');
    var verifyResult = LineTokenVerification.verifyToken(accessToken);
    
    log('DEBUG', 'Main', 'Token verification result', {
      error: verifyResult.error,
      success: verifyResult.success,
      hasUserId: !!verifyResult.userId
    });
    
    if (verifyResult.error || !verifyResult.success) {
      log('ERROR', 'Main', 'Token verification failed', verifyResult);
      return ContentService.createTextOutput(JSON.stringify({
        error: true,
        code: 'AUTHENTICATION_ERROR',
        message: 'Invalid or expired access token',
        debug: verifyResult
      }));
    }
    
    lineUserId = verifyResult.userId;
    log('INFO', 'Main', 'Token verified successfully: ' + lineUserId);
  } else {
    log('DEBUG', 'Main', 'Action does not require authentication');
  }
} else {
  // ===== 修正: 開発モードではlineUserIdを使用 =====
  lineUserId = e.parameter.lineUserId || e.parameter.userId;  // ← 修正
  log('DEBUG', 'Main', 'Development mode: using lineUserId from parameter: ' + lineUserId);
}

log('DEBUG', 'Main', 'Final lineUserId', { lineUserId: lineUserId });
    
    // ============================================================================
    // userId必須チェック
    // ============================================================================
    var actionsWithoutUserId = ['getProductList', 'getTrainerList', 'healthCheck', 'getAvailableSlots', 'products', 'validateCouponCode', 'getApplicableCoupon', 'check_voucher', 'geocodeAddress'];
    
    if (actionsWithoutUserId.indexOf(action) === -1 && !lineUserId) {
      return ContentService.createTextOutput(JSON.stringify({
        error: true,
        code: 'INVALID_PARAMS',
        message: 'userId parameter is required for action: ' + action
      }));
    }
    
    if (lineUserId) {
      log('INFO', 'Main', 'User ID: ' + lineUserId);
    }
    
    var response;
    
    // アクション別処理
    switch (action) {
      // === typeパラメータ対応（既存フロントエンド互換） ===
      case 'data':
        response = handleGetCustomerData(lineUserId);
        break;
        
      case 'products':
        response = handleGetProductList();
        break;
      
      // === actionパラメータ（新形式） ===
      case 'getCustomerData':
        response = handleGetCustomerData(lineUserId);
        break;
        
      case 'getMyReservations':
        response = handleGetMyReservations(lineUserId);
        break;
        
      case 'getProductList':
        response = handleGetProductList();
        break;
        
      case 'getTrainerList':
        response = handleGetTrainerList();
        break;
        
      case 'getAvailableSlots':
        response = handleGetAvailableSlots(e.parameter);
        break;
        
      case 'createReservationWithPayment':
        var requestBody = {
          reservationData: e.parameter.reservationData,
          paymentData: e.parameter.paymentData,
          lockId: e.parameter.lockId
        };
        response = handleCreateReservationWithPayment(lineUserId, requestBody);
        break;
        
      case 'healthCheck':
        response = handleHealthCheck();
        break;

      case 'getApplicableCoupon':
        response = handleGetApplicableCoupon(e.parameter);
        break;

      case 'validateCouponCode':
        response = handleValidateCouponCode(e.parameter);
        break;

      case 'geocodeAddress':
        response = handleGeocodeAddress(e.parameter);
        break;

      case 'check_voucher':
        response = handleCheckVoucher(e.parameter);
        break;

      default:
        return ContentService.createTextOutput(JSON.stringify({
          error: true,
          code: 'INVALID_ACTION',
          message: 'Invalid action: ' + action
        }));
    }
    
    log('INFO', 'Main', 'GET request completed successfully');
    
    // フロントエンド互換レスポンス
    var frontendResponse = { error: false };
    for (var key in response) {
      if (response.hasOwnProperty(key)) {
        frontendResponse[key] = response[key];
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify(frontendResponse)).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    log('ERROR', 'Main', 'GET request failed', { error: error.message });
    
    var errorResponse = error.toJSON ? error.toJSON() : {
      error: true,
      code: 'UNKNOWN_ERROR',
      message: error.message || error.toString()
    };
    
    return ContentService.createTextOutput(JSON.stringify(errorResponse)).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// POST - データ操作API
// ============================================================================

function doPost(e) {
  try {
    log('INFO', 'Main', 'POST request received');
    
    // リクエストボディ解析
    var requestBody;
    
    try {
      if (e.postData && e.postData.contents) {
        requestBody = JSON.parse(e.postData.contents);
      } else {
        throw new Error('No post data');
      }
    } catch (parseError) {
      return ContentService.createTextOutput(JSON.stringify({
        error: true,
        code: 'VALIDATION_ERROR',
        message: 'Invalid JSON in request body'
      }));
    }
    
    log('INFO', 'Main', 'Request body parsed', { action: requestBody.action });
    
    var action = requestBody.action;
    
    // ============================================================================
    // Token検証(段階的実装)
    // ============================================================================
    var lineUserId;
    
    if (ENABLE_TOKEN_VERIFICATION) {
      // Token検証が有効な場合
      var accessToken = requestBody.lineAccessToken || '';
      
      if (!accessToken) {
        log('WARN', 'Main', 'Access token missing');
        return ContentService.createTextOutput(JSON.stringify({
          error: true,
          code: 'AUTHENTICATION_ERROR',
          message: 'Access token is required'
        }));
      }
      
      // LINE Token検証
      var verifyResult = LineTokenVerification.verifyToken(accessToken);
      
      if (verifyResult.error || !verifyResult.success) {
        log('ERROR', 'Main', 'Token verification failed', verifyResult);
        return ContentService.createTextOutput(JSON.stringify({
          error: true,
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid or expired access token'
        }));
      }
      
      lineUserId = verifyResult.userId;
      log('INFO', 'Main', 'Token verified successfully: ' + lineUserId);
    } else {
      // 開発モード: lineUserIdを優先、なければuserIdを使用
      lineUserId = requestBody.lineUserId || requestBody.userId;
      log('DEBUG', 'Main', 'Development mode: using lineUserId: ' + lineUserId);
    }
    
    // ============================================================================
    // userId必須チェック
    // ============================================================================
    var actionsWithoutUserId = ['getMonthAvailability'];
    
    if (actionsWithoutUserId.indexOf(action) === -1 && !lineUserId) {
      return ContentService.createTextOutput(JSON.stringify({
        error: true,
        code: 'INVALID_PARAMS',
        message: 'userId is required for action: ' + action
      }));
    }
    
    if (lineUserId) {
      log('INFO', 'Main', 'User ID: ' + lineUserId);
    }
    
    var response;
    
    
    // アクション別処理
switch (action) {
  case 'createReservationWithPayment':
    response = handleCreateReservationWithPayment(lineUserId, requestBody);
    break;
    
  case 'cancelReservation':
    response = handleCancelReservation(lineUserId, requestBody);
    break;
  
  // ===== 追加: add_reservation =====
  case 'add_reservation':
    response = handleAddReservation(lineUserId, requestBody);
    break;

  case 'get_month_availability':
    response = handleGetMonthAvailability(lineUserId, requestBody);
    break;

  case 'updateProfile':
    response = handleUpdateProfile(lineUserId, requestBody);
    break;
    
  case 'updateDog':
    response = handleUpdateDog(lineUserId, requestBody);
    break;
    
  case 'lockSlot':
    response = handleLockSlot(lineUserId, requestBody);
    break;

  case 'getMonthAvailability':
    response = handleGetMonthAvailability(lineUserId, requestBody);
    break;

  // ===== 新規ユーザー早期登録 =====
  case 'registerCustomer':
    response = handleRegisterCustomer(lineUserId, requestBody);
    break;

  case 'registerDog':
    response = handleRegisterDog(lineUserId, requestBody);
    break;

  // ===== LINE通知送信 =====
  case 'send_line_msg':
    response = handleSendLineMessage(requestBody);
    break;

  // ===== Eメール送信 =====
  case 'send_email':
    response = handleSendEmail(requestBody);
    break;

  default:
    return ContentService.createTextOutput(JSON.stringify({
      error: true,
      code: 'INVALID_ACTION',
      message: 'Invalid action: ' + action
    }));
}
    
    log('INFO', 'Main', 'POST request completed successfully');
    
    // フロントエンド互換レスポンス
    var frontendResponse = { error: false };
    for (var key in response) {
      if (response.hasOwnProperty(key)) {
        frontendResponse[key] = response[key];
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify(frontendResponse)).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // エラーログ（詳細）
    log('ERROR', 'Main', 'POST request failed', {
      errorType: typeof error,
      isError: error instanceof Error,
      message: error.message,
      code: error.code,
      keys: error ? Object.keys(error) : []
    });

    var errorResponse;

    // K9Errorオブジェクト（throw result で投げられた場合）
    if (error && typeof error === 'object' && error.error === true) {
      errorResponse = {
        error: true,
        code: error.code || 'UNKNOWN_ERROR',
        message: typeof error.message === 'string' ? error.message : JSON.stringify(error.message || error)
      };
    }
    // toJSON メソッドがある場合
    else if (error && error.toJSON) {
      errorResponse = error.toJSON();
    }
    // 通常の Error オブジェクト
    else if (error instanceof Error) {
      errorResponse = {
        error: true,
        code: 'UNKNOWN_ERROR',
        message: error.message || error.toString()
      };
    }
    // その他
    else {
      errorResponse = {
        error: true,
        code: 'UNKNOWN_ERROR',
        message: typeof error === 'string' ? error : JSON.stringify(error)
      };
    }

    return ContentService.createTextOutput(JSON.stringify(errorResponse)).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 予約作成（決済なし）
 */
function handleAddReservation(lineUserId, requestBody) {
  try {
    log('INFO', 'Main', 'Creating reservation without payment', {
      userId: requestBody.userId,
      lineUserId: lineUserId,
      date: requestBody.date,
      time: requestBody.time
    });
    
    // ===== 1. 顧客情報取得 =====
    var customer;
    
    if (requestBody.regData) {
      // 新規顧客の場合は登録
      log('INFO', 'Main', 'Creating new customer');

      // 年齢フィールドの互換性対応（新形式: dogAgeYears/dogAgeMonths、旧形式: dogAge）
      var dogAgeYears = requestBody.regData.dogAgeYears || requestBody.regData.dogAge || 0;
      var dogAgeMonths = requestBody.regData.dogAgeMonths || 0;

      customer = CustomerRepository.create({
        line_user_id: lineUserId,
        customer_name: requestBody.regData.name,
        customer_phone: requestBody.regData.phone,
        customer_email: requestBody.regData.email || null,
        postal_code: requestBody.regData.zip,
        address: requestBody.regData.address,
        building: requestBody.regData.building || null,
        landmark: requestBody.regData.landmark || null,
        base_lat: requestBody.regData.lat || null,
        base_lng: requestBody.regData.lng || null
      });

      if (customer.error) {
        throw customer;
      }

      // 犬も登録
      var dog = DogRepository.create({
        customer_id: customer.customer_id,
        dog_name: requestBody.regData.dogName,
        breed: requestBody.regData.dogBreed,
        age_years: dogAgeYears,
        age_months: dogAgeMonths,
        dog_gender: requestBody.regData.dogGender || null,
        is_neutered: requestBody.regData.neutered || false,
        vaccinations: requestBody.regData.vaccinations ? JSON.stringify(requestBody.regData.vaccinations) : null,
        problem: requestBody.regData.concerns || null,
        notes: requestBody.regData.remarks || null
      });

      if (dog.error) {
        throw dog;
      }

      requestBody.dogId = dog.dog_id;
      
    } else {
      // ===== 既存顧客の場合、複数の方法で検索 =====
      
      // 1. customer_idで検索を試みる
      if (requestBody.userId && requestBody.userId.indexOf('-') !== -1) {
        log('INFO', 'Main', 'Trying to find customer by customer_id: ' + requestBody.userId);
        customer = CustomerRepository.findById(requestBody.userId);
        
        if (customer && !customer.error) {
          log('INFO', 'Main', 'Customer found by customer_id');
        }
      }
      
      // 2. 見つからなければline_user_idで検索
      if (!customer || customer.error) {
        log('INFO', 'Main', 'Trying to find customer by line_user_id: ' + lineUserId);
        customer = CustomerRepository.findByLineUserId(lineUserId);
        
        if (customer && !customer.error) {
          log('INFO', 'Main', 'Customer found by line_user_id');
        }
      }
      
      // 3. まだ見つからなければエラー
      if (!customer || customer.error) {
        throw createK9Error(
          ErrorCode.RECORD_NOT_FOUND,
          'Customer not found',
          { 
            userId: requestBody.userId, 
            lineUserId: lineUserId 
          }
        );
      }
    }
    
    log('INFO', 'Main', 'Customer identified: ' + customer.customer_id);
    
    // ===== 2. 犬情報取得 =====
    var dog = DogRepository.findById(requestBody.dogId);
    if (dog.error) {
      throw createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Dog not found');
    }
    
    // ===== 3. トレーナーID取得 =====
    var trainerId = requestBody.trainerId;
    
    if (!trainerId) {
      var trainers = DB.fetchTable(CONFIG.SHEET.TRAINERS);
      if (trainers.length > 0) {
        trainerId = trainers[0].trainer_id;
      }
    }
    
    // ===== 4. 商品情報取得 =====
    var duration = 90;
    var product = null;
    
    if (requestBody.menuId) {
      var products = DB.fetchTable(CONFIG.SHEET.PRODUCTS);
      product = products.find(function(p) {
        return p.product_id === requestBody.menuId;
      });
      
      if (product && product.product_duration) {
        duration = product.product_duration;
      }
      
      if (requestBody.isMultiDog) {
        duration += 30;
      }
    }
    
    // ===== 5. 日時計算 =====
    var startDateTime = new Date(requestBody.date + ' ' + requestBody.time);
    var endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);
    
    // HH:MM形式に変換
    var endTime = Utilities.formatDate(endDateTime, 'JST', 'HH:mm');
    
    // ===== 6. トレーナー情報取得 =====
var trainer = null;
if (trainerId) {
  var trainers = DB.fetchTable(CONFIG.SHEET.TRAINERS);
  trainer = trainers.find(function(t) {
    return t.trainer_id === trainerId;
  });
}

// ===== 7. 住所情報 =====
log('INFO', 'Main', 'Alt address check', {
  useAltAddress: requestBody.useAltAddress,
  hasAltAddress: !!requestBody.altAddress,
  altAddress: requestBody.altAddress ? JSON.stringify(requestBody.altAddress) : 'null'
});

// ===== エラーハンドリング：useAltAddressがtrueだがaltAddressがnullの場合 =====
if (requestBody.useAltAddress && !requestBody.altAddress) {
  log('ERROR', 'Main', 'useAltAddress is true but altAddress is null - frontend data collection issue');
  throw createK9Error(
    ErrorCode.VALIDATION_ERROR,
    '別住所を使用する場合は、住所情報を入力してください',
    { 
      useAltAddress: requestBody.useAltAddress,
      altAddress: requestBody.altAddress
    }
  );
}

var locationAddress, locationType, locationLat, locationLng;
var altAddress = null;
var altLocationLat = null;
var altLocationLng = null;
var altBuildingName = null;
var altLandmark = null;
var altLocationType = null;
var altRemarks = null;

// ===== 別住所の処理 =====
if (requestBody.useAltAddress && requestBody.altAddress) {
  log('INFO', 'Main', 'Using alternative address');
  
  altAddress = requestBody.altAddress.address;
  altBuildingName = requestBody.altAddress.buildingName || null;
  altLandmark = requestBody.altAddress.landmark || null;
  altLocationType = requestBody.altAddress.locationType || 'OUTDOOR';
  altRemarks = requestBody.altAddress.remarks || null;
  
  // ===== ジオコーディング実装 =====
  try {
    log('INFO', 'Main', 'Geocoding alt address: ' + altAddress);
    
    var apiKey = CONFIG.GOOGLE_MAPS.API_KEY;
    var geocodeUrl = CONFIG.GOOGLE_MAPS.GEOCODING_URL + 
                     '?address=' + encodeURIComponent(altAddress) + 
                     '&key=' + apiKey;
    
    var geocodeResponse = UrlFetchApp.fetch(geocodeUrl, { muteHttpExceptions: true });
    var geocodeJson = JSON.parse(geocodeResponse.getContentText());
    
    if (geocodeJson.status === 'OK' && geocodeJson.results && geocodeJson.results.length > 0) {
      var location = geocodeJson.results[0].geometry.location;
      altLocationLat = location.lat;
      altLocationLng = location.lng;
      log('INFO', 'Main', 'Geocoding success: ' + altLocationLat + ', ' + altLocationLng);
    } else {
      log('WARN', 'Main', 'Geocoding failed: ' + geocodeJson.status);
    }
  } catch (geocodeError) {
    log('ERROR', 'Main', 'Geocoding exception: ' + geocodeError.message);
  }
  
  log('INFO', 'Main', 'Alt address extracted', {
    altAddress: altAddress,
    altBuildingName: altBuildingName,
    altLandmark: altLandmark,
    altLocationType: altLocationType,
    altRemarks: altRemarks,
    altLocationLat: altLocationLat,
    altLocationLng: altLocationLng
  });
}

// ===== 顧客住所は常にlocation_addressに設定 =====
locationAddress = customer.customer_address_street || customer.address;
locationType = 'OUTDOOR';
locationLat = customer.base_lat;
locationLng = customer.base_lng;

log('INFO', 'Main', 'Location data set', {
  locationAddress: locationAddress,
  locationLat: locationLat,
  locationLng: locationLng
});

// ===== 8. 予約データ構築 =====
var reservationData = {
  customer_id: customer.customer_id,
  primary_dog_id: requestBody.dogId,
  trainer_id: trainerId,
  office_id: 'default-office',
  product_id: requestBody.menuId,
  reservation_date: requestBody.date,
  start_time: requestBody.time,
  end_time: endTime,
  start_datetime: startDateTime,
  end_datetime: endDateTime,
  duration_minutes: duration,
  reservation_type: product && product.product_type === 'COURSE' ? 'COURSE' : 'SINGLE',
  is_multi_dog: requestBody.isMultiDog || false,
  location_type: locationType,
  location_address: locationAddress,
  location_lat: locationLat,
  location_lng: locationLng,
  
  // ===== 別住所情報（追加）=====
alt_address: altAddress,
alt_location_lat: altLocationLat,
alt_location_lng: altLocationLng,
alt_building_name: altBuildingName,
alt_landmark: altLandmark,
alt_location_type: altLocationType,
alt_remarks: altRemarks,
  status: 'PENDING',
  payment_status: requestBody.paymentStatus || 'UNPAID',
  payment_method: requestBody.paymentMethod || 'CASH',
  notes: requestBody.remarks || '',

  // ===== クーポン情報 =====
  coupon_id: requestBody.coupon_id || null,
  coupon_code: requestBody.coupon_code || null,
  coupon_value: requestBody.coupon_value || 0,

  // ===== 金額内訳 =====
  lesson_amount: requestBody.lesson_amount || 0,
  travel_fee: requestBody.travel_fee || 0,
  total_amount: requestBody.totalPrice || 0,

  // ===== CalendarRepository用の追加データ =====
  customer_name: customer.customer_name,
  customer_code: customer.customer_code,
  customer_phone: customer.customer_phone,
  dog_name: dog.dog_name,
  dog_code: dog.dog_code,
  trainer_name: trainer ? trainer.trainer_name : '',
  trainer_code: trainer ? trainer.trainer_code : '',
  product_name: product ? product.product_name : '単発トレーニング',
  address: locationAddress,

  created_by: 'WEB_RESERVATION'
};
    
    log('INFO', 'Main', 'Reservation data prepared', {
  customer_id: reservationData.customer_id,
  date: reservationData.reservation_date,
  time: reservationData.start_time,
  end_time: reservationData.end_time,
  alt_address: reservationData.alt_address,
  alt_location_lat: reservationData.alt_location_lat,
  alt_location_lng: reservationData.alt_location_lng,
  alt_building_name: reservationData.alt_building_name,
  alt_landmark: reservationData.alt_landmark,
  alt_location_type: reservationData.alt_location_type,
  alt_remarks: reservationData.alt_remarks
});
    
    // ===== 8. 予約作成 =====
    var reservation = ReservationRepository.create(reservationData);
    
    if (reservation.error) {
      throw reservation;
    }
    
    log('INFO', 'Main', 'Reservation created successfully', {
      reservation_id: reservation.reservation_id,
      reservation_code: reservation.reservation_code,
      google_calendar_id: reservation.google_calendar_id
    });
    
    // ===== 9. 通知送信 =====
    try {
      if (typeof NotificationService !== 'undefined') {
        NotificationService.sendReservationConfirmation(reservation.reservation_id);
      }
    } catch (notificationError) {
      log('WARN', 'Main', 'Notification failed', { error: notificationError.message });
    }
    
    return {
      status: 'success',
      reservation: reservation
    };
    
  } catch (error) {
    log('ERROR', 'Main', 'Failed to create reservation', { error: error.message });
    throw error;
  }
}


// ============================================================================
// GETハンドラー
// ============================================================================

/**
 * 顧客データ取得
 */
function handleGetCustomerData(lineUserId) {
  // 顧客情報取得
  var customer = CustomerRepository.findByLineUserId(lineUserId);
  
  if (!customer || customer.error) {
    throw createK9Error(
      ErrorCode.RECORD_NOT_FOUND,
      'Customer not found',
      { lineUserId: lineUserId }
    );
  }
  
  // フロントエンド互換性のためフィールドを追加
  customer.name = customer.customer_name;
  customer.name_disp = customer.customer_name ? customer.customer_name.split(' ')[0] : '';
  
  // 犬情報取得
  var dogs = DogRepository.findByCustomerId(customer.customer_id);
  
  if (dogs.error) {
    dogs = [];
  }
  
  // 各犬にもフィールドを追加
  dogs = dogs.map(function(dog) {
    dog.name = dog.dog_name;
    dog.name_disp = dog.dog_name;
    return dog;
  });
  
  return {
    customer: customer,
    dogs: dogs
  };
}

/**
 * 自分の予約一覧取得
 */
function handleGetMyReservations(lineUserId) {
  try {
    log('INFO', 'Main', 'Getting my reservations', { lineUserId: lineUserId });
    
    var customer = CustomerRepository.findByLineUserId(lineUserId);
    
    if (!customer || customer.error) {
      throw customer || createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Customer not found');
    }
    
    var reservations = ReservationRepository.findByCustomerId(customer.customer_id);
    
    if (reservations.error) {
      throw reservations;
    }
    
    log('INFO', 'Main', 'Reservations found', { count: reservations.length });
    
    // 商品・犬・トレーナーマスタを直接取得
    var products = DB.fetchTable(CONFIG.SHEET.PRODUCTS);
    var dogs = DB.fetchTable(CONFIG.SHEET.DOGS);
    var trainers = DB.fetchTable(CONFIG.SHEET.TRAINERS);
    
    // 各予約に情報を追加
    var enrichedReservations = reservations.map(function(reservation) {
      // 犬情報取得
      var dogName = null;
      if (reservation.primary_dog_id) {
        var dog = dogs.find(function(d) { return d.dog_id === reservation.primary_dog_id; });
        if (dog) {
          dogName = dog.dog_name;
        }
      }
      
      // 商品情報取得
      var productName = null;
      var amount = null;
      if (reservation.product_id) {
        var product = products.find(function(p) { return p.product_id === reservation.product_id; });
        if (product) {
          productName = product.product_name;
          amount = product.tax_included_price || product.product_price;
        }
      }
      
      // トレーナー情報取得
      var trainerName = 'スタッフ';
      if (reservation.trainer_id && reservation.trainer_id !== 'default-trainer') {
        var trainer = trainers.find(function(t) { return t.trainer_id === reservation.trainer_id; });
        if (trainer) {
          trainerName = trainer.trainer_name;
        }
      }
      
      // 日付を正規化
      var reservationDate = reservation.reservation_date;
      if (reservationDate && typeof reservationDate === 'object' && reservationDate.getTime) {
        reservationDate = Utilities.formatDate(reservationDate, 'JST', 'yyyy-MM-dd');
      } else if (reservationDate && reservationDate.length > 10) {
        reservationDate = reservationDate.split(' ')[0];
      }
      
      return {
        reservation_id: reservation.reservation_id,
        reservation_code: reservation.reservation_code,
        customer_id: reservation.customer_id,
        primary_dog_id: reservation.primary_dog_id,
        trainer_id: reservation.trainer_id,
        office_id: reservation.office_id,
        product_id: reservation.product_id,
        reservation_date: reservationDate,
        start_time: reservation.start_time,
        duration: reservation.duration_minutes || 90,
        status: reservation.status,
        payment_status: reservation.payment_status,
        dog_name: dogName,
        product_name: productName,
        trainer_name: trainerName,
        amount: amount
      };
    });
    
    log('INFO', 'Main', 'Reservations enriched', { count: enrichedReservations.length });
    
    return {
      reservations: enrichedReservations
    };
    
  } catch (error) {
    log('ERROR', 'Main', 'Failed to get my reservations', { error: error.message });
    throw error;
  }
}

/**
 * 商品一覧取得
 */
function handleGetProductList() {
  var products = DB.fetchTable(CONFIG.SHEET.PRODUCTS);
  
  var activeProducts = products.filter(function(product) {
    return product.product_status === 'ACTIVE' && !product.is_deleted;
  });
  
  return { products: activeProducts };
}

/**
 * トレーナー一覧取得
 */
function handleGetTrainerList() {
  var trainers = DB.fetchTable(CONFIG.SHEET.TRAINERS);
  
  var activeTrainers = trainers.filter(function(trainer) {
    return trainer.trainer_status === 'ACTIVE' && !trainer.is_deleted;
  });
  
  return { trainers: activeTrainers };
}

/**
 * 適用可能なクーポン取得（自動適用）
 */
function handleGetApplicableCoupon(params) {
  var productId = params.productId;
  var amount = parseInt(params.amount) || 0;
  var reservationDate = params.reservationDate;

  if (!productId || !amount) {
    return { coupon: null };
  }

  var coupon = CouponService.getAutoApplicableCoupon(productId, amount, reservationDate);
  return { coupon: coupon };
}

/**
 * クーポンコード検証
 */
function handleValidateCouponCode(params) {
  var couponCode = params.couponCode;
  var productId = params.productId;
  var amount = parseInt(params.amount) || 0;

  if (!couponCode) {
    return { valid: false, message: 'クーポンコードを入力してください' };
  }

  return CouponService.validateCouponCode(couponCode, productId, amount);
}

/**
 * 住所ジオコーディング（座標取得）
 * Google Maps APIを使用して住所から緯度経度を取得
 */
function handleGeocodeAddress(params) {
  var address = params.address;

  if (!address) {
    return { success: false, error: '住所を入力してください' };
  }

  try {
    // 日本国内の住所として検索
    var fullAddress = address;
    if (!address.includes('日本') && !address.includes('Japan')) {
      fullAddress = '日本 ' + address;
    }

    var geocoder = Maps.newGeocoder();
    geocoder.setLanguage('ja');
    geocoder.setRegion('jp');

    var response = geocoder.geocode(fullAddress);

    if (response.status !== 'OK' || !response.results || response.results.length === 0) {
      log('WARN', 'Main', 'Geocoding failed', { address: address, status: response.status });
      return {
        success: false,
        error: '住所が見つかりませんでした。正確な住所を入力してください。'
      };
    }

    var location = response.results[0].geometry.location;
    var formattedAddress = response.results[0].formatted_address;

    log('INFO', 'Main', 'Geocoding success', {
      address: address,
      lat: location.lat,
      lng: location.lng
    });

    return {
      success: true,
      lat: location.lat,
      lng: location.lng,
      formattedAddress: formattedAddress
    };

  } catch (error) {
    log('ERROR', 'Main', 'Geocoding error', { address: address, error: error.message });
    return {
      success: false,
      error: 'ジオコーディングエラー: ' + error.message
    };
  }
}

/**
 * Voucher/クーポンコード検証（既存フロントエンド互換）
 */
function handleCheckVoucher(params) {
  var couponCode = params.code;

  if (!couponCode) {
    return { valid: false, message: 'コードを入力してください' };
  }

  // CouponServiceで検証
  var result = CouponService.validateCouponCode(couponCode, 'ALL', 99999);

  if (result.valid) {
    return {
      valid: true,
      coupon_id: result.coupon.coupon_id,
      code: result.coupon.coupon_code,
      name: result.coupon.coupon_name,
      discount_type: result.coupon.discount_type,
      discount_value: result.coupon.discount_amount
    };
  } else {
    return {
      valid: false,
      message: result.message
    };
  }
}

/**
 * 空き枠取得
 */
function handleGetAvailableSlots(params) {
  var trainerId = params.trainerId;
  var date = params.date;
  
  if (!trainerId || !date) {
    throw createK9Error(
      ErrorCode.REQUIRED_FIELD_MISSING,
      'trainerId and date are required',
      { trainerId: trainerId, date: date }
    );
  }
  
  try {
    var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
    
    var bookedSlots = reservations.filter(function(r) {
      if (!r.trainer_id || !r.reservation_date) return false;
      
      var resDate = r.reservation_date;
      if (resDate instanceof Date) {
        resDate = Utilities.formatDate(resDate, 'JST', 'yyyy-MM-dd');
      } else if (typeof resDate !== 'string') {
        resDate = String(resDate);
      }
      
      return r.trainer_id === trainerId &&
             resDate.indexOf(date) === 0 &&
             (r.reservation_status === 'PENDING' || r.reservation_status === 'CONFIRMED');
    }).map(function(r) {
      return r.start_time;
    }).filter(function(time) {
      return time;
    });
    
    // ロック済み枠の取得
    var lockedSlots = [];
    try {
      var locks = DB.fetchTable(CONFIG.SHEET.RESERVATION_LOCKS);
      var now = new Date();
      
      lockedSlots = locks.filter(function(lock) {
        if (!lock.trainer_id || !lock.reservation_date || !lock.status || !lock.expires_at) {
          return false;
        }
        
        try {
          var expiresAt = new Date(lock.expires_at);
          if (expiresAt <= now) return false;
        } catch (e) {
          return false;
        }
        
        var lockDate = lock.reservation_date;
        if (lockDate instanceof Date) {
          lockDate = Utilities.formatDate(lockDate, 'JST', 'yyyy-MM-dd');
        } else if (typeof lockDate !== 'string') {
          lockDate = String(lockDate);
        }
        
        return lock.trainer_id === trainerId &&
               lockDate.indexOf(date) === 0 &&
               lock.status === 'LOCKED';
      }).map(function(lock) {
        var time = lock.start_time;
        if (!time && lock.reservation_date) {
          var dateStr = String(lock.reservation_date);
          var parts = dateStr.split(' ');
          if (parts.length > 1) {
            time = parts[1].substring(0, 5);
          }
        }
        return time;
      }).filter(function(time) {
        return time;
      });
    } catch (lockError) {
      log('WARN', 'Main', 'Failed to fetch reservation locks', { error: lockError.message });
      lockedSlots = [];
    }
    
    var allSlots = [
      '09:00', '10:00', '11:00', '12:00', '13:00',
      '14:00', '15:00', '16:00', '17:00', '18:00'
    ];
    
    var availableSlots = allSlots.filter(function(slot) {
      return bookedSlots.indexOf(slot) === -1 && lockedSlots.indexOf(slot) === -1;
    });
    
    return { slots: availableSlots };
    
  } catch (error) {
    log('ERROR', 'Main', 'Failed to get available slots', { error: error.message });
    throw error;
  }
}

/**
 * ヘルスチェック
 */
function handleHealthCheck() {
  return {
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: CONFIG.SYSTEM.API_VERSION,
    tokenVerificationEnabled: ENABLE_TOKEN_VERIFICATION
  };
}

// ============================================================================
// POSTハンドラー
// ============================================================================

/**
 * 予約作成 + 決済（アトミック）
 * handleAddReservationと同等のデータ処理 + Square決済を実行
 *
 * 対応パターン:
 * 1. 既存ユーザー: customer_id/dog_idで顧客・犬を取得
 * 2. 新規ユーザー（事前登録済み）: lineUserIdで顧客・犬を取得
 * 3. 新規ユーザー（未登録）: regDataから顧客・犬を作成
 */
function handleCreateReservationWithPayment(lineUserId, requestBody) {
  log('INFO', 'Main', '=== handleCreateReservationWithPayment START ===');
  log('DEBUG', 'Main', 'Input lineUserId: ' + lineUserId);
  log('DEBUG', 'Main', 'requestBody keys: ' + Object.keys(requestBody).join(', '));
  log('DEBUG', 'Main', 'isNewUser: ' + requestBody.isNewUser);

  var customer, dog;
  var isNewUser = requestBody.isNewUser === true || requestBody.isNewUser === 'true';

  // ===== 1. 顧客情報取得/作成 =====
  customer = CustomerRepository.findByLineUserId(lineUserId);

  log('DEBUG', 'Main', 'CustomerRepository.findByLineUserId result:', {
    found: !!customer && !customer.error,
    error: customer ? customer.error : 'null',
    customer_id: customer ? customer.customer_id : 'null'
  });

  if (!customer || customer.error) {
    // 顧客が見つからない場合
    if (isNewUser && requestBody.regData) {
      // 新規ユーザー: regDataから顧客を作成
      log('INFO', 'Main', 'Creating new customer from regData');

      var regData = requestBody.regData;
      customer = CustomerRepository.create({
        line_user_id: lineUserId,
        customer_name: regData.name,
        customer_phone: regData.phone,
        customer_email: regData.email || null,
        postal_code: regData.zip || null,
        address: regData.address,
        building: regData.building || null,
        landmark: regData.landmark || null,
        base_lat: regData.lat || null,
        base_lng: regData.lng || null,
        registration_status: 'ACTIVE'
      });

      if (customer.error) {
        log('ERROR', 'Main', 'Customer creation failed', customer);
        throw customer;
      }
      log('INFO', 'Main', 'New customer created: ' + customer.customer_id);
    } else {
      log('ERROR', 'Main', 'Customer not found for lineUserId: ' + lineUserId);
      throw createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Customer not found');
    }
  }

  log('INFO', 'Main', 'Customer identified: ' + customer.customer_id);

  // ===== データ解析 =====
  var reservationDataFromClient, paymentDataFromClient;

  // 新規ユーザーフォーマット vs 既存ユーザーフォーマットの判定
  if (requestBody.reservationData && typeof requestBody.reservationData === 'string') {
    // 既存フォーマット（JSON文字列）
    reservationDataFromClient = JSON.parse(requestBody.reservationData);
    paymentDataFromClient = JSON.parse(requestBody.paymentData);
  } else {
    // 新規ユーザーフォーマット（直接オブジェクト）
    reservationDataFromClient = {
      reservation_date: requestBody.date,
      start_time: requestBody.time,
      trainer_id: requestBody.trainerId,
      product_id: requestBody.menuId,
      is_multi_dog: requestBody.isMultiDog || false,
      lesson_amount: requestBody.lesson_amount,
      travel_fee: requestBody.travel_fee,
      total_amount: requestBody.totalPrice
    };
    paymentDataFromClient = requestBody.paymentData ? JSON.parse(requestBody.paymentData) : {
      amount: requestBody.lesson_amount,
      total_amount: requestBody.totalPrice,
      payment_method: requestBody.paymentMethod === 'CREDIT' ? 'CREDIT_CARD' : 'CASH'
    };
  }

  log('DEBUG', 'Main', 'Parsed reservationData:', reservationDataFromClient);
  log('DEBUG', 'Main', 'Parsed paymentData:', paymentDataFromClient);

  // ===== 2. 犬情報取得/作成 =====
  var dogId = reservationDataFromClient.primary_dog_id;

  if (dogId) {
    // 犬IDが指定されている場合
    dog = DogRepository.findById(dogId);
  } else {
    // 犬IDがない場合、顧客の犬を検索
    var customerDogs = DogRepository.findByCustomerId(customer.customer_id);
    if (customerDogs && customerDogs.length > 0) {
      dog = customerDogs[0];
      log('INFO', 'Main', 'Found existing dog for customer: ' + dog.dog_id);
    }
  }

  // 犬が見つからない場合、新規作成を試みる
  if ((!dog || dog.error) && isNewUser && requestBody.regData) {
    log('INFO', 'Main', 'Creating new dog from regData');

    var regData = requestBody.regData;
    var dogAgeYears = regData.dogAgeYears || regData.dogAge || 0;
    var dogAgeMonths = regData.dogAgeMonths || 0;

    dog = DogRepository.create({
      customer_id: customer.customer_id,
      dog_name: regData.dogName,
      breed: regData.dogBreed,
      age_years: dogAgeYears,
      age_months: dogAgeMonths,
      dog_gender: regData.dogGender || null,
      is_neutered: regData.neutered || false,
      vaccinations: regData.vaccinations ? JSON.stringify(regData.vaccinations) : null,
      problem: regData.concerns || null,
      notes: regData.remarks || null
    });

    if (dog.error) {
      log('ERROR', 'Main', 'Dog creation failed', dog);
      throw dog;
    }
    log('INFO', 'Main', 'New dog created: ' + dog.dog_id);
  }

  if (!dog || dog.error) {
    throw createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Dog not found and could not be created');
  }

  // reservationDataにdog_idを設定
  reservationDataFromClient.primary_dog_id = dog.dog_id;

  // ===== 3. トレーナー情報取得 =====
  var trainerId = reservationDataFromClient.trainer_id;
  var trainer = null;

  if (!trainerId) {
    var trainers = DB.fetchTable(CONFIG.SHEET.TRAINERS);
    if (trainers.length > 0) {
      trainerId = trainers[0].trainer_id;
      trainer = trainers[0];
    }
  } else {
    var trainers = DB.fetchTable(CONFIG.SHEET.TRAINERS);
    trainer = trainers.find(function(t) {
      return t.trainer_id === trainerId;
    });
  }

  // ===== 4. 商品情報取得・時間計算 =====
  var duration = reservationDataFromClient.duration || 90;
  var product = null;

  if (reservationDataFromClient.product_id) {
    var products = DB.fetchTable(CONFIG.SHEET.PRODUCTS);
    product = products.find(function(p) {
      return p.product_id === reservationDataFromClient.product_id;
    });

    if (product && product.product_duration) {
      duration = product.product_duration;
    }

    if (reservationDataFromClient.is_multi_dog) {
      duration += 30;
    }
  }

  // ===== 5. 日時計算 =====
  var startDateTime = new Date(reservationDataFromClient.reservation_date + ' ' + reservationDataFromClient.start_time);
  var endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);
  var endTime = Utilities.formatDate(endDateTime, 'JST', 'HH:mm');

  log('INFO', 'Main', 'Time calculation: ' + reservationDataFromClient.start_time + ' + ' + duration + 'min = ' + endTime);

  // ===== 6. 住所情報処理 =====
  var locationAddress, locationType, locationLat, locationLng;
  var altAddress = null;
  var altLocationLat = null;
  var altLocationLng = null;
  var altBuildingName = null;
  var altLandmark = null;
  var altLocationType = null;
  var altRemarks = null;

  // 別住所の処理
  if (reservationDataFromClient.use_alt_address && reservationDataFromClient.alt_address) {
    log('INFO', 'Main', 'Processing alternative address');

    var altAddrData = reservationDataFromClient.alt_address;
    altAddress = altAddrData.address;
    altBuildingName = altAddrData.buildingName || null;
    altLandmark = altAddrData.landmark || null;
    altLocationType = altAddrData.locationType || 'OUTDOOR';
    altRemarks = altAddrData.remarks || null;

    // ジオコーディング
    try {
      var apiKey = CONFIG.GOOGLE_MAPS.API_KEY;
      var geocodeUrl = CONFIG.GOOGLE_MAPS.GEOCODING_URL +
                       '?address=' + encodeURIComponent(altAddress) +
                       '&key=' + apiKey;

      var geocodeResponse = UrlFetchApp.fetch(geocodeUrl, { muteHttpExceptions: true });
      var geocodeJson = JSON.parse(geocodeResponse.getContentText());

      if (geocodeJson.status === 'OK' && geocodeJson.results && geocodeJson.results.length > 0) {
        var location = geocodeJson.results[0].geometry.location;
        altLocationLat = location.lat;
        altLocationLng = location.lng;
        log('INFO', 'Main', 'Geocoding success: ' + altLocationLat + ', ' + altLocationLng);
      } else {
        log('WARN', 'Main', 'Geocoding failed: ' + geocodeJson.status);
      }
    } catch (geocodeError) {
      log('ERROR', 'Main', 'Geocoding exception: ' + geocodeError.message);
    }
  }

  // 顧客住所は常にlocation_addressに設定
  locationAddress = customer.customer_address_street || customer.address || '';
  locationType = 'OUTDOOR';
  locationLat = customer.base_lat;
  locationLng = customer.base_lng;

  log('INFO', 'Main', 'Location data set', {
    locationAddress: locationAddress,
    locationLat: locationLat,
    locationLng: locationLng,
    altAddress: altAddress
  });

  // ===== 7. 予約データ構築（完全版）=====
  var reservationData = {
    customer_id: customer.customer_id,
    primary_dog_id: reservationDataFromClient.primary_dog_id,
    trainer_id: trainerId,
    office_id: reservationDataFromClient.office_id || 'default-office',
    product_id: reservationDataFromClient.product_id,
    reservation_date: reservationDataFromClient.reservation_date,
    start_time: reservationDataFromClient.start_time,
    end_time: endTime,
    start_datetime: startDateTime,
    end_datetime: endDateTime,
    duration_minutes: duration,
    reservation_type: product && product.product_type === 'COURSE' ? 'COURSE' : 'SINGLE',
    is_multi_dog: reservationDataFromClient.is_multi_dog || false,
    location_type: locationType,
    location_address: locationAddress,
    location_lat: locationLat,
    location_lng: locationLng,

    // 別住所情報
    alt_address: altAddress,
    alt_location_lat: altLocationLat,
    alt_location_lng: altLocationLng,
    alt_building_name: altBuildingName,
    alt_landmark: altLandmark,
    alt_location_type: altLocationType,
    alt_remarks: altRemarks,

    status: 'PENDING',
    payment_status: 'PENDING',
    payment_method: paymentDataFromClient.payment_method || 'CREDIT',
    notes: reservationDataFromClient.notes || '',

    // クーポン情報
    coupon_id: reservationDataFromClient.coupon_id || null,
    coupon_code: reservationDataFromClient.coupon_code || null,
    coupon_value: reservationDataFromClient.coupon_value || 0,

    // 金額内訳
    lesson_amount: reservationDataFromClient.lesson_amount || 0,
    travel_fee: reservationDataFromClient.travel_fee || 0,
    total_amount: paymentDataFromClient.total_amount || 0,

    // CalendarRepository用の追加データ
    customer_name: customer.customer_name,
    customer_code: customer.customer_code,
    customer_phone: customer.customer_phone,
    dog_name: dog.dog_name,
    dog_code: dog.dog_code,
    trainer_name: trainer ? trainer.trainer_name : '',
    trainer_code: trainer ? trainer.trainer_code : '',
    product_name: product ? product.product_name : '単発トレーニング',
    address: locationAddress,

    created_by: 'WEB_RESERVATION'
  };

  log('INFO', 'Main', 'Reservation data prepared', {
    customer_id: reservationData.customer_id,
    date: reservationData.reservation_date,
    start_time: reservationData.start_time,
    end_time: reservationData.end_time,
    duration_minutes: reservationData.duration_minutes,
    location_address: reservationData.location_address
  });

  // ===== 8. 決済データ構築 =====
  var paymentData = {
    amount: paymentDataFromClient.amount,
    tax_amount: paymentDataFromClient.tax_amount,
    total_amount: paymentDataFromClient.total_amount,
    payment_method: paymentDataFromClient.payment_method || 'CREDIT_CARD',
    square_source_id: paymentDataFromClient.square_source_id
  };

  var lockId = requestBody.lockId;

  // ===== 9. idempotency_key生成・キュー登録 =====
  var idempotencyKey = Transaction.generateIdempotencyKey(customer.customer_id);
  paymentData.idempotency_key = idempotencyKey;

  log('INFO', 'Main', 'idempotency_key generated: ' + idempotencyKey);

  // 二重処理チェック
  var duplicateCheck = Transaction.checkSquareDuplicate(idempotencyKey);
  if (duplicateCheck.isDuplicate) {
    log('WARN', 'Main', 'Duplicate transaction detected');
    return {
      success: true,
      duplicate: true,
      message: duplicateCheck.message,
      existingEntry: duplicateCheck.existingEntry
    };
  }

  // トランザクションキューに登録
  var queueEntry = Transaction.enqueue({
    idempotency_key: idempotencyKey,
    transaction_type: 'PAYMENT',
    customer_id: customer.customer_id,
    request_data: {
      reservationData: reservationData,
      paymentData: paymentData,
      lockId: lockId
    }
  });

  // ===== 10. アトミックトランザクション実行（Square決済含む）=====
  var result;
  try {
    result = Transaction.createReservationWithPaymentAtomic(
      reservationData,
      paymentData,
      lockId
    );

    if (result.error || !result.success) {
      throw result;
    }

    // 成功: キューステータスを更新
    Transaction.updateQueueStatus(queueEntry.queue_id, 'COMPLETED');

    log('INFO', 'Main', '=== handleCreateReservationWithPayment SUCCESS ===');
    return result;

  } catch (transactionError) {
    log('ERROR', 'Main', 'Transaction failed, creating PENDING_PAYMENT reservation', transactionError);

    // キューステータスを更新
    Transaction.updateQueueStatus(queueEntry.queue_id, 'FAILED', {
      error: transactionError.message || JSON.stringify(transactionError),
      retry_count: 1
    });

    // ===== PENDING_PAYMENT予約を作成（決済なしで予約確保）=====
    try {
      reservationData.status = 'CONFIRMED';  // 予約自体は確定
      reservationData.payment_status = 'PENDING_PAYMENT';  // 決済は保留

      var reservationOnly = ReservationRepository.create(reservationData);

      if (reservationOnly.error) {
        log('ERROR', 'Main', 'Failed to create PENDING_PAYMENT reservation', reservationOnly);
        throw transactionError;  // 元のエラーを投げる
      }

      // キューにreservation_idを追加
      Transaction.updateQueueStatus(queueEntry.queue_id, 'PENDING_RETRY', {
        reservation_id: reservationOnly.reservation_id
      });

      log('INFO', 'Main', 'PENDING_PAYMENT reservation created: ' + reservationOnly.reservation_code);

      // LINE通知（予約確保 + 決済リトライ中）
      if (typeof NotificationService !== 'undefined' && customer.line_user_id) {
        try {
          NotificationService.sendPaymentPendingNotification(
            customer.line_user_id,
            reservationOnly,
            '決済処理を再試行しております'
          );
        } catch (notifyError) {
          log('WARN', 'Main', 'Failed to send PENDING_PAYMENT notification: ' + notifyError.message);
        }
      }

      return {
        success: true,
        payment_pending: true,
        reservation: reservationOnly,
        message: '予約は確保されました。決済処理を再試行中です。',
        queue_id: queueEntry.queue_id
      };

    } catch (fallbackError) {
      log('ERROR', 'Main', 'Failed to create fallback reservation', fallbackError);
      throw transactionError;
    }
  }
}

/**
 * 予約キャンセル
 */
function handleCancelReservation(lineUserId, requestBody) {
  var reservationId = requestBody.reservationId;
  var reason = requestBody.reason || '';
  
  if (!reservationId) {
    throw createK9Error(
      ErrorCode.REQUIRED_FIELD_MISSING,
      'reservationId is required'
    );
  }
  
  var reservation = ReservationRepository.findById(reservationId);
  
  if (reservation.error) {
    throw reservation;
  }
  
  var customer = CustomerRepository.findByLineUserId(lineUserId);
  
  if (!customer || customer.error) {
    throw customer || createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Customer not found');
  }
  
  if (reservation.customer_id !== customer.customer_id) {
    throw createK9Error(
      ErrorCode.PERMISSION_DENIED,
      'You do not have permission to cancel this reservation'
    );
  }
  
  var result = ReservationService.cancelReservation(
    reservationId,
    reason,
    'CUSTOMER'
  );
  
  if (result.error) {
    throw result;
  }
  
  return result;
}

/**
 * プロフィール更新
 */
function handleUpdateProfile(lineUserId, requestBody) {
  var customer = CustomerRepository.findByLineUserId(lineUserId);
  
  if (!customer || customer.error) {
    throw customer || createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Customer not found');
  }
  
  var updateData = requestBody.updateData;
  
  if (!updateData) {
    throw createK9Error(
      ErrorCode.REQUIRED_FIELD_MISSING,
      'updateData is required'
    );
  }
  
  var result = CustomerRepository.update(customer.customer_id, updateData);
  
  if (result.error) {
    throw result;
  }
  
  return result;
}

/**
 * 犬情報更新
 */
function handleUpdateDog(lineUserId, requestBody) {
  var dogId = requestBody.dogId;
  var updateData = requestBody.updateData;
  
  if (!dogId || !updateData) {
    throw createK9Error(
      ErrorCode.REQUIRED_FIELD_MISSING,
      'dogId and updateData are required'
    );
  }
  
  var dog = DogRepository.findById(dogId);
  
  if (dog.error) {
    throw dog;
  }
  
  var customer = CustomerRepository.findByLineUserId(lineUserId);
  
  if (!customer || customer.error) {
    throw customer || createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Customer not found');
  }
  
  if (dog.customer_id !== customer.customer_id) {
    throw createK9Error(
      ErrorCode.PERMISSION_DENIED,
      'You do not have permission to update this dog'
    );
  }
  
  var result = DogRepository.update(dogId, updateData);
  
  if (result.error) {
    throw result;
  }
  
  return result;
}

/**
 * 予約枠ロック
 */
function handleLockSlot(lineUserId, requestBody) {
  var customer = CustomerRepository.findByLineUserId(lineUserId);
  
  if (!customer || customer.error) {
    throw customer || createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Customer not found');
  }
  
  var lockData = {
    trainer_id: requestBody.trainerId,
    office_id: requestBody.officeId,
    reservation_date: requestBody.reservationDate,
    customer_id: customer.customer_id
  };
  
  var result = ReservationService.lockSlot(lockData);
  
  if (result.error) {
    throw result;
  }
  
  return result;
}

/**
 * 月の空き状況取得ハンドラー
 */
/**
 * 月の空き状況取得ハンドラー
 */
function handleGetMonthAvailability(lineUserId, requestBody) {
  try {
    log('INFO', 'Main', 'handleGetMonthAvailability', {
      year: requestBody.year,
      month: requestBody.month,
      trainer_code: requestBody.trainer_code
    });
    
    var params = {
      year: requestBody.year,
      month: requestBody.month,
      trainer_code: requestBody.trainer_code,
      is_multiple_dogs: requestBody.is_multiple_dogs || false
    };
    
    var result = getMonthAvailability(params);
    
    if (!result.success) {
      throw createK9Error(
        ErrorCode.CALENDAR_ERROR,
        result.error || 'カレンダー空き状況の取得に失敗しました',
        { error_details: result.error_details }
      );
    }
    
    return result;
    
  } catch (error) {
    log('ERROR', 'Main', 'handleGetMonthAvailability exception', {
      error: error.message
    });
    
    throw error;
  }
}
// ============================================================================
// テスト関数
// ============================================================================

/**
 * 顧客データ取得テスト
 */
function testGetCustomerData() {
  console.log('=== Test Get Customer Data ===\n');
  
  var mockRequest = {
    parameter: {
      action: 'getCustomerData',
      userId: 'U1d95daf0e8dfe55a2d5f22442fcddf2f'
    }
  };
  
  try {
    var response = doGet(mockRequest);
    var content = response.getContent();
    var data = JSON.parse(content);
    
    if (data.error === false) {
      console.log('✅ Success!');
      console.log('Customer:', data.customer.customer_name);
      console.log('Dogs:', data.dogs.length);
    } else {
      console.log('❌ Error:', data.message);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

/**
 * ヘルスチェックテスト
 */
function testHealthCheck() {
  console.log('=== Health Check Test ===\n');
  
  var mockRequest = {
    parameter: {
      action: 'healthCheck'
    }
  };
  
  try {
    var response = doGet(mockRequest);
    var content = response.getContent();
    var data = JSON.parse(content);
    
    if (data.error === false && data.status === 'OK') {
      console.log('✅ Health check passed');
      console.log('API Version:', data.version);
      console.log('Token Verification:', data.tokenVerificationEnabled);
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

/**
 * Token検証テスト
 */
function testTokenVerification() {
  console.log('=== Token Verification Test ===\n');
  
  // テスト用のダミーToken(実際のTokenに置き換えてください)
  var testToken = 'eyJhbGciOiJIUzI1NiJ9.CkNnhqMDnmQRsPU_gjlheRyTZ0yRv0IWBkvGf-opfuClDM3uzERYyb5CkdX_0Yz9o6Dgf5ZsjusG0tmgEs32I4-FSv_1DSsy5gkxScgrMcJHSYmR5Fu7FZvGq-obhRbrhDon-iZJpb5rkpTKtBWLn7et4yBYx6u9L0jtnu2klx4.-wDeoPTljDcnjvtAB466HpwQPgNuKRZH5kvc4rif0AM';
  
  console.log('Testing with token:', testToken.substring(0, 20) + '...');
  
  try {
    var result = LineTokenVerification.verifyToken(testToken);
    
    console.log('\nVerification Result:');
    console.log('- Error:', result.error);
    console.log('- Success:', result.success);
    console.log('- User ID:', result.userId);
    console.log('- Message:', result.message);
    
    if (result.success) {
      console.log('\n✅ Token verification succeeded');
      console.log('User ID:', result.userId);
    } else {
      console.log('\n❌ Token verification failed');
      console.log('Reason:', result.message);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with exception:', error.message);
    console.error('Stack:', error.stack);
  }
}

// ============================================================================
// 新規ユーザー早期登録（二段階処理用）
// ============================================================================

/**
 * 顧客情報の早期登録
 * View4 飼い主情報入力完了時にバックグラウンドで呼び出される
 */
function handleRegisterCustomer(lineUserId, requestBody) {
  log('INFO', 'Main', '=== handleRegisterCustomer START ===');
  log('DEBUG', 'Main', 'lineUserId: ' + lineUserId);
  log('DEBUG', 'Main', 'requestBody: ' + JSON.stringify(requestBody));

  // 既存顧客チェック
  var existingCustomer = CustomerRepository.findByLineUserId(lineUserId);
  if (existingCustomer && !existingCustomer.error) {
    log('INFO', 'Main', 'Customer already exists: ' + existingCustomer.customer_id);
    return {
      success: true,
      customer_id: existingCustomer.customer_id,
      existing: true
    };
  }

  // 必須フィールド検証
  var regData = requestBody.regData || requestBody;
  if (!regData.name || !regData.phone || !regData.address) {
    throw createK9Error(
      ErrorCode.REQUIRED_FIELD_MISSING,
      '顧客登録に必要な情報が不足しています',
      { required: ['name', 'phone', 'address'] }
    );
  }

  // 顧客作成
  var customer = CustomerRepository.create({
    line_user_id: lineUserId,
    customer_name: regData.name,
    customer_phone: regData.phone,
    customer_email: regData.email || null,
    postal_code: regData.zip || null,
    address: regData.address,
    building: regData.building || null,
    landmark: regData.landmark || null,
    base_lat: regData.lat || null,
    base_lng: regData.lng || null,
    registration_status: 'PENDING'  // 予約完了まではPENDING
  });

  if (customer.error) {
    log('ERROR', 'Main', 'Customer creation failed', customer);
    throw customer;
  }

  log('INFO', 'Main', 'Customer created: ' + customer.customer_id);
  log('INFO', 'Main', '=== handleRegisterCustomer SUCCESS ===');

  return {
    success: true,
    customer_id: customer.customer_id,
    existing: false
  };
}

/**
 * 犬情報の早期登録
 * View4 犬情報入力完了時にバックグラウンドで呼び出される
 */
function handleRegisterDog(lineUserId, requestBody) {
  log('INFO', 'Main', '=== handleRegisterDog START ===');
  log('DEBUG', 'Main', 'lineUserId: ' + lineUserId);
  log('DEBUG', 'Main', 'requestBody: ' + JSON.stringify(requestBody));

  // 顧客取得
  var customer = CustomerRepository.findByLineUserId(lineUserId);
  if (!customer || customer.error) {
    throw createK9Error(
      ErrorCode.RECORD_NOT_FOUND,
      '顧客情報が見つかりません。先に顧客登録を行ってください。'
    );
  }

  // 必須フィールド検証
  var regData = requestBody.regData || requestBody;
  if (!regData.dogName || !regData.dogBreed) {
    throw createK9Error(
      ErrorCode.REQUIRED_FIELD_MISSING,
      '犬情報登録に必要な情報が不足しています',
      { required: ['dogName', 'dogBreed'] }
    );
  }

  // 年齢フィールドの互換性対応
  var dogAgeYears = regData.dogAgeYears || regData.dogAge || 0;
  var dogAgeMonths = regData.dogAgeMonths || 0;

  // 犬作成
  var dog = DogRepository.create({
    customer_id: customer.customer_id,
    dog_name: regData.dogName,
    breed: regData.dogBreed,
    age_years: dogAgeYears,
    age_months: dogAgeMonths,
    dog_gender: regData.dogGender || null,
    is_neutered: regData.neutered || false,
    vaccinations: regData.vaccinations ? JSON.stringify(regData.vaccinations) : null,
    problem: regData.concerns || null,
    notes: regData.remarks || null
  });

  if (dog.error) {
    log('ERROR', 'Main', 'Dog creation failed', dog);
    throw dog;
  }

  log('INFO', 'Main', 'Dog created: ' + dog.dog_id);
  log('INFO', 'Main', '=== handleRegisterDog SUCCESS ===');

  return {
    success: true,
    customer_id: customer.customer_id,
    dog_id: dog.dog_id
  };
}

/**
 * LineTokenVerification が存在するか確認
 */
function testLineTokenVerificationExists() {
  console.log('=== LineTokenVerification Existence Test ===\n');

  try {
    if (typeof LineTokenVerification === 'undefined') {
      console.log('❌ LineTokenVerification is NOT defined');
      console.log('Please make sure LineTokenVerification.gs is deployed');
      return;
    }

    console.log('✅ LineTokenVerification is defined');

    if (typeof LineTokenVerification.verifyToken === 'function') {
      console.log('✅ LineTokenVerification.verifyToken is a function');
    } else {
      console.log('❌ LineTokenVerification.verifyToken is NOT a function');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// ============================================================================
// 決済リトライトリガー
// ============================================================================

/**
 * 決済リトライトリガー（5分毎に実行）
 * GASのトリガーとして設定: トリガー → retryFailedPayments → 時間主導型 → 5分毎
 */
function retryFailedPayments() {
  log('INFO', 'Main', '=== retryFailedPayments START ===');

  try {
    // リトライ対象のキューエントリを取得
    var allEntries = DB.fetchTable(CONFIG.SHEET.TRANSACTION_QUEUE);

    var pendingRetries = allEntries.filter(function(entry) {
      return entry.status === 'PENDING_RETRY' &&
             entry.retry_count < (entry.max_retries || 3);
    });

    log('INFO', 'Main', 'Found ' + pendingRetries.length + ' pending payment retries');

    if (pendingRetries.length === 0) {
      log('INFO', 'Main', '=== retryFailedPayments END (no pending retries) ===');
      return { success: true, processed: 0 };
    }

    var results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      manualRequired: 0
    };

    pendingRetries.forEach(function(entry) {
      try {
        log('INFO', 'Main', 'Processing retry for queue_id: ' + entry.queue_id);
        results.processed++;

        // リクエストデータを復元
        var requestData = typeof entry.request_data === 'string'
          ? JSON.parse(entry.request_data)
          : entry.request_data;

        var paymentData = requestData.paymentData;
        var reservationId = entry.reservation_id;

        if (!paymentData || !paymentData.square_source_id) {
          log('ERROR', 'Main', 'Invalid payment data for retry', { queue_id: entry.queue_id });
          handleRetryFailure(entry, 'Invalid payment data: square_source_id missing');
          results.failed++;
          return;
        }

        // Square決済リトライ
        log('INFO', 'Main', 'Retrying Square payment', {
          queue_id: entry.queue_id,
          amount: paymentData.total_amount,
          idempotency_key: entry.idempotency_key
        });

        // idempotency_keyを設定（同じキーで再試行）
        paymentData.idempotency_key = entry.idempotency_key;

        var squareResult = SquareService.processCardPayment(paymentData, paymentData.square_source_id);

        if (squareResult.success) {
          // 成功: キュー更新 + 予約更新 + 通知
          handleRetrySuccess(entry, squareResult, reservationId);
          results.succeeded++;
        } else {
          // 失敗: リトライカウント増加
          handleRetryFailure(entry, squareResult.message || 'Square payment failed');
          results.failed++;
        }

      } catch (retryError) {
        log('ERROR', 'Main', 'Retry exception for queue_id: ' + entry.queue_id, {
          error: retryError.message
        });
        handleRetryFailure(entry, retryError.message);
        results.failed++;
      }
    });

    log('INFO', 'Main', '=== retryFailedPayments END ===', results);
    return { success: true, results: results };

  } catch (error) {
    log('ERROR', 'Main', 'retryFailedPayments failed: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * リトライ成功時の処理
 */
function handleRetrySuccess(queueEntry, squareResult, reservationId) {
  log('INFO', 'Main', 'Payment retry succeeded for queue_id: ' + queueEntry.queue_id);

  // 1. キューステータスを更新
  Transaction.updateQueueStatus(queueEntry.queue_id, 'COMPLETED', {
    square_payment_id: squareResult.square_payment_id
  });

  // 2. 予約の決済ステータスを更新
  if (reservationId) {
    DB.update(CONFIG.SHEET.RESERVATIONS, reservationId, {
      payment_status: 'CAPTURED',
      updated_at: new Date()
    });

    log('INFO', 'Main', 'Reservation payment status updated to CAPTURED: ' + reservationId);
  }

  // 3. 決済レコード作成/更新
  try {
    var requestData = typeof queueEntry.request_data === 'string'
      ? JSON.parse(queueEntry.request_data)
      : queueEntry.request_data;

    var paymentData = requestData.paymentData;

    var paymentRecord = {
      payment_id: Utilities.getUuid(),
      reservation_id: reservationId,
      customer_id: queueEntry.customer_id,
      amount: paymentData.amount,
      tax_amount: paymentData.tax_amount || 0,
      total_amount: paymentData.total_amount,
      payment_method: 'CREDIT_CARD',
      payment_status: 'CAPTURED',
      square_payment_id: squareResult.square_payment_id,
      square_order_id: squareResult.square_order_id || '',
      square_receipt_url: squareResult.square_receipt_url || '',
      card_brand: squareResult.card_brand || '',
      card_last4: squareResult.card_last4 || '',
      created_at: new Date(),
      updated_at: new Date()
    };

    DB.insert(CONFIG.SHEET.PAYMENTS, paymentRecord);
    log('INFO', 'Main', 'Payment record created: ' + paymentRecord.payment_id);
  } catch (paymentError) {
    log('WARN', 'Main', 'Failed to create payment record: ' + paymentError.message);
  }

  // 4. LINE通知（決済完了）
  try {
    var customer = CustomerRepository.findById(queueEntry.customer_id);
    if (customer && !customer.error && customer.line_user_id) {
      var reservation = ReservationRepository.findById(reservationId);
      if (reservation && !reservation.error) {
        NotificationService.sendPaymentCompletedNotification(
          customer.line_user_id,
          reservation,
          squareResult
        );
        log('INFO', 'Main', 'Payment completed notification sent');
      }
    }
  } catch (notifyError) {
    log('WARN', 'Main', 'Failed to send payment completed notification: ' + notifyError.message);
  }
}

/**
 * リトライ失敗時の処理
 */
function handleRetryFailure(queueEntry, errorMessage) {
  var newRetryCount = (queueEntry.retry_count || 0) + 1;
  var maxRetries = queueEntry.max_retries || 3;

  log('INFO', 'Main', 'Payment retry failed', {
    queue_id: queueEntry.queue_id,
    retry_count: newRetryCount,
    max_retries: maxRetries,
    error: errorMessage
  });

  if (newRetryCount >= maxRetries) {
    // 最大リトライ回数到達: MANUAL_REQUIRED
    log('WARN', 'Main', 'Max retries reached, marking as MANUAL_REQUIRED');

    DB.update(CONFIG.SHEET.TRANSACTION_QUEUE, queueEntry.queue_id, {
      status: 'MANUAL_REQUIRED',
      retry_count: newRetryCount,
      last_error: errorMessage,
      updated_at: new Date()
    });

    // 顧客に通知（最終失敗）
    try {
      var customer = CustomerRepository.findById(queueEntry.customer_id);
      if (customer && !customer.error && customer.line_user_id) {
        var reservation = null;
        if (queueEntry.reservation_id) {
          reservation = ReservationRepository.findById(queueEntry.reservation_id);
        }
        NotificationService.sendPaymentFailedNotification(
          customer.line_user_id,
          reservation,
          errorMessage
        );
        log('INFO', 'Main', 'Payment failed notification sent to customer');
      }
    } catch (notifyError) {
      log('WARN', 'Main', 'Failed to send payment failed notification: ' + notifyError.message);
    }

    // 管理者に通知
    try {
      var adminCustomer = CustomerRepository.findById(queueEntry.customer_id);
      var adminReservation = queueEntry.reservation_id
        ? ReservationRepository.findById(queueEntry.reservation_id)
        : null;
      NotificationService.sendPaymentErrorToAdmin(queueEntry, adminCustomer, adminReservation);
      log('INFO', 'Main', 'Payment error notification sent to admin');
    } catch (adminNotifyError) {
      log('WARN', 'Main', 'Failed to send admin notification: ' + adminNotifyError.message);
    }

  } else {
    // まだリトライ可能: PENDING_RETRY
    DB.update(CONFIG.SHEET.TRANSACTION_QUEUE, queueEntry.queue_id, {
      status: 'PENDING_RETRY',
      retry_count: newRetryCount,
      last_error: errorMessage,
      updated_at: new Date()
    });
  }
}

/**
 * 手動リトライ用関数
 * 管理者がqueueIdを指定して手動でリトライを実行
 */
function manualRetryPayment(queueId) {
  log('INFO', 'Main', 'Manual retry requested for queue_id: ' + queueId);

  var allEntries = DB.fetchTable(CONFIG.SHEET.TRANSACTION_QUEUE);
  var entry = allEntries.find(function(e) {
    return e.queue_id === queueId;
  });

  if (!entry) {
    return { error: true, message: 'Queue entry not found: ' + queueId };
  }

  // リトライカウントをリセットして再試行を許可
  DB.update(CONFIG.SHEET.TRANSACTION_QUEUE, queueId, {
    status: 'PENDING_RETRY',
    retry_count: 0,
    updated_at: new Date()
  });

  log('INFO', 'Main', 'Queue entry reset for manual retry: ' + queueId);

  // 即時リトライ実行
  return retryFailedPayments();
}

/**
 * 決済リトライトリガーを設定（一度だけ実行）
 * GASエディタから手動でこの関数を実行してください
 */
function setupPaymentRetryTrigger() {
  // 既存のretryFailedPaymentsトリガーを削除
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'retryFailedPayments') {
      ScriptApp.deleteTrigger(trigger);
      log('INFO', 'Main', 'Deleted existing retryFailedPayments trigger');
    }
  });

  // 5分毎のトリガーを作成
  ScriptApp.newTrigger('retryFailedPayments')
    .timeBased()
    .everyMinutes(5)
    .create();

  log('INFO', 'Main', 'Created retryFailedPayments trigger (every 5 minutes)');

  return { success: true, message: 'Payment retry trigger setup complete (every 5 minutes)' };
}

/**
 * 決済リトライトリガーを削除
 */
function removePaymentRetryTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var deletedCount = 0;

  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'retryFailedPayments') {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });

  log('INFO', 'Main', 'Removed ' + deletedCount + ' retryFailedPayments triggers');

  return { success: true, message: 'Removed ' + deletedCount + ' triggers' };
}

// ============================================================================
// LINE通知・Eメール送信
// ============================================================================

/**
 * LINEメッセージ送信ハンドラー
 */
function handleSendLineMessage(requestBody) {
  log('INFO', 'Main', 'handleSendLineMessage called', {
    userId: requestBody.userId,
    messageLength: requestBody.message ? requestBody.message.length : 0
  });

  try {
    var userId = requestBody.userId;
    var message = requestBody.message;

    if (!userId || !message) {
      return {
        success: false,
        error: 'userId and message are required'
      };
    }

    // LINE Messaging API を使用して送信
    var result = NotificationService.sendPushMessage(userId, message);

    log('INFO', 'Main', 'LINE message sent', { userId: userId, result: result });

    return {
      success: true,
      status: 'success'
    };

  } catch (error) {
    log('ERROR', 'Main', 'handleSendLineMessage failed', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Eメール送信ハンドラー
 */
function handleSendEmail(requestBody) {
  log('INFO', 'Main', 'handleSendEmail called', {
    to: requestBody.to,
    subject: requestBody.subject
  });

  try {
    var to = requestBody.to;
    var subject = requestBody.subject;
    var body = requestBody.body;

    if (!to || !subject || !body) {
      return {
        success: false,
        error: 'to, subject, and body are required'
      };
    }

    // メールアドレスのバリデーション
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return {
        success: false,
        error: 'Invalid email address format'
      };
    }

    // GASのMailAppを使用してメール送信
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: body,
      name: 'K9 Harmony',
      replyTo: 'info@k9harmony.jp'
    });

    log('INFO', 'Main', 'Email sent successfully', { to: to, subject: subject });

    return {
      success: true
    };

  } catch (error) {
    log('ERROR', 'Main', 'handleSendEmail failed', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}