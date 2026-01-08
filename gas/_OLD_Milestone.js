/**
 * ============================================================================
 * K9 Harmony Portal - Milestone System Module
 * ============================================================================
 * @file    milestone.gs
 * @version v2025.12.19-CSS-ADJUSTED
 * @desc    マイルストーンの定義取得、獲得判定、データ提供を行う独立モジュール
 */

// マイルストーン専用設定
const MS_CONFIG = {
  SHEET: {
    DEF: 'マイルストーン定義',
    LOG: 'マイルストーン獲得履歴',
    LESSON: 'レッスン評価' 
  },
  // ティア定義 (CSVのtier列と一致させる)
  TIER: {
    BEGINNER: '1_Beginner',
    INTERMEDIATE: '2_Intermediate',
    ADVANCED: '3_Advanced'
  },
  // 中級チラ見せ発生条件 (獲得バッジ数)
  UNLOCK_COUNT_THRESHOLD: 6
};

/**
 * [API] マイルストーン画面用データ取得のメイン関数
 * main.gs から呼び出されることを想定
 * @param {string} dogId - 対象の犬ID
 * @return {object} マイルストーンデータ構造体
 */
function getMilestoneService(dogId) {
  console.log(`[Milestone] Fetching data for dog: ${dogId}`);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 定義データの取得
  const defSheet = ss.getSheetByName(MS_CONFIG.SHEET.DEF);
  if (!defSheet) throw new Error(`Sheet not found: ${MS_CONFIG.SHEET.DEF}`);
  const definitions = getSheetDataAsObjects_(defSheet);
  
  // 2. 獲得履歴の取得
  const logSheet = ss.getSheetByName(MS_CONFIG.SHEET.LOG);
  if (!logSheet) throw new Error(`Sheet not found: ${MS_CONFIG.SHEET.LOG}`);
  const historyLogs = getSheetDataAsObjects_(logSheet);
  
  // 対象犬の履歴のみ抽出
  const myLogs = historyLogs.filter(row => String(row.dog_unique_key) === String(dogId));
  const acquiredIds = myLogs.map(log => String(log.milestone_id));
  
  // 3. データ結合とステータス判定
  let earnedCount = 0;
  
  const badges = definitions
    .filter(def => def.is_active === true) // 有効なもののみ
    .map(def => {
      const isAcquired = acquiredIds.includes(String(def.milestone_id));
      if (isAcquired) earnedCount++;
      
      // 未確認の演出があるか (FALSE または 空欄 = まだ見ていない)
      const targetLog = myLogs.find(l => String(l.milestone_id) === String(def.milestone_id));
      const showAnimation = targetLog ? (String(targetLog.is_seen_animation).toUpperCase() !== 'TRUE') : false;

      // アイコンタイプ（CSSクラス名として使用）
      // SSの列名が 'icon_path' でも 'icon_type' でも、あるいは列自体がなくても 'default' になるよう処理
      const iconType = def.icon_type || def.icon_path || 'default';

      return {
        id: def.milestone_id,
        tier: def.tier,
        title: def.title,
        desc: def.description,
        tips: def.tips,
        icon_type: iconType, // フロント側で class="badge-${iconType}" のように利用
        color: def.badge_color,
        is_acquired: isAcquired,
        is_new: showAnimation, // これがTRUEなら花火演出
        sort: Number(def.sort_order)
      };
    })
    .sort((a, b) => a.sort - b.sort);

  // 4. エリア解放ロジック (チラ見せ判定)
  // 初級が規定数(6個)以上で、中級を「Peek(チラ見せ)」状態にする
  const showIntermediatePeek = (earnedCount >= MS_CONFIG.UNLOCK_COUNT_THRESHOLD);
  
  // 初級コンプリート判定 (ID: MS-008 を持っているか、または初級全取得か。ここでは簡易的にMS-008で判定)
  const hasBeginnerComplete = acquiredIds.includes('MS-008'); 
  
  // 5. レスポンス構築
  return {
    status: 'success',
    meta: {
      total_earned: earnedCount,
      show_intermediate_peek: showIntermediatePeek,
      show_intermediate_full: hasBeginnerComplete,
      // 上級は中級コンプ後に解放などのロジックをここに追加可能
      show_advanced_peek: false 
    },
    badges: badges
  };
}

/**
 * [API] 演出を見たフラグを更新する関数
 * 花火が終わった後にフロントから叩く
 */
