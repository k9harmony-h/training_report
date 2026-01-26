/**
 * ============================================================================
 * K9 Harmony - Transaction診断スクリプト
 * ============================================================================
 * 目的: Transaction.createReservationWithPaymentAtomicエラーの根本原因特定
 * 実行場所: GASエディタ
 */

/**
 * 診断テスト1: Transactionオブジェクトの読み込み確認
 */
function DIAG_1_CheckTransactionLoaded() {
  console.log('========== 診断テスト1: Transactionオブジェクト読み込み確認 ==========');
  
  if (typeof Transaction !== 'undefined') {
    console.log('✅ Transaction オブジェクトは読み込まれています');
    
    // メソッド一覧を表示
    var methods = Object.keys(Transaction);
    console.log('📋 利用可能なメソッド数: ' + methods.length);
    console.log('📋 メソッド一覧:');
    methods.forEach(function(method) {
      console.log('   - ' + method);
    });
    
    // createReservationWithPaymentAtomicの存在確認
    if (typeof Transaction.createReservationWithPaymentAtomic === 'function') {
      console.log('✅ Transaction.createReservationWithPaymentAtomic メソッドが存在します');
    } else {
      console.log('❌ Transaction.createReservationWithPaymentAtomic メソッドが見つかりません');
      console.log('⚠️  メソッド名のスペルミスまたは定義エラーの可能性があります');
    }
    
  } else {
    console.log('❌ Transaction オブジェクトが読み込まれていません');
    console.log('');
    console.log('【考えられる原因】');
    console.log('1. Transaction.gs ファイルが存在しない');
    console.log('2. Transaction.gs に構文エラーがある（赤い波線を確認）');
    console.log('3. ファイル名が "Transaction.gs" と完全一致していない');
    console.log('4. デプロイに Transaction.gs が含まれていない');
    console.log('');
    console.log('【次のアクション】');
    console.log('→ 左側のファイル一覧で "Transaction.gs" を探してください');
    console.log('→ ファイルを開いて、赤い波線や警告マークがないか確認してください');
  }
  
  console.log('====================================================================');
}

/**
 * 診断テスト2: 全ファイルの読み込み順序確認
 */
function DIAG_2_CheckFileLoadOrder() {
  console.log('========== 診断テスト2: ファイル読み込み順序確認 ==========');
  
  var objects = [
    'CONFIG',
    'DB',
    'ErrorHandler',
    'CustomerRepository',
    'DogRepository',
    'TrainerRepository',
    'OfficeRepository',
    'ProductRepository',
    'ReservationRepository',
    'PaymentRepository',
    'LessonRepository',
    'SaleRepository',
    'ReservationService',
    'Transaction',
    'RetryHandler',
    'SquareService',
    'NotificationService',
    'CalendarRepository',
    'CalendarService'
  ];
  
  console.log('📋 各オブジェクトの読み込み状況:');
  
  var loadedCount = 0;
  var notLoadedCount = 0;
  
  objects.forEach(function(objName) {
    try {
      var obj = eval(objName);
      if (typeof obj !== 'undefined') {
        console.log('✅ ' + objName + ' - 読み込み済み');
        loadedCount++;
      } else {
        console.log('❌ ' + objName + ' - 未読み込み');
        notLoadedCount++;
      }
    } catch (e) {
      console.log('❌ ' + objName + ' - エラー: ' + e.message);
      notLoadedCount++;
    }
  });
  
  console.log('');
  console.log('📊 読み込み状況: ' + loadedCount + '/' + objects.length + ' 読み込み成功');
  
  if (notLoadedCount > 0) {
    console.log('⚠️  ' + notLoadedCount + '個のオブジェクトが読み込まれていません');
    console.log('→ 該当ファイルに構文エラーがある可能性があります');
  }
  
  console.log('====================================================================');
}

/**
 * 診断テスト3: Transaction.gs の構文チェック
 */
