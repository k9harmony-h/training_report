/**
 * ============================================================================
 * K9 Harmony - Disaster Module
 * ============================================================================
 * @file    disaster.gs
 * @version v2025.12.13-STEP3-FINAL-CONFIG
 */

const DISASTER_CONFIG = {
  SLIDES: {
    HANDBOOK:       '13B4BsuXuzUE1AZadWILQP_OHHaVAYoBYvEnuxkIX1PQ',
    CRATE_TAG:      '1MSlvMgULTg-HfCp3uFtcPoe_eqlbX5uFzF4OSfqTtVw',
    MISSING_POSTER: '1cA-JDa2cbxC5pko5Nsbtt6W17cRfdBG6PkRMaXYsGXE'
  },
  COLS: {
    DOG_NAME: 'dog_name', DOG_GENDER: 'dog_gender', BREED: 'breed', COAT_COLOR: 'coat_color',
    DOG_BIRTH_DATE: 'dog_birth_date', NEUTERED: 'neutered', DOG_PHOTO: 'dog_photo',
    VET_NAME: 'vet_name', VET_PHONE: 'vet_phone', DOG_ALLERGY: 'dog_allergy',
    DOG_MEDICAL_HISTORY: 'dog_medical_history', DOG_MEDICINE: 'dog_medicine', DOG_FOOD: 'dog_food',
    DOG_CAUTION: 'dog_caution', DOG_MICROCHIP: 'dog_microchip', DOG_LICENSE_NO: 'dog_license_no',
    WEIGHT: 'weight', UPDATED_AT: 'updated_at', DOG_PROBLEM: 'problem', 
    CUSTOMER_NAME: 'customer_name', CUSTOMER_PHONE: 'customer_phone',
    EM_CONTACT_NAME: 'em_contact_name', EM_CONTACT_PHONE: 'em_contact_phone',
    EM_PROXY_NAME: 'em_proxy_name', EM_PROXY_PHONE: 'em_proxy_phone', EVACUATION_SITE: 'evacuation_site'
  }
};

function generatePdfForApi(lineUserId, dogId, docType) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (typeof getColumnMap !== 'function') throw new Error('utils.gs not loaded');

  const mergedData = getMergedDataByDogId_(ss, dogId);
  if (!mergedData) return { error: 'Dog data not found.' };

  let templateId = '', suffix = '';
  if (docType === 'handbook') { templateId = DISASTER_CONFIG.SLIDES.HANDBOOK; suffix = 'ハンドブック'; }
  else if (docType === 'crate') { templateId = DISASTER_CONFIG.SLIDES.CRATE_TAG; suffix = 'クレートタグ'; }
  else if (docType === 'poster') { templateId = DISASTER_CONFIG.SLIDES.MISSING_POSTER; suffix = '迷子チラシ'; }
  else return { error: 'Invalid document type.' };

  // ★ 顧客フォルダ -> 犬フォルダ -> disasterフォルダ を探索
  let outputFolder = DriveApp.getRootFolder();
  try {
      // CONFIGを使用
      const shCust = ss.getSheetByName(CONFIG.SHEET.CUSTOMER);
      const cData = shCust.getDataRange().getValues();
      const cMap = getColumnMap(shCust);
      let custFolderId = '';
      
      for(let i=1; i<cData.length; i++) {
         if(String(cData[i][cMap['customer_unique_key']]) === String(mergedData.custKey)) {
            custFolderId = cData[i][cMap['shared_folder_id']];
            break;
         }
      }
      
      if (custFolderId) {
         const custFolder = DriveApp.getFolderById(custFolderId);
         // 犬フォルダ名: [dog_code]_[dog_name]_photo
         const dogFolderName = `${mergedData.dogCode}_${mergedData.rawDogName}_photo`;
         const dogFolder = getOrCreateFolder_(custFolder, dogFolderName); // Utils.gs
         
         // CONFIGを使用 (disastarフォルダ)
         outputFolder = getOrCreateFolder_(dogFolder, CONFIG.DIR.DISASTER);
      }
  } catch(e) {
      console.warn('Folder discovery failed, using root: ' + e.message);
  }

  try {
    const cleanName = mergedData.dogNameDisplay.replace(/くん|ちゃん$/, '');
    const fileName = `${suffix}_${cleanName}`;
    const pdfFile = createPDF_(templateId, mergedData, outputFolder, fileName);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // 10分後削除トリガー
    setDeleteTrigger_(pdfFile.getId(), 'FILE');

    return { 
       success: true, 
       url: pdfFile.getUrl(), 
       downloadUrl: `https://drive.google.com/uc?export=download&id=${pdfFile.getId()}`, 
       name: fileName 
    };
  } catch (e) {
    return { error: 'PDF Gen Failed: ' + e.message };
  }
}

// データ取得ロジック (フォルダ特定用にキーを追加)
function getMergedDataByDogId_(ss, dogId) {
  // CONFIGを使用
  const shDog = ss.getSheetByName(CONFIG.SHEET.DOG);
  const data = shDog.getDataRange().getValues();
  const dMap = getColumnMap(shDog);
  let targetRowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(getVal(data[i], dMap, 'dog_unique_key')) === String(dogId)) {
      targetRowIndex = i + 1; break;
    }
  }
  if (targetRowIndex === -1) return null;
  return getMergedData_(ss, targetRowIndex);
}

