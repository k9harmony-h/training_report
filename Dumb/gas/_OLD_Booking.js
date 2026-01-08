/**
 * Booking Core Logic
 * 予約作成・更新・バリデーション
 */

const Booking = {
  /**
   * 新規予約を作成する (仮押さえ/確定)
   * @param {string} lineUserId - ユーザーID
   * @param {Object} requestData - 予約リクエストデータ
   * @return {Object} result { success: boolean, message: string, data: object }
   */
  create: function(lineUserId, requestData) {
    const lock = LockService.getScriptLock();
    
    // 1. 排他制御 (最大30秒待機)
    // 同一タイミングでの二重予約を防ぐ
    try {
      lock.waitLock(30000); 
    } catch (e) {
      return { success: false, message: '現在アクセスが集中しています。もう一度お試しください。' };
    }

    try {
      // 2. 顧客情報の取得 & バリデーション
      const customer = DB.findBy(SYS_CONFIG.SHEETS.CUSTOMERS, 'line_user_id', lineUserId);
      if (!customer) {
        return { success: false, message: '顧客情報が見つかりません。' };
      }
      
      // ブラックリストチェック
      if (customer.is_blacklisted === true || String(customer.is_blacklisted) === 'TRUE') {
         // 表向きは「満席」等のエラー、あるいは丁重な断りを返す
         return { success: false, message: 'ご予約を受け付けられませんでした。管理者へお問い合わせください。' };
      }

      // 3. 商品情報の取得 (メニューIDから)
      const productKey = requestData.productUniqueKey; // アプリから送られてくる商品ID
      const product = DB.findBy(SYS_CONFIG.SHEETS.PRODUCTS, 'product_unique_key', productKey);
      if (!product) {
        return { success: false, message: '選択されたメニューが無効です。' };
      }

      // 4. 犬情報の取得
      const dog = DB.findBy(SYS_CONFIG.SHEETS.DOGS, 'dog_unique_key', requestData.dogUniqueKey);
      if (!dog) {
        return { success: false, message: '犬情報が見つかりません。' };
      }

      // 5. 予約データの構築
      const resId = `RES-${SysUtils.getDateString()}-${SysUtils.generateUniqueId()}`;
      const startTime = new Date(requestData.startTime); // "2025/12/25 10:00"
      const endTime = new Date(requestData.endTime);     // "2025/12/25 11:30"

      const newReservation = {
        res_id: resId,
        customer_unique_key: customer.customer_unique_key,
        dog_unique_key: dog.dog_unique_key,
        product_unique_key: productKey,
        start_time: SysUtils.getCurrentTime().replace(/ \d{2}:\d{2}:\d{2}/, '') + ' ' + requestData.startTime.split(' ')[1], // フォーマット調整
        end_time: SysUtils.getCurrentTime().replace(/ \d{2}:\d{2}:\d{2}/, '') + ' ' + requestData.endTime.split(' ')[1], // ※実際は渡された日時を正しくParseする必要あり
        // ※簡易実装のため、ここでは引数をそのまま日時として保存する想定
        
        // 正確なDateTime保存用
        start_time: requestData.startTime, 
        end_time: requestData.endTime,

        status: 'CONFIRMED', // 仮実装として即確定。決済導入後は 'PENDING'
        payment_status: 'PENDING',
        multi_dog_flag: requestData.multiDog || false,
        receipt_required: requestData.receiptRequired || false,
        receipt_addressee: requestData.receiptAddressee || '',
        memo: requestData.memo || '',
        created_at: SysUtils.getCurrentTime(),
        updated_at: SysUtils.getCurrentTime()
      };

      // 6. DBへの書き込み
      const insertSuccess = DB.insert(SYS_CONFIG.SHEETS.RESERVATIONS, newReservation);
      if (!insertSuccess) {
        throw new Error('DB Write Failed');
      }

      // 7. カレンダー連携
      const eventId = Calendar.syncReservation(newReservation, customer, dog, product.product_name);
      
      // カレンダーIDが取れたらDB更新（本来はupdateメソッドが必要だが今回は割愛、またはinsert時にセット）
      // ※今回は簡易的にログに残すのみとする
      SysUtils.log('INFO', 'Booking.create', `Event Created: ${eventId}`, { resId: resId });

      return {
        success: true,
        message: '予約が完了しました。',
        data: {
          reservationId: resId,
          eventId: eventId
        }
      };

    } catch (e) {
      SysUtils.log('ERROR', 'Booking.create', e.message, requestData);
      return { success: false, message: 'システムエラーが発生しました。' };
    } finally {
      // 8. ロック解除
      lock.releaseLock();
    }
  }
};

/* --- テスト用 --- */
function testBooking() {
  // ※実在する line_user_id, dog_unique_key, product_unique_key に書き換えてテストしてください
  const TEST_USER_ID = 'U1d95daf0e8dfe55a2d5f22442fcddf2f'; // DBにあるダミーID
  const TEST_DOG_KEY = 'da12c3a5'; // Winter
  // マスタから商品キーを取得 (systemConfigで定義したマスタ取得関数を利用)
  const TEST_PROD_KEY = getMasterValue('PLAN_SINGLE_KEY');

  if (!TEST_PROD_KEY || TEST_PROD_KEY === 'PUT_PRODUCT_KEY_HERE') {
    console.error('Master Data not setup correctly.');
    return;
  }

  const result = Booking.create(TEST_USER_ID, {
    productUniqueKey: TEST_PROD_KEY,
    dogUniqueKey: TEST_DOG_KEY,
    startTime: '2025/12/25 10:00:00',
    endTime: '2025/12/25 11:30:00',
    multiDog: false,
    receiptRequired: true,
    receiptAddressee: '株式会社K9',
    memo: 'テスト予約です'
  });

  console.log(JSON.stringify(result, null, 2));
}