/**
 * ============================================================================
 * K9 Harmony - Sale Repository
 * ============================================================================
 * ファイル名: SaleRepository.gs
 * 役割: 売上情報のCRUD操作 + 集計機能
 * 最終更新: 2026-01-02
 * バージョン: v1.0.0
 */

// ============================================================================
// 売上リポジトリ
// ============================================================================

var SaleRepository = {
  
  /**
   * 売上作成（通常はPaymentRepository.capture()から自動実行）
   * @param {Object} data 売上データ
   * @return {Object} 作成された売上データ
   */
  create: function(data) {
    var context = { service: 'SaleRepository', action: 'create' };
    
    try {
      // 1. 必須フィールドチェック
      Validator.required(data.sales_amount, 'sales_amount');
      Validator.required(data.sale_date, 'sale_date');
      
      // 2. ID生成
      data.sale_id = Utilities.getUuid();
      
      // 3. デフォルト値設定
      data.created_at = new Date();
      data.updated_at = new Date();
      
      // 4. DB登録
      DB.insert(CONFIG.SHEET.SALES, data);
      
      log('INFO', 'SaleRepository', 'Sale created: ' + data.sale_id);
      
      return data;
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 売上検索（ID）
   */
  findById: function(saleId) {
    try {
      var sale = DB.findById(CONFIG.SHEET.SALES, saleId);
      
      if (!sale) {
        throw ErrorHandler.notFoundError('Sale', saleId);
      }
      
      return sale;
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'SaleRepository', action: 'findById' });
    }
  },
  
  /**
   * 顧客の売上一覧取得
   */
  findByCustomerId: function(customerId) {
    try {
      return DB.findBy(CONFIG.SHEET.SALES, 'customer_id', customerId);
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'SaleRepository', action: 'findByCustomerId' });
    }
  },
  
  /**
   * 日付範囲で売上検索
   */
  findByDateRange: function(startDate, endDate) {
    try {
      var sales = DB.fetchTable(CONFIG.SHEET.SALES);
      
      return sales.filter(function(s) {
        var saleDate = new Date(s.sale_date);
        return saleDate >= startDate && saleDate <= endDate;
      });
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'SaleRepository', action: 'findByDateRange' });
    }
  },
  
  /**
   * 月次売上取得
   */
  findByMonth: function(year, month) {
    var startDate = new Date(year, month - 1, 1);
    var endDate = new Date(year, month, 0, 23, 59, 59);
    
    return this.findByDateRange(startDate, endDate);
  },
  
  /**
   * 年次売上取得
   */
  findByYear: function(year) {
    var startDate = new Date(year, 0, 1);
    var endDate = new Date(year, 11, 31, 23, 59, 59);
    
    return this.findByDateRange(startDate, endDate);
  },
  
  /**
   * 売上更新
   */
  update: function(saleId, data) {
    var context = { service: 'SaleRepository', action: 'update' };
    
    try {
      var oldData = this.findById(saleId);
      
      if (oldData.error) {
        throw oldData;
      }
      
      data.updated_at = new Date();
      
      DB.update(CONFIG.SHEET.SALES, saleId, data);
      
      log('INFO', 'SaleRepository', 'Sale updated: ' + saleId);
      
      return this.findById(saleId);
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  /**
   * 月次売上サマリー
   */
  getMonthlySummary: function(year, month) {
    try {
      var sales = this.findByMonth(year, month);
      
      var summary = {
        year: year,
        month: month,
        count: sales.length,
        total_sales: 0,
        total_tax: 0,
        average_sale: 0
      };
      
      sales.forEach(function(s) {
        summary.total_sales += s.sales_amount || 0;
        summary.total_tax += s.tax_amount || 0;
      });
      
      summary.average_sale = sales.length > 0 ? Math.round(summary.total_sales / sales.length) : 0;
      
      return summary;
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'SaleRepository', action: 'getMonthlySummary' });
    }
  },
  
  /**
   * 年次売上サマリー
   */
  getAnnualSummary: function(year) {
    try {
      var sales = this.findByYear(year);
      
      var summary = {
        year: year,
        count: sales.length,
        total_sales: 0,
        total_tax: 0,
        average_sale: 0,
        monthly_breakdown: []
      };
      
      // 全体集計
      sales.forEach(function(s) {
        summary.total_sales += s.sales_amount || 0;
        summary.total_tax += s.tax_amount || 0;
      });
      
      summary.average_sale = sales.length > 0 ? Math.round(summary.total_sales / sales.length) : 0;
      
      // 月別集計
      for (var month = 1; month <= 12; month++) {
        var monthlySummary = this.getMonthlySummary(year, month);
        summary.monthly_breakdown.push(monthlySummary);
      }
      
      return summary;
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'SaleRepository', action: 'getAnnualSummary' });
    }
  },
  
  /**
   * 顧客別売上ランキング
   */
  getCustomerRanking: function(year) {
    try {
      var sales = year ? this.findByYear(year) : DB.fetchTable(CONFIG.SHEET.SALES);
      
      // 顧客別に集計
      var customerSales = {};
      sales.forEach(function(s) {
        if (!s.customer_id) return;
        
        if (!customerSales[s.customer_id]) {
          customerSales[s.customer_id] = {
            customer_id: s.customer_id,
            total_sales: 0,
            count: 0
          };
        }
        
        customerSales[s.customer_id].total_sales += s.sales_amount || 0;
        customerSales[s.customer_id].count++;
      });
      
      // 配列に変換してソート
      var ranking = Object.keys(customerSales).map(function(customerId) {
        var data = customerSales[customerId];
        
        // 顧客名を取得
        var customer = CustomerRepository.findById(customerId);
        data.customer_name = customer.error ? 'Unknown' : customer.customer_name;
        data.customer_code = customer.error ? '' : customer.customer_code;
        
        return data;
      });
      
      ranking.sort(function(a, b) {
        return b.total_sales - a.total_sales;
      });
      
      return ranking;
      
    } catch (error) {
      return ErrorHandler.handle(error, { service: 'SaleRepository', action: 'getCustomerRanking' });
    }
  }
};

