/**
 * ============================================================================
 * K9 Harmony - Dog Repository
 * ============================================================================
 * ファイル名: DogRepository.gs
 * 役割: 犬情報のCRUD操作 + フォルダ自動生成 + 写真管理
 * 最終更新: 2026-01-02
 * バージョン: v1.0.0
 */

// ============================================================================
// 犬リポジトリ
// ============================================================================

var DogRepository = {
  
  /**
   * 犬情報作成
   * @param {Object} data 犬データ
   * @return {Object} 作成された犬データ
   */
  create: function(data) {
    var context = { service: 'DogRepository', action: 'create' };
    
    try {
      // 1. バリデーション
      var errors = ValidationRules.dog(data);
      if (errors.length > 0) {
        throw errors[0];
      }
      
      // 2. 顧客存在確認
      var customer = CustomerRepository.findById(data.customer_id);
      if (customer.error) {
        throw ErrorHandler.notFoundError('Customer', data.customer_id);
      }
      
      // 3. 犬コード自動採番
      if (!data.dog_code) {
        data.dog_code = this._generateDogCode();
      }
      
      // 4. ID生成
      data.dog_id = Utilities.getUuid();
      
      // 5. デフォルト値設定
      data.created_at = new Date();
      data.updated_at = new Date();
      
      // 6. DB登録
      DB.insert(CONFIG.SHEET.DOGS, data);

      // フォルダ自動生成
      var folderInfo = DogRepository._createDogFolder(data, customer);

      // フォルダ情報を更新
      DB.update(CONFIG.SHEET.DOGS, data.dog_id, {
        dog_shared_folder_id: folderInfo.folderId,
        dog_shared_folder_url: folderInfo.folderUrl
      });

      data.dog_shared_folder_id = folderInfo.folderId;
      data.dog_shared_folder_url = folderInfo.folderUrl;

      var dog = data;
      
      // 7. 監査ログ記録
      if (typeof AuditService !== 'undefined') {
        AuditService.log(
          'dog',
          dog.dog_id,
          'CREATE',
          null,
          dog,
          'TRAINER',
          this._getCurrentUser()
        );
      }
      
      log('INFO', 'DogRepository', 'Dog created: ' + dog.dog_code);
      
      return dog;
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 犬検索（ID）
   */
  findById: function(dogId) {
    try {
      var dog = DB.findById(CONFIG.SHEET.DOGS, dogId);
      
      if (!dog) {
        throw ErrorHandler.notFoundError('Dog', dogId);
      }
      
      return dog;
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'DogRepository', action: 'findById' });
    }
  },
  
  /**
   * 顧客の犬一覧取得
   */
  findByCustomerId: function(customerId) {
    try {
      var dogs = DB.findBy(CONFIG.SHEET.DOGS, 'customer_id', customerId);
      
      // 削除済みを除外
      return dogs.filter(function(d) {
        return !d.is_deleted;
      });
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'DogRepository', action: 'findByCustomerId' });
    }
  },
  
  /**
   * 全犬情報取得
   */
  findAll: function() {
    try {
      var dogs = DB.fetchTable(CONFIG.SHEET.DOGS);
      
      // 削除済みを除外
      return dogs.filter(function(d) {
        return !d.is_deleted;
      });
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'DogRepository', action: 'findAll' });
    }
  },
  
  /**
   * 犬情報更新
   */
  update: function(dogId, data) {
    var context = { service: 'DogRepository', action: 'update' };
    
    try {
      var oldData = this.findById(dogId);
      
      if (oldData.error) {
        throw oldData;
      }
      
      data.updated_at = new Date();
      
      TransactionManager.execute(function(tx) {
        tx.update(CONFIG.SHEET.DOGS, dogId, data);
      });
      
      if (typeof AuditService !== 'undefined') {
        AuditService.log(
          'dog',
          dogId,
          'UPDATE',
          oldData,
          data,
          'TRAINER',
          this._getCurrentUser()
        );
      }
      
      log('INFO', 'DogRepository', 'Dog updated: ' + dogId);
      
      // 犬情報変更通知
      var updatedDog = this.findById(dogId);
      if (typeof NotificationService !== 'undefined' && !updatedDog.error) {
        var customer = CustomerRepository.findById(updatedDog.customer_id);
        if (!customer.error) {
          NotificationService.sendDogInfoUpdateNotification(customer, updatedDog, data);
        }
      }
      
      return updatedDog;
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 犬情報削除（論理削除）
   */
  delete: function(dogId) {
    var context = { service: 'DogRepository', action: 'delete' };
    
    try {
      var oldData = this.findById(dogId);
      
      if (oldData.error) {
        throw oldData;
      }
      
      var deleteData = {
        is_deleted: true,
        deleted_at: new Date()
      };
      
      TransactionManager.execute(function(tx) {
        tx.update(CONFIG.SHEET.DOGS, dogId, deleteData);
      });
      
      if (typeof AuditService !== 'undefined') {
        AuditService.log(
          'dog',
          dogId,
          'DELETE',
          oldData,
          null,
          'TRAINER',
          this._getCurrentUser()
        );
      }
      
      log('INFO', 'DogRepository', 'Dog deleted: ' + dogId);
      
      return { success: true, dogId: dogId };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 犬フォルダ作成
   * フォルダ構造:
   * ▶ {customer_code}_{customer_name}/
   *   ├─ {dog_code}_{dog_name}/
   *   │  ├─ {dog_code}_{dog_name}_Profile_Photo/
   *   │  ├─ Medical/
   *   │  ├─ Disaster/
   *   │  └─ Lesson_Photo/
   */
  _createDogFolder: function(dog, customer) {
    try {
      // 顧客フォルダ取得
      if (!customer.google_drive_folder_id) {
        log('WARN', 'DogRepository', 'Customer folder not found, skipping dog folder creation');
        return { folderId: null, folderUrl: null };
      }
      
      // フォルダIDの検証
      try {
        var customerFolder = DriveApp.getFolderById(customer.google_drive_folder_id);
      } catch (e) {
        log('ERROR', 'DogRepository', 'Invalid customer folder ID: ' + customer.google_drive_folder_id, {
          error: e.message
        });
        return { folderId: null, folderUrl: null };
      }
      
      // 犬フォルダ作成
      var dogFolderName = dog.dog_code + '_' + dog.dog_name;
      var dogFolder = customerFolder.createFolder(dogFolderName);
      
      // サブフォルダ作成
      dogFolder.createFolder(dog.dog_code + '_' + dog.dog_name + '_Profile_Photo');
      dogFolder.createFolder('Medical');
      dogFolder.createFolder('Disaster');
      dogFolder.createFolder('Lesson_Photo');
      
      log('INFO', 'DogRepository', 'Dog folder created: ' + dogFolderName);
      
      return {
        folderId: dogFolder.getId(),
        folderUrl: dogFolder.getUrl()
      };
      
    } catch (error) {
      log('ERROR', 'DogRepository', 'Failed to create dog folder', {
        error: error.message,
        dog_code: dog.dog_code
      });
      
      return {
        folderId: null,
        folderUrl: null
      };
    }
  },
  
  /**
   * 犬コード自動採番
   * 形式: YY-DO-XXXX（YYは年、XXXXは連番）
   */
  _generateDogCode: function() {
    var dogs = DB.fetchTable(CONFIG.SHEET.DOGS);
    var currentYear = new Date().getFullYear().toString().substr(-2);
    var prefix = currentYear + '-DO-';
    
    // 同じ年の最大番号を取得
    var maxNumber = 0;
    dogs.forEach(function(d) {
      if (d.dog_code && d.dog_code.startsWith(prefix)) {
        var num = parseInt(d.dog_code.split('-')[2]);
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
 * 犬作成テスト
 */
function testDogCreate() {
  console.log('=== Dog Create Test ===\n');
  
  // 顧客を取得
  var customers = CustomerRepository.findAll();
  if (customers.length === 0) {
    console.error('❌ No customers found. Create a customer first.');
    return;
  }
  
  var customer = customers[0];
  console.log('Using customer:', customer.customer_code);
  
  var testDog = {
    customer_id: customer.customer_id,
    dog_name: 'テスト犬',
    dog_gender: '♂',
    breed: '柴犬',
    coat_color: '赤',
    dog_birth_date: '2020/01/01',
    neutered: '済',
    problem: 'テスト用',
    attributes: 'フレンドリー'
  };
  
  var result = DogRepository.create(testDog);
  
  if (result.error) {
    console.error('❌ Create failed:', result.message);
  } else {
    console.log('✅ Dog created:');
    console.log('  ID:', result.dog_id);
    console.log('  Code:', result.dog_code);
    console.log('  Name:', result.dog_name);
    console.log('  Folder:', result.dog_shared_folder_url);
  }
}

/**
 * 犬検索テスト
 */
function testDogFind() {
  console.log('\n=== Dog Find Test ===\n');
  
  var customers = CustomerRepository.findAll();
  if (customers.length === 0) {
    console.error('❌ No customers found.');
    return;
  }
  
  var customer = customers[0];
  var dogs = DogRepository.findByCustomerId(customer.customer_id);
  
  console.log('Customer:', customer.customer_code);
  console.log('Dogs:', dogs.length);
  
  if (dogs.length > 0) {
    console.log('\nFirst dog:');
    console.log('  ID:', dogs[0].dog_id);
    console.log('  Code:', dogs[0].dog_code);
    console.log('  Name:', dogs[0].dog_name);
    console.log('  Breed:', dogs[0].breed);
  }
}

/**
 * 全テスト実行
 */
function testDogRepository() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Dog Repository Test Suite                ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  testDogCreate();
  testDogFind();
  
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   Test Suite Completed                     ║');
  console.log('╚════════════════════════════════════════════╝');
}