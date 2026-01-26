/**
 * ============================================================================
 * K9 Harmony - Trainer Repository
 * ============================================================================
 * ファイル名: TrainerRepository.gs
 * 役割: トレーナー情報のCRUD操作
 * 最終更新: 2026-01-19
 * バージョン: v1.0.0
 */

// ============================================================================
// トレーナーリポジトリ
// ============================================================================

var TrainerRepository = {
  
  /**
   * トレーナーIDで検索
   * @param {string} trainerId - トレーナーID
   * @return {Object} トレーナー情報 or エラーオブジェクト
   */
  findById: function(trainerId) {
    try {
      log('INFO', 'TrainerRepository', 'Finding trainer by ID: ' + trainerId);
      
      var trainers = DB.fetchTable(CONFIG.SHEET.TRAINERS);
      
      var trainer = trainers.find(function(t) {
        return t.trainer_id === trainerId;
      });
      
      if (!trainer) {
        log('WARN', 'TrainerRepository', 'Trainer not found: ' + trainerId);
        return createK9Error(
          ErrorCode.RECORD_NOT_FOUND,
          'Trainer not found',
          { trainer_id: trainerId }
        );
      }
      
      log('INFO', 'TrainerRepository', 'Trainer found: ' + trainer.trainer_name);
      return trainer;
      
    } catch (error) {
      log('ERROR', 'TrainerRepository', 'findById failed', { error: error.message });
      return ErrorHandler.handleError(error, 'TrainerRepository.findById');
    }
  },
  
  /**
   * トレーナーコードで検索
   * @param {string} trainerCode - トレーナーコード (例: TRN-001)
   * @return {Object} トレーナー情報 or エラーオブジェクト
   */
  findByTrainerCode: function(trainerCode) {
    try {
      log('INFO', 'TrainerRepository', 'Finding trainer by code: ' + trainerCode);
      
      var trainers = DB.fetchTable(CONFIG.SHEET.TRAINERS);
      
      var trainer = trainers.find(function(t) {
        return t.trainer_code === trainerCode;
      });
      
      if (!trainer) {
        log('WARN', 'TrainerRepository', 'Trainer not found with code: ' + trainerCode);
        return createK9Error(
          ErrorCode.RECORD_NOT_FOUND,
          'Trainer not found',
          { trainer_code: trainerCode }
        );
      }
      
      log('INFO', 'TrainerRepository', 'Trainer found: ' + trainer.trainer_name);
      return trainer;
      
    } catch (error) {
      log('ERROR', 'TrainerRepository', 'findByTrainerCode failed', { error: error.message });
      return ErrorHandler.handleError(error, 'TrainerRepository.findByTrainerCode');
    }
  },

  /**
   * 全トレーナー取得
   * @param {Object} options - オプション（statusフィルタ等）
   * @return {Array} トレーナーリスト
   */
  findAll: function(options) {
    try {
      log('INFO', 'TrainerRepository', 'Finding all trainers');
      
      options = options || {};
      
      var trainers = DB.fetchTable(CONFIG.SHEET.TRAINERS);
      
      // ステータスフィルタ
      if (options.status) {
        trainers = trainers.filter(function(t) {
          return t.trainer_status === options.status;
        });
      }
      
      // 削除済みを除外
      if (options.excludeDeleted !== false) {
        trainers = trainers.filter(function(t) {
          return !t.is_deleted;
        });
      }
      
      log('INFO', 'TrainerRepository', 'Found ' + trainers.length + ' trainers');
      return trainers;
      
    } catch (error) {
      log('ERROR', 'TrainerRepository', 'findAll failed', { error: error.message });
      return ErrorHandler.handleError(error, 'TrainerRepository.findAll');
    }
  },
  
  /**
   * アクティブなトレーナー取得
   * @return {Array} アクティブなトレーナーリスト
   */
  findActive: function() {
    try {
      log('INFO', 'TrainerRepository', 'Finding active trainers');
      
      var trainers = DB.fetchTable(CONFIG.SHEET.TRAINERS);
      
      var activeTrainers = trainers.filter(function(t) {
        return t.trainer_status === 'ACTIVE' && !t.is_deleted;
      });
      
      log('INFO', 'TrainerRepository', 'Found ' + activeTrainers.length + ' active trainers');
      return activeTrainers;
      
    } catch (error) {
      log('ERROR', 'TrainerRepository', 'findActive failed', { error: error.message });
      return ErrorHandler.handleError(error, 'TrainerRepository.findActive');
    }
  },
  
  /**
   * トレーナー新規作成
   * @param {Object} data - トレーナーデータ
   * @return {Object} 作成結果
   */
  create: function(data) {
    try {
      log('INFO', 'TrainerRepository', 'Creating new trainer');
      
      // バリデーション
      if (!data.trainer_name) {
        throw new Error('trainer_name is required');
      }
      
      var trainerId = Utilities.getUuid().substring(0, 8);
      
      // トレーナーコード生成（TRN-001形式）
      var trainers = DB.fetchTable(CONFIG.SHEET.TRAINERS);
      var maxCode = 0;
      trainers.forEach(function(t) {
        if (t.trainer_code && t.trainer_code.startsWith('TRN-')) {
          var num = parseInt(t.trainer_code.split('-')[1]);
          if (num > maxCode) maxCode = num;
        }
      });
      var trainerCode = 'TRN-' + String(maxCode + 1).padStart(3, '0');
      
      var now = new Date();
      
      var newTrainer = {
        trainer_id: trainerId,
        trainer_code: trainerCode,
        trainer_name: data.trainer_name,
        trainer_email: data.trainer_email || '',
        trainer_phone: data.trainer_phone || '',
        trainer_status: data.trainer_status || 'ACTIVE',
        specialization: data.specialization || '',
        certifications: data.certifications || '',
        bio: data.bio || '',
        is_deleted: false,
        created_at: now,
        updated_at: now
      };
      
      var result = DB.appendRow(CONFIG.SHEET.TRAINERS, newTrainer);
      
      if (result.error) {
        throw new Error(result.message);
      }
      
      log('INFO', 'TrainerRepository', 'Trainer created: ' + trainerId);
      
      return {
        success: true,
        trainer_id: trainerId,
        trainer_code: trainerCode,
        trainer: newTrainer
      };
      
    } catch (error) {
      log('ERROR', 'TrainerRepository', 'create failed', { error: error.message });
      return ErrorHandler.handleError(error, 'TrainerRepository.create');
    }
  },
  
  /**
   * トレーナー情報更新
   * @param {string} trainerId - トレーナーID
   * @param {Object} updateData - 更新データ
   * @return {Object} 更新結果
   */
  update: function(trainerId, updateData) {
    try {
      log('INFO', 'TrainerRepository', 'Updating trainer: ' + trainerId);
      
      // 既存トレーナー確認
      var existingTrainer = this.findById(trainerId);
      if (existingTrainer.error) {
        return existingTrainer;
      }
      
      // 更新データ準備
      updateData.updated_at = new Date();
      
      var result = DB.updateRow(
        CONFIG.SHEET.TRAINERS,
        'trainer_id',
        trainerId,
        updateData
      );
      
      if (result.error) {
        throw new Error(result.message);
      }
      
      log('INFO', 'TrainerRepository', 'Trainer updated successfully');
      
      return {
        success: true,
        trainer_id: trainerId,
        updated_fields: Object.keys(updateData)
      };
      
    } catch (error) {
      log('ERROR', 'TrainerRepository', 'update failed', { error: error.message });
      return ErrorHandler.handleError(error, 'TrainerRepository.update');
    }
  },
  
  /**
   * トレーナー論理削除
   * @param {string} trainerId - トレーナーID
   * @return {Object} 削除結果
   */
  delete: function(trainerId) {
    try {
      log('INFO', 'TrainerRepository', 'Deleting trainer: ' + trainerId);
      
      var updateData = {
        is_deleted: true,
        trainer_status: 'INACTIVE',
        updated_at: new Date()
      };
      
      var result = this.update(trainerId, updateData);
      
      if (result.error) {
        return result;
      }
      
      log('INFO', 'TrainerRepository', 'Trainer deleted (logical): ' + trainerId);
      
      return {
        success: true,
        trainer_id: trainerId,
        message: 'Trainer deleted successfully'
      };
      
    } catch (error) {
      log('ERROR', 'TrainerRepository', 'delete failed', { error: error.message });
      return ErrorHandler.handleError(error, 'TrainerRepository.delete');
    }
  }
};

// ============================================================================
// テスト関数
// ============================================================================

/**
 * TrainerRepositoryテスト
 */
function testTrainerRepository() {
  console.log('=== TrainerRepository Test ===\n');
  
  // テスト1: findByTrainerCode
  console.log('Test 1: findByTrainerCode');
  var trainer = TrainerRepository.findByTrainerCode('TRN-001');
  if (trainer.error) {
    console.log('❌ Error:', trainer.message);
  } else {
    console.log('✅ Success:', trainer.trainer_name);
  }
  
  // テスト2: findAll (ACTIVE)
  console.log('\nTest 2: findActive');
  var activeTrainers = TrainerRepository.findActive();
  if (activeTrainers.error) {
    console.log('❌ Error:', activeTrainers.message);
  } else {
    console.log('✅ Success: Found ' + activeTrainers.length + ' active trainers');
    activeTrainers.forEach(function(t) {
      console.log('  - ' + t.trainer_code + ': ' + t.trainer_name);
    });
  }
  
  console.log('\n✅ TrainerRepository Test Completed');
}