/**
 * ============================================================================
 * K9 Harmony - Shared Utilities & Configuration
 * ============================================================================
 * @file    Utils.gs
 * @version v2025.12.25-STEP2-CONFIG-INTEGRATED
 */

// ----------------------------------------------------------------------------
// [Global Configuration]
// ----------------------------------------------------------------------------
const CONFIG = {
  // フォルダID (一元管理)
  FOLDER: {
    ROOT:   '1Af5NfmKL7S8NszCZHLJHBgfRwPqcTeEy', // 本番環境ルート
    SOURCE: '1i2lnZKYaNaFFPd2pEPNi7_MjpsEbcjFF', // 画像アップロード元
    DOG_SEARCH_FALLBACK: '1ZH0Z7ezG4fSBZ0_5BfUAv0jauAa1bZi0' // 旧フォルダ(検索用)
  },
  // シート名
  SHEET: {
    CUSTOMER: '顧客情報',
    DOG:      '犬情報',
    LESSON:   'レッスン評価',
    TRAINER:  'トレーナー',
    SALES:    '売上管理',
    PRODUCT:  '商品',
    LOG:      'System_Logs' // 【追加】ログ用シート
  },
  // フォルダ名定義
  DIR: {
    CONTRACT: 'contract_signature',
    MEDICAL:  'medical',
    DISASTER: 'disastar',
    LESSON:   'lesson_photo'
  }
};

// ----------------------------------------------------------------------------
// [Helper Functions] Data Handling
// ----------------------------------------------------------------------------

function valOrNone(val) { 
  return (val === undefined || val === null || String(val).trim() === '') ? '記載なし' : val; 
}

function getColumnMap(sheet) { 
  if (!sheet) return {}; 
  const h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]; 
  const m = {}; 
  h.forEach((v, i) => { 
    // BOM除去とトリミング
    var cleanHeader = String(v).replace(/[\uFEFF\u200B]/g, '').trim();
    if(cleanHeader) m[cleanHeader] = i; 
  }); 
  return m; 
}

function getVal(row, map, name) { 
  const idx = map[name]; 
  return (idx !== undefined && row[idx] !== undefined) ? row[idx] : ''; 
}

function formatDateSafe(v, f) { 
  if (v instanceof Date) {
    try {
      return Utilities.formatDate(v, Session.getScriptTimeZone(), f); 
    } catch(e) { return ''; }
  }
  return ''; 
}

// ----------------------------------------------------------------------------
// [Helper Functions] Folder & File Management
// ----------------------------------------------------------------------------

/**
 * フォルダを取得、なければ作成する (堅牢版)
 */
function getOrCreateFolder_(parentFolder, folderName) {
  try {
    const folders = parentFolder.getFoldersByName(folderName);
    while (folders.hasNext()) {
      const folder = folders.next();
      if (!folder.isTrashed()) {
        return folder;
      }
    }
    const newFolder = parentFolder.createFolder(folderName);
    try { newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}
    return newFolder;
  } catch (e) {
    console.error(`[Utils] Folder Error (${folderName}): ${e.message}`);
    throw e;
  }
}

function isDriveId(val) {
  if (!val) return false;
  const s = String(val).trim();
  return !s.includes('/') && s.length > 20 && /^[-\w]+$/.test(s);
}

function needsProcessing(val) {
  if (!val) return false;
  const s = String(val).trim();
  if (isDriveId(s)) return false; 
  return s.includes('/') || /\.(jpg|jpeg|png|heic)$/i.test(s) || s.includes('Images');
}

/**
 * 画像Base64取得 (共通ロジック)
 */
function getImageBase64(pathOrUrl, fallbackFolderId) { 
  if (!pathOrUrl) return null; 
  try { 
    const strVal = String(pathOrUrl);
    let fileId = '';
    
    const matchId = strVal.match(/[-\w]{25,}/);
    if (matchId) { fileId = matchId[0]; }
    
    if (fileId) {
      try {
        const file = DriveApp.getFileById(fileId);
        return 'data:' + file.getBlob().getContentType() + ';base64,' + Utilities.base64Encode(file.getBlob().getBytes());
      } catch(e) { }
    }

    if (fallbackFolderId) {
      const parts = strVal.split('/');
      const filename = parts[parts.length - 1].trim();
      try {
        const folder = DriveApp.getFolderById(fallbackFolderId);
        const files = folder.getFilesByName(filename);
        if (files.hasNext()) {
          const file = files.next();
          return 'data:' + file.getBlob().getContentType() + ';base64,' + Utilities.base64Encode(file.getBlob().getBytes());
        }
      } catch(e) { }
    }
  } catch (e) { 
    console.error('[Utils] getImageBase64 Error: ' + e.message); 
  } 
  return null; 
}