function getMergedData_(ss, dogRowIndex) {
  // CONFIGを使用
  const shDog = ss.getSheetByName(CONFIG.SHEET.DOG);
  const shCust = ss.getSheetByName(CONFIG.SHEET.CUSTOMER);
  const dMap = getColumnMap(shDog); 
  const cMap = getColumnMap(shCust); 
  
  const dogValues = shDog.getRange(dogRowIndex, 1, 1, shDog.getLastColumn()).getValues()[0];
  const custKey = getVal(dogValues, dMap, 'customer_unique_key');
  if (!custKey) return null;

  const custDataAll = shCust.getDataRange().getValues();
  let custValues = null;
  for (let i = 1; i < custDataAll.length; i++) {
    if (String(getVal(custDataAll[i], cMap, 'customer_unique_key')) === String(custKey)) { custValues = custDataAll[i]; break; }
  }
  
  const rawName = getVal(dogValues, dMap, DISASTER_CONFIG.COLS.DOG_NAME);
  const dogCode = getVal(dogValues, dMap, 'dog_code'); 
  const gender  = getVal(dogValues, dMap, DISASTER_CONFIG.COLS.DOG_GENDER);
  const suffix = (['Male', 'オス', '♂'].includes(gender)) ? 'くん' : 'ちゃん';
  
  const bDate = getVal(dogValues, dMap, DISASTER_CONFIG.COLS.DOG_BIRTH_DATE);
  let age = '';
  if (bDate instanceof Date) {
    const today = new Date();
    let y = today.getFullYear() - bDate.getFullYear();
    const m = today.getMonth() - bDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) y--;
    age = `${y}歳`;
  }

  const allergyDetail = getVal(dogValues, dMap, DISASTER_CONFIG.COLS.DOG_ALLERGY);
  const allergyYN = (allergyDetail && String(allergyDetail).trim() !== '') ? '有' : '無';
  
  return {
    custKey: custKey, 
    dogCode: dogCode, 
    rawDogName: rawName, 
    dogNameDisplay: rawName ? `${rawName}${suffix}` : '',
    breed:       getVal(dogValues, dMap, DISASTER_CONFIG.COLS.BREED),
    gender:      gender, birthDate: bDate, age: age,
    coatColor:   getVal(dogValues, dMap, DISASTER_CONFIG.COLS.COAT_COLOR),
    neutered:    getVal(dogValues, dMap, DISASTER_CONFIG.COLS.NEUTERED),
    dogPhotoSource: getVal(dogValues, dMap, DISASTER_CONFIG.COLS.DOG_PHOTO), 
    vetName:         getVal(dogValues, dMap, DISASTER_CONFIG.COLS.VET_NAME),
    vetPhone:        getVal(dogValues, dMap, DISASTER_CONFIG.COLS.VET_PHONE),
    allergy:         allergyDetail, allergyYN: allergyYN,
    medicalHistory: getVal(dogValues, dMap, DISASTER_CONFIG.COLS.DOG_MEDICAL_HISTORY),
    medicine:        getVal(dogValues, dMap, DISASTER_CONFIG.COLS.DOG_MEDICINE),
    food:            getVal(dogValues, dMap, DISASTER_CONFIG.COLS.DOG_FOOD),
    caution:         getVal(dogValues, dMap, DISASTER_CONFIG.COLS.DOG_CAUTION),
    microchip:       getVal(dogValues, dMap, DISASTER_CONFIG.COLS.DOG_MICROCHIP),
    licenseNo:       getVal(dogValues, dMap, DISASTER_CONFIG.COLS.DOG_LICENSE_NO),
    weight:          getVal(dogValues, dMap, DISASTER_CONFIG.COLS.WEIGHT),
    problem:         getVal(dogValues, dMap, DISASTER_CONFIG.COLS.DOG_PROBLEM),
    customerName:    getVal(custValues, cMap, DISASTER_CONFIG.COLS.CUSTOMER_NAME),
    customerPhone:   getVal(custValues, cMap, DISASTER_CONFIG.COLS.CUSTOMER_PHONE),
    emContactName:   getVal(custValues, cMap, DISASTER_CONFIG.COLS.EM_CONTACT_NAME),
    emContactPhone:  getVal(custValues, cMap, DISASTER_CONFIG.COLS.EM_CONTACT_PHONE),
    emProxyName:     getVal(custValues, cMap, DISASTER_CONFIG.COLS.EM_PROXY_NAME),
    emProxyPhone:    getVal(custValues, cMap, DISASTER_CONFIG.COLS.EM_PROXY_PHONE),
    evacuationSite:  getVal(custValues, cMap, DISASTER_CONFIG.COLS.EVACUATION_SITE),
    updateDate:      new Date()
  };
}

