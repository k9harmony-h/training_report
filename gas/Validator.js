/**
 * ============================================================================
 * K9 Harmony - Validator
 * ============================================================================
 * ファイル名: Validator.gs
 * 役割: データバリデーション
 * 最終更新: 2026-01-02
 * バージョン: v1.0.1 (ES5互換)
 */

// ============================================================================
// バリデータ
// ============================================================================

var Validator = {
  
  /**
   * 必須チェック
   */
  required: function(value, fieldName) {
    if (value === null || value === undefined || value === '') {
      throw ErrorHandler.requiredFieldError(fieldName);
    }
    return true;
  },
  
  /**
   * メールアドレス形式チェック
   */
  email: function(value, fieldName) {
    if (!value) return true; // 空は許容（requiredと組み合わせ）
    
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw ErrorHandler.validationError(fieldName, 'Invalid email format');
    }
    return true;
  },
  
  /**
   * 電話番号形式チェック
   */
  phone: function(value, fieldName) {
    if (!value) return true;
    
    // ハイフンあり/なし両対応
    var phoneRegex = /^0\d{1,4}-?\d{1,4}-?\d{4}$/;
    if (!phoneRegex.test(value)) {
      throw ErrorHandler.validationError(fieldName, 'Invalid phone format');
    }
    return true;
  },
  
  /**
   * 郵便番号形式チェック
   */
  zipCode: function(value, fieldName) {
    if (!value) return true;
    
    var zipRegex = /^\d{3}-?\d{4}$/;
    if (!zipRegex.test(value)) {
      throw ErrorHandler.validationError(fieldName, 'Invalid zip code format (例: 174-0063)');
    }
    return true;
  },
  
  /**
   * 日付形式チェック
   */
  date: function(value, fieldName) {
    if (!value) return true;
    
    var date = new Date(value);
    if (isNaN(date.getTime())) {
      throw ErrorHandler.validationError(fieldName, 'Invalid date format');
    }
    return true;
  },
  
  /**
   * 数値チェック
   */
  number: function(value, fieldName, options) {
    options = options || {};
    if (!value && value !== 0) return true;
    
    var num = Number(value);
    if (isNaN(num)) {
      throw ErrorHandler.validationError(fieldName, 'Must be a number');
    }
    
    // 最小値チェック
    if (options.min !== undefined && num < options.min) {
      throw ErrorHandler.validationError(fieldName, 'Must be >= ' + options.min);
    }
    
    // 最大値チェック
    if (options.max !== undefined && num > options.max) {
      throw ErrorHandler.validationError(fieldName, 'Must be <= ' + options.max);
    }
    
    return true;
  },
  
  /**
   * 文字列長チェック
   */
  length: function(value, fieldName, options) {
    options = options || {};
    if (!value) return true;
    
    var len = value.length;
    
    if (options.min !== undefined && len < options.min) {
      throw ErrorHandler.validationError(fieldName, 'Must be at least ' + options.min + ' characters');
    }
    
    if (options.max !== undefined && len > options.max) {
      throw ErrorHandler.validationError(fieldName, 'Must be at most ' + options.max + ' characters');
    }
    
    return true;
  },
  
  /**
   * 列挙値チェック
   */
  enum: function(value, fieldName, allowedValues) {
    if (!value) return true;
    
    if (allowedValues.indexOf(value) === -1) {
      throw ErrorHandler.validationError(
        fieldName,
        'Must be one of: ' + allowedValues.join(', ')
      );
    }
    return true;
  },
  
  /**
   * カスタムバリデーション
   */
  custom: function(value, fieldName, validatorFn, errorMessage) {
    if (!validatorFn(value)) {
      throw ErrorHandler.validationError(fieldName, errorMessage);
    }
    return true;
  }
};

// ============================================================================
// エンティティ別バリデーションルール
// ============================================================================

