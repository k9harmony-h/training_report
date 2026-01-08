/**
 * ============================================================================
 * K9 Harmony Portal - Image & Folder Management
 * ============================================================================
 * @file    画像管理.gs
 * @version v2025.12.18-FIX-FLUSH-SYNC
 * @desc    Utils.gsのCONFIGを使用し、処理済み行をスキップする高速化ロジックを実装
 * v2025.12.18: フォルダ作成直後にflushを追加し同期ズレを防止
 */

/**
 * ■ トリガー実行用
 * データベースに変更があった場合に呼び出される
 */
function onDatabaseChange(e) {
  console.time('Total Execution Time');
  forceMigrateAllImages(); 
  console.timeEnd('Total Execution Time');
}

/**
 * ■ 強制移行・整理ツール
 * 新規追加分のみを効率的に処理する
 */
function forceMigrateAllImages() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  console.log('=== Migration Started (Optimized) ===');
  
  // 1. 顧客処理
  try {
    console.log('> Checking Customers...');
    processCustomerRows_(ss.getSheetByName(CONFIG.SHEET.CUSTOMER));
  } catch (e) { console.error('[Fatal] Customer Process Failed: ' + e.stack); }
  
  SpreadsheetApp.flush(); // 書き込みを確定

  // 2. 犬処理
  try {
    console.log('> Checking Dogs...');
    processDogRows_(ss);
  } catch (e) { console.error('[Fatal] Dog Process Failed: ' + e.stack); }

  SpreadsheetApp.flush();

  // 3. レッスン処理
  try {
    console.log('> Checking Lessons...');
    processLessonRows_(ss);
  } catch (e) { console.error('[Fatal] Lesson Process Failed: ' + e.stack); }
  
  console.log('=== Migration Completed ===');
}

// ------------------------------------------------------
// 1. 顧客処理 (Customers)
// ------------------------------------------------------
function processCustomerRows_(sheet) {
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  const colMap = getColumnMap(sheet); // Utils.gs
  const root = DriveApp.getFolderById(CONFIG.FOLDER.ROOT);

  // ヘッダー行を除くループ
  for (let i = 1; i < data.length; i++) {
    const row = i + 1;
    const custCode = data[i][colMap['customer_code']];
    const folderId = String(data[i][colMap['shared_folder_id']]);
    
    // ▼ 高速化スキップ判定: フォルダIDがあり、かつ画像列も処理不要ならスキップ
    const sigPath = data[i][colMap['signature']];
    const conPath = data[i][colMap['contract_photo']];
    
    // フォルダIDが既にあって、画像処理が必要ない(=空欄か既にID)なら次へ
    if (isDriveId(folderId) && !needsProcessing(sigPath) && !needsProcessing(conPath)) {
      continue; 
    }

    if (!custCode) continue;

    // --- ここから処理が必要な行 ---
    try {
      // A. 顧客フォルダ確保
      let targetFolder;
      if (isDriveId(folderId)) {
        try { targetFolder = DriveApp.getFolderById(folderId); } catch(e){}
      }
      
      if (!targetFolder) {
        const folderName = `${custCode}_photo`;
        targetFolder = getOrCreateFolder_(root, folderName); // Utils.gs
        
        // シート更新
        sheet.getRange(row, colMap['shared_folder_id'] + 1).setValue(targetFolder.getId());
        if (colMap['shared_folder_url'] !== undefined) {
          sheet.getRange(row, colMap['shared_folder_url'] + 1).setValue(targetFolder.getUrl());
        }
        console.log(`[Customer] Folder Linked: ${custCode}`);
      }

      // B. 契約書・署名の移動
      if (needsProcessing(sigPath) || needsProcessing(conPath)) {
        const contractFolder = getOrCreateFolder_(targetFolder, CONFIG.DIR.CONTRACT);
        const targetCols = { 'contract_photo': 'contract_photo', 'signature': 'signature' };
        
        for (const [colName, suffix] of Object.entries(targetCols)) {
          if (colMap[colName] === undefined) continue;
          const val = data[i][colMap[colName]];
          
          if (needsProcessing(val)) {
            const newName = `${custCode}_${suffix}`;
            const fileId = moveFileToFolder_(val, contractFolder, newName);
            if (fileId) {
              sheet.getRange(row, colMap[colName] + 1).setValue(fileId);
            }
          }
        }
      }
    } catch (e) {
      console.error(`[Error] Customer Row ${row} (${custCode}): ${e.message}`);
    }
  }
}