// 削除トリガー (ファイル単体削除)
function setDeleteTrigger_(fileId, type) {
  ScriptApp.newTrigger('deleteResourceTrigger_').timeBased().after(10 * 60 * 1000).create();
  const key = `DELETE_TASK_${new Date().getTime()}_${Math.floor(Math.random() * 1000)}`;
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify({ id: fileId, type: type }));
}

function deleteResourceTrigger_() {
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  const now = new Date().getTime();
  for (const key in allProps) {
    if (key.startsWith('DELETE_TASK_')) {
      const ts = parseInt(key.split('_')[2]);
      if (now - ts > 9 * 60 * 1000) {
        try {
          const data = JSON.parse(allProps[key]);
          DriveApp.getFileById(data.id).setTrashed(true);
        } catch(e){}
        props.deleteProperty(key);
      }
    }
  }
}

function createPDF_(templateId, data, folder, fileName) {
  const templateFile = DriveApp.getFileById(templateId);
  const tempFile = templateFile.makeCopy(`TEMP_${fileName}`, folder);
  const slideApp = SlidesApp.openById(tempFile.getId());
  
  const slides = slideApp.getSlides();
  slides.forEach(slide => {
    replaceText_(slide, data);
    replaceImage_(slide, '{dog_photo}', data.dogPhotoSource);
  });
  
  slideApp.saveAndClose();
  const pdfBlob = tempFile.getAs(MimeType.PDF);
  const pdfFile = folder.createFile(pdfBlob).setName(fileName + '.pdf');
  tempFile.setTrashed(true);
  return pdfFile;
}

function replaceText_(slide, data) {
  // マッピング処理 (Utils.gs 依存)
  const replacements = {
    '{dog_name}': data.dogNameDisplay,
    '{breed}': valOrNone(data.breed),
    '{dog_gender}': valOrNone(data.gender),
    '{dog_birth_date}': formatDateSafe(data.birthDate, 'yyyy/MM/dd'),
    '{age}': valOrNone(data.age),
    '{coat_color}': valOrNone(data.coatColor),
    '{neutered}': valOrNone(data.neutered),
    '{vet_name}': valOrNone(data.vetName),
    '{vet_phone}': valOrNone(data.vetPhone),
    '{dog_medical_history}': valOrNone(data.medicalHistory),
    '{dog_medicine}': valOrNone(data.medicine),
    '{dog_food}': valOrNone(data.food),
    '{dog_allergy}': valOrNone(data.allergy),
    '{allergyYN}': data.allergyYN,
    '{dog_caution}': valOrNone(data.caution),
    '{dog_microchip}': valOrNone(data.microchip),
    '{dog_license_no}': data.licenseNo || '',
    '{weight}': data.weight || '',
    '{problem}': data.problem || '',
    '{customer_name}': valOrNone(data.customerName),
    '{customer_phone}': valOrNone(data.customerPhone),
    '{em_contact_name}': valOrNone(data.emContactName),
    '{em_contact_phone}': valOrNone(data.emContactPhone),
    '{em_proxy_name}': valOrNone(data.emProxyName),
    '{em_proxy_phone}': valOrNone(data.emProxyPhone),
    '{evacuation_site}': valOrNone(data.evacuationSite),
    '{updateDate}': formatDateSafe(data.updateDate, 'yyyy/MM/dd')
  };

  for (const [key, value] of Object.entries(replacements)) {
    slide.replaceAllText(key, String(value));
  }
}

function replaceImage_(slide, tag, source) {
  if (!source) return;
  let imageBlob = null;
  let fileId = '';
  try {
    const strSource = String(source);
    const matchId = strSource.match(/id=([-\w]{25,})/);
    const matchPath = strSource.match(/\/d\/([-\w]{25,})/);
    const simpleMatch = strSource.match(/^[-\w]{25,}$/); 
    if (matchId) fileId = matchId[1];
    else if (matchPath) fileId = matchPath[1];
    else if (simpleMatch) fileId = simpleMatch[0];
    if (fileId) imageBlob = DriveApp.getFileById(fileId).getBlob();
  } catch(e) {}

  if (!imageBlob) {
    try {
      const parts = String(source).split('/');
      const fileName = parts[parts.length - 1];
      // 画像管理.gsが動いた後なら、画像は整理されたフォルダにあるはずだが、
      // ここでは簡易的に名前検索でフォールバック
      const files = DriveApp.getFilesByName(fileName);
      if (files.hasNext()) imageBlob = files.next().getBlob();
    } catch(e) {}
  }

  if (!imageBlob) return;
  const shapes = slide.getShapes();
  const target = findShapeRecursive_(shapes, tag);
  if (target) {
    try { target.replaceWithImage(imageBlob, true); } catch(e) {}
  }
}

function findShapeRecursive_(shapes, tag) {
  for (const s of shapes) {
    if (s.getShapeType() === SlidesApp.ShapeType.GROUP) {
      const found = findShapeRecursive_(s.getGroup().getChildren(), tag);
      if (found) return found;
    }
    const check = (val) => val && String(val).trim() === tag;
    if (check(s.getDescription()) || check(s.getTitle())) return s;
    try { if (s.getText && check(s.getText().asString())) return s; } catch(e) {}
  }
  return null;
}