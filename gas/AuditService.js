/**
 * ============================================================================
 * K9 Harmony - Audit Service
 * ============================================================================
 * ファイル名: AuditService.gs
 * 役割: 監査ログ記録
 * 最終更新: 2026-01-12
 * バージョン: v1.0.1
 */

var AuditService = {
  
  /**
   * 監査ログ記録
   * @param {string} entityType - エンティティタイプ（customer, payment, reservation等）
   * @param {string} entityId - エンティティID
   * @param {string} action - アクション（CREATE, UPDATE, DELETE）
   * @param {Object} oldValues - 変更前の値（UPDATE時）
   * @param {Object} newValues - 変更後の値
   * @param {string} actorType - 操作者タイプ（CUSTOMER, TRAINER, SYSTEM）
   * @param {string} actorId - 操作者ID
   */
  log: function(entityType, entityId, action, oldValues, newValues, actorType, actorId) {
    try {
      var changedFields = this._getChangedFields(oldValues, newValues);
      
      var logData = {
        log_id: Utilities.getUuid(),
        entity_type: entityType,
        entity_id: entityId,
        action: action,
        actor_type: actorType,
        actor_id: actorId,
        actor_ip: '',
        old_values: oldValues ? JSON.stringify(oldValues) : '',
        new_values: newValues ? JSON.stringify(newValues) : '',
        changed_fields: JSON.stringify(changedFields),
        is_gdpr_relevant: this._isGDPRRelevant(entityType),
        created_at: new Date()
      };
      
      DB.insert(CONFIG.SHEET.AUDIT_LOGS, logData);
      
      log('DEBUG', 'AuditService', 'Audit log recorded', {
        entity_type: entityType,
        entity_id: entityId,
        action: action
      });
      
    } catch (error) {
      log('ERROR', 'AuditService', 'Failed to record audit log', { 
        error: error.message,
        entity_type: entityType,
        entity_id: entityId
      });
    }
  },
  
  /**
   * 変更フィールド検出
   */
  _getChangedFields: function(oldValues, newValues) {
    if (!oldValues || !newValues) return [];
    
    var changed = [];
    
    for (var key in newValues) {
      if (newValues.hasOwnProperty(key)) {
        // 変更前の値がない、または異なる場合
        if (!oldValues.hasOwnProperty(key) || oldValues[key] !== newValues[key]) {
          changed.push(key);
        }
      }
    }
    
    return changed;
  },
  
  /**
   * 安全な監査ログ記録（エラーでも処理を止めない）
   */
  logSafe: function(entityType, entityId, action, oldValues, newValues, actorType, actorId) {
    try {
      this.log(entityType, entityId, action, oldValues, newValues, actorType, actorId);
    } catch (auditError) {
      log('ERROR', 'AuditService', 'Failed to record audit log', { 
        error: auditError.message,
        entity_type: entityType,
        entity_id: entityId
      });
    }
  },
  
  /**
   * GDPR関連エンティティか判定
   */
  _isGDPRRelevant: function(entityType) {
    var gdprEntities = ['customer', 'dog'];
    return gdprEntities.indexOf(entityType) !== -1;
  },
  
  /**
   * 特定エンティティの監査ログ取得
   */
  getLogsByEntity: function(entityType, entityId) {
    try {
      var logs = DB.fetchTable(CONFIG.SHEET.AUDIT_LOGS);
      
      return logs.filter(function(log) {
        return log.entity_type === entityType && log.entity_id === entityId;
      }).sort(function(a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });
      
    } catch (error) {
      log('ERROR', 'AuditService', 'Failed to get logs', { error: error.message });
      return [];
    }
  }
};

// ============================================================================
// テスト関数
// ============================================================================

/**
 * 監査ログ作成テスト
 */
function testAuditServiceLog() {
  console.log('=== Audit Service Log Test ===\n');
  
  // テストデータ
  var oldData = {
    customer_name: '田中太郎',
    customer_phone: '090-1234-5678'
  };
  
  var newData = {
    customer_name: '田中太郎',
    customer_phone: '090-9999-8888',
    customer_email: 'tanaka@example.com'
  };
  
  // 監査ログ記録
  AuditService.log(
    'customer',
    'test-customer-id',
    'UPDATE',
    oldData,
    newData,
    'TRAINER',
    'trainer-001'
  );
  
  console.log('✅ Audit log recorded');
  
  // 確認
  Utilities.sleep(1000);
  
  var logs = DB.fetchTable(CONFIG.SHEET.AUDIT_LOGS);
  var latestLog = logs[logs.length - 1];
  
  console.log('\n最新の監査ログ:');
  console.log('  Entity:', latestLog.entity_type);
  console.log('  Action:', latestLog.action);
  console.log('  Changed fields:', latestLog.changed_fields);
  console.log('  GDPR relevant:', latestLog.is_gdpr_relevant);
}

/**
 * 監査ログ取得テスト
 */
function testAuditServiceGetLogs() {
  console.log('=== Audit Service Get Logs Test ===\n');
  
  var logs = AuditService.getLogsByEntity('customer', 'test-customer-id');
  
  console.log('Found', logs.length, 'logs');
  
  logs.forEach(function(log, index) {
    console.log('\nLog', index + 1 + ':');
    console.log('  Action:', log.action);
    console.log('  Created:', log.created_at);
  });
}