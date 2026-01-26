/**
 * ============================================================================
 * K9 Harmony - Customer Repository
 * ============================================================================
 * ファイル名: CustomerRepository.gs
 * 役割: 顧客情報のCRUD操作 + フォルダ自動生成 + 監査ログ
 * 最終更新: 2026-01-02
 * バージョン: v1.0.0
 */

// ============================================================================
// 顧客リポジトリ
// ============================================================================

var CustomerRepository = {
  
  /**
   * 顧客作成
   * @param {Object} data 顧客データ
   * @return {Object} 作成された顧客データ
   */
  create: function(data) {
    var context = { service: 'CustomerRepository', action: 'create' };
    
    try {
      // 1. バリデーション
      var errors = ValidationRules.customer(data);
      if (errors.length > 0) {
        throw errors[0]; // 最初のエラーを投げる
      }
      
      // 2. 重複チェック（メールアドレス）
      if (data.customer_email) {
        var existing = this.findByEmail(data.customer_email);
        if (existing) {
          throw ErrorHandler.duplicateError('Customer', 'customer_email', data.customer_email);
        }
      }
      
      // 3. 顧客コード自動採番
      if (!data.customer_code) {
        data.customer_code = this._generateCustomerCode();
      }
      
      // 4. ID生成
      data.customer_id = Utilities.getUuid();
      
      // 5. デフォルト値設定
      data.customer_status = data.customer_status || 'ACTIVE';
      data.lifecycle_stage = data.lifecycle_stage || 'LEAD';
      data.is_blacklisted = data.is_blacklisted || false;
      data.line_blocked_flag = data.line_blocked_flag || false;
      data.created_at = new Date();
      data.updated_at = new Date();
      data.created_by = this._getCurrentUser();
      data.updated_by = this._getCurrentUser();
      
      // 6. トランザクション内で実行
      var customer = TransactionManager.execute(function(tx) {
        // DB登録
        tx.insert(CONFIG.SHEET.CUSTOMERS, data);
        
        // フォルダ自動生成
        var folderInfo = CustomerRepository._createCustomerFolder(data);
        
        // フォルダ情報を更新
        tx.update(CONFIG.SHEET.CUSTOMERS, data.customer_id, {
          google_drive_folder_id: folderInfo.folderId,
          google_drive_folder_url: folderInfo.folderUrl
        });
        
        data.google_drive_folder_id = folderInfo.folderId;
        data.google_drive_folder_url = folderInfo.folderUrl;
        
        return data;
      });
      
      // 7. 監査ログ記録（AuditServiceが実装されている場合）
      if (typeof AuditService !== 'undefined') {
        AuditService.log(
          'customer',
          customer.customer_id,
          'CREATE',
          null,
          customer,
          'TRAINER',
          this._getCurrentUser()
        );
      }
      
      log('INFO', 'CustomerRepository', 'Customer created: ' + customer.customer_code);
      
      return customer;
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 顧客検索（ID）
   */
  findById: function(customerId) {
    try {
      var customer = DB.findById(CONFIG.SHEET.CUSTOMERS, customerId);
      
      if (!customer) {
        throw ErrorHandler.notFoundError('Customer', customerId);
      }
      
      return customer;
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'CustomerRepository', action: 'findById' });
    }
  },
  
  /**
   * 顧客検索（メールアドレス）
   */
  findByEmail: function(email) {
    try {
      var customers = DB.findBy(CONFIG.SHEET.CUSTOMERS, 'customer_email', email);
      return customers.length > 0 ? customers[0] : null;
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'CustomerRepository', action: 'findByEmail' });
    }
  },
  
  /**
   * 顧客検索（LINE User ID）
   */
  findByLineUserId: function(lineUserId) {
    try {
      var customers = DB.findBy(CONFIG.SHEET.CUSTOMERS, 'line_user_id', lineUserId);
      return customers.length > 0 ? customers[0] : null;
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'CustomerRepository', action: 'findByLineUserId' });
    }
  },
  
  /**
   * 全顧客取得
   */
  findAll: function() {
    try {
      var customers = DB.fetchTable(CONFIG.SHEET.CUSTOMERS);
      
      // 削除済みを除外
      return customers.filter(function(c) {
        return !c.is_deleted;
      });
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'CustomerRepository', action: 'findAll' });
    }
  },
  
  /**
   * 顧客更新
   */
  update: function(customerId, data) {
    var context = { service: 'CustomerRepository', action: 'update' };
    
    try {
      // 1. 存在確認
      var oldData = this.findById(customerId);
      
      if (oldData.error) {
        throw oldData; // findByIdのエラーを再スロー
      }
      
      // 2. バリデーション（部分更新なので緩い検証）
      if (data.customer_email) {
        Validator.email(data.customer_email, 'customer_email');
      }
      if (data.customer_phone) {
        Validator.phone(data.customer_phone, 'customer_phone');
      }
      if (data.customer_zip_code) {
        Validator.zipCode(data.customer_zip_code, 'customer_zip_code');
      }
      
      // 3. 更新日時設定
      data.updated_at = new Date();
      data.updated_by = this._getCurrentUser();
      
      // 4. トランザクション内で更新
      TransactionManager.execute(function(tx) {
        tx.update(CONFIG.SHEET.CUSTOMERS, customerId, data);
      });
      
      // 5. 監査ログ記録
      if (typeof AuditService !== 'undefined') {
        AuditService.log(
          'customer',
          customerId,
          'UPDATE',
          oldData,
          data,
          'TRAINER',
          this._getCurrentUser()
        );
      }
      
      log('INFO', 'CustomerRepository', 'Customer updated: ' + customerId);
      
      // 6. プロフィール変更通知
      var updatedCustomer = this.findById(customerId);
      if (typeof NotificationService !== 'undefined' && !updatedCustomer.error) {
        NotificationService.sendProfileUpdateNotification(updatedCustomer, data);
      }
      
      return updatedCustomer;
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 顧客削除（論理削除）
   */
  delete: function(customerId) {
    var context = { service: 'CustomerRepository', action: 'delete' };
    
    try {
      var oldData = this.findById(customerId);
      
      if (oldData.error) {
        throw oldData;
      }
      
      var deleteData = {
        is_deleted: true,
        deleted_at: new Date(),
        updated_by: this._getCurrentUser()
      };
      
      TransactionManager.execute(function(tx) {
        tx.update(CONFIG.SHEET.CUSTOMERS, customerId, deleteData);
      });
      
      // 監査ログ記録
      if (typeof AuditService !== 'undefined') {
        AuditService.log(
          'customer',
          customerId,
          'DELETE',
          oldData,
          null,
          'TRAINER',
          this._getCurrentUser()
        );
      }
      
      log('INFO', 'CustomerRepository', 'Customer deleted: ' + customerId);
      
      return { success: true, customerId: customerId };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 顧客フォルダ作成
   * フォルダ構造:
   * ▶ {customer_code}_{customer_name}
   *   ├─ Contract_Signature
   */
  _createCustomerFolder: function(customer) {
    try {
      // ルートフォルダ取得（Configで設定）
      var rootFolder = DriveApp.getFolderById(CONFIG.FOLDER.CUSTOMERS_ROOT);
      
      // 顧客フォルダ作成
      var folderName = customer.customer_code + '_' + customer.customer_name;
      var customerFolder = rootFolder.createFolder(folderName);
      
      // Contract_Signatureフォルダ作成
      customerFolder.createFolder('Contract_Signature');
      
      log('INFO', 'CustomerRepository', 'Customer folder created: ' + folderName);
      
      return {
        folderId: customerFolder.getId(),
        folderUrl: customerFolder.getUrl()
      };
      
    } catch (error) {
      log('ERROR', 'CustomerRepository', 'Failed to create customer folder', {
        error: error.message,
        customer_code: customer.customer_code
      });
      
      // フォルダ作成失敗してもエラーにしない（後で手動作成可能）
      return {
        folderId: null,
        folderUrl: null
      };
    }
  },
  
  /**
   * 顧客コード自動採番
   * 形式: K9-CU-XXXX（XXXXは連番）
   */
  _generateCustomerCode: function() {
    var customers = DB.fetchTable(CONFIG.SHEET.CUSTOMERS);
    
    // 既存の最大番号を取得
    var maxNumber = 0;
    customers.forEach(function(c) {
      if (c.customer_code && c.customer_code.startsWith('K9-CU-')) {
        var num = parseInt(c.customer_code.split('-')[2]);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });
    
    var nextNumber = maxNumber + 1;
    var paddedNumber = ('0000' + nextNumber).slice(-4);
    
    return 'K9-CU-' + paddedNumber;
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
 * 顧客作成テスト
 */
function testCustomerCreate() {
  console.log('=== Customer Create Test ===\n');
  
  var testCustomer = {
    customer_name: 'テスト 花子',
    customer_name_kana: 'テスト ハナコ',
    customer_gender: 'Female',
    customer_birth_date: '1990/05/15',
    customer_email: 'test.hanako@example.com',
    customer_phone: '090-9876-5432',
    customer_zip_code: '150-0001',
    customer_address_prefecture: '東京都',
    customer_address_city: '渋谷区',
    customer_address_street: '神宮前1-1-1',
    customer_address_building: 'テストビル101'
  };
  
  var result = CustomerRepository.create(testCustomer);
  
  if (result.error) {
    console.error('❌ Create failed:', result.message);
  } else {
    console.log('✅ Customer created:');
    console.log('  ID:', result.customer_id);
    console.log('  Code:', result.customer_code);
    console.log('  Name:', result.customer_name);
    console.log('  Folder:', result.google_drive_folder_url);
  }
}

/**
 * 顧客検索テスト
 */
function testCustomerFind() {
  console.log('\n=== Customer Find Test ===\n');
  
  // 全顧客取得
  var customers = CustomerRepository.findAll();
  console.log('Total customers:', customers.length);
  
  if (customers.length > 0) {
    var firstCustomer = customers[0];
    console.log('\nFirst customer:');
    console.log('  ID:', firstCustomer.customer_id);
    console.log('  Code:', firstCustomer.customer_code);
    console.log('  Name:', firstCustomer.customer_name);
    
    // ID検索
    var found = CustomerRepository.findById(firstCustomer.customer_id);
    console.log('\n✅ Find by ID:', found.customer_name);
  }
}

/**
 * 顧客更新テスト
 */
function testCustomerUpdate() {
  console.log('\n=== Customer Update Test ===\n');
  
  var customers = CustomerRepository.findAll();
  
  if (customers.length > 0) {
    var customer = customers[0];
    console.log('Updating customer:', customer.customer_code);
    
    var updateData = {
      customer_phone: '090-0000-1111',
      remarks: 'テスト更新 ' + new Date().toLocaleString('ja-JP')
    };
    
    var result = CustomerRepository.update(customer.customer_id, updateData);
    
    if (result.error) {
      console.error('❌ Update failed:', result.message);
    } else {
      console.log('✅ Customer updated');
      console.log('  New phone:', result.customer_phone);
      console.log('  Remarks:', result.remarks);
    }
  }
}

/**
 * 全テスト実行
 */
function testCustomerRepository() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Customer Repository Test Suite          ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  testCustomerCreate();
  testCustomerFind();
  testCustomerUpdate();
  
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   Test Suite Completed                     ║');
  console.log('╚════════════════════════════════════════════╝');
}

/**
 * プロフィール変更通知テスト
 */
function TEST_ProfileUpdateNotification() {
  console.log('=== プロフィール変更通知テスト ===\n');
  
  var customers = CustomerRepository.findAll();
  
  if (customers.length === 0) {
    console.log('❌ 顧客がいません');
    return;
  }
  
  var customer = customers[0];
  console.log('テスト対象顧客:', customer.customer_name);
  
  // プロフィール変更
  var result = CustomerRepository.update(
    customer.customer_id,
    {
      customer_phone: '090-9999-8888',
      remarks: 'テスト変更 ' + new Date().toLocaleString('ja-JP')
    }
  );
  
  if (result.error) {
    console.error('❌ エラー:', result.message);
  } else {
    console.log('✅ プロフィール変更成功');
    console.log('   新電話番号:', result.customer_phone);
    console.log('');
    console.log('👉 顧客のLINEを確認してください');
    console.log('   「プロフィール情報が変更されました」というメッセージが届いているはずです');
  }
}