function DIAG_3_CheckTransactionSyntax() {
  console.log('========== 診断テスト3: Transaction.gs 構文チェック ==========');
  
  if (typeof Transaction === 'undefined') {
    console.log('❌ Transaction オブジェクトが読み込まれていないため、構文チェック不可');
    console.log('');
    console.log('【手動確認手順】');
    console.log('1. GASエディタで "Transaction.gs" ファイルを開く');
    console.log('2. エディタ内に赤い波線や警告マークがないか確認');
    console.log('3. もし見つかった場合:');
    console.log('   - エラー箇所にマウスカーソルを合わせてエラー内容を確認');
    console.log('   - エラーを修正');
    console.log('   - Ctrl+S (または Cmd+S) で保存');
    console.log('   - 新しいバージョンとしてデプロイ');
    console.log('   - このテストを再実行');
    return;
  }
  
  console.log('✅ Transaction オブジェクトは正常に読み込まれています');
  
  // 必須メソッドの存在確認
  var requiredMethods = [
    'execute',
    'createReservationWithPaymentAtomic',
    'recordOperation',
    'registerRollback',
    'getTransactionHistory',
    'getFailureStatistics'
  ];
  
  var allMethodsExist = true;
  
  requiredMethods.forEach(function(method) {
    if (typeof Transaction[method] === 'function') {
      console.log('✅ Transaction.' + method + ' - 存在');
    } else {
      console.log('❌ Transaction.' + method + ' - 見つかりません');
      allMethodsExist = false;
    }
  });
  
  if (allMethodsExist) {
    console.log('');
    console.log('✅ 全ての必須メソッドが正しく定義されています');
    console.log('→ Transaction.gs の構文は問題ありません');
  } else {
    console.log('');
    console.log('⚠️  一部のメソッドが見つかりません');
    console.log('→ Transaction.gs のコードを確認してください');
  }
  
  console.log('====================================================================');
}

/**
 * 診断テスト4: デプロイ状況確認
 */
function DIAG_4_CheckDeploymentStatus() {
  console.log('========== 診断テスト4: デプロイ状況確認 ==========');
  
  console.log('【確認項目】');
  console.log('');
  console.log('1. 現在のデプロイバージョンを確認:');
  console.log('   → GASエディタ右上の「デプロイ」→「デプロイを管理」をクリック');
  console.log('   → 最新バージョン番号と日時を確認');
  console.log('');
  console.log('2. Transaction.gs が最新デプロイに含まれているか確認:');
  console.log('   → ファイル一覧で Transaction.gs が存在することを確認');
  console.log('   → ファイルを開いて内容が正しいことを確認');
  console.log('');
  console.log('3. デプロイのタイムスタンプ確認:');
  console.log('   → Transaction.gs の最終編集時刻 < デプロイ時刻 であることを確認');
  console.log('   → もし Transaction.gs の方が新しい場合、再デプロイが必要');
  console.log('');
  console.log('4. 再デプロイ手順（必要な場合）:');
  console.log('   a. GASエディタ右上の「デプロイ」→「新しいデプロイ」をクリック');
  console.log('   b. 「種類を選択」で「ウェブアプリ」を選択');
  console.log('   c. 「説明」に "Transaction.gs構文修正" などを入力');
  console.log('   d. 「デプロイ」をクリック');
  console.log('   e. 新しいデプロイURLをコピー');
  console.log('   f. Cloudflare Workersの環境変数 GAS_URL を更新');
  
  console.log('====================================================================');
}

/**
 * 全診断テストを一括実行
 */
function RUN_ALL_DIAGNOSTICS() {
  console.log('');
  console.log('##############################################################');
  console.log('# K9 Harmony - Transaction エラー診断（全テスト実行）');
  console.log('##############################################################');
  console.log('');
  
  DIAG_1_CheckTransactionLoaded();
  console.log('');
  
  DIAG_2_CheckFileLoadOrder();
  console.log('');
  
  DIAG_3_CheckTransactionSyntax();
  console.log('');
  
  DIAG_4_CheckDeploymentStatus();
  console.log('');
  
  console.log('##############################################################');
  console.log('# 診断完了');
  console.log('##############################################################');
  console.log('');
  console.log('【診断結果の解釈】');
  console.log('');
  console.log('✅ が多い → Transaction.gs は正しく読み込まれています');
  console.log('   → キャッシュクリア + ブラウザリロードを試してください');
  console.log('');
  console.log('❌ が多い → Transaction.gs に問題があります');
  console.log('   → ファイルの存在、構文エラー、デプロイ状況を確認してください');
  console.log('');
}