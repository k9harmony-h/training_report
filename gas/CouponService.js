/**
 * ============================================================================
 * K9 Harmony - Coupon Service
 * ============================================================================
 * ファイル名: CouponService.js
 * 役割: クーポンの取得・適用・検証
 * 最終更新: 2026-01-26
 * バージョン: v1.0.0
 */

var CouponService = {

  /**
   * 自動適用可能なクーポンを取得
   * @param {string} productId - 商品ID
   * @param {number} amount - 購入金額
   * @param {Date|string} reservationDate - 予約日
   * @return {Object|null} 適用可能なクーポン（最も割引額が大きいもの）
   */
  getAutoApplicableCoupon: function(productId, amount, reservationDate) {
    var context = { service: 'CouponService', action: 'getAutoApplicableCoupon' };

    try {
      log('INFO', 'CouponService', 'Getting auto-applicable coupon', {
        productId: productId,
        amount: amount,
        reservationDate: reservationDate
      });

      var coupons = DB.fetchTable(CONFIG.SHEET.COUPONS);
      var today = new Date();
      today.setHours(0, 0, 0, 0);

      // 有効なクーポンをフィルタ
      var validCoupons = coupons.filter(function(coupon) {
        // ステータスチェック
        if (coupon.coupon_status !== 'ACTIVE') return false;

        // 自動適用チェック
        if (!coupon.auto_apply) return false;

        // 期間チェック
        var startDate = new Date(coupon.coupon_start_date);
        var endDate = new Date(coupon.coupon_end_date);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        if (today < startDate || today > endDate) return false;

        // 対象商品チェック
        if (coupon.applicable_products !== 'ALL') {
          var applicableProducts = String(coupon.applicable_products).split(',').map(function(p) {
            return p.trim();
          });
          if (applicableProducts.indexOf(productId) === -1) return false;
        }

        // 最低購入金額チェック
        if (coupon.min_amount && amount < coupon.min_amount) return false;

        // 利用上限チェック
        if (coupon.max_use && coupon.current_uses >= coupon.max_use) return false;

        return true;
      });

      if (validCoupons.length === 0) {
        log('INFO', 'CouponService', 'No auto-applicable coupon found');
        return null;
      }

      // 割引額を計算して最大のものを選択
      var bestCoupon = null;
      var maxDiscount = 0;

      validCoupons.forEach(function(coupon) {
        var discount = CouponService.calculateDiscount(coupon, amount);
        if (discount > maxDiscount) {
          maxDiscount = discount;
          bestCoupon = coupon;
        }
      });

      if (bestCoupon) {
        log('INFO', 'CouponService', 'Auto-applicable coupon found', {
          coupon_id: bestCoupon.coupon_id,
          discount: maxDiscount
        });

        return {
          coupon_id: bestCoupon.coupon_id,
          coupon_code: bestCoupon.coupon_code,
          coupon_name: bestCoupon.coupon_name,
          discount_type: bestCoupon.discount_type,
          discount_value: bestCoupon.discount_value,
          discount_amount: maxDiscount
        };
      }

      return null;

    } catch (error) {
      log('ERROR', 'CouponService', 'Failed to get auto-applicable coupon', {
        error: error.message
      });
      return null;
    }
  },

  /**
   * クーポンコードで検証・取得
   * @param {string} couponCode - クーポンコード
   * @param {string} productId - 商品ID
   * @param {number} amount - 購入金額
   * @return {Object} 検証結果
   */
  validateCouponCode: function(couponCode, productId, amount) {
    var context = { service: 'CouponService', action: 'validateCouponCode' };

    try {
      log('INFO', 'CouponService', 'Validating coupon code', { couponCode: couponCode });

      var coupons = DB.fetchTable(CONFIG.SHEET.COUPONS);
      var coupon = coupons.find(function(c) {
        return c.coupon_code === couponCode;
      });

      if (!coupon) {
        return { valid: false, message: 'クーポンコードが見つかりません' };
      }

      // ステータスチェック
      if (coupon.coupon_status !== 'ACTIVE') {
        return { valid: false, message: 'このクーポンは現在ご利用いただけません' };
      }

      // 期間チェック
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var startDate = new Date(coupon.coupon_start_date);
      var endDate = new Date(coupon.coupon_end_date);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      if (today < startDate) {
        return { valid: false, message: 'このクーポンはまだご利用開始前です' };
      }
      if (today > endDate) {
        return { valid: false, message: 'このクーポンの有効期限が終了しております' };
      }

      // 対象商品チェック
      if (coupon.applicable_products !== 'ALL') {
        var applicableProducts = String(coupon.applicable_products).split(',').map(function(p) {
          return p.trim();
        });
        if (applicableProducts.indexOf(productId) === -1) {
          return { valid: false, message: 'このクーポンは選択中のコースにはご利用いただけません' };
        }
      }

      // 最低購入金額チェック
      if (coupon.min_amount && amount < coupon.min_amount) {
        return {
          valid: false,
          message: '¥' + coupon.min_amount.toLocaleString() + '以上のご購入でご利用いただけます'
        };
      }

      // 利用上限チェック
      if (coupon.max_use && coupon.current_uses >= coupon.max_use) {
        return { valid: false, message: 'このクーポンは利用上限に達しております' };
      }

      // 有効
      var discount = this.calculateDiscount(coupon, amount);

      return {
        valid: true,
        coupon: {
          coupon_id: coupon.coupon_id,
          coupon_code: coupon.coupon_code,
          coupon_name: coupon.coupon_name,
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
          discount_amount: discount
        }
      };

    } catch (error) {
      log('ERROR', 'CouponService', 'Coupon validation failed', { error: error.message });
      return { valid: false, message: 'クーポンの検証中にエラーが発生しました' };
    }
  },

  /**
   * 割引額を計算
   * @param {Object} coupon - クーポンオブジェクト
   * @param {number} amount - 購入金額
   * @return {number} 割引額
   */
  calculateDiscount: function(coupon, amount) {
    if (coupon.discount_type === 'FIXED') {
      return Math.min(coupon.discount_value, amount);
    } else if (coupon.discount_type === 'PERCENTAGE') {
      return Math.floor(amount * coupon.discount_value / 100);
    }
    return 0;
  },

  /**
   * クーポン使用回数を増加
   * @param {string} couponId - クーポンID
   */
  incrementUsage: function(couponId) {
    var context = { service: 'CouponService', action: 'incrementUsage' };

    try {
      var coupons = DB.fetchTable(CONFIG.SHEET.COUPONS);
      var coupon = coupons.find(function(c) {
        return c.coupon_id === couponId;
      });

      if (!coupon) {
        log('WARN', 'CouponService', 'Coupon not found for increment', { couponId: couponId });
        return;
      }

      var newCount = (coupon.current_uses || 0) + 1;

      DB.update(CONFIG.SHEET.COUPONS, couponId, {
        current_uses: newCount,
        updated_at: new Date()
      });

      log('INFO', 'CouponService', 'Coupon usage incremented', {
        couponId: couponId,
        newCount: newCount
      });

    } catch (error) {
      log('ERROR', 'CouponService', 'Failed to increment coupon usage', {
        couponId: couponId,
        error: error.message
      });
    }
  },

  /**
   * 全ての有効なクーポン一覧を取得（管理用）
   * @return {Array} 有効なクーポン一覧
   */
  getActiveCoupons: function() {
    var coupons = DB.fetchTable(CONFIG.SHEET.COUPONS);
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    return coupons.filter(function(coupon) {
      if (coupon.coupon_status !== 'ACTIVE') return false;

      var endDate = new Date(coupon.coupon_end_date);
      endDate.setHours(23, 59, 59, 999);

      return today <= endDate;
    });
  }
};