// ------------------------------------------------------
// 2. 犬処理 (Dogs)
// ------------------------------------------------------
function processDogRows_(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEET.DOG);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  const colMap = getColumnMap(sheet);

  const custSheet = ss.getSheetByName(CONFIG.SHEET.CUSTOMER);
  const custData = custSheet.getDataRange().getValues();
  const custMap = getColumnMap(custSheet);
  const root = DriveApp.getFolderById(CONFIG.FOLDER.ROOT);

  for (let i = 1; i < data.length; i++) {
    const row = i + 1;
    
    // ▼ 高速化スキップ判定
    const dPhoto = data[i][colMap['dog_photo']];
    const rabies = data[i][colMap['photo_rabies']];
    const vaccine = data[i][colMap['photo_vaccine']];

    // 修正: カラム名 dog_shared_folder_id
    const folderIdCol = colMap['dog_shared_folder_id'];
    const folderId = folderIdCol !== undefined ? String(data[i][folderIdCol]) : '';
    
    // すべての画像セルが「空欄」または「ID」なら何もしない
    if (isDriveId(folderId) && !needsProcessing(dPhoto) && !needsProcessing(rabies) && !needsProcessing(vaccine)) {
      continue;
    }

    const custKey = data[i][colMap['customer_unique_key']];
    const dogCode = data[i][colMap['dog_code']];
    const dogName = data[i][colMap['dog_name']];

    if (!custKey || !dogCode || !dogName) continue;

    try {
      // 1. 親フォルダ(顧客)を探す
      // ここも毎回探すと重いが、画像処理が必要な行だけ実行されるので許容範囲
      const custInfo = findCustInfo_(custData, custMap, custKey);
      if (!custInfo) {
        console.warn(`[Skip] Parent customer not found for dog row ${row}`);
        continue;
      }

      let custFolder;
      if (custInfo.folderId && isDriveId(custInfo.folderId)) {
        try { custFolder = DriveApp.getFolderById(custInfo.folderId); } catch(e){}
      }
      if (!custFolder && custInfo.code) {
        // IDがない場合は名前検索でリカバリ（稀なケース）
        const folders = root.getFoldersByName(`${custInfo.code}_photo`);
        if (folders.hasNext()) custFolder = folders.next();
      }

      if (!custFolder) {
        console.warn(`[Skip] Customer folder missing: ${custInfo.code}`);
        continue;
      }

      // 2. 犬フォルダ確保
      let dogFolder;
      if (isDriveId(folderId)) {
        try { dogFolder = DriveApp.getFolderById(folderId); } catch(e){}
      }

      if (!dogFolder) {
        const dogFolderName = `${dogCode}_${dogName}_photo`;
        // 既存フォルダがあるか確認
        const existing = custFolder.getFoldersByName(dogFolderName);
        if (existing.hasNext()) {
             dogFolder = existing.next();
        } else {
             dogFolder = custFolder.createFolder(dogFolderName);
             try { dogFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}
        }

        // 修正: 書き込み先 dog_shared_folder_id
        if (colMap['dog_shared_folder_id'] !== undefined) {
            sheet.getRange(row, colMap['dog_shared_folder_id'] + 1).setValue(dogFolder.getId());
        }
        if (colMap['dog_shared_folder_url'] !== undefined) {
            sheet.getRange(row, colMap['dog_shared_folder_url'] + 1).setValue(dogFolder.getUrl());
        }

        // 【修正点】フォルダ作成・ID書き込み直後にFlushし、後続処理（手順3）での参照エラーを防ぐ
        SpreadsheetApp.flush();
        console.log(`[Dog] Folder Linked & Flushed: ${dogName}`);
      }

      // 3. プロフィール画像移動
      if (needsProcessing(dPhoto)) {
         const newName = `${dogCode}_${dogName}_photo`; 
         const fileId = moveFileToFolder_(dPhoto, dogFolder, newName);
         if (fileId) sheet.getRange(row, colMap['dog_photo'] + 1).setValue(fileId);
      }

      // 4. 医療画像の移動 (medicalフォルダ)
      if (needsProcessing(rabies) || needsProcessing(vaccine)) {
         const medicalFolder = getOrCreateFolder_(dogFolder, CONFIG.DIR.MEDICAL);
         const medCols = { 'photo_rabies': 'photo_rabies', 'photo_vaccine': 'photo_vaccine' };
         
         for (const [colName, suffix] of Object.entries(medCols)) {
           if (colMap[colName] === undefined) continue;
           const path = data[i][colMap[colName]];
           if (needsProcessing(path)) {
             const newName = `${dogCode}_${dogName}_${suffix}`;
             const fileId = moveFileToFolder_(path, medicalFolder, newName);
             if (fileId) sheet.getRange(row, colMap[colName] + 1).setValue(fileId);
           }
         }
      }

      // 5. その他必要フォルダ作成（空でも作っておく）
      getOrCreateFolder_(dogFolder, CONFIG.DIR.DISASTER);
      getOrCreateFolder_(dogFolder, CONFIG.DIR.LESSON);

    } catch(e) {
      console.error(`[Error] Dog Row ${row}: ${e.message}`);
    }
  }
}

