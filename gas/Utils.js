/**
 * ============================================================================
 * K9 Harmony - Utilities (Enhanced with Log Manager)
 * ============================================================================
 * ファイル名: Utils.gs
 * 役割: 基本的なDB操作とログ管理
 * 最終更新: 2026-01-09
 * バージョン: v2.0.1 (RESERVATION_LOCKS対応)
 * 
 * 変更内容:
 * - RESERVATION_LOCKS を transSheets に追加
 */

// ============================================================================
// ログレベル定義
// ============================================================================

var LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
};

// ============================================================================
// ログマネージャー
// ============================================================================

var LogManager = {
  currentLevel: LogLevel.INFO,
  consoleEnabled: true,
  sheetEnabled: true,
  rotationDays: 7,
  
  setLevel: function(level) {
    if (typeof level === 'string') {
      switch (level) {
        case 'DEBUG': this.currentLevel = LogLevel.DEBUG; break;
        case 'INFO': this.currentLevel = LogLevel.INFO; break;
        case 'WARN': this.currentLevel = LogLevel.WARN; break;
        case 'ERROR': this.currentLevel = LogLevel.ERROR; break;
        case 'CRITICAL': this.currentLevel = LogLevel.CRITICAL; break;
      }
    } else {
      this.currentLevel = level;
    }
    console.log('Log level set to:', level);
  },
  
  rotateLog: function() {
    try {
      log('INFO', 'LogManager', 'Starting log rotation');
      
      var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET.MASTER_ID);
      var sheet = ss.getSheetByName(CONFIG.SHEET.SYSTEM_LOGS);
      
      if (!sheet) {
        throw new Error('System log sheet not found');
      }
      
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var timestampColIndex = headers.indexOf('timestamp');
      
      if (timestampColIndex === -1) {
        throw new Error('Timestamp column not found');
      }
      
      var now = new Date();
      var cutoffDate = new Date(now.getTime() - (this.rotationDays * 24 * 60 * 60 * 1000));
      var rowsToDelete = [];
      
      for (var i = 1; i < data.length; i++) {
        var timestamp = new Date(data[i][timestampColIndex]);
        if (timestamp < cutoffDate) {
          rowsToDelete.push(i + 1);
        }
      }
      
      rowsToDelete.reverse();
      var deletedCount = 0;
      
      rowsToDelete.forEach(function(rowNum) {
        sheet.deleteRow(rowNum);
        deletedCount++;
      });
      
      log('INFO', 'LogManager', 'Log rotation completed', { deletedRows: deletedCount });
      
      return { success: true, deletedRows: deletedCount };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  getErrorStatistics: function(days) {
    try {
      days = days || 7;
      
      var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET.MASTER_ID);
      var sheet = ss.getSheetByName(CONFIG.SHEET.SYSTEM_LOGS);
      
      if (!sheet) {
        throw new Error('System log sheet not found');
      }
      
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var timestampColIndex = headers.indexOf('timestamp');
      var levelColIndex = headers.indexOf('level');
      var sourceColIndex = headers.indexOf('function');
      
      var now = new Date();
      var startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
      
      var stats = {
        period: days + ' days',
        total: 0,
        byLevel: { INFO: 0, WARN: 0, ERROR: 0, CRITICAL: 0 },
        bySource: {},
        recentErrors: []
      };
      
      for (var i = 1; i < data.length; i++) {
        var timestamp = new Date(data[i][timestampColIndex]);
        if (timestamp < startDate) continue;
        
        var level = data[i][levelColIndex];
        var source = data[i][sourceColIndex];
        
        stats.total++;
        
        if (stats.byLevel[level] !== undefined) {
          stats.byLevel[level]++;
        }
        
        if (!stats.bySource[source]) {
          stats.bySource[source] = 0;
        }
        stats.bySource[source]++;
        
        if ((level === 'ERROR' || level === 'CRITICAL') && stats.recentErrors.length < 10) {
          stats.recentErrors.push({
            timestamp: timestamp,
            level: level,
            source: source,
            message: data[i][headers.indexOf('message')]
          });
        }
      }
      
      stats.errorRate = stats.total > 0 
        ? ((stats.byLevel.ERROR + stats.byLevel.CRITICAL) / stats.total * 100).toFixed(2)
        : 0;
      
      return { success: true, statistics: stats };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// ログ関数
// ============================================================================

/**
 * ログ出力（強化版）
 * @param {string} level ログレベル ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL')
 * @param {string} service サービス名
 * @param {string} message メッセージ
 * @param {Object} data 追加データ（オプション）
 */
function log(level, service, message, data) {
  try {
    // ログレベル数値化
    var levelNum;
    switch (level) {
      case 'DEBUG': levelNum = LogLevel.DEBUG; break;
      case 'INFO': levelNum = LogLevel.INFO; break;
      case 'WARN': levelNum = LogLevel.WARN; break;
      case 'ERROR': levelNum = LogLevel.ERROR; break;
      case 'CRITICAL': levelNum = LogLevel.CRITICAL; break;
      default: levelNum = LogLevel.INFO;
    }
    
    // 現在のレベルより低ければスキップ
    if (levelNum < LogManager.currentLevel) {
      return;
    }
    
    // コンソール出力
    if (LogManager.consoleEnabled) {
      var timestamp = Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd HH:mm:ss');
      var logMessage = '[' + timestamp + '] [' + level + '] [' + service + '] ' + message;
      
      switch (level) {
        case 'DEBUG':
        case 'INFO':
          console.log(logMessage);
          break;
        case 'WARN':
          console.warn(logMessage);
          break;
        case 'ERROR':
        case 'CRITICAL':
          console.error(logMessage);
          break;
        default:
          console.log(logMessage);
      }
      
      if (data && Object.keys(data).length > 0) {
        console.log('Data:', data);
      }
    }
    
    // スプレッドシート書き込み（INFO以上）
    if (LogManager.sheetEnabled && levelNum >= LogLevel.INFO) {
      try {
        var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET.MASTER_ID);
        var sheet = ss.getSheetByName(CONFIG.SHEET.SYSTEM_LOGS);
        
        if (sheet) {
          sheet.appendRow([
            new Date(),
            level,
            service,
            message,
            data ? JSON.stringify(data) : ''
          ]);
        }
      } catch (e) {
        console.error('Failed to write to System Logs:', e.message);
      }
    }
    
  } catch (error) {
    console.error('Log failed:', error.message);
  }
}

// ============================================================================
// テーブルキャッシュ（Phase 3最適化）
// ============================================================================

/**
 * テーブルデータをメモリキャッシュ＆CacheServiceでキャッシュ
 * 同一リクエスト内での複数回読み込みを防止
 */
var TableCache = {
  TTL_SECONDS: 300,  // 5分
  _memoryCache: {},  // リクエスト内メモリキャッシュ

  /**
   * テーブルデータを取得（キャッシュ優先）
   * @param {string} sheetName シート名
   * @return {Array<Object>} データ配列
   */
  getTable: function(sheetName) {
    // 1. メモリキャッシュ確認（同一リクエスト内の重複読み込み防止）
    if (this._memoryCache[sheetName]) {
      return this._memoryCache[sheetName];
    }

    // 2. CacheService確認（リクエスト間のキャッシュ）
    var cacheKey = 'TBL_' + sheetName;
    try {
      var cached = CacheService.getScriptCache().get(cacheKey);
      if (cached) {
        var data = JSON.parse(cached);
        this._memoryCache[sheetName] = data;
        return data;
      }
    } catch (e) {
      // キャッシュ読み込みエラーは無視
      log('DEBUG', 'TableCache', 'Cache read error', { sheetName: sheetName, error: e.message });
    }

    // 3. DBから読み込み
    var data = DB.fetchTable(sheetName);

    // 4. キャッシュに保存
    this._memoryCache[sheetName] = data;
    try {
      var jsonData = JSON.stringify(data);
      // CacheServiceの容量制限（100KB）を超える場合はスキップ
      if (jsonData.length < 100000) {
        CacheService.getScriptCache().put(cacheKey, jsonData, this.TTL_SECONDS);
      }
    } catch (e) {
      // キャッシュ書き込みエラーは無視
      log('DEBUG', 'TableCache', 'Cache write error', { sheetName: sheetName, error: e.message });
    }

    return data;
  },

  /**
   * 特定のテーブルキャッシュをクリア
   * @param {string} sheetName シート名
   */
  invalidate: function(sheetName) {
    delete this._memoryCache[sheetName];
    try {
      CacheService.getScriptCache().remove('TBL_' + sheetName);
    } catch (e) {
      // エラーは無視
    }
  },

  /**
   * 全キャッシュクリア
   */
  invalidateAll: function() {
    this._memoryCache = {};
    // CacheServiceの一括クリアはAPIがないため、個別にクリアする必要がある
  }
};

// ============================================================================
// DB操作関数（簡易版）
// ============================================================================

const DB = {
  
  /**
   * テーブル全体を取得
   * @param {string} sheetName シート名
   * @return {Array<Object>} データ配列
   */
  fetchTable: function(sheetName) {
    try {
      const ss = this._getSpreadsheet(sheetName);
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        throw new Error(`Sheet not found: ${sheetName}`);
      }
      
      const data = sheet.getDataRange().getValues();
      
      if (data.length === 0) {
        return [];
      }
      
      const headers = data[0];
      const rows = data.slice(1);
      
      return rows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });
      
    } catch (e) {
      log('ERROR', 'DB', `Failed to fetch table: ${sheetName}`, { error: e.message });
      throw e;
    }
  },
  
  /**
   * IDで検索
   * @param {string} sheetName シート名
   * @param {string} id ID値
   * @return {Object|null} データオブジェクト
   */
  findById: function(sheetName, id) {
    const data = this.fetchTable(sheetName);
    
    // 最初のカラムがIDと仮定
    return data.find(row => Object.values(row)[0] === id) || null;
  },
  
  /**
   * カラムで検索
   * @param {string} sheetName シート名
   * @param {string} column カラム名
   * @param {any} value 検索値
   * @return {Array<Object>} マッチしたデータ配列
   */
  findBy: function(sheetName, column, value) {
    const data = this.fetchTable(sheetName);
    return data.filter(row => row[column] === value);
  },
  
  /**
   * データ挿入
   * @param {string} sheetName シート名
   * @param {Object} data データオブジェクト
   */
  insert: function(sheetName, data) {
    try {
      const ss = this._getSpreadsheet(sheetName);
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        throw new Error(`Sheet not found: ${sheetName}`);
      }
      
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const row = headers.map(header => data[header] !== undefined ? data[header] : '');
      
      sheet.appendRow(row);
      
      log('INFO', 'DB', `Inserted into ${sheetName}`);
      
    } catch (e) {
      log('ERROR', 'DB', `Failed to insert into ${sheetName}`, { error: e.message });
      throw e;
    }
  },
  
  /**
   * データ更新
   * @param {string} sheetName シート名
   * @param {string} id ID値
   * @param {Object} data 更新データ
   */
  update: function(sheetName, id, data) {
    try {
      const ss = this._getSpreadsheet(sheetName);
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        throw new Error(`Sheet not found: ${sheetName}`);
      }
      
      const allData = sheet.getDataRange().getValues();
      const headers = allData[0];
      const idColumnIndex = 0; // 最初のカラムがIDと仮定
      
      // IDでマッチする行を検索
      const rowIndex = allData.findIndex((row, index) => 
        index > 0 && row[idColumnIndex] === id
      );
      
      if (rowIndex === -1) {
        throw new Error(`Record not found: ${id}`);
      }
      
      // 更新対象のカラムを特定して更新
      Object.keys(data).forEach(key => {
        const columnIndex = headers.indexOf(key);
        if (columnIndex !== -1) {
          sheet.getRange(rowIndex + 1, columnIndex + 1).setValue(data[key]);
        }
      });
      
      log('INFO', 'DB', `Updated ${sheetName} record: ${id}`);

    } catch (e) {
      log('ERROR', 'DB', `Failed to update ${sheetName}`, { error: e.message });
      throw e;
    }
  },

  /**
   * データ削除（行削除）
   * @param {string} sheetName シート名
   * @param {string} id ID値
   */
  deleteById: function(sheetName, id) {
    try {
      const ss = this._getSpreadsheet(sheetName);
      const sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        throw new Error(`Sheet not found: ${sheetName}`);
      }

      const allData = sheet.getDataRange().getValues();
      const idColumnIndex = 0; // 最初のカラムがIDと仮定

      // IDでマッチする行を検索
      const rowIndex = allData.findIndex((row, index) =>
        index > 0 && row[idColumnIndex] === id
      );

      if (rowIndex === -1) {
        log('WARN', 'DB', `Record not found for deletion: ${id}`);
        return false;
      }

      // 行を削除（rowIndexは0始まり、シートは1始まり）
      sheet.deleteRow(rowIndex + 1);

      log('INFO', 'DB', `Deleted from ${sheetName}: ${id}`);
      return true;

    } catch (e) {
      log('ERROR', 'DB', `Failed to delete from ${sheetName}`, { error: e.message });
      throw e;
    }
  },