var ValidationRules = {
  
  /**
   * 顧客情報バリデーション
   */
  customer: function(data) {
    var errors = [];
    
    try {
      // 必須フィールド
      Validator.required(data.customer_name, 'customer_name');
      Validator.required(data.customer_phone, 'customer_phone');
      
      // 形式チェック
      Validator.phone(data.customer_phone, 'customer_phone');
      Validator.email(data.customer_email, 'customer_email');
      Validator.zipCode(data.customer_zip_code, 'customer_zip_code');
      Validator.date(data.customer_birth_date, 'customer_birth_date');
      
      // 性別チェック
      if (data.customer_gender) {
        Validator.enum(data.customer_gender, 'customer_gender', ['Male', 'Female', 'Other']);
      }
      
      // ステータスチェック
      if (data.customer_status) {
        Validator.enum(data.customer_status, 'customer_status', ['ACTIVE', 'INACTIVE', 'SUSPENDED']);
      }
      
      // ライフサイクルステージチェック
      if (data.lifecycle_stage) {
        Validator.enum(data.lifecycle_stage, 'lifecycle_stage', ['LEAD', 'TRIAL', 'REGULAR', 'LOYAL', 'VIP']);
      }
      
    } catch (error) {
      errors.push(error);
    }
    
    return errors;
  },
  
  /**
   * 犬情報バリデーション
   */
  dog: function(data) {
    var errors = [];
    
    try {
      Validator.required(data.customer_id, 'customer_id');
      Validator.required(data.dog_name, 'dog_name');
      Validator.required(data.breed, 'breed');
      Validator.date(data.dog_birth_date, 'dog_birth_date');
      
      // 性別チェック
      if (data.dog_gender) {
        Validator.enum(data.dog_gender, 'dog_gender', ['♂', '♀','不明']);
      }
      
      // 去勢・避妊チェック
      if (data.neutered) {
        Validator.enum(data.neutered, 'neutered', ['済', '未', '不明']);
      }
      
    } catch (error) {
      errors.push(error);
    }
    
    return errors;
  },
  
  /**
   * 予約バリデーション
   */
  reservation: function(data) {
    var errors = [];
    
    try {
      Validator.required(data.customer_id, 'customer_id');
      Validator.required(data.primary_dog_id, 'primary_dog_id');
      Validator.required(data.trainer_id, 'trainer_id');
      Validator.required(data.office_id, 'office_id');
      Validator.required(data.reservation_date, 'reservation_date');
      
      Validator.date(data.reservation_date, 'reservation_date');
      
      // ステータスチェック
      if (data.status) {
        Validator.enum(data.status, 'status', [
          'PENDING',
          'CONFIRMED',
          'COMPLETED',
          'CANCELLED',
          'NO_SHOW'
        ]);
      }
      
      // 日時の未来チェック（新規予約の場合）
      if (data.reservation_date && !data.reservation_id) {
        var reservationDate = new Date(data.reservation_date);
        var now = new Date();

        // 日付のみで比較（時刻を無視）
        // start_timeがある場合は、予約時刻も考慮
        var reservationDateOnly = new Date(reservationDate.getFullYear(), reservationDate.getMonth(), reservationDate.getDate());
        var todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (reservationDateOnly < todayOnly) {
          throw ErrorHandler.validationError(
            'reservation_date',
            'Reservation date must be in the future'
          );
        }

        // 当日予約の場合、予約開始時刻が現在時刻より後かチェック
        if (reservationDateOnly.getTime() === todayOnly.getTime() && data.start_time) {
          var timeParts = data.start_time.split(':');
          var reservationDateTime = new Date(reservationDate.getFullYear(), reservationDate.getMonth(), reservationDate.getDate(),
            parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), 0);

          if (reservationDateTime < now) {
            throw ErrorHandler.validationError(
              'start_time',
              'Reservation time must be in the future'
            );
          }
        }
      }
      
    } catch (error) {
      errors.push(error);
    }
    
    return errors;
  },
  
  /**
   * 決済バリデーション
   */
  payment: function(data) {
    var errors = [];
    
    try {
      Validator.required(data.reservation_id, 'reservation_id');
      Validator.required(data.amount, 'amount');
      
      Validator.number(data.amount, 'amount', { min: 0 });
      Validator.number(data.tax_amount, 'tax_amount', { min: 0 });
      
      // 決済方法チェック
      if (data.payment_method) {
        Validator.enum(data.payment_method, 'payment_method', [
          'CREDIT_CARD',
          'CASH',
          'BANK_TRANSFER',
          'COUPON'
        ]);
      }
      
      // ステータスチェック
      if (data.payment_status) {
        Validator.enum(data.payment_status, 'payment_status', [
          'PENDING',
          'AUTHORIZED',
          'CAPTURED',
          'FAILED',
          'CANCELLED',
          'REFUNDED'
        ]);
      }
      
    } catch (error) {
      errors.push(error);
    }
    
    return errors;
  },
  
  /**
   * レッスン評価バリデーション
   */
  lesson: function(data) {
    var errors = [];
    
    try {
      Validator.required(data.customer_id, 'customer_id');
      Validator.required(data.dog_id, 'dog_id');
      Validator.required(data.trainer_id, 'trainer_id');
      Validator.required(data.lesson_date, 'lesson_date');
      
      Validator.date(data.lesson_date, 'lesson_date');
      
      // スコアチェック（1-5）
      for (var i = 1; i <= 10; i++) {
        var scoreField = 'score_' + i;
        if (data[scoreField] !== undefined && data[scoreField] !== null && data[scoreField] !== '') {
          Validator.number(data[scoreField], scoreField, { min: 1, max: 5 });
        }
      }
      
    } catch (error) {
      errors.push(error);
    }
    
    return errors;
  }
};

// ============================================================================
// テスト関数
// ============================================================================

/**
 * バリデーションテスト
 */
function testValidation() {
  console.log('=== Validation Test ===\n');
  
  // テスト1: 正常な顧客データ
  console.log('Test 1: Valid Customer Data');
  var validCustomer = {
    customer_name: '田中 太郎',
    customer_phone: '090-1234-5678',
    customer_email: 'tanaka@example.com',
    customer_zip_code: '174-0063',
    customer_gender: 'Male',
    customer_status: 'ACTIVE'
  };
  
  var errors1 = ValidationRules.customer(validCustomer);
  console.log('Errors:', errors1.length === 0 ? '✅ None' : errors1);
  
  // テスト2: 不正な顧客データ
  console.log('\nTest 2: Invalid Customer Data');
  var invalidCustomer = {
    customer_name: '', // 必須エラー
    customer_phone: '123', // 形式エラー
    customer_email: 'invalid-email', // 形式エラー
    customer_gender: 'Unknown' // 列挙値エラー
  };
  
  var errors2 = ValidationRules.customer(invalidCustomer);
  console.log('Errors:', errors2.length);
  for (var i = 0; i < errors2.length; i++) {
    console.log('  - ' + errors2[i].message);
  }
  
  // テスト3: 予約データ
  console.log('\nTest 3: Reservation Data');
  var reservation = {
    customer_id: '6fec4d95',
    dog_id: 'da12c3a5',
    trainer_id: 'e44b0184',
    office_id: '0721fa20',
    reservation_date: '2026/03/15 10:00:00',
    status: 'PENDING'
  };
  
  var errors3 = ValidationRules.reservation(reservation);
  console.log('Errors:', errors3.length === 0 ? '✅ None' : errors3);
  
  console.log('\n✅ Validation Test Completed');
}