// ------------------------------------------------------
// 3. レッスン処理 (Lessons)
// ------------------------------------------------------
function processLessonRows_(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEET.LESSON);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  const colMap = getColumnMap(sheet);

  const custSheet = ss.getSheetByName(CONFIG.SHEET.CUSTOMER);
  const custData = custSheet.getDataRange().getValues();
  const custMap = getColumnMap(custSheet);

  const dogSheet = ss.getSheetByName(CONFIG.SHEET.DOG);
  const dogData = dogSheet.getDataRange().getValues();
  const dogMap = getColumnMap(dogSheet);
  
  const root = DriveApp.getFolderById(CONFIG.FOLDER.ROOT);

  for (let i = 1; i < data.length; i++) {
    const row = i + 1;
    
    // ▼ 高速化スキップ判定
    let needsAction = false;
    for(let p=1; p<=5; p++) {
       if (needsProcessing(data[i][colMap[`training_photo_${p}`]])) {
         needsAction = true;
         break;
       }
    }
    if (!needsAction) continue; // 全画像がID化済みならスキップ

    const trainCode = data[i][colMap['training_code']];
    const custKey = data[i][colMap['customer_unique_key']];
    const dogKey  = data[i][colMap['dog_unique_key']];
    
    if(!custKey || !dogKey || !trainCode) continue;

    try {
      // 1. 顧客フォルダ特定
      const custInfo = findCustInfo_(custData, custMap, custKey);
      if (!custInfo) continue;
      
      let custFolder;
      if (custInfo.folderId && isDriveId(custInfo.folderId)) {
        try { custFolder = DriveApp.getFolderById(custInfo.folderId); } catch(e){}
      }
      if (!custFolder && custInfo.code) {
        const folders = root.getFoldersByName(`${custInfo.code}_photo`);
        if (folders.hasNext()) custFolder = folders.next();
      }
      if (!custFolder) continue;

      // 2. 犬情報特定
      let dogCode = '', dogName = '', dogFolderId = '';
      for(let d=1; d<dogData.length; d++) {
         if(String(dogData[d][dogMap['dog_unique_key']]) === String(dogKey)) {
            dogCode = dogData[d][dogMap['dog_code']];
            dogName = dogData[d][dogMap['dog_name']];
            // 追加: 犬情報からフォルダID取得
            if (dogMap['dog_shared_folder_id'] !== undefined) {
               dogFolderId = String(dogData[d][dogMap['dog_shared_folder_id']]);
            }
            break;
         }
      }
      if(!dogCode) continue;

      // 3. レッスンフォルダ確保
      // 優先: 犬フォルダIDがあれば使用
      let dogFolder;
      if (isDriveId(dogFolderId)) {
        try { dogFolder = DriveApp.getFolderById(dogFolderId); } catch(e){}
      }

      // IDがない、または無効な場合は顧客フォルダから探す(既存ロジック)
      if (!dogFolder) {
          const dogFolderName = `${dogCode}_${dogName}_photo`;
          const folders = custFolder.getFoldersByName(dogFolderName);
          if (folders.hasNext()) dogFolder = folders.next();
      }

      if (!dogFolder) {
         console.warn(`[Skip] Dog folder not ready for lesson row ${row} (ID: ${dogFolderId})`);
         continue; 
      }

      const lessonFolder = getOrCreateFolder_(dogFolder, CONFIG.DIR.LESSON);

      // 4. 画像移動
      for(let p=1; p<=5; p++) {
         const colName = `training_photo_${p}`;
         const path = data[i][colMap[colName]];
         if(needsProcessing(path)) {
            const newName = `${trainCode}_${dogName}_${colName}`;
            const fileId = moveFileToFolder_(path, lessonFolder, newName);
            if(fileId) sheet.getRange(row, colMap[colName] + 1).setValue(fileId);
         }
      }

    } catch (e) {
      console.error(`[Error] Lesson Row ${row}: ${e.message}`);
    }
  }
}