/**
 * スプレッドシート取得（内部用）
 */
_getSpreadsheet: function(sheetName) {
  // マスターシートの判定
  const masterSheets = [
    CONFIG.SHEET.CUSTOMERS,
    CONFIG.SHEET.DOGS,
    CONFIG.SHEET.TRAINERS,
    CONFIG.SHEET.OFFICES,
    CONFIG.SHEET.PRODUCTS,
    CONFIG.SHEET.COUPONS,
    CONFIG.SHEET.SYSTEM_CONFIG,
    CONFIG.SHEET.SYSTEM_LOGS,
    CONFIG.SHEET.MILESTONE_DEFINITIONS
  ];

  // トランザクションシートの判定
  const transSheets = [
    CONFIG.SHEET.RESERVATIONS,
    CONFIG.SHEET.PAYMENTS,
    CONFIG.SHEET.LESSONS,
    CONFIG.SHEET.SALES,
    CONFIG.SHEET.EXPENSES,
    CONFIG.SHEET.PROCUREMENTS,
    CONFIG.SHEET.RESERVATION_LOCKS,
    CONFIG.SHEET.TRANSACTION_LOG,
    CONFIG.SHEET.TRANSACTION_QUEUE,
    CONFIG.SHEET.RETRY_LOGS,
    CONFIG.SHEET.MILESTONE_LOGS
  ];
  
  if (masterSheets.includes(sheetName)) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET.MASTER_ID);
  } else if (transSheets.includes(sheetName)) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET.TRANS_ID);
  } else {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET.ANALYTICS_ID);
  }
}
};

