/**
 * ============================================================================
 * K9 Harmony - Lesson Repository
 * ============================================================================
 * ファイル名: LessonRepository.gs
 * 役割: レッスン評価のCRUD操作 + 写真管理
 * 最終更新: 2026-01-12
 * バージョン: v1.0.1
 */

// ============================================================================
// レッスンリポジトリ
// ============================================================================

var LessonRepository = {
  
  /**
   * レッスン評価作成
   * @param {Object} data レッスンデータ
   * @return {Object} 作成されたレッスンデータ
   */
  create: function(data) {
    var context = { service: 'LessonRepository', action: 'create' };
    
    try {
      // 1. バリデーション
      var errors = ValidationRules.lesson(data);
      if (errors.length > 0) {
        throw errors[0];
      }
      
      // 2. レッスンコード自動採番
      if (!data.lesson_code) {
        data.lesson_code = this._generateLessonCode();
      }
      
      // 3. ID生成
      data.lesson_id = Utilities.getUuid();
      
      // 4. デフォルト値設定
      data.created_at = new Date();
      data.updated_at = new Date();
      
      // 5. DB登録
      DB.insert(CONFIG.SHEET.LESSONS, data);
      
      // 6. 監査ログ記録
      if (typeof AuditService !== 'undefined') {
        AuditService.logSafe('lesson', data.lesson_id, 'CREATE', null, data, 'TRAINER', data.trainer_id);
      }
      
      log('INFO', 'LessonRepository', 'Lesson created: ' + data.lesson_code);
      
      // 7. レッスン評価追加通知
      if (typeof NotificationService !== 'undefined') {
        var customer = CustomerRepository.findById(data.customer_id);
        if (!customer.error) {
          NotificationService.sendLessonEvaluationAdded(data, customer);
        }
      }
      
      return data;
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * レッスン検索（ID）
   */
  findById: function(lessonId) {
    try {
      var lesson = DB.findById(CONFIG.SHEET.LESSONS, lessonId);
      
      if (!lesson) {
        throw ErrorHandler.notFoundError('Lesson', lessonId);
      }
      
      return lesson;
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'LessonRepository', action: 'findById' });
    }
  },
  
  /**
   * 犬のレッスン履歴取得
   */
  findByDogId: function(dogId) {
    try {
      var lessons = DB.findBy(CONFIG.SHEET.LESSONS, 'dog_id', dogId);
      
      // 日付順にソート（新しい順）
      lessons.sort(function(a, b) {
        return new Date(b.lesson_date) - new Date(a.lesson_date);
      });
      
      return lessons;
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'LessonRepository', action: 'findByDogId' });
    }
  },
  
  /**
   * トレーナーのレッスン一覧取得
   */
  findByTrainerId: function(trainerId) {
    try {
      return DB.findBy(CONFIG.SHEET.LESSONS, 'trainer_id', trainerId);
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'LessonRepository', action: 'findByTrainerId' });
    }
  },
  
  /**
   * 日付範囲でレッスン検索
   */
  findByDateRange: function(startDate, endDate) {
    try {
      var lessons = DB.fetchTable(CONFIG.SHEET.LESSONS);
      
      return lessons.filter(function(l) {
        var lessonDate = new Date(l.lesson_date);
        return lessonDate >= startDate && lessonDate <= endDate;
      });
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'LessonRepository', action: 'findByDateRange' });
    }
  },
  
  /**
   * レッスン更新
   */
  update: function(lessonId, data) {
    var context = { service: 'LessonRepository', action: 'update' };
    
    try {
      var oldData = this.findById(lessonId);
      
      if (oldData.error) {
        throw oldData;
      }
      
      data.updated_at = new Date();
      
      DB.update(CONFIG.SHEET.LESSONS, lessonId, data);
      
      if (typeof AuditService !== 'undefined') {
        AuditService.logSafe('lesson', lessonId, 'UPDATE', oldData, data, 'TRAINER', this._getCurrentUser());
      }

      log('INFO', 'LessonRepository', 'Lesson updated: ' + lessonId);
      
      return this.findById(lessonId);
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * レッスンコード自動採番
   * 形式: YY-LE-XXXX
   */
  _generateLessonCode: function() {
    var lessons = DB.fetchTable(CONFIG.SHEET.LESSONS);
    var currentYear = new Date().getFullYear().toString().substr(-2);
    var prefix = currentYear + '-LE-';
    
    var maxNumber = 0;
    lessons.forEach(function(l) {
      if (l.lesson_code && l.lesson_code.startsWith(prefix)) {
        var num = parseInt(l.lesson_code.split('-')[2]);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });
    
    var nextNumber = maxNumber + 1;
    var paddedNumber = ('0000' + nextNumber).slice(-4);
    
    return prefix + paddedNumber;
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
  }
};

// ============================================================================
// テスト関数
// ============================================================================

/**
 * レッスン作成テスト
 */
function testLessonCreate() {
  console.log('=== Lesson Create Test ===\n');
  
  // 顧客と犬を取得
  var customers = CustomerRepository.findAll();
  if (customers.length === 0) {
    console.error('❌ No customers found.');
    return;
  }
  
  var customer = customers[0];
  var dogs = DogRepository.findByCustomerId(customer.customer_id);
  
  if (dogs.length === 0) {
    console.error('❌ No dogs found.');
    return;
  }
  
  var dog = dogs[0];
  
  var testLesson = {
    customer_id: customer.customer_id,
    dog_id: dog.dog_id,
    trainer_id: 'e44b0184',
    office_id: '0721fa20',
    lesson_date: new Date(),
    goal: 'テストゴール',
    done: 'できたこと',
    unable: 'できなかったこと',
    next_homework: '次回までの宿題',
    score_1: 5,
    score_detail_1: '完璧にできた',
    score_2: 4,
    score_detail_2: '良好',
    comment_trainer: 'よくできました！'
  };
  
  var result = LessonRepository.create(testLesson);
  
  if (result.error) {
    console.error('❌ Create failed:', result.message);
  } else {
    console.log('✅ Lesson created:');
    console.log('  ID:', result.lesson_id);
    console.log('  Code:', result.lesson_code);
    console.log('  Date:', result.lesson_date);
    console.log('  Goal:', result.goal);
  }
}

/**
 * レッスン履歴テスト
 */
function testLessonHistory() {
  console.log('\n=== Lesson History Test ===\n');
  
  var dogs = DogRepository.findAll();
  if (dogs.length === 0) {
    console.error('❌ No dogs found.');
    return;
  }
  
  var dog = dogs[0];
  var lessons = LessonRepository.findByDogId(dog.dog_id);
  
  console.log('Dog:', dog.dog_name);
  console.log('Lessons:', lessons.length);
  
  if (lessons.length > 0) {
    console.log('\nLatest lesson:');
    console.log('  Code:', lessons[0].lesson_code);
    console.log('  Date:', lessons[0].lesson_date);
    console.log('  Goal:', lessons[0].goal);
  }
}

/**
 * 全テスト実行
 */
function testLessonRepository() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Lesson Repository Test Suite             ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  testLessonCreate();
  testLessonHistory();
  
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   Test Suite Completed                     ║');
  console.log('╚════════════════════════════════════════════╝');
}

/**
 * レッスン評価通知テスト
 */
function TEST_LessonEvaluationNotification() {
  console.log('=== レッスン評価通知テスト ===\n');
  
  // 顧客データ取得
  var customers = CustomerRepository.findAll();
  
  if (customers.length === 0) {
    console.log('❌ 顧客がいません');
    return;
  }
  
  var customer = customers[0];
  console.log('テスト対象顧客:', customer.customer_name);
  
  // 犬データ取得
  var dogs = DogRepository.findByCustomerId(customer.customer_id);
  
  if (dogs.length === 0) {
    console.log('❌ 犬がいません');
    return;
  }
  
  var dog = dogs[0];
  console.log('テスト対象犬:', dog.dog_name);
  
  // テストレッスン作成
  var testLesson = {
    customer_id: customer.customer_id,
    dog_id: dog.dog_id,
    trainer_id: 'e44b0184',
    office_id: '0721fa20',
    lesson_date: new Date(),
    goal: 'テストゴール',
    done: 'できたこと',
    unable: 'できなかったこと',
    score_1: 5,
    score_detail_1: '完璧'
  };
  
  var result = LessonRepository.create(testLesson);
  
  if (result.error) {
    console.error('❌ エラー:', result.message);
  } else {
    console.log('✅ レッスン評価作成成功');
    console.log('   レッスンコード:', result.lesson_code);
    console.log('');
    console.log('👉 顧客のLINEを確認してください');
    console.log('   「レッスン評価が追加されました」というメッセージが届いているはずです');
  }
}