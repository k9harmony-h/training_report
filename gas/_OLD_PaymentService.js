/**
 * ============================================================================
 * K9 Harmony - Payment Service
 * ============================================================================
 * @file    paymentService.gs
 * @version v2025.12.25-Initial_Refactor
 * @desc    決済、チケット管理、売上計算ロジックを集約するドメインサービス。
 */

const PaymentService = {
  
  /**
   * チケット残高を計算して返す
   * @param {string} customerUniqueKey 
   * @return {Object} { purchased: number, used: number, balance: number }
   */
  getTicketBalance: function(customerUniqueKey) {
    // 既存ロジック(calculateTicketBalanceService_)をラップする
    // ※保守性のため、main.gsにあるロジックを将来的にこちらへ完全移動推奨ですが
    //   今回はmain.gsの関数を呼び出す形、もしくはロジックをコピーして独立させます。
    //   -> 安全のため、今回はロジックをこちらに移植し、main.gsからは削除(または委譲)します。
    
    if (!customerUniqueKey) throw new Error('customer_unique_key is required for ticket balance.');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const config = (typeof SYS_CONFIG !== 'undefined') ? SYS_CONFIG : {}; // Fallback
    
    // シート名解決 (SYS_CONFIG or CONFIG or Default)
    const pSheetName = (config.SHEETS && config.SHEETS.PRODUCTS) || '商品';
    const sSheetName = (config.SHEETS && config.SHEETS.SALES) || '売上管理';
    const lSheetName = (config.SHEETS && config.SHEETS.LESSONS) || 'レッスン評価'; // 要確認: 既存コードでは 'Training_Data'

    // 1. 商品マスタからチケット枚数定義を取得
    // ※DB.fetchTable が使えるならそれを使うのがベストですが、既存踏襲します
    const productSheet = ss.getSheetByName('商品') || ss.getSheetByName('Product_Master');
    if (!productSheet) return { purchased: 0, used: 0, balance: 0 };
    
    const products = this._getSheetData(productSheet);
    const productTicketMap = {};
    products.forEach(row => {
      const count = row['ticket_count'] ? Number(row['ticket_count']) : 0;
      productTicketMap[row['product_unique_key']] = count;
    });

    // 2. 売上データから購入済みチケットを計算
    const salesSheet = ss.getSheetByName('売上管理') || ss.getSheetByName('Sales_Data');
    if (!salesSheet) return { purchased: 0, used: 0, balance: 0 };
    
    const sales = this._getSheetData(salesSheet);
    let totalPurchased = 0;
    sales.forEach(row => {
      if (row['customer_unique_key'] === customerUniqueKey) {
        const pKey = row['product_unique_key'];
        if (productTicketMap.hasOwnProperty(pKey)) {
          totalPurchased += productTicketMap[pKey];
        }
      }
    });

    // 3. レッスン履歴から消費済みチケットを計算
    // ※Training_Dataシートを使用
    const trainingSheet = ss.getSheetByName('レッスン評価') || ss.getSheetByName('Training_Data');
    if (!trainingSheet) return { purchased: 0, used: 0, balance: 0 };
    
    const trainings = this._getSheetData(trainingSheet);
    let totalUsed = 0;
    trainings.forEach(row => {
      if (row['customer_unique_key'] === customerUniqueKey) {
        // ※ここをより厳密にするなら、payment_methodが'Ticket'のものをカウントすべきですが
        // 既存ロジックを踏襲し、単純にレッスン数＝消費数とします。
        totalUsed++;
      }
    });

    return {
      purchased: totalPurchased,
      used: totalUsed,
      balance: totalPurchased - totalUsed
    };
  },

  /**
   * [Private] シートデータをオブジェクト配列化 (main.gsのロジックと同じ)
   */
  _getSheetData: function(sheet) {
    if (!sheet) return [];
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return [];
    const headers = values[0];
    const data = [];
    const map = {};
    headers.forEach((h, i) => map[String(h).trim()] = i);
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowObj = {};
      for (let key in map) {
        rowObj[key] = row[map[key]];
      }
      data.push(rowObj);
    }
    return data;
  }
};