// ============================================================================
// テスト関数
// ============================================================================

/**
 * 売上サマリーテスト
 */
function testSaleSummary() {
  console.log('=== Sale Summary Test ===\n');
  
  var currentYear = new Date().getFullYear();
  var currentMonth = new Date().getMonth() + 1;
  
  // 月次サマリー
  console.log('Monthly Summary (' + currentYear + '/' + currentMonth + '):');
  var monthlySummary = SaleRepository.getMonthlySummary(currentYear, currentMonth);
  
  console.log('  Count:', monthlySummary.count);
  console.log('  Total Sales: ¥' + monthlySummary.total_sales.toLocaleString());
  console.log('  Total Tax: ¥' + monthlySummary.total_tax.toLocaleString());
  console.log('  Average: ¥' + monthlySummary.average_sale.toLocaleString());
  
  // 年次サマリー
  console.log('\nAnnual Summary (' + currentYear + '):');
  var annualSummary = SaleRepository.getAnnualSummary(currentYear);
  
  console.log('  Count:', annualSummary.count);
  console.log('  Total Sales: ¥' + annualSummary.total_sales.toLocaleString());
  console.log('  Total Tax: ¥' + annualSummary.total_tax.toLocaleString());
  console.log('  Average: ¥' + annualSummary.average_sale.toLocaleString());
}

/**
 * 顧客ランキングテスト
 */
function testCustomerRanking() {
  console.log('\n=== Customer Ranking Test ===\n');
  
  var currentYear = new Date().getFullYear();
  var ranking = SaleRepository.getCustomerRanking(currentYear);
  
  console.log('Top Customers (' + currentYear + '):');
  
  var top10 = ranking.slice(0, 10);
  top10.forEach(function(customer, index) {
    console.log((index + 1) + '. ' + customer.customer_code + ' ' + customer.customer_name);
    console.log('   Total: ¥' + customer.total_sales.toLocaleString() + ' (' + customer.count + ' transactions)');
  });
}

/**
 * 全テスト実行
 */
function testSaleRepository() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Sale Repository Test Suite               ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  testSaleSummary();
  testCustomerRanking();
  
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   Test Suite Completed                     ║');
  console.log('╚════════════════════════════════════════════╝');
}