// ============================================================================
// テスト関数
// ============================================================================

/**
 * テスト1: Config検証
 */
function test1_ValidateConfig() {
  console.log('=== Test 1: Config Validation ===');
  
  try {
    const result = validateConfig();
    console.log('✅ Config validation:', result ? 'PASSED' : 'FAILED');
  } catch (e) {
    console.error('❌ Config validation FAILED:', e.message);
  }
}

/**
 * テスト2: DB接続テスト
 */
function test2_DatabaseConnection() {
  console.log('\n=== Test 2: Database Connection ===');
  
  try {
    // Masterスプレッドシート
    const masterSS = SpreadsheetApp.openById(CONFIG.SPREADSHEET.MASTER_ID);
    console.log('✅ Master Spreadsheet:', masterSS.getName());
    
    // Transactionsスプレッドシート
    const transSS = SpreadsheetApp.openById(CONFIG.SPREADSHEET.TRANS_ID);
    console.log('✅ Transactions Spreadsheet:', transSS.getName());
    
    // Analyticsスプレッドシート
    const analyticsSS = SpreadsheetApp.openById(CONFIG.SPREADSHEET.ANALYTICS_ID);
    console.log('✅ Analytics Spreadsheet:', analyticsSS.getName());
    
    console.log('✅ All spreadsheets accessible!');
    
  } catch (e) {
    console.error('❌ Database connection FAILED:', e.message);
  }
}

/**
 * 予約枠ロックテスト
 */
function testReservationLocks() {
  console.log('=== Reservation Locks Test ===\n');
  
  try {
    var locks = DB.fetchTable(CONFIG.SHEET.RESERVATION_LOCKS);
    console.log('✅ Reservation locks fetched:', locks.length);
    
    if (locks.length > 0) {
      console.log('First lock:', locks[0]);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}