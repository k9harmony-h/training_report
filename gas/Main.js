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

      // === 画像取得API（LIFF評価ページ用） ===
      case 'img_profile':
        response = handleGetProfileImage(lineUserId, e.parameter.dogId);
        break;

      case 'img_latest':
        response = handleGetLessonImages(lineUserId, e.parameter.dogId);
        break;

      // === 評価データAPI（LIFF評価ページ用） ===
      case 'getEvaluationBundle':
      case 'evaluationBundle':
        response = handleGetEvaluationBundle(lineUserId, e.parameter.dogId);
        break;

      // === MyPageバンドルAPI（マイページ用） ===
      case 'getMyPageBundle':
        response = handleGetMyPageBundle(lineUserId, e.parameter.dogId);
        break;

      case 'getEvaluationData':
      case 'evaluation':
        response = handleGetEvaluationData(lineUserId, e.parameter.dogId);
        break;

      // === マイルストーンAPI（LIFF評価ページ用） ===
      case 'milestone':
      case 'getMilestones':
        response = handleGetMilestones(lineUserId, e.parameter.dogId);
        break;

      // === マイメモAPI（LIFF評価ページ用） ===
      case 'getMemo':
        response = handleGetMemo(lineUserId, e.parameter.dogId);
        break;

      // === バウチャーAPI（マイページ用） ===
      case 'getVouchers':
        response = handleGetVouchers(lineUserId);
        break;

      // === 支払い履歴API（マイページ用） ===
      case 'getPaymentHistory':
        response = handleGetPaymentHistory(lineUserId);
        break;

      // === 防災手帳API ===
      case 'getDisasterData':
        response = handleGetDisasterData(lineUserId, e.parameter.dogId);
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

  // ===== マイルストーン既読マーク =====
  case 'markMilestoneSeen':
    response = handleMarkMilestoneSeen(requestBody);
    break;

  // ===== マイメモ保存 =====
  case 'saveMemo':
    response = handleSaveMemo(lineUserId, requestBody);
    break;

  // ===== チケット購入（クレジットカード決済）=====
  case 'purchaseTicket':
    response = handlePurchaseTicket(lineUserId, requestBody);
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
      } else if (reservationDate && typeof reservationDate === 'string' && reservationDate.length > 10) {
        reservationDate = reservationDate.split(' ')[0];
      }

      // 時刻を正規化（HH:mm形式にする）
      var startTime = reservation.start_time;
      if (startTime && typeof startTime === 'object' && startTime.getTime) {
        startTime = Utilities.formatDate(startTime, 'JST', 'HH:mm');
      } else if (startTime && typeof startTime === 'string') {
        // "HH:MM:SS" → "HH:MM" に変換、"1899-..." を含む場合は時刻部分だけ取得
        if (startTime.indexOf('1899') !== -1 || startTime.indexOf('1900') !== -1) {
          var timeParts = startTime.match(/(\d{1,2}):(\d{2})/);
          startTime = timeParts ? timeParts[0] : startTime;
        } else if (startTime.split(':').length > 2) {
          startTime = startTime.split(':').slice(0, 2).join(':');
        }
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
        start_time: startTime,
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
 * MyPage全データバンドル取得
 * 顧客データ + 犬データ + 予約データ を統合して返す
 */
function handleGetMyPageBundle(lineUserId, dogId) {
  var startTime = new Date().getTime();
  log('INFO', 'Main', 'handleGetMyPageBundle called', { lineUserId: lineUserId, dogId: dogId });

  try {
    // ========================================================================
    // Phase 1: テーブルを1回だけ読み込み（最適化）
    // ========================================================================
    var tables = {
      customers: TableCache.getTable(CONFIG.SHEET.CUSTOMERS),
      dogs: TableCache.getTable(CONFIG.SHEET.DOGS),
      reservations: TableCache.getTable(CONFIG.SHEET.RESERVATIONS),
      products: TableCache.getTable(CONFIG.SHEET.PRODUCTS),
      trainers: TableCache.getTable(CONFIG.SHEET.TRAINERS)
    };
    var tableLoadTime = new Date().getTime() - startTime;
    log('DEBUG', 'Main', 'Tables loaded for MyPageBundle', { elapsed: tableLoadTime + 'ms' });

    // ========================================================================
    // Phase 2: 顧客情報取得
    // ========================================================================
    var customer = tables.customers.find(function(c) {
      return c.line_user_id === lineUserId;
    });
    if (!customer) {
      throw createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Customer not found', { lineUserId: lineUserId });
    }

    // ========================================================================
    // Phase 3: 犬情報取得
    // ========================================================================
    var dogs = tables.dogs.filter(function(d) {
      return d.customer_id === customer.customer_id;
    });

    // 複数犬の場合もデータを全て返す（犬選択用）
    // NOTE: 以前は早期リターンしていたが、reservationsも含めて全データを返すように変更
    log('DEBUG', 'Main', 'handleGetMyPageBundle - dogs found', {
      count: dogs.length,
      customerId: customer.customer_id,
      ticketRemaining: customer.ticket_remaining
    });

    // 対象の犬を決定
    var targetDog = null;
    if (dogId) {
      targetDog = dogs.find(function(d) { return d.dog_id === dogId; });
    } else if (dogs.length > 0) {
      targetDog = dogs[0];
    }

    // ========================================================================
    // Phase 4: 予約データ取得
    // ========================================================================
    var reservations = tables.reservations.filter(function(r) {
      return r.customer_id === customer.customer_id;
    });

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    // 予約データのエンリッチ＆分類
    var upcomingReservations = [];
    var pastReservations = [];

    reservations.forEach(function(reservation) {
      // 犬情報取得
      var dogName = null;
      if (reservation.primary_dog_id) {
        var dog = tables.dogs.find(function(d) { return d.dog_id === reservation.primary_dog_id; });
        if (dog) {
          dogName = dog.dog_name;
        }
      }

      // 商品情報取得
      var productName = null;
      var amount = null;
      if (reservation.product_id) {
        var product = tables.products.find(function(p) { return p.product_id === reservation.product_id; });
        if (product) {
          productName = product.product_name;
          amount = product.tax_included_price || product.product_price;
        }
      }

      // トレーナー情報取得
      var trainerName = 'スタッフ';
      if (reservation.trainer_id && reservation.trainer_id !== 'default-trainer') {
        var trainer = tables.trainers.find(function(t) { return t.trainer_id === reservation.trainer_id; });
        if (trainer) {
          trainerName = trainer.trainer_name;
        }
      }

      // 日付を正規化
      var reservationDate = reservation.reservation_date;
      var reservationDateObj = null;
      if (reservationDate && typeof reservationDate === 'object' && reservationDate.getTime) {
        reservationDateObj = new Date(reservationDate);
        reservationDate = Utilities.formatDate(reservationDate, 'JST', 'yyyy-MM-dd');
      } else if (reservationDate && typeof reservationDate === 'string') {
        if (reservationDate.length > 10) {
          reservationDate = reservationDate.split(' ')[0];
        }
        reservationDateObj = new Date(reservationDate);
      }

      // 時刻を正規化
      var startTime = reservation.start_time;
      if (startTime && typeof startTime === 'object' && startTime.getTime) {
        startTime = Utilities.formatDate(startTime, 'JST', 'HH:mm');
      } else if (startTime && typeof startTime === 'string') {
        if (startTime.indexOf('1899') !== -1 || startTime.indexOf('1900') !== -1) {
          var timeParts = startTime.match(/(\d{1,2}):(\d{2})/);
          startTime = timeParts ? timeParts[0] : startTime;
        } else if (startTime.split(':').length > 2) {
          startTime = startTime.split(':').slice(0, 2).join(':');
        }
      }

      var enrichedReservation = {
        reservation_id: reservation.reservation_id,
        reservation_code: reservation.reservation_code,
        customer_id: reservation.customer_id,
        primary_dog_id: reservation.primary_dog_id,
        trainer_id: reservation.trainer_id,
        office_id: reservation.office_id,
        product_id: reservation.product_id,
        reservation_date: reservationDate,
        start_time: startTime,
        duration: reservation.duration_minutes || 90,
        status: reservation.status,
        payment_status: reservation.payment_status,
        dog_name: dogName,
        product_name: productName,
        trainer_name: trainerName,
        amount: amount
      };

      // 未来 or 過去に分類
      if (reservationDateObj && reservationDateObj >= today &&
          (reservation.status === 'CONFIRMED' || reservation.status === 'PENDING')) {
        upcomingReservations.push(enrichedReservation);
      } else {
        pastReservations.push(enrichedReservation);
      }
    });

    // 日付でソート
    upcomingReservations.sort(function(a, b) {
      return new Date(a.reservation_date) - new Date(b.reservation_date);
    });
    pastReservations.sort(function(a, b) {
      return new Date(b.reservation_date) - new Date(a.reservation_date);
    });

    // ========================================================================
    // Phase 5: レスポンス構築
    // ========================================================================
    var elapsed = new Date().getTime() - startTime;
    log('INFO', 'Main', 'handleGetMyPageBundle completed', {
      elapsed: elapsed + 'ms',
      upcomingCount: upcomingReservations.length,
      pastCount: pastReservations.length,
      ticketRemaining: customer.ticket_remaining
    });

    // 犬データをマップ
    var dogsData = dogs.map(function(d) {
      return {
        dog_id: d.dog_id,
        id: d.dog_id, // 互換性のため両方含める
        dog_name: d.dog_name,
        name: d.dog_name,
        name_disp: d.dog_name,
        profile_image_url: d.profile_image_url || null,
        dog_breed: d.dog_breed || d.breed || null,
        birth_date: d.dog_birth_date || d.birth_date,
        gender: d.dog_gender || d.gender
      };
    });

    // レスポンス構築
    var response = {
      error: false,
      customer: {
        customer_id: customer.customer_id,
        name: customer.customer_name,
        name_disp: customer.customer_name ? customer.customer_name.split(' ')[0] : '',
        birth_date: customer.birth_date,
        ticket_remaining: customer.ticket_remaining || 0,
        phone: customer.phone || null,
        email: customer.email || null,
        address: customer.address || null
      },
      dogs: dogsData,
      reservations: {
        upcoming: upcomingReservations,
        past: pastReservations
      },
      _perf: {
        elapsed_ms: elapsed,
        table_load_ms: tableLoadTime,
        reservations_count: reservations.length,
        dogs_count: dogs.length
      }
    };

    // 複数犬がいる場合は multiple_dogs も含める（犬選択UI用）
    if (dogs.length > 1) {
      response.multiple_dogs = dogsData;
      log('DEBUG', 'Main', 'Multiple dogs found, adding multiple_dogs to response', { count: dogs.length });
    }

    log('INFO', 'Main', 'handleGetMyPageBundle response', {
      hasDogs: dogsData.length,
      hasMultipleDogs: !!response.multiple_dogs,
      upcomingCount: upcomingReservations.length,
      pastCount: pastReservations.length,
      ticketRemaining: customer.ticket_remaining
    });

    return response;

  } catch (error) {
    log('ERROR', 'Main', 'Failed to get my page bundle', { error: error.message });
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

  // デバッグログ: reservationDataの型と内容を確認
  log('DEBUG', 'Main', 'reservationData analysis', {
    exists: !!requestBody.reservationData,
    type: typeof requestBody.reservationData,
    isString: typeof requestBody.reservationData === 'string',
    isObject: typeof requestBody.reservationData === 'object',
    preview: typeof requestBody.reservationData === 'string'
      ? requestBody.reservationData.substring(0, 100)
      : JSON.stringify(requestBody.reservationData).substring(0, 100)
  });

  // 新規ユーザーフォーマット vs 既存ユーザーフォーマットの判定
  if (requestBody.reservationData && typeof requestBody.reservationData === 'string') {
    // 既存フォーマット（JSON文字列）
    reservationDataFromClient = JSON.parse(requestBody.reservationData);
    paymentDataFromClient = JSON.parse(requestBody.paymentData);
  } else if (requestBody.reservationData && typeof requestBody.reservationData === 'object') {
    // k9-liff Vue版: reservationDataとpaymentDataが直接オブジェクトとして送信される
    reservationDataFromClient = requestBody.reservationData;
    paymentDataFromClient = requestBody.paymentData || {};
  } else {
    // 新規ユーザーフォーマット（旧形式: 個別フィールド）
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
    paymentDataFromClient = {
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
// 画像取得ハンドラー（LIFF評価ページ用）
// ============================================================================

/**
 * プロフィール画像取得ハンドラー（サムネイルURL優先）
 * @param {string} lineUserId - LINEユーザーID
 * @param {string} dogId - 犬ID（オプション）
 * @returns {object} { error: boolean, image?: string, message?: string }
 */
function handleGetProfileImage(lineUserId, dogId) {
  var startTime = new Date().getTime();
  log('INFO', 'Main', 'handleGetProfileImage', {
    lineUserId: lineUserId ? lineUserId.substring(0, 8) + '...' : null,
    dogId: dogId
  });

  try {
    // 顧客確認
    var customer = CustomerRepository.findByLineUserId(lineUserId);
    if (!customer || customer.error) {
      return {
        error: true,
        message: '顧客情報が見つかりません'
      };
    }

    // 犬IDが指定されていない場合は最初の犬を使用
    var targetDogId = dogId;
    if (!targetDogId) {
      var dogs = DogRepository.findByCustomerId(customer.customer_id);
      if (dogs && dogs.length > 0) {
        targetDogId = dogs[0].dog_id;
      }
    }

    if (!targetDogId) {
      return {
        error: true,
        message: '犬情報が見つかりません'
      };
    }

    // サムネイルURLを優先して取得（高速）
    var thumbnailUrl = ImageService.getProfileThumbnailUrl(targetDogId, 400);

    if (thumbnailUrl) {
      var elapsed = new Date().getTime() - startTime;
      log('INFO', 'Main', 'Profile thumbnail URL retrieved', {
        dogId: targetDogId,
        elapsed: elapsed + 'ms'
      });

      return {
        error: false,
        image: thumbnailUrl
      };
    }

    // フォールバック: Base64（サムネイルURLが取得できない場合）
    var result = ImageService.getProfileImage(targetDogId);

    if (result.error) {
      log('WARN', 'Main', 'Profile image not found', { dogId: targetDogId, error: result.error });
      return {
        error: false,
        image: null,
        message: result.error
      };
    }

    var elapsed = new Date().getTime() - startTime;
    log('INFO', 'Main', 'Profile image retrieved (Base64 fallback)', {
      dogId: targetDogId,
      hasImage: !!result.image,
      elapsed: elapsed + 'ms'
    });

    return {
      error: false,
      image: result.image
    };

  } catch (e) {
    log('ERROR', 'Main', 'handleGetProfileImage failed', { error: e.message });
    return {
      error: true,
      message: e.message
    };
  }
}

/**
 * レッスン写真取得ハンドラー（サムネイルURL優先）
 * @param {string} lineUserId - LINEユーザーID
 * @param {string} dogId - 犬ID（オプション）
 * @returns {object} { error: boolean, images?: string[], message?: string }
 */
function handleGetLessonImages(lineUserId, dogId) {
  var startTime = new Date().getTime();
  log('INFO', 'Main', 'handleGetLessonImages', {
    lineUserId: lineUserId ? lineUserId.substring(0, 8) + '...' : null,
    dogId: dogId
  });

  try {
    // 顧客確認
    var customer = CustomerRepository.findByLineUserId(lineUserId);
    if (!customer || customer.error) {
      return {
        error: true,
        message: '顧客情報が見つかりません'
      };
    }

    // 犬IDが指定されていない場合は最初の犬を使用
    var targetDogId = dogId;
    if (!targetDogId) {
      var dogs = DogRepository.findByCustomerId(customer.customer_id);
      if (dogs && dogs.length > 0) {
        targetDogId = dogs[0].dog_id;
      }
    }

    if (!targetDogId) {
      return {
        error: true,
        message: '犬情報が見つかりません'
      };
    }

    // サムネイルURLを優先して取得（高速）
    var thumbnailResult = ImageService.getLessonThumbnailUrlsWithFolder(targetDogId, 5, 800);

    // デバッグログ: thumbnailResultの内容を確認
    log('DEBUG', 'Main', 'thumbnailResult details', {
      hasResult: !!thumbnailResult,
      imageCount: thumbnailResult ? (thumbnailResult.images ? thumbnailResult.images.length : 0) : 0,
      folderUrl: thumbnailResult ? thumbnailResult.folderUrl : 'undefined',
      resultKeys: thumbnailResult ? Object.keys(thumbnailResult).join(',') : 'null'
    });

    if (thumbnailResult && thumbnailResult.images && thumbnailResult.images.length > 0) {
      var elapsed = new Date().getTime() - startTime;
      log('INFO', 'Main', 'Lesson thumbnail URLs retrieved', {
        dogId: targetDogId,
        count: thumbnailResult.images.length,
        folderUrl: thumbnailResult.folderUrl || 'NOT SET',
        elapsed: elapsed + 'ms'
      });

      return {
        error: false,
        images: thumbnailResult.images,
        folderUrl: thumbnailResult.folderUrl
      };
    }

    // フォールバック: Base64（サムネイルURLが取得できない場合）
    var result = ImageService.getLessonImages(targetDogId);

    if (result.error) {
      log('WARN', 'Main', 'Lesson images not found', { dogId: targetDogId, error: result.error });
      return {
        error: false,
        images: [],
        folderUrl: null,
        message: result.error
      };
    }

    var elapsed = new Date().getTime() - startTime;
    log('INFO', 'Main', 'Lesson images retrieved (Base64 fallback)', {
      dogId: targetDogId,
      count: result.images ? result.images.length : 0,
      elapsed: elapsed + 'ms'
    });

    return {
      error: false,
      images: result.images || [],
      folderUrl: result.folderUrl || null
    };

  } catch (e) {
    log('ERROR', 'Main', 'handleGetLessonImages failed', { error: e.message });
    return {
      error: true,
      message: e.message
    };
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

  // 電話番号をハイフン付きの標準形式に整形
  // Google Sheetsは数字のような文字列を数値に変換して先頭の0が消えるため、
  // ハイフンを含む形式で保存することで文字列として維持
  var phoneNumber = regData.phone;
  if (phoneNumber) {
    // すでにハイフンがある場合はそのまま、ない場合は追加
    var cleanPhone = String(phoneNumber).replace(/-/g, '');
    if (cleanPhone.length === 11) {
      // 携帯電話: 090-1234-5678
      phoneNumber = cleanPhone.slice(0, 3) + '-' + cleanPhone.slice(3, 7) + '-' + cleanPhone.slice(7);
    } else if (cleanPhone.length === 10) {
      // 固定電話: 03-1234-5678 or 0123-45-6789
      phoneNumber = cleanPhone.slice(0, 2) + '-' + cleanPhone.slice(2, 6) + '-' + cleanPhone.slice(6);
    }
  }

  // 郵便番号をハイフン付きの標準形式に整形 (XXX-XXXX)
  var postalCode = regData.zip;
  if (postalCode) {
    var cleanZip = String(postalCode).replace(/-/g, '');
    // 先頭の0が消えている場合は補完（7桁に満たない場合）
    while (cleanZip.length < 7) {
      cleanZip = '0' + cleanZip;
    }
    if (cleanZip.length === 7) {
      postalCode = cleanZip.slice(0, 3) + '-' + cleanZip.slice(3);
    }
  }

  // 顧客作成
  // スプレッドシートのカラム名に合わせる
  var customer = CustomerRepository.create({
    line_user_id: lineUserId,
    customer_name: regData.name,
    customer_phone: phoneNumber,
    customer_email: regData.email || null,
    postal_code: postalCode,
    customer_address_street: regData.address,           // スプレッドシートカラム名
    customer_address_building: regData.building || null, // スプレッドシートカラム名
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

  // 重複チェック: 同じ顧客IDと犬名の組み合わせが既に存在するか確認
  var existingDogs = DogRepository.findByCustomerId(customer.customer_id);
  if (existingDogs && existingDogs.length > 0) {
    var duplicateDog = existingDogs.find(function(d) {
      return d.dog_name === regData.dogName;
    });
    if (duplicateDog) {
      log('INFO', 'Main', 'Dog already exists, returning existing dog_id: ' + duplicateDog.dog_id);
      return {
        success: true,
        customer_id: customer.customer_id,
        dog_id: duplicateDog.dog_id,
        existing: true
      };
    }
  }

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

// ============================================================================
// 評価ページ用APIハンドラー
// ============================================================================

/**
 * 評価データ統合API（Phase 1最適化）
 * 評価データ + マイルストーン + プロフィール画像を1回のAPIで返す
 * @param {string} lineUserId LINE User ID
 * @param {string} dogId 犬ID（オプション）
 * @return {Object} 統合評価データ
 */
function handleGetEvaluationBundle(lineUserId, dogId) {
  var startTime = new Date().getTime();
  log('INFO', 'Main', 'handleGetEvaluationBundle called', { lineUserId: lineUserId, dogId: dogId });

  try {
    // ========================================================================
    // Phase 1: 必須テーブルのみ先に読み込み（multiple_dogs早期返却で2テーブル節約）
    // ========================================================================
    var tables = {
      customers: TableCache.getTable(CONFIG.SHEET.CUSTOMERS),
      dogs: TableCache.getTable(CONFIG.SHEET.DOGS),
      lessons: TableCache.getTable(CONFIG.SHEET.LESSONS),
      reservations: TableCache.getTable(CONFIG.SHEET.RESERVATIONS)
    };
    var tableLoadTime = new Date().getTime() - startTime;
    log('DEBUG', 'Main', 'Essential tables loaded (4/6)', { elapsed: tableLoadTime + 'ms' });

    // 1. 顧客情報取得
    var customer = tables.customers.find(function(c) {
      return c.line_user_id === lineUserId;
    });
    if (!customer) {
      throw createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Customer not found', { lineUserId: lineUserId });
    }

    // 2. 犬情報取得
    var dogs = tables.dogs.filter(function(d) {
      return d.customer_id === customer.customer_id;
    });

    // 犬が複数いて、dogIdが指定されていない場合
    if (dogs.length > 1 && !dogId) {
      // 顧客レベルの統計を計算（全ての犬の合計）
      var allDogIdSetEarly = {};
      dogs.forEach(function(d) { allDogIdSetEarly[d.dog_id] = true; });
      var allLessonsEarly = (tables.lessons || []).filter(function(l) {
        return allDogIdSetEarly[l.dog_id] === true;
      });
      // 日付順ソート（新しい順）
      allLessonsEarly.sort(function(a, b) {
        var dateA = a.lesson_date ? new Date(a.lesson_date) : new Date(0);
        var dateB = b.lesson_date ? new Date(b.lesson_date) : new Date(0);
        return dateB - dateA;
      });

      var earlyTotalLessonCount = allLessonsEarly.length;
      var earlyTotalTrainingTime = allLessonsEarly.length * 90; // 分単位（90分/レッスン）
      var earlyLastLessonDate = null;
      if (allLessonsEarly.length > 0 && allLessonsEarly[0].lesson_date) {
        var lessonDateEarly = allLessonsEarly[0].lesson_date;
        if (typeof lessonDateEarly === 'object' && typeof lessonDateEarly.getTime === 'function') {
          earlyLastLessonDate = Utilities.formatDate(lessonDateEarly, 'JST', 'yyyy-MM-dd');
        } else {
          // 文字列の場合: ISO形式(T区切り)やスペース区切りに対応
          var dateStr = String(lessonDateEarly);
          earlyLastLessonDate = dateStr.split('T')[0].split(' ')[0].replace(/\//g, '-');
        }
      }

      // チケット残数を計算
      var earlyReservations = tables.reservations.filter(function(r) {
        return r.customer_id === customer.customer_id;
      });
      var earlyTicketCount = earlyReservations.filter(function(r) {
        return r.status === 'CONFIRMED';
      }).length;

      return {
        multiple_dogs: dogs.map(function(d) {
          return {
            id: d.dog_id,
            name: d.dog_name,
            name_disp: d.dog_name,
            birth_date: d.dog_birth_date || d.birth_date,
            gender: d.dog_gender || d.gender
          };
        }),
        customer: {
          name: customer.customer_name,
          birth_date: customer.birth_date,
          shared_folder_url: customer.shared_folder_url || null
        },
        total_lesson_count: earlyTotalLessonCount,
        total_training_time: earlyTotalTrainingTime,
        last_lesson_date: earlyLastLessonDate,
        ticket_count: earlyTicketCount
      };
    }

    // ========================================================================
    // Phase 2: マイルストーンテーブル読み込み（multiple_dogs早期返却後のみ）
    // ========================================================================
    tables.milestoneDefs = TableCache.getTable(CONFIG.SHEET.MILESTONE_DEFINITIONS);
    tables.milestoneLogs = TableCache.getTable(CONFIG.SHEET.MILESTONE_LOGS);
    tableLoadTime = new Date().getTime() - startTime;
    log('DEBUG', 'Main', 'All tables loaded (6/6)', { elapsed: tableLoadTime + 'ms' });

    // 対象の犬を決定
    var targetDog = null;
    if (dogId) {
      targetDog = dogs.find(function(d) { return d.dog_id === dogId; });
    } else if (dogs.length > 0) {
      targetDog = dogs[0];
    }

    if (!targetDog) {
      throw createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Dog not found', { dogId: dogId });
    }

    // 3. レッスン履歴取得（キャッシュ済みテーブルからフィルタ）
    var lessons = tables.lessons.filter(function(l) {
      return l.dog_id === targetDog.dog_id;
    });
    // 日付順ソート（新しい順）
    lessons.sort(function(a, b) {
      var dateA = a.lesson_date ? new Date(a.lesson_date) : new Date(0);
      var dateB = b.lesson_date ? new Date(b.lesson_date) : new Date(0);
      return dateB - dateA;
    });

    // 4. 最新レッスンデータ変換
    var latest = null;
    if (lessons.length > 0) {
      var latestLesson = lessons[0];
      latest = _convertLessonToLatest(latestLesson, targetDog);
    }

    // 5. スコア履歴変換
    var scoreHistory = lessons.slice(0, 10).map(function(lesson) {
      return _convertLessonToHistory(lesson);
    });

    // 6. チケット残数（キャッシュ済みテーブルからフィルタ）
    var reservations = tables.reservations.filter(function(r) {
      return r.customer_id === customer.customer_id;
    });
    var ticketCount = reservations.filter(function(r) {
      return r.status === 'CONFIRMED';
    }).length;

    // 7. 総トレーニング時間
    var totalTrainingTime = lessons.length * 90; // 分単位（90分/レッスン）

    // ========================================================================
    // Phase 2: マイルストーンデータ（キャッシュ済みテーブルから取得）
    // ========================================================================
    var milestoneDefs = tables.milestoneDefs.filter(function(d) {
      return d.is_active === true || d.is_active === 'TRUE' || d.is_active === 1;
    });

    var milestoneLogs = tables.milestoneLogs.filter(function(l) {
      return l.dog_id === targetDog.dog_id;
    });

    // ログをmilestone_idでマップ化
    var logMap = {};
    milestoneLogs.forEach(function(log) {
      logMap[log.milestone_id] = log;
    });

    // 定義と獲得状態を結合
    var badges = milestoneDefs.map(function(def) {
      var logEntry = logMap[def.milestone_id];
      return {
        milestone_id: def.milestone_id,
        tier: def.tier,
        sort_order: def.sort_order || 0,
        title: def.title,
        description: def.description,
        tips: def.tips || '',
        condition_type: def.condition_type,
        condition_value: def.condition_value,
        icon_type: def.icon_type || 'paw',
        badge_color: def.badge_color || 'pastel-sage',
        is_active: true,
        is_acquired: !!logEntry,
        is_new: logEntry ? (logEntry.is_seen_animation === false || logEntry.is_seen_animation === 'FALSE') : false,
        acquired_date: logEntry ? logEntry.acquired_date : null
      };
    });

    // sort_order順にソート
    badges.sort(function(a, b) {
      return a.sort_order - b.sort_order;
    });

    // ========================================================================
    // Phase 3: プロフィール画像（サムネイルURL優先・高速版）
    // ========================================================================
    var profileImage = null;
    var profileImageUrl = null;
    var imageStartTime = new Date().getTime();
    try {
      // 既に取得済みのフォルダIDを直接使用（DB再読み込みをスキップ）
      var sharedFolderId = targetDog.dog_shared_folder_id;
      if (sharedFolderId) {
        profileImageUrl = ImageService.getProfileThumbnailUrlFromFolderId(sharedFolderId, 400);
      }

      if (!profileImageUrl) {
        // サムネイルURLが取得できない場合はBase64フォールバック（遅いので非推奨）
        log('WARN', 'Main', 'Thumbnail URL failed, falling back to Base64');
        var imgResult = ImageService.getProfileImage(targetDog.dog_id);
        if (!imgResult.error) {
          profileImage = imgResult.image;
        }
      }
      var imageElapsed = new Date().getTime() - imageStartTime;
      log('DEBUG', 'Main', 'Profile image retrieved', { elapsed: imageElapsed + 'ms', hasUrl: !!profileImageUrl, hasBase64: !!profileImage });
    } catch (imgError) {
      log('WARN', 'Main', 'Profile image fetch failed', { error: imgError.message });
    }

    // ========================================================================
    // 顧客レベルの統計を計算（全ての犬の合計）- O(n)ルックアップで最適化
    // ========================================================================
    var allDogIdSet = {};
    dogs.forEach(function(d) { allDogIdSet[d.dog_id] = true; });
    var allLessons = tables.lessons.filter(function(l) {
      return allDogIdSet[l.dog_id] === true;
    });
    // 日付順ソート（新しい順）
    allLessons.sort(function(a, b) {
      var dateA = a.lesson_date ? new Date(a.lesson_date) : new Date(0);
      var dateB = b.lesson_date ? new Date(b.lesson_date) : new Date(0);
      return dateB - dateA;
    });

    var customerTotalLessonCount = allLessons.length;
    var customerTotalTrainingTime = allLessons.length * 90; // 分単位（90分/レッスン）
    var customerLastLessonDate = null;
    if (allLessons.length > 0 && allLessons[0].lesson_date) {
      var lessonDate = allLessons[0].lesson_date;
      if (typeof lessonDate === 'object' && typeof lessonDate.getTime === 'function') {
        customerLastLessonDate = Utilities.formatDate(lessonDate, 'JST', 'yyyy-MM-dd');
      } else {
        // 文字列の場合: ISO形式(T区切り)やスペース区切りに対応
        var dateStr = String(lessonDate);
        customerLastLessonDate = dateStr.split('T')[0].split(' ')[0].replace(/\//g, '-');
      }
    }

    var elapsed = new Date().getTime() - startTime;
    log('INFO', 'Main', 'handleGetEvaluationBundle completed', { elapsed: elapsed + 'ms' });

    return {
      customer: {
        name: customer.customer_name,
        birth_date: customer.birth_date,
        shared_folder_url: customer.shared_folder_url || null
      },
      dog: {
        id: targetDog.dog_id,
        name: targetDog.dog_name,
        name_disp: targetDog.dog_name,
        birth_date: targetDog.dog_birth_date || targetDog.birth_date,
        gender: targetDog.dog_gender || targetDog.gender
      },
      latest: latest,
      score_history: scoreHistory,
      ticket_count: ticketCount,
      total_training_time: customerTotalTrainingTime,
      total_lesson_count: customerTotalLessonCount,
      last_lesson_date: customerLastLessonDate,
      all_dogs: dogs.map(function(d) {
        return {
          id: d.dog_id,
          name: d.dog_name,
          name_disp: d.dog_name,
          birth_date: d.dog_birth_date || d.birth_date,
          gender: d.dog_gender || d.gender
        };
      }),
      // 統合データ
      milestones: {
        status: 'success',
        badges: badges
      },
      profile_image: profileImage,
      profile_image_url: profileImageUrl,
      // パフォーマンス情報
      _perf: {
        elapsed_ms: elapsed,
        table_load_ms: tableLoadTime
      }
    };

  } catch (error) {
    log('ERROR', 'Main', 'handleGetEvaluationBundle failed', { error: error.message });
    throw error;
  }
}

/**
 * 評価データ取得ハンドラー
 * @param {string} lineUserId LINE User ID
 * @param {string} dogId 犬ID（オプション）
 * @return {Object} 評価データ
 */
function handleGetEvaluationData(lineUserId, dogId) {
  log('INFO', 'Main', 'handleGetEvaluationData called', { lineUserId: lineUserId, dogId: dogId });

  try {
    // 1. 顧客情報取得
    var customer = CustomerRepository.findByLineUserId(lineUserId);
    if (!customer || customer.error) {
      throw createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Customer not found', { lineUserId: lineUserId });
    }

    // 2. 犬情報取得
    var dogs = DogRepository.findByCustomerId(customer.customer_id);
    if (dogs.error) {
      dogs = [];
    }

    // 犬が複数いて、dogIdが指定されていない場合
    if (dogs.length > 1 && !dogId) {
      // 顧客レベルの統計を計算（全ての犬の合計）- LessonRepositoryを使用
      var allLessonsEarly = [];
      dogs.forEach(function(d) {
        var dogLessons = LessonRepository.findByDogId(d.dog_id);
        if (!dogLessons.error && Array.isArray(dogLessons)) {
          allLessonsEarly = allLessonsEarly.concat(dogLessons);
        }
      });
      // 日付順ソート（新しい順）
      allLessonsEarly.sort(function(a, b) {
        var dateA = a.lesson_date ? new Date(a.lesson_date) : new Date(0);
        var dateB = b.lesson_date ? new Date(b.lesson_date) : new Date(0);
        return dateB - dateA;
      });

      var earlyTotalLessonCount = allLessonsEarly.length;
      var earlyTotalTrainingTime = allLessonsEarly.length * 90; // 分単位（90分/レッスン）
      var earlyLastLessonDate = null;
      if (allLessonsEarly.length > 0 && allLessonsEarly[0].lesson_date) {
        var lessonDateEarly = allLessonsEarly[0].lesson_date;
        if (typeof lessonDateEarly === 'object' && typeof lessonDateEarly.getTime === 'function') {
          earlyLastLessonDate = Utilities.formatDate(lessonDateEarly, 'JST', 'yyyy-MM-dd');
        } else {
          // 文字列の場合: ISO形式(T区切り)やスペース区切りに対応
          var dateStr = String(lessonDateEarly);
          earlyLastLessonDate = dateStr.split('T')[0].split(' ')[0].replace(/\//g, '-');
        }
      }

      // チケット残数を計算（ReservationRepositoryを使用）
      var earlyReservations = ReservationRepository.findByCustomerId(customer.customer_id);
      var earlyTicketCount = 0;
      if (!earlyReservations.error && Array.isArray(earlyReservations)) {
        earlyTicketCount = earlyReservations.filter(function(r) {
          return r.status === 'CONFIRMED';
        }).length;
      }

      return {
        multiple_dogs: dogs.map(function(d) {
          return {
            id: d.dog_id,
            name: d.dog_name,
            name_disp: d.dog_name,
            birth_date: d.dog_birth_date || d.birth_date,
            gender: d.dog_gender || d.gender
          };
        }),
        customer: {
          name: customer.customer_name,
          birth_date: customer.birth_date,
          shared_folder_url: customer.shared_folder_url || null
        },
        total_lesson_count: earlyTotalLessonCount,
        total_training_time: earlyTotalTrainingTime,
        last_lesson_date: earlyLastLessonDate,
        ticket_count: earlyTicketCount
      };
    }

    // 対象の犬を決定
    var targetDog = null;
    if (dogId) {
      targetDog = dogs.find(function(d) { return d.dog_id === dogId; });
    } else if (dogs.length > 0) {
      targetDog = dogs[0];
    }

    if (!targetDog) {
      throw createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Dog not found', { dogId: dogId });
    }

    // 3. レッスン履歴取得
    var lessons = LessonRepository.findByDogId(targetDog.dog_id);
    if (lessons.error) {
      lessons = [];
    }

    // 4. 最新レッスンデータ変換
    var latest = null;
    if (lessons.length > 0) {
      var latestLesson = lessons[0];
      latest = _convertLessonToLatest(latestLesson, targetDog);
    }

    // 5. スコア履歴変換
    var scoreHistory = lessons.slice(0, 10).map(function(lesson) {
      return _convertLessonToHistory(lesson);
    });

    // 6. チケット残数（予約から計算）
    var reservations = ReservationRepository.findByCustomerId(customer.customer_id);
    var ticketCount = 0;
    if (!reservations.error) {
      // status=CONFIRMEDの予約数を未使用チケットと見なす（仮実装）
      ticketCount = reservations.filter(function(r) {
        return r.status === 'CONFIRMED';
      }).length;
    }

    // 7. 総トレーニング時間（レッスン数 × 90分 / 60）
    var totalTrainingTime = lessons.length * 90; // 分単位（90分/レッスン）

    return {
      customer: {
        name: customer.customer_name,
        birth_date: customer.birth_date,
        shared_folder_url: customer.shared_folder_url || null
      },
      dog: {
        id: targetDog.dog_id,
        name: targetDog.dog_name,
        name_disp: targetDog.dog_name,
        birth_date: targetDog.dog_birth_date || targetDog.birth_date,
        gender: targetDog.dog_gender || targetDog.gender
      },
      latest: latest,
      score_history: scoreHistory,
      ticket_count: ticketCount,
      total_training_time: totalTrainingTime,
      all_dogs: dogs.map(function(d) {
        return {
          id: d.dog_id,
          name: d.dog_name,
          name_disp: d.dog_name,
          birth_date: d.dog_birth_date || d.birth_date,
          gender: d.dog_gender || d.gender
        };
      })
    };

  } catch (error) {
    log('ERROR', 'Main', 'handleGetEvaluationData failed', { error: error.message });
    throw error;
  }
}

/**
 * レッスンデータをLatestLesson形式に変換
 * @private
 */
function _convertLessonToLatest(lesson, dog) {
  // スコア配列生成
  var scores = [];
  var details = [];
  for (var i = 1; i <= 10; i++) {
    scores.push(lesson['score_' + i] || 0);
    details.push(lesson['score_detail_' + i] || '');
  }

  // 日付フォーマット
  var lessonDate = lesson.lesson_date;
  if (lessonDate && typeof lessonDate === 'object' && lessonDate.getTime) {
    lessonDate = Utilities.formatDate(lessonDate, 'JST', 'yyyy/MM/dd');
  } else if (lessonDate && lessonDate.indexOf('-') !== -1) {
    lessonDate = lessonDate.replace(/-/g, '/');
  }

  // 次回予約推奨日の計算（レッスン日から7-10日後）
  var recommendDate = null;
  if (lesson.lesson_date) {
    var baseDate = new Date(lesson.lesson_date);
    var today = new Date();
    var startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() + 7);
    var endDate = new Date(baseDate);
    endDate.setDate(endDate.getDate() + 10);

    // 期限内であれば推奨日を設定
    if (endDate >= today) {
      recommendDate = Utilities.formatDate(startDate, 'JST', 'MM/dd') + ' 〜 ' + Utilities.formatDate(endDate, 'JST', 'MM/dd');
    }
  }

  // 写真有無チェック（photo_1カラムの存在で判定）
  var hasPhotos = !!(lesson.photo_1 || lesson.photo_1_id);

  return {
    date: lessonDate,
    goal: lesson.goal || '',
    done: lesson.done || '',
    unable: lesson.unable || '',
    homework: lesson.next_homework || '',
    next_goal: lesson.next_goal || '',
    comment: lesson.comment_trainer || '',
    recommend_date: recommendDate,
    has_photos: hasPhotos,
    scores: scores,
    details: details
  };
}

/**
 * レッスンデータをScoreHistory形式に変換
 * @private
 */
function _convertLessonToHistory(lesson) {
  // スコア配列生成
  var scores = [];
  for (var i = 1; i <= 10; i++) {
    scores.push(lesson['score_' + i] || 0);
  }

  // 日付フォーマット
  var lessonDate = lesson.lesson_date;
  if (lessonDate && typeof lessonDate === 'object' && lessonDate.getTime) {
    lessonDate = Utilities.formatDate(lessonDate, 'JST', 'yyyy/MM/dd');
  } else if (lessonDate && lessonDate.indexOf('-') !== -1) {
    lessonDate = lessonDate.replace(/-/g, '/');
  }

  return {
    id: lesson.lesson_id,
    date: lessonDate,
    scores: scores,
    comment: lesson.comment_trainer || '',
    homework: lesson.next_homework || '',
    done: lesson.done || ''
  };
}

/**
 * マイルストーン取得ハンドラー
 * @param {string} lineUserId LINE User ID
 * @param {string} dogId 犬ID
 * @return {Object} マイルストーンデータ
 */
function handleGetMilestones(lineUserId, dogId) {
  log('INFO', 'Main', 'handleGetMilestones called', { lineUserId: lineUserId, dogId: dogId });

  try {
    // 顧客確認
    var customer = CustomerRepository.findByLineUserId(lineUserId);
    if (!customer || customer.error) {
      throw createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Customer not found', { lineUserId: lineUserId });
    }

    // 犬確認（dogIdが必須）
    if (!dogId) {
      // dogIdがない場合は最初の犬を使用
      var dogs = DogRepository.findByCustomerId(customer.customer_id);
      if (dogs.error || dogs.length === 0) {
        throw createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Dog not found');
      }
      dogId = dogs[0].dog_id;
    }

    // マイルストーンバッジ取得
    var badges = MilestoneRepository.getBadgesForDog(dogId);

    return {
      status: 'success',
      badges: badges
    };

  } catch (error) {
    log('ERROR', 'Main', 'handleGetMilestones failed', { error: error.message });
    return {
      status: 'error',
      error: error.message
    };
  }
}

/**
 * マイルストーン既読マークハンドラー
 * @param {Object} requestBody { dogId, milestoneId }
 * @return {Object} 結果
 */
function handleMarkMilestoneSeen(requestBody) {
  log('INFO', 'Main', 'handleMarkMilestoneSeen called', {
    dogId: requestBody.dogId,
    milestoneId: requestBody.milestoneId
  });

  try {
    var dogId = requestBody.dogId;
    var milestoneId = requestBody.milestoneId;

    if (!dogId || !milestoneId) {
      return {
        success: false,
        error: 'dogId and milestoneId are required'
      };
    }

    var result = MilestoneRepository.markAsSeen(dogId, milestoneId);

    return result;

  } catch (error) {
    log('ERROR', 'Main', 'handleMarkMilestoneSeen failed', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// マイメモAPI（LIFF評価ページ用）
// ============================================================================

/**
 * マイメモ取得ハンドラー
 * @param {string} lineUserId LINE User ID
 * @param {string} dogId 犬ID
 * @return {Object} { memo: string }
 */
function handleGetMemo(lineUserId, dogId) {
  log('INFO', 'Main', 'handleGetMemo called', { lineUserId: lineUserId, dogId: dogId });

  try {
    // 顧客検証（本人の犬かどうか）
    var customer = CustomerRepository.findByLineUserId(lineUserId);
    if (!customer || customer.error) {
      return { memo: '', error: 'Customer not found' };
    }

    var dogs = DogRepository.findByCustomerId(customer.customer_id);
    var targetDog = dogs.find(function(d) { return d.dog_id === dogId; });

    if (!targetDog) {
      return { memo: '', error: 'Dog not found or not owned by this customer' };
    }

    var memo = DogRepository.getMemo(dogId);

    return { memo: memo };

  } catch (error) {
    log('ERROR', 'Main', 'handleGetMemo failed', { error: error.message });
    return { memo: '', error: error.message };
  }
}

/**
 * バウチャー一覧取得ハンドラー（マイページ用）
 * @param {string} lineUserId LINE User ID
 * @return {Object} { vouchers: Array, error?: string }
 */
function handleGetVouchers(lineUserId) {
  log('INFO', 'Main', 'handleGetVouchers called', { lineUserId: lineUserId });

  try {
    // 顧客検証
    var customer = CustomerRepository.findByLineUserId(lineUserId);
    if (!customer || customer.error) {
      return { vouchers: [], error: 'Customer not found' };
    }

    // CouponServiceから顧客向けバウチャーを取得
    var vouchers = CouponService.getCustomerVouchers(customer.customer_id);

    log('INFO', 'Main', 'Vouchers retrieved', { count: vouchers.length });

    return { vouchers: vouchers };

  } catch (error) {
    log('ERROR', 'Main', 'handleGetVouchers failed', { error: error.message });
    return { vouchers: [], error: error.message };
  }
}

/**
 * 支払い履歴取得ハンドラー
 * @param {string} lineUserId LINE User ID
 * @return {Object} { payments: Array }
 */
function handleGetPaymentHistory(lineUserId) {
  log('INFO', 'Main', 'handleGetPaymentHistory called', { lineUserId: lineUserId });

  try {
    // 顧客検証
    var customer = CustomerRepository.findByLineUserId(lineUserId);
    if (!customer || customer.error) {
      return { payments: [], error: 'Customer not found' };
    }

    // 決済履歴を取得
    var allPayments = DB.fetchTable(CONFIG.SHEET.PAYMENTS);
    var customerPayments = allPayments.filter(function(p) {
      return p.customer_id === customer.customer_id;
    });

    // 商品マスタを取得（商品名表示用）
    var products = DB.fetchTable(CONFIG.SHEET.PRODUCTS);
    var productMap = {};
    products.forEach(function(p) {
      productMap[p.product_id] = p;
    });

    // 予約情報を取得（予約コード表示用）
    var reservations = DB.fetchTable(CONFIG.SHEET.RESERVATIONS);
    var reservationMap = {};
    reservations.forEach(function(r) {
      reservationMap[r.reservation_id] = r;
    });

    // レスポンス形式に変換
    var payments = customerPayments.map(function(payment) {
      var product = productMap[payment.product_id] || {};
      var reservation = payment.reservation_id ? reservationMap[payment.reservation_id] : null;

      return {
        payment_id: payment.payment_id,
        payment_code: payment.payment_code || '',
        payment_date: payment.created_at ? Utilities.formatDate(new Date(payment.created_at), 'Asia/Tokyo', 'yyyy-MM-dd') : '',
        amount: payment.total_amount || 0,
        payment_method: payment.payment_method || 'CREDIT_CARD',
        status: payment.payment_status || 'CAPTURED',
        reservation_code: reservation ? reservation.reservation_code : null,
        product_name: product.product_name || '不明',
        square_receipt_url: payment.square_receipt_url || null
      };
    });

    // 日付の新しい順にソート
    payments.sort(function(a, b) {
      return new Date(b.payment_date) - new Date(a.payment_date);
    });

    log('INFO', 'Main', 'Payment history retrieved', { count: payments.length });

    return { payments: payments };

  } catch (error) {
    log('ERROR', 'Main', 'handleGetPaymentHistory failed', { error: error.message });
    return { payments: [], error: error.message };
  }
}

/**
 * マイメモ保存ハンドラー
 * @param {string} lineUserId LINE User ID
 * @param {Object} requestBody { dogId, memo }
 * @return {Object} { success: boolean, error?: string }
 */
function handleSaveMemo(lineUserId, requestBody) {
  log('INFO', 'Main', 'handleSaveMemo called', {
    lineUserId: lineUserId,
    dogId: requestBody.dogId,
    memoLength: (requestBody.memo || '').length
  });

  try {
    var dogId = requestBody.dogId;
    var memo = requestBody.memo || '';

    if (!dogId) {
      return { success: false, error: 'dogId is required' };
    }

    // 顧客検証（本人の犬かどうか）
    var customer = CustomerRepository.findByLineUserId(lineUserId);
    if (!customer || customer.error) {
      return { success: false, error: 'Customer not found' };
    }

    var dogs = DogRepository.findByCustomerId(customer.customer_id);
    var targetDog = dogs.find(function(d) { return d.dog_id === dogId; });

    if (!targetDog) {
      return { success: false, error: 'Dog not found or not owned by this customer' };
    }

    var result = DogRepository.saveMemo(dogId, memo);

    return result;

  } catch (error) {
    log('ERROR', 'Main', 'handleSaveMemo failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

// ============================================================================
// チケット購入処理
// ============================================================================

/**
 * チケット購入（クレジットカード決済）
 *
 * @param {string} lineUserId - LINE User ID
 * @param {Object} requestBody - リクエストデータ
 * @param {string} requestBody.productId - 商品ID (prod002 or prod003)
 * @param {number} requestBody.quantity - 購入数量
 * @param {string} requestBody.sourceId - Square カードトークン
 * @param {string} requestBody.cardBrand - カードブランド
 * @param {string} requestBody.cardLast4 - カード下4桁
 * @param {number} requestBody.totalAmount - 合計金額（税込）
 * @param {string} requestBody.idempotencyKey - 冪等キー
 * @return {Object} 処理結果
 */
function handlePurchaseTicket(lineUserId, requestBody) {
  log('INFO', 'Main', '=== handlePurchaseTicket START ===');
  log('DEBUG', 'Main', 'Input:', {
    lineUserId: lineUserId,
    productId: requestBody.productId,
    quantity: requestBody.quantity,
    totalAmount: requestBody.totalAmount,
    idempotencyKey: requestBody.idempotencyKey
  });

  try {
    // ===== 1. 入力バリデーション =====
    if (!requestBody.productId || !requestBody.sourceId || !requestBody.totalAmount || !requestBody.idempotencyKey) {
      throw createK9Error(
        ErrorCode.VALIDATION_ERROR,
        'Required fields missing: productId, sourceId, totalAmount, idempotencyKey'
      );
    }

    // ===== 2. 顧客検証 =====
    var customer = CustomerRepository.findByLineUserId(lineUserId);
    if (!customer || customer.error) {
      throw createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Customer not found');
    }
    log('INFO', 'Main', 'Customer verified: ' + customer.customer_id);

    // ===== 3. 商品情報取得・検証 =====
    var products = DB.fetchTable(CONFIG.SHEET.PRODUCTS);
    var product = products.find(function(p) { return p.product_id === requestBody.productId; });

    if (!product) {
      throw createK9Error(ErrorCode.RECORD_NOT_FOUND, 'Product not found: ' + requestBody.productId);
    }

    // 商品タイプ確認（チケット商品のみ）
    if (product.product_type !== 'TICKET') {
      throw createK9Error(
        ErrorCode.VALIDATION_ERROR,
        'Invalid product type. Only TICKET products can be purchased here.'
      );
    }
    log('INFO', 'Main', 'Product verified: ' + product.product_name);

    // ===== 4. 金額検証 =====
    var productPrice = Number(product.product_price) || Number(product.price) || 0;
    var expectedAmount = productPrice * requestBody.quantity;
    log('DEBUG', 'Main', 'Amount validation', {
      productPrice: productPrice,
      quantity: requestBody.quantity,
      expectedAmount: expectedAmount,
      gotAmount: requestBody.totalAmount
    });
    if (expectedAmount !== requestBody.totalAmount) {
      throw createK9Error(
        ErrorCode.VALIDATION_ERROR,
        'Amount mismatch. Expected: ' + expectedAmount + ', Got: ' + requestBody.totalAmount
      );
    }

    // ===== 5. 冪等性チェック（重複決済防止）=====
    var existingPayments = DB.findBy(CONFIG.SHEET.PAYMENTS, 'idempotency_key', requestBody.idempotencyKey);
    if (existingPayments && existingPayments.length > 0) {
      log('WARN', 'Main', 'Duplicate idempotency key detected: ' + requestBody.idempotencyKey);
      // 既存の決済情報を返す
      var existingPayment = existingPayments[0];
      return {
        success: true,
        duplicate: true,
        payment_id: existingPayment.payment_id,
        message: 'Payment already processed'
      };
    }

    // ===== 6. トランザクション実行 =====
    var transactionResult = Transaction.execute(function(transactionLog) {

      // 6-1. Square決済実行
      log('INFO', 'Main', 'Processing Square payment...');
      var paymentData = {
        total_amount: requestBody.totalAmount,
        payment_id: Utilities.getUuid(),
        customer_id: customer.customer_id
      };

      var squareResult = SquareService.processCardPayment(paymentData, requestBody.sourceId);

      if (squareResult.error || !squareResult.success) {
        throw createK9Error(
          ErrorCode.SQUARE_API_ERROR,
          'Square payment failed: ' + (squareResult.message || 'Unknown error'),
          { square_error: squareResult }
        );
      }

      log('INFO', 'Main', 'Square payment successful: ' + squareResult.square_payment_id);
      Transaction.recordOperation(transactionLog, 'Square決済成功', { square_payment_id: squareResult.square_payment_id });

      // 6-2. 決済履歴INSERT
      var paymentId = Utilities.getUuid();
      var paymentCode = 'PAY-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd') + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');

      // 税額計算
      var taxRate = CONFIG.BUSINESS.TAX_RATE || 0.10;
      var taxAmount = Math.floor(requestBody.totalAmount * taxRate / (1 + taxRate));
      var netAmount = requestBody.totalAmount - taxAmount;

      // Square手数料計算（3.25%）
      var squareFeeRate = 0.0325;
      var squareFeeAmount = Math.floor(requestBody.totalAmount * squareFeeRate);
      var netAfterFee = requestBody.totalAmount - squareFeeAmount;

      var paymentRecord = {
        payment_id: paymentId,
        payment_code: paymentCode,
        customer_id: customer.customer_id,
        reservation_id: null,  // チケット購入は予約なし
        product_id: requestBody.productId,
        amount: netAmount,
        tax_amount: taxAmount,
        total_amount: requestBody.totalAmount,
        payment_method: 'CREDIT_CARD',
        payment_status: 'CAPTURED',
        square_payment_id: squareResult.square_payment_id,
        square_order_id: squareResult.square_order_id || null,
        square_receipt_url: squareResult.square_receipt_url || null,
        card_last4: requestBody.cardLast4 || squareResult.card_last4 || null,
        card_brand: requestBody.cardBrand || squareResult.card_brand || null,
        square_fee_rate: squareFeeRate,
        square_fee_amount: squareFeeAmount,
        net_amount: netAfterFee,
        idempotency_key: requestBody.idempotencyKey,
        created_at: new Date(),
        updated_at: new Date()
      };

      DB.insert(CONFIG.SHEET.PAYMENTS, paymentRecord);
      log('INFO', 'Main', 'Payment record created: ' + paymentId);
      Transaction.recordOperation(transactionLog, '決済履歴INSERT', { payment_id: paymentId });

      // ロールバック登録（Square返金）
      Transaction.registerRollback(transactionLog, 'Square決済返金', function() {
        log('WARN', 'Main', 'Executing Square refund for: ' + squareResult.square_payment_id);
        SquareService.refundPayment(squareResult.square_payment_id, requestBody.totalAmount, 'Transaction rollback');
      });

      // 6-3. 売上台帳INSERT
      var saleId = Utilities.getUuid();
      var saleRecord = {
        sale_id: saleId,
        sale_code: '',
        sale_date: new Date(),
        customer_id: customer.customer_id,
        product_id: requestBody.productId,
        product_name: product.product_name,
        quantity: requestBody.quantity,
        unit_price: product.price,
        sales_amount: requestBody.totalAmount,
        tax_amount: taxAmount,
        payment_method: 'CREDIT_CARD',
        payment_id: paymentId,
        remarks: 'チケット購入 - Square: ' + squareResult.square_payment_id,
        created_at: new Date(),
        updated_at: new Date()
      };

      DB.insert(CONFIG.SHEET.SALES, saleRecord);
      log('INFO', 'Main', 'Sale record created: ' + saleId);
      Transaction.recordOperation(transactionLog, '売上台帳INSERT', { sale_id: saleId });

      // 6-4. チケット加算
      var ticketsToAdd = (product.max_lessons || product.lesson_count || 0) * requestBody.quantity;
      log('DEBUG', 'Main', 'Adding tickets', { customer_id: customer.customer_id, tickets_to_add: ticketsToAdd });
      var ticketResult = CustomerRepository.addTickets(customer.customer_id, ticketsToAdd);
      log('DEBUG', 'Main', 'Ticket add result', {
        success: ticketResult.success,
        old_balance: ticketResult.old_balance,
        new_balance: ticketResult.new_balance,
        error: ticketResult.error ? ticketResult.message : null
      });

      if (ticketResult.error) {
        // チケット加算失敗 - 管理者通知が必要
        log('ERROR', 'Main', 'Failed to add tickets', { customer_id: customer.customer_id, tickets: ticketsToAdd });

        // 管理者LINE通知
        try {
          var adminMessage = '⚠️ チケット加算エラー\n顧客ID: ' + customer.customer_id + '\n購入回数: ' + ticketsToAdd + '回\n決済ID: ' + paymentId + '\n要手動対応';
          NotificationService.sendAdminLineNotification(adminMessage);
        } catch (notifyError) {
          log('ERROR', 'Main', 'Failed to send admin notification: ' + notifyError.message);
        }

        // エラーは投げない（決済は成功しているため）
        // ただし結果にフラグを立てる
      }

      log('INFO', 'Main', 'Tickets added: ' + ticketsToAdd + ' to customer: ' + customer.customer_id);
      Transaction.recordOperation(transactionLog, 'チケット加算', { tickets_added: ticketsToAdd, new_balance: ticketResult.new_balance });

      // 6-5. 監査ログINSERT
      if (typeof AuditService !== 'undefined') {
        AuditService.logSafe(
          'ticket_purchase',
          paymentId,
          'TICKET_PURCHASE',
          { ticket_remaining: ticketResult.old_balance },
          { ticket_remaining: ticketResult.new_balance },
          'CUSTOMER',
          lineUserId
        );
      }
      Transaction.recordOperation(transactionLog, '監査ログINSERT', { payment_id: paymentId });

      // 新しいチケット残高を確実に数値で返す
      var newBalance = parseInt(ticketResult.new_balance) || 0;
      log('INFO', 'Main', 'Ticket purchase complete', {
        payment_id: paymentId,
        tickets_added: ticketsToAdd,
        new_ticket_balance: newBalance
      });

      return {
        payment_id: paymentId,
        payment_code: paymentCode,
        square_payment_id: squareResult.square_payment_id,
        square_receipt_url: squareResult.square_receipt_url,
        tickets_added: ticketsToAdd,
        new_ticket_balance: newBalance
      };
    }, {
      operation: 'purchaseTicket',
      customer_id: customer.customer_id,
      product_id: requestBody.productId,
      amount: requestBody.totalAmount
    });

    // ===== 7. 結果処理 =====
    if (!transactionResult.success) {
      log('ERROR', 'Main', 'Transaction failed', transactionResult.error);
      return {
        success: false,
        error: true,
        code: transactionResult.error ? transactionResult.error.code : 'TRANSACTION_ERROR',
        message: transactionResult.error ? transactionResult.error.message : 'Transaction failed'
      };
    }

    // ===== 8. LINE通知送信（非同期・エラー無視）=====
    try {
      if (typeof NotificationService !== 'undefined' && customer.line_user_id) {
        NotificationService.sendTicketPurchaseConfirmation(
          customer.line_user_id,
          {
            product_name: product.product_name,
            quantity: requestBody.quantity,
            total_amount: requestBody.totalAmount,
            tickets_added: transactionResult.result.tickets_added,
            new_balance: transactionResult.result.new_ticket_balance,
            receipt_url: transactionResult.result.square_receipt_url
          }
        );
      }
    } catch (notifyError) {
      log('WARN', 'Main', 'Failed to send purchase confirmation: ' + notifyError.message);
    }

    log('INFO', 'Main', '=== handlePurchaseTicket SUCCESS ===');

    return {
      success: true,
      payment_id: transactionResult.result.payment_id,
      payment_code: transactionResult.result.payment_code,
      square_payment_id: transactionResult.result.square_payment_id,
      square_receipt_url: transactionResult.result.square_receipt_url,
      tickets_added: transactionResult.result.tickets_added,
      new_ticket_balance: transactionResult.result.new_ticket_balance
    };

  } catch (error) {
    log('ERROR', 'Main', 'handlePurchaseTicket failed', { error: error.message || error });

    return {
      success: false,
      error: true,
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Ticket purchase failed'
    };
  }
}

// ============================================================================
// テスト関数
// ============================================================================

/**
 * 統合評価APIのテスト
 * 実行方法: GASエディタで testGetEvaluationBundle() を実行
 */
function testGetEvaluationBundle() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   getEvaluationBundle Test                  ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // テスト用のLINE User IDを取得（最初の顧客）
  var customers = DB.fetchTable(CONFIG.SHEET.CUSTOMERS);
  if (customers.length === 0) {
    console.log('❌ テスト用顧客データがありません');
    return;
  }

  var testCustomer = customers.find(function(c) { return c.line_user_id; });
  if (!testCustomer) {
    console.log('❌ LINE User IDを持つ顧客がいません');
    return;
  }

  var lineUserId = testCustomer.line_user_id;
  console.log('テスト対象顧客:', testCustomer.customer_name);
  console.log('LINE User ID:', lineUserId.substring(0, 10) + '...\n');

  // 統合API呼び出し
  var startTime = new Date().getTime();
  try {
    var result = handleGetEvaluationBundle(lineUserId, null);
    var elapsed = new Date().getTime() - startTime;

    console.log('✅ 統合API完了');
    console.log('処理時間:', elapsed, 'ms');
    console.log('サーバー計測:', result._perf ? result._perf.elapsed_ms + 'ms' : 'N/A');

    // 結果サマリー
    console.log('\n--- 結果サマリー ---');
    console.log('顧客名:', result.customer ? result.customer.name : 'なし');
    console.log('犬名:', result.dog ? result.dog.name : 'なし');
    console.log('最新レッスン日:', result.latest ? result.latest.date : 'なし');
    console.log('履歴件数:', result.score_history ? result.score_history.length : 0);
    console.log('チケット残:', result.ticket_count);
    console.log('マイルストーン件数:', result.milestones && result.milestones.badges ? result.milestones.badges.length : 0);
    console.log('プロフィール画像URL:', result.profile_image_url ? '取得成功' : 'なし');
    console.log('プロフィール画像Base64:', result.profile_image ? '取得成功' : 'なし');

  } catch (error) {
    var elapsed = new Date().getTime() - startTime;
    console.log('❌ エラー:', error.message);
    console.log('処理時間:', elapsed, 'ms');
  }

  // 比較: 従来API
  console.log('\n--- 従来API比較 ---');
  var startTime2 = new Date().getTime();
  try {
    var oldResult = handleGetEvaluationData(lineUserId, null);
    var oldElapsed = new Date().getTime() - startTime2;
    console.log('従来API処理時間:', oldElapsed, 'ms');
  } catch (error) {
    console.log('従来APIエラー:', error.message);
  }

  console.log('\n✅ テスト完了');
}