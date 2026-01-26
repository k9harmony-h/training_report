/**
 * ============================================================================
 * K9 Harmony - Lifecycle Service (Error Handling Unified)
 * ============================================================================
 * バージョン: v2.0.0 - エラーハンドリング統一版
 * 最終更新: 2026-01-04
 */

var LifecycleService = {
  
  STAGE_THRESHOLDS: {
    BRONZE: 0,
    SILVER: 3,
    GOLD: 10,
    PLATINUM: 20,
    DIAMOND: 50
  },
  
  updateCustomerLifecycleStage: function(customerId) {
    var context = { service: 'LifecycleService', action: 'updateCustomerLifecycleStage' };
    
    try {
      log('INFO', 'LifecycleService', 'Updating lifecycle stage: ' + customerId);
      
      var customer = DB.findById(CONFIG.SHEET.CUSTOMERS, customerId);
      
      if (!customer) {
        throw createK9Error(
          ErrorCode.RECORD_NOT_FOUND,
          'Customer not found',
          { customerId: customerId }
        );
      }
      
      var completedLessons = this._getCompletedLessonsCount(customerId);
      var newStage = this._calculateLifecycleStage(completedLessons);
      var oldStage = customer.lifecycle_stage || 'BRONZE';
      
      if (newStage !== oldStage) {
        DB.update(CONFIG.SHEET.CUSTOMERS, customerId, {
          lifecycle_stage: newStage,
          lifecycle_updated_at: new Date(),
          updated_at: new Date()
        });
        
        log('INFO', 'LifecycleService', 'Lifecycle stage updated: ' + oldStage + ' → ' + newStage);
        
        if (typeof NotificationService !== 'undefined' && customer.line_user_id) {
          this._sendStageUpNotification(customer, oldStage, newStage, completedLessons);
        }
        
        return {
          success: true,
          oldStage: oldStage,
          newStage: newStage,
          completedLessons: completedLessons,
          message: 'ライフサイクルステージを更新しました'
        };
      }
      
      return {
        success: true,
        stage: oldStage,
        completedLessons: completedLessons,
        message: 'ステージに変更はありません'
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  updateAllCustomerLifecycleStages: function() {
    var context = { service: 'LifecycleService', action: 'updateAllCustomerLifecycleStages' };
    
    try {
      log('INFO', 'LifecycleService', 'Batch updating all lifecycle stages');
      
      var customers = DB.fetchTable(CONFIG.SHEET.CUSTOMERS);
      
      var updatedCount = 0;
      var unchangedCount = 0;
      var errorCount = 0;
      
      customers.forEach(function(customer) {
        if (customer.customer_status !== 'ACTIVE') return;
        
        var result = this.updateCustomerLifecycleStage(customer.customer_id);
        
        if (result.error) {
          errorCount++;
        } else if (result.oldStage !== result.newStage) {
          updatedCount++;
        } else {
          unchangedCount++;
        }
      }.bind(this));
      
      log('INFO', 'LifecycleService', 'Batch update completed: ' + updatedCount + ' updated, ' + unchangedCount + ' unchanged, ' + errorCount + ' errors');
      
      return {
        success: true,
        updatedCount: updatedCount,
        unchangedCount: unchangedCount,
        errorCount: errorCount
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  getCustomerEngagementMetrics: function(customerId) {
    var context = { service: 'LifecycleService', action: 'getCustomerEngagementMetrics' };
    
    try {
      var customer = DB.findById(CONFIG.SHEET.CUSTOMERS, customerId);
      
      if (!customer) {
        throw createK9Error(
          ErrorCode.RECORD_NOT_FOUND,
          'Customer not found',
          { customerId: customerId }
        );
      }
      
      var completedLessons = this._getCompletedLessonsCount(customerId);
      var totalReservations = this._getTotalReservationsCount(customerId);
      var cancelledReservations = this._getCancelledReservationsCount(customerId);
      var noShowCount = this._getNoShowCount(customerId);
      
      var lastLesson = this._getLastLessonDate(customerId);
      var daysSinceLastLesson = lastLesson ? Math.floor((new Date() - new Date(lastLesson)) / (1000 * 60 * 60 * 24)) : null;
      
      var totalSpent = this._getTotalSpent(customerId);
      
      var cancellationRate = totalReservations > 0 ? (cancelledReservations / totalReservations * 100).toFixed(1) : 0;
      var completionRate = totalReservations > 0 ? (completedLessons / totalReservations * 100).toFixed(1) : 0;
      
      var engagementScore = this._calculateEngagementScore({
        completedLessons: completedLessons,
        daysSinceLastLesson: daysSinceLastLesson,
        cancellationRate: parseFloat(cancellationRate),
        noShowCount: noShowCount
      });
      
      var churnRisk = this._calculateChurnRisk({
        daysSinceLastLesson: daysSinceLastLesson,
        cancellationRate: parseFloat(cancellationRate),
        noShowCount: noShowCount,
        engagementScore: engagementScore
      });
      
      return {
        success: true,
        metrics: {
          customer_id: customerId,
          customer_name: customer.customer_name,
          lifecycle_stage: customer.lifecycle_stage || 'BRONZE',
          completed_lessons: completedLessons,
          total_reservations: totalReservations,
          cancelled_reservations: cancelledReservations,
          no_show_count: noShowCount,
          cancellation_rate: parseFloat(cancellationRate),
          completion_rate: parseFloat(completionRate),
          last_lesson_date: lastLesson,
          days_since_last_lesson: daysSinceLastLesson,
          total_spent: totalSpent,
          engagement_score: engagementScore,
          churn_risk: churnRisk
        }
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  identifyChurnRiskCustomers: function() {
    var context = { service: 'LifecycleService', action: 'identifyChurnRiskCustomers' };
    
    try {
      log('INFO', 'LifecycleService', 'Identifying churn risk customers');
      
      var customers = DB.fetchTable(CONFIG.SHEET.CUSTOMERS);
      var churnRiskCustomers = [];
      
      customers.forEach(function(customer) {
        if (customer.customer_status !== 'ACTIVE') return;
        
        var metrics = this.getCustomerEngagementMetrics(customer.customer_id);
        
        if (!metrics.error && metrics.metrics.churn_risk === 'HIGH') {
          churnRiskCustomers.push({
            customer_id: customer.customer_id,
            customer_name: customer.customer_name,
            customer_email: customer.customer_email,
            customer_phone: customer.customer_phone,
            lifecycle_stage: customer.lifecycle_stage,
            days_since_last_lesson: metrics.metrics.days_since_last_lesson,
            engagement_score: metrics.metrics.engagement_score,
            churn_risk: metrics.metrics.churn_risk
          });
        }
      }.bind(this));
      
      churnRiskCustomers.sort(function(a, b) {
        return (b.days_since_last_lesson || 0) - (a.days_since_last_lesson || 0);
      });
      
      log('INFO', 'LifecycleService', 'Found ' + churnRiskCustomers.length + ' churn risk customers');
      
      if (churnRiskCustomers.length > 0 && typeof NotificationService !== 'undefined') {
        NotificationService.sendAdminNotification(
          'Churn Risk Alert',
          churnRiskCustomers.length + ' customers identified as high churn risk',
          'WARN'
        );
      }
      
      return {
        success: true,
        count: churnRiskCustomers.length,
        customers: churnRiskCustomers
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  _getCompletedLessonsCount: function(customerId) {
    var lessons = DB.findBy(CONFIG.SHEET.LESSONS, 'customer_id', customerId);
    
    return lessons.filter(function(lesson) {
      return lesson.lesson_status === 'COMPLETED';
    }).length;
  },
  
  _getTotalReservationsCount: function(customerId) {
    var reservations = DB.findBy(CONFIG.SHEET.RESERVATIONS, 'customer_id', customerId);
    return reservations.length;
  },
  
  _getCancelledReservationsCount: function(customerId) {
    var reservations = DB.findBy(CONFIG.SHEET.RESERVATIONS, 'customer_id', customerId);
    
    return reservations.filter(function(r) {
      return r.reservation_status === 'CANCELLED';
    }).length;
  },
  
  _getNoShowCount: function(customerId) {
    var reservations = DB.findBy(CONFIG.SHEET.RESERVATIONS, 'customer_id', customerId);
    
    return reservations.filter(function(r) {
      return r.reservation_status === 'NO_SHOW';
    }).length;
  },
  
  _getLastLessonDate: function(customerId) {
    var lessons = DB.findBy(CONFIG.SHEET.LESSONS, 'customer_id', customerId);
    
    var completedLessons = lessons.filter(function(lesson) {
      return lesson.lesson_status === 'COMPLETED';
    });
    
    if (completedLessons.length === 0) return null;
    
    completedLessons.sort(function(a, b) {
      return new Date(b.lesson_date) - new Date(a.lesson_date);
    });
    
    return completedLessons[0].lesson_date;
  },
  
  _getTotalSpent: function(customerId) {
    var payments = DB.findBy(CONFIG.SHEET.PAYMENTS, 'customer_id', customerId);
    
    var total = payments.reduce(function(sum, payment) {
      if (payment.payment_status === 'CAPTURED' || payment.payment_status === 'COMPLETED') {
        return sum + (payment.total_amount || 0);
      }
      return sum;
    }, 0);
    
    return total;
  },
  
  _calculateLifecycleStage: function(completedLessons) {
    if (completedLessons >= this.STAGE_THRESHOLDS.DIAMOND) return 'DIAMOND';
    if (completedLessons >= this.STAGE_THRESHOLDS.PLATINUM) return 'PLATINUM';
    if (completedLessons >= this.STAGE_THRESHOLDS.GOLD) return 'GOLD';
    if (completedLessons >= this.STAGE_THRESHOLDS.SILVER) return 'SILVER';
    return 'BRONZE';
  },
  
  _calculateEngagementScore: function(data) {
    var score = 100;
    
    if (data.daysSinceLastLesson !== null) {
      if (data.daysSinceLastLesson > 90) score -= 40;
      else if (data.daysSinceLastLesson > 60) score -= 30;
      else if (data.daysSinceLastLesson > 30) score -= 20;
      else if (data.daysSinceLastLesson > 14) score -= 10;
    } else {
      score -= 20;
    }
    
    if (data.cancellationRate > 50) score -= 30;
    else if (data.cancellationRate > 30) score -= 20;
    else if (data.cancellationRate > 15) score -= 10;
    
    score -= data.noShowCount * 15;
    
    score += Math.min(data.completedLessons * 2, 30);
    
    return Math.max(0, Math.min(100, score));
  },
  
  _calculateChurnRisk: function(data) {
    if (data.daysSinceLastLesson === null) return 'MEDIUM';
    
    if (data.daysSinceLastLesson > 90 || data.engagementScore < 30 || data.noShowCount >= 3) {
      return 'HIGH';
    }
    
    if (data.daysSinceLastLesson > 60 || data.engagementScore < 50 || data.cancellationRate > 30) {
      return 'MEDIUM';
    }
    
    return 'LOW';
  },
  
  _sendStageUpNotification: function(customer, oldStage, newStage, completedLessons) {
    try {
      var stageNames = {
        'BRONZE': 'ブロンズ',
        'SILVER': 'シルバー',
        'GOLD': 'ゴールド',
        'PLATINUM': 'プラチナ',
        'DIAMOND': 'ダイヤモンド'
      };
      
      var message = {
        type: 'text',
        text: customer.customer_name + ' 様\n\n' +
              '🎉 ステージアップおめでとうございます！\n\n' +
              stageNames[oldStage] + ' → ' + stageNames[newStage] + '\n\n' +
              'これまでに ' + completedLessons + ' 回のレッスンを\n' +
              '受講いただきました。\n\n' +
              'これからもK9 Harmonyを\n' +
              'よろしくお願いいたします🐾'
      };
      
      NotificationService._sendLineMessage(customer.line_user_id, message);
      
      log('INFO', 'LifecycleService', 'Stage up notification sent to: ' + customer.customer_name);
      
    } catch (error) {
      log('ERROR', 'LifecycleService', 'Failed to send stage up notification: ' + error.message);
    }
  }
};

function updateDailyLifecycleStages() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Daily Lifecycle Stage Update             ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  try {
    var result = LifecycleService.updateAllCustomerLifecycleStages();
    
    if (result.error) {
      console.error('❌ エラー:', result.message);
      return;
    }
    
    console.log('✅ Lifecycle stage update completed');
    console.log('   Updated:', result.updatedCount);
    console.log('   Unchanged:', result.unchangedCount);
    console.log('   Errors:', result.errorCount);
    
    if (typeof NotificationService !== 'undefined') {
      NotificationService.sendAdminNotification(
        'Daily Lifecycle Stage Update Completed',
        'Updated: ' + result.updatedCount + '\nUnchanged: ' + result.unchangedCount + '\nErrors: ' + result.errorCount,
        'INFO'
      );
    }
    
  } catch (error) {
    console.error('❌ Lifecycle update failed:', error.message);
    
    if (typeof NotificationService !== 'undefined') {
      NotificationService.sendAdminNotification(
        'Lifecycle Update Failed',
        'Error: ' + error.message,
        'ERROR'
      );
    }
  }
}

function identifyChurnRiskDaily() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Daily Churn Risk Identification          ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  try {
    var result = LifecycleService.identifyChurnRiskCustomers();
    
    if (result.error) {
      console.error('❌ エラー:', result.message);
      return;
    }
    
    console.log('✅ Churn risk identification completed');
    console.log('   High risk customers:', result.count);
    
    if (result.count > 0) {
      console.log('\n【High Risk Customers】');
      result.customers.forEach(function(customer, index) {
        console.log((index + 1) + '. ' + customer.customer_name + ' (' + customer.days_since_last_lesson + ' days)');
      });
    }
    
  } catch (error) {
    console.error('❌ Churn risk identification failed:', error.message);
  }
}

function TEST_LifecycleMetrics() {
  console.log('=== Lifecycle Metrics Test ===\n');
  
  var customers = DB.fetchTable(CONFIG.SHEET.CUSTOMERS);
  
  if (customers.length === 0) {
    console.log('❌ 顧客がいません');
    return;
  }
  
  var customer = customers[0];
  console.log('テスト対象顧客:', customer.customer_name);
  
  var result = LifecycleService.getCustomerEngagementMetrics(customer.customer_id);
  
  if (result.error) {
    console.error('❌ エラー:', result.message);
  } else {
    console.log('✅ メトリクス取得成功\n');
    console.log('【エンゲージメント指標】');
    console.log('  ライフサイクルステージ:', result.metrics.lifecycle_stage);
    console.log('  完了レッスン数:', result.metrics.completed_lessons);
    console.log('  総予約数:', result.metrics.total_reservations);
    console.log('  キャンセル率:', result.metrics.cancellation_rate + '%');
    console.log('  完了率:', result.metrics.completion_rate + '%');
    console.log('  最終レッスン:', result.metrics.last_lesson_date);
    console.log('  最終レッスンから:', result.metrics.days_since_last_lesson, '日');
    console.log('  総支払額: ¥' + result.metrics.total_spent.toLocaleString());
    console.log('  エンゲージメントスコア:', result.metrics.engagement_score);
    console.log('  チャーンリスク:', result.metrics.churn_risk);
  }
}