// ------------------------------------------------------
// Helpers (Private)
// ------------------------------------------------------
function findCustInfo_(cData, cMap, key) {
  for(let i=1; i<cData.length; i++) {
    if(String(cData[i][cMap['customer_unique_key']]) === String(key)) {
       return {
         code: cData[i][cMap['customer_code']],
         folderId: cData[i][cMap['shared_folder_id']]
       };
    }
  }
  return null;
}

/**
 * ファイルを移動・リネームする
 * @param {string} path - 入力されたパスまたはファイル名
 * @param {Folder} targetFolder - 移動先フォルダ
 * @param {string} newNameBase - 拡張子を除いた新しいファイル名
 * @return {string|null} 移動後のファイルID (失敗時null)
 */
function moveFileToFolder_(path, targetFolder, newNameBase) {
  if (!path) return null;
  const originalName = path.split('/').pop();
  
  try {
    const srcFolder = DriveApp.getFolderById(CONFIG.FOLDER.SOURCE);
    const files = srcFolder.getFilesByName(originalName);
    
    if (files.hasNext()) {
      const file = files.next();
      let ext = 'jpg'; // default
      const parts = originalName.split('.');
      if (parts.length > 1) {
          ext = parts.pop().toLowerCase();
      } else {
          // 拡張子判定強化
          const mime = file.getMimeType();
          if (mime === 'image/png') ext = 'png';
          else if (mime === 'image/jpeg') ext = 'jpg';
          else if (mime === 'image/heic') ext = 'heic';
      }
      
      const newName = `${newNameBase}.${ext}`;
      
      // 重複チェック (同名ファイルが既に移動先にあるか)
      const existing = targetFolder.getFilesByName(newName);
      if(existing.hasNext()) {
        const existedFile = existing.next();
        console.log(`[Exists] File already exists: ${newName}`);
        // 元ファイルはゴミ箱へ（二重処理防止）
        file.setTrashed(true);
        return existedFile.getId();
      }
      
      // コピーして元を削除（移動）
      const newFile = file.makeCopy(newName, targetFolder);
      file.setTrashed(true);
      console.log(`[Moved] ${originalName} -> ${newName}`);
      return newFile.getId();
    }
  } catch (e) {
    console.error(`[Move Error] ${originalName}: ${e.message}`);
  }
  return null;
}

/**
 * [Trigger] 夜間バッチ: 30日経過したレッスン写真、10分経過した防災PDFを削除
 * 設定: 「時間主導型」 > 「日次」
 */
function runNightlyCleanup() {
    console.log('[Cleanup] Nightly cleanup started.');
    cleanupTargetFolders_(30, CONFIG.DIR.LESSON); 
    cleanupTargetFolders_(0.007, CONFIG.DIR.DISASTER); 
}

/**
 * [Trigger] 短期バッチ: 防災PDFをこまめに削除したい場合
 * 設定: 「時間主導型」 > 「1時間おき」など
 */
function runShortTermCleanup() {
    console.log('[Cleanup] Short-term cleanup started.');
    cleanupTargetFolders_(0.007, CONFIG.DIR.DISASTER); 
}

/**
 * 指定した種類のフォルダ内にある古いファイルを削除する
 * @param {number} daysOld - 削除対象とする経過日数 (小数は時間換算)
 * @param {string} targetSubFolderName - 対象サブフォルダ名 (lesson_photo / disastar)
 */
function cleanupTargetFolders_(daysOld, targetSubFolderName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET.DOG);
    const data = sheet.getDataRange().getValues();
    const colMap = getColumnMap(sheet);
    const now = new Date();
    const threshold = new Date(now.getTime() - (daysOld * 24 * 60 * 60 * 1000));
    
    for (let i = 1; i < data.length; i++) {
        // カラム名修正
        const folderId = String(data[i][colMap['dog_shared_folder_id']]);
        if (!isDriveId(folderId)) continue;
        
        try {
            const dogFolder = DriveApp.getFolderById(folderId);
            const subFolders = dogFolder.getFoldersByName(targetSubFolderName);
            
            if (subFolders.hasNext()) {
                const targetFolder = subFolders.next();
                const files = targetFolder.getFiles();
                
                while (files.hasNext()) {
                    const file = files.next();
                    if (file.getDateCreated() < threshold) {
                        file.setTrashed(true);
                        console.log(`[Deleted] ${file.getName()} (Created: ${file.getDateCreated()})`);
                    }
                }
            }
        } catch(e) {
            console.warn(`[Cleanup Skip] Folder access failed: ${folderId}`);
        }
    }
}