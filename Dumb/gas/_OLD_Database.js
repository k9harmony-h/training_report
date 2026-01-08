/**
 * Database Access Object (DAO)
 * スプレッドシートの読み書きを抽象化するクラス
 */

const DB = {
  /**
   * スプレッドシートのインスタンスを取得
   */
  getSS: function() {
    return SpreadsheetApp.getActiveSpreadsheet();
  },

  /**
   * 指定したシートの全データを連想配列のリストとして取得
   * @param {string} sheetName - シート名
   * @return {Array<Object>} [{id: 1, name: "hoge"}, ...]
   */
  fetchTable: function(sheetName) {
    const ss = this.getSS();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      SysUtils.log('ERROR', 'DB.fetchTable', `Sheet not found: ${sheetName}`);
      throw new Error(`Sheet not found: ${sheetName}`);
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const headers = data[0];
    const rows = data.slice(1);

    return rows.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        if (header) { 
          obj[header] = row[index];
        }
      });
      return obj;
    });
  },

  /**
   * 特定のカラムの値でレコードを検索し、最初に見つかった1件を返す
   * @param {string} sheetName 
   * @param {string} colName 
   * @param {string} value 
   * @return {Object|null}
   */
  findBy: function(sheetName, colName, value) {
    const table = this.fetchTable(sheetName);
    return table.find(row => row[colName] === value) || null;
  },

  /**
   * 新規レコードを追加
   * @param {string} sheetName 
   * @param {Object} dataObj - { column_name: value, ... }
   * @return {boolean} success
   */
  insert: function(sheetName, dataObj) {
    const ss = this.getSS();
    const sheet = ss.getSheetByName(sheetName);
    
    // ヘッダーを取得して、書き込む順序を決定
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const newRow = headers.map(header => {
      return (dataObj[header] !== undefined) ? dataObj[header] : '';
    });

    try {
      sheet.appendRow(newRow);
      return true;
    } catch (e) {
      SysUtils.log('ERROR', 'DB.insert', e.message, dataObj);
      return false;
    }
  }
};

/* --- テスト実行用 --- */
function testConnection() {
  try {
    // 1. マスタ読み込みテスト
    // ※System_Mastersシートに TAX_RATE が設定されている前提
    const tax = getMasterValue('TAX_RATE');
    console.log(`Tax Rate Check: ${tax}`);

    // 2. 顧客検索テスト
    const customers = DB.fetchTable(SYS_CONFIG.SHEETS.CUSTOMERS);
    console.log(`Customers Count: ${customers.length}`);
    
    // 3. ログ書き込みテスト
    SysUtils.log('INFO', 'testConnection', 'DB Connection Successful (Updated)');
    console.log('Log written.');

  } catch (e) {
    console.error('Test Failed:', e);
  }
}