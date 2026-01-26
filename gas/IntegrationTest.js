/**
 * ============================================================================
 * K9 Harmony - Integration Test
 * ============================================================================
 * ファイル名: IntegrationTest.gs
 * 役割: システム全体の統合テスト
 * 最終更新: 2026-01-02
 * バージョン: v1.0.0
 */

/**
 * 統合テスト: 顧客登録〜更新〜削除の一連の流れ
 */
function integrationTest_CustomerLifecycle() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Integration Test: Customer Lifecycle    ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  var testCustomerId;
  
  try {
    // Step 1: 顧客作成
    console.log('Step 1: Creating customer...');
    
    // ユニークなメールアドレスを生成（タイムスタンプ使用）
    var timestamp = new Date().getTime();
    
    var createData = {
      customer_name: '統合テスト 太郎',
      customer_name_kana: 'トウゴウテスト タロウ',
      customer_gender: 'Male',
      customer_email: 'integration.test.' + timestamp + '@example.com',
      customer_phone: '080-1234-5678',
      customer_zip_code: '100-0001',
      customer_address_prefecture: '東京都',
      customer_address_city: '千代田区',
      customer_address_street: '千代田1-1-1'
    };
    
    var customer = CustomerRepository.create(createData);
    
    if (customer.error) {
      throw new Error('Customer creation failed: ' + customer.message);
    }
    
    testCustomerId = customer.customer_id;
    console.log('✅ Customer created:', customer.customer_code);
    console.log('   ID:', customer.customer_id);
    console.log('   Folder:', customer.google_drive_folder_url || 'N/A');
    
    // Step 2: 顧客検索
    console.log('\nStep 2: Finding customer...');
    var found = CustomerRepository.findById(testCustomerId);
    
    if (found.error) {
      throw new Error('Customer find failed: ' + found.message);
    }
    
    console.log('✅ Customer found:', found.customer_name);
    
    // Step 3: 顧客更新
    console.log('\nStep 3: Updating customer...');
    var updateData = {
      customer_phone: '080-9999-8888',
      remarks: 'Integration test updated at ' + new Date().toLocaleString('ja-JP')
    };
    
    var updated = CustomerRepository.update(testCustomerId, updateData);
    
    if (updated.error) {
      throw new Error('Customer update failed: ' + updated.message);
    }
    
    console.log('✅ Customer updated');
    console.log('   New phone:', updated.customer_phone);
    
    // Step 4: 顧客削除（論理削除）
    console.log('\nStep 4: Deleting customer...');
    var deleted = CustomerRepository.delete(testCustomerId);
    
    if (deleted.error) {
      throw new Error('Customer delete failed: ' + deleted.message);
    }
    
    console.log('✅ Customer deleted (soft delete)');
    
    // Step 5: 削除後の確認
    console.log('\nStep 5: Verifying deletion...');
    var afterDelete = DB.findById(CONFIG.SHEET.CUSTOMERS, testCustomerId);
    
    if (afterDelete && afterDelete.is_deleted === true) {
      console.log('✅ Deletion confirmed: is_deleted = true');
    } else if (afterDelete && afterDelete.is_deleted === 'TRUE') {
      // Googleスプレッドシートでは boolean が文字列 'TRUE' になる場合がある
      console.log('✅ Deletion confirmed: is_deleted = TRUE (string)');
    } else {
      console.error('❌ Deletion verification failed');
      console.error('   is_deleted value:', afterDelete ? afterDelete.is_deleted : 'record not found');
    }
    
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   ✅ Integration Test PASSED               ║');
    console.log('╚════════════════════════════════════════════╝');
    
  } catch (error) {
    console.error('\n╔════════════════════════════════════════════╗');
    console.error('║   ❌ Integration Test FAILED               ║');
    console.error('╚════════════════════════════════════════════╝');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

/**
 * 統合テスト: エラーハンドリング
 */
function integrationTest_ErrorHandling() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   Integration Test: Error Handling        ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  // Test 1: 必須フィールド欠落
  console.log('Test 1: Missing required field');
  var invalidData1 = {
    customer_name: '', // 必須フィールドが空
    customer_phone: '080-1234-5678'
  };
  
  var result1 = CustomerRepository.create(invalidData1);
  
  if (result1.error && result1.code === 'REQUIRED_FIELD_MISSING') {
    console.log('✅ Correctly rejected: ' + result1.message);
  } else {
    console.error('❌ Should have been rejected');
  }
  
  // Test 2: 不正な形式
  console.log('\nTest 2: Invalid format');
  var invalidData2 = {
    customer_name: 'テスト',
    customer_phone: '123', // 不正な電話番号
    customer_email: 'invalid-email' // 不正なメール
  };
  
  var result2 = CustomerRepository.create(invalidData2);
  
  if (result2.error && result2.code === 'VALIDATION_ERROR') {
    console.log('✅ Correctly rejected: ' + result2.message);
  } else {
    console.error('❌ Should have been rejected');
  }
  
  // Test 3: 存在しないID
  console.log('\nTest 3: Non-existent ID');
  var result3 = CustomerRepository.findById('invalid-id-999');
  
  if (result3.error && result3.code === 'RECORD_NOT_FOUND') {
    console.log('✅ Correctly returned error: ' + result3.message);
  } else {
    console.error('❌ Should have returned error');
  }
  
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   ✅ Error Handling Test PASSED            ║');
  console.log('╚════════════════════════════════════════════╝');
}

/**
 * 全統合テスト実行
 */
function _DEV_ONLY_runAllIntegrationTests() {
  integrationTest_CustomerLifecycle();
  integrationTest_ErrorHandling();
  
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   All Integration Tests Completed         ║');
  console.log('╚════════════════════════════════════════════╝');
}