function markMilestoneAsSeen(dogId, milestoneId) {
  console.log(`[Milestone] Mark seen: ${dogId} - ${milestoneId}`);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(MS_CONFIG.SHEET.LOG);
  const data = logSheet.getDataRange().getValues();
  const map = getColumnMap(logSheet); // 下部ヘルパー関数またはUtils
  
  let updated = false;
  
  for (let i = 1; i < data.length; i++) {
    const rowDogId = String(getVal(data[i], map, 'dog_unique_key'));
    const rowMsId  = String(getVal(data[i], map, 'milestone_id'));
    
    if (rowDogId === String(dogId) && rowMsId === String(milestoneId)) {
      // is_seen_animation カラムを TRUE に更新
      const colIndex = map['is_seen_animation'] + 1;
      logSheet.getRange(i + 1, colIndex).setValue(true);
      updated = true;
      break; // 1件更新すればOK
    }
  }
  
  return { success: updated };
}

/**
 * [Logic] マイルストーンの自動判定と付与 (保存時に実行)
 * doPostやdoGetのタイミングではなく、レッスン記録保存時に呼び出す想定
 */
function checkAndGrantMilestones(dogId) {
  console.log(`[Milestone Check] Starting for dog: ${dogId}`);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // --- 1. 必要なデータの準備 ---
  
  // (A) マイルストーン定義
  const defSheet = ss.getSheetByName(MS_CONFIG.SHEET.DEF);
  if (!defSheet) return; // シートがない場合は終了
  const definitions = getSheetDataAsObjects_(defSheet);

  // (B) 獲得済み履歴
  const logSheet = ss.getSheetByName(MS_CONFIG.SHEET.LOG);
  if (!logSheet) return;
  const historyLogs = getSheetDataAsObjects_(logSheet);
  
  // 既に持っているIDリスト
  const myAcquiredIds = historyLogs
    .filter(row => String(row.dog_unique_key) === String(dogId))
    .map(row => String(row.milestone_id));

  // (C) レッスン履歴（判定の根拠データ）
  const lessonSheet = ss.getSheetByName(MS_CONFIG.SHEET.LESSON);
  let lessonCount = 0;
  
  if (lessonSheet) {
    const allLessons = getSheetDataAsObjects_(lessonSheet);
    const myLessons = allLessons.filter(row => String(row.dog_unique_key) === String(dogId));
    lessonCount = myLessons.length;
  }

  // --- 2. 判定ループ ---
  const newMilestones = [];

  definitions.forEach(def => {
    // 既に獲得済みならスキップ
    if (myAcquiredIds.includes(String(def.milestone_id))) return;
    if (!def.is_active) return;

    let isConditionMet = false;

    // 定義シートに 'condition_type' と 'condition_value' カラムがある前提
    const type = String(def.condition_type || '').toLowerCase(); 
    const val  = Number(def.condition_value || 0);

    switch (type) {
      case 'count': // レッスン回数による判定
        if (lessonCount >= val) isConditionMet = true;
        break;
      
      // 必要に応じて case 'score': などを追加
      
      case 'manual': // 手動付与のみ
      default:
        isConditionMet = false;
        break;
    }

    if (isConditionMet) {
      console.log(`[Grant] New milestone! ${def.milestone_id} for ${dogId}`);
      newMilestones.push(def.milestone_id);
    }
  });

  // --- 3. 新規獲得分の書き込み ---
  if (newMilestones.length > 0) {
    const timestamp = new Date();
    // 追記用に配列化: [Timestamp, DogID, MilestoneID, IsSeen, Remarks]
    // 実際のカラム順序に合わせて調整してください。ここでは標準的な並びを想定。
    const newRows = newMilestones.map(msId => [
      timestamp,      // A列
      dogId,          // B列
      msId,           // C列
      false,          // D列: 未読
      'System Grant'  // E列
    ]);
    
    // まとめて書き込み(appendRowループより高速)
    // ただしappendRowsメソッドはないため、getRangeで最終行の下を取得してsetValuesする
    const lastRow = logSheet.getLastRow();
    logSheet.getRange(lastRow + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    
    console.log(`Granted ${newMilestones.length} milestones.`);
  } else {
    console.log('No new milestones granted.');
  }
}

// --- 内部ヘルパー関数 (Utils.gsがない場合の依存解決用) ---

/**
 * シートデータをオブジェクト配列として取得
 */
function getSheetDataAsObjects_(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}

/**
 * カラム名のマッピングを取得 (getVal用)
 */
function getColumnMap(sheet) {
  const headers = sheet.getDataRange().getValues()[0];
  const map = {};
  headers.forEach((h, i) => map[h] = i);
  return map;
}

/**
 * マップを使って値を取得
 */
function getVal(rowArray, map, key) {
  const index = map[key];
  if (index === undefined) return null;
  return rowArray[index];
}