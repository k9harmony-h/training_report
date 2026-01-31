/**
 * ============================================================================
 * K9 Harmony - Image Service
 * ============================================================================
 * Google Drive画像をBase64形式で取得するサービス
 * LINE内ブラウザでの画像表示に対応
 *
 * 作成日: 2026-01-30
 */

var ImageService = {

  // 画像サイズ制限（バイト）- Base64変換後のサイズ制限
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB

  // サムネイルサイズ
  THUMBNAIL_SIZE: {
    PROFILE: { width: 400, height: 400 },
    LESSON: { width: 800, height: 600 }
  },

  /**
   * ファイルIDからBase64画像を取得
   * @param {string} fileId - Google DriveのファイルID
   * @param {boolean} [asThumbnail=false] - サムネイルとして取得するか
   * @returns {string|null} Base64形式の画像データ（data:image/...形式）
   */
  getImageAsBase64: function(fileId, asThumbnail) {
    if (!fileId) {
      log('WARN', 'ImageService', 'getImageAsBase64: fileId is empty');
      return null;
    }

    try {
      var file = DriveApp.getFileById(fileId);

      // ファイルサイズチェック
      var fileSize = file.getSize();
      if (fileSize > this.MAX_IMAGE_SIZE) {
        log('WARN', 'ImageService', 'Image too large', { fileId: fileId, size: fileSize });
        return null;
      }

      var blob = file.getBlob();
      var mimeType = blob.getContentType();

      // 画像ファイルかチェック
      if (!mimeType || !mimeType.startsWith('image/')) {
        log('WARN', 'ImageService', 'Not an image file', { fileId: fileId, mimeType: mimeType });
        return null;
      }

      var base64 = Utilities.base64Encode(blob.getBytes());
      var dataUrl = 'data:' + mimeType + ';base64,' + base64;

      log('DEBUG', 'ImageService', 'Image converted to Base64', {
        fileId: fileId,
        mimeType: mimeType,
        originalSize: fileSize,
        base64Length: dataUrl.length
      });

      return dataUrl;

    } catch (e) {
      log('ERROR', 'ImageService', 'Failed to get image', {
        fileId: fileId,
        error: e.message
      });
      return null;
    }
  },

  /**
   * フォルダ内の最新画像を取得
   * @param {string} folderId - Google DriveのフォルダID
   * @param {number} [limit=1] - 取得する画像数
   * @returns {string[]} Base64形式の画像データの配列
   */
  getImagesFromFolder: function(folderId, limit) {
    if (!folderId) {
      log('WARN', 'ImageService', 'getImagesFromFolder: folderId is empty');
      return [];
    }

    limit = limit || 1;
    var images = [];

    try {
      var folder = DriveApp.getFolderById(folderId);
      var files = folder.getFiles();

      // 画像ファイルを収集
      var imageFiles = [];
      while (files.hasNext()) {
        var file = files.next();
        var mimeType = file.getMimeType();

        if (mimeType && mimeType.startsWith('image/')) {
          imageFiles.push({
            file: file,
            date: file.getLastUpdated()
          });
        }
      }

      // 更新日時でソート（新しい順）
      imageFiles.sort(function(a, b) {
        return b.date - a.date;
      });

      // 指定数だけBase64変換
      for (var i = 0; i < Math.min(limit, imageFiles.length); i++) {
        var base64 = this.getImageAsBase64(imageFiles[i].file.getId());
        if (base64) {
          images.push(base64);
        }
      }

      log('DEBUG', 'ImageService', 'Images retrieved from folder', {
        folderId: folderId,
        found: imageFiles.length,
        returned: images.length
      });

      return images;

    } catch (e) {
      log('ERROR', 'ImageService', 'Failed to get images from folder', {
        folderId: folderId,
        error: e.message
      });
      return [];
    }
  },

  /**
   * 犬のプロフィール画像を取得
   * @param {string} dogId - 犬ID
   * @returns {object} { image: string|null, error: string|null }
   */
  getProfileImage: function(dogId) {
    if (!dogId) {
      return { image: null, error: 'dogId is required' };
    }

    try {
      // 犬情報を取得
      var dog = DogRepository.findById(dogId);
      if (!dog) {
        log('WARN', 'ImageService', 'Dog not found', { dogId: dogId });
        return { image: null, error: 'Dog not found' };
      }

      var folderId = dog.dog_shared_folder_id;
      if (!folderId) {
        log('WARN', 'ImageService', 'Dog has no shared folder', { dogId: dogId });
        return { image: null, error: 'No folder configured' };
      }

      // プロフィール写真フォルダを探す
      // 構造: {dog_folder}/Profile_Photo/ または直接 {dog_folder} 内
      var profileFolderId = this._findProfileFolder(folderId);

      if (profileFolderId) {
        var images = this.getImagesFromFolder(profileFolderId, 1);
        if (images.length > 0) {
          return { image: images[0], error: null };
        }
      }

      // プロフィールフォルダがない場合、犬フォルダ直下の最新画像を使用
      var images = this.getImagesFromFolder(folderId, 1);
      if (images.length > 0) {
        return { image: images[0], error: null };
      }

      return { image: null, error: 'No profile image found' };

    } catch (e) {
      log('ERROR', 'ImageService', 'getProfileImage failed', {
        dogId: dogId,
        error: e.message
      });
      return { image: null, error: e.message };
    }
  },

  /**
   * レッスン写真を取得
   * @param {string} dogId - 犬ID
   * @param {string} [lessonId] - レッスンID（省略時は最新レッスン）
   * @returns {object} { images: string[], error: string|null }
   */
  getLessonImages: function(dogId, lessonId) {
    if (!dogId) {
      return { images: [], error: 'dogId is required' };
    }

    try {
      // 犬情報を取得
      var dog = DogRepository.findById(dogId);
      if (!dog) {
        return { images: [], error: 'Dog not found' };
      }

      var folderId = dog.dog_shared_folder_id;
      if (!folderId) {
        return { images: [], error: 'No folder configured' };
      }

      // Lesson_Photo フォルダを探す
      var lessonPhotoFolderId = this._findLessonPhotoFolder(folderId);

      if (lessonPhotoFolderId) {
        // 最新5枚を取得
        var images = this.getImagesFromFolder(lessonPhotoFolderId, 5);
        return { images: images, error: null };
      }

      return { images: [], error: 'No lesson photo folder found' };

    } catch (e) {
      log('ERROR', 'ImageService', 'getLessonImages failed', {
        dogId: dogId,
        error: e.message
      });
      return { images: [], error: e.message };
    }
  },

  /**
   * プロフィール画像のサムネイルURLを取得（Phase 4最適化）
   * Google DriveのサムネイルURLを使用することで、Base64変換を回避
   * @param {string} dogId - 犬ID
   * @param {number} [width=400] - サムネイル幅
   * @returns {string|null} サムネイルURL
   */
  getProfileThumbnailUrl: function(dogId, width) {
    if (!dogId) {
      return null;
    }

    width = width || 400;

    try {
      // 犬情報を取得
      var dog = DogRepository.findById(dogId);
      if (!dog) {
        log('WARN', 'ImageService', 'Dog not found for thumbnail', { dogId: dogId });
        return null;
      }

      var folderId = dog.dog_shared_folder_id;
      if (!folderId) {
        return null;
      }

      // プロフィール写真フォルダを探す
      var profileFolderId = this._findProfileFolder(folderId);
      var targetFolderId = profileFolderId || folderId;

      // フォルダ内の最新画像ファイルを取得
      var folder = DriveApp.getFolderById(targetFolderId);
      var files = folder.getFiles();

      var latestFile = null;
      var latestDate = null;

      while (files.hasNext()) {
        var file = files.next();
        var mimeType = file.getMimeType();

        if (mimeType && mimeType.startsWith('image/')) {
          var updated = file.getLastUpdated();
          if (!latestDate || updated > latestDate) {
            latestDate = updated;
            latestFile = file;
          }
        }
      }

      if (!latestFile) {
        return null;
      }

      // Google DriveのサムネイルURLを生成
      // 形式: https://drive.google.com/thumbnail?id={fileId}&sz=w{width}
      var fileId = latestFile.getId();
      var thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w' + width;

      log('DEBUG', 'ImageService', 'Thumbnail URL generated', {
        dogId: dogId,
        fileId: fileId,
        width: width
      });

      return thumbnailUrl;

    } catch (e) {
      log('ERROR', 'ImageService', 'getProfileThumbnailUrl failed', {
        dogId: dogId,
        error: e.message
      });
      return null;
    }
  },

  /**
   * レッスン写真のサムネイルURLリストを取得
   * @param {string} dogId - 犬ID
   * @param {number} [limit=5] - 取得数
   * @param {number} [width=800] - サムネイル幅
   * @returns {string[]} サムネイルURLの配列
   */
  getLessonThumbnailUrls: function(dogId, limit, width) {
    if (!dogId) {
      return [];
    }

    limit = limit || 5;
    width = width || 800;

    try {
      var dog = DogRepository.findById(dogId);
      if (!dog) {
        return [];
      }

      var folderId = dog.dog_shared_folder_id;
      if (!folderId) {
        return [];
      }

      var lessonFolderId = this._findLessonPhotoFolder(folderId);
      if (!lessonFolderId) {
        return [];
      }

      var folder = DriveApp.getFolderById(lessonFolderId);
      var files = folder.getFiles();

      // 画像ファイルを収集
      var imageFiles = [];
      while (files.hasNext()) {
        var file = files.next();
        var mimeType = file.getMimeType();

        if (mimeType && mimeType.startsWith('image/')) {
          imageFiles.push({
            id: file.getId(),
            date: file.getLastUpdated()
          });
        }
      }

      // 更新日時でソート（新しい順）
      imageFiles.sort(function(a, b) {
        return b.date - a.date;
      });

      // サムネイルURLリスト生成
      var urls = [];
      for (var i = 0; i < Math.min(limit, imageFiles.length); i++) {
        urls.push('https://drive.google.com/thumbnail?id=' + imageFiles[i].id + '&sz=w' + width);
      }

      log('DEBUG', 'ImageService', 'Lesson thumbnail URLs generated', {
        dogId: dogId,
        count: urls.length
      });

      return urls;

    } catch (e) {
      log('ERROR', 'ImageService', 'getLessonThumbnailUrls failed', {
        dogId: dogId,
        error: e.message
      });
      return [];
    }
  },

  /**
   * プロフィール写真フォルダを探す
   * @private
   */
  _findProfileFolder: function(parentFolderId) {
    try {
      var parentFolder = DriveApp.getFolderById(parentFolderId);
      var folders = parentFolder.getFolders();

      while (folders.hasNext()) {
        var folder = folders.next();
        var name = folder.getName().toLowerCase();

        if (name.indexOf('profile') !== -1 || name.indexOf('プロフィール') !== -1) {
          return folder.getId();
        }
      }

      return null;
    } catch (e) {
      log('WARN', 'ImageService', '_findProfileFolder failed', { error: e.message });
      return null;
    }
  },

  /**
   * レッスン写真フォルダを探す
   * @private
   */
  _findLessonPhotoFolder: function(parentFolderId) {
    try {
      var parentFolder = DriveApp.getFolderById(parentFolderId);
      var folders = parentFolder.getFolders();

      while (folders.hasNext()) {
        var folder = folders.next();
        var name = folder.getName().toLowerCase();

        if (name.indexOf('lesson') !== -1 || name.indexOf('レッスン') !== -1) {
          return folder.getId();
        }
      }

      return null;
    } catch (e) {
      log('WARN', 'ImageService', '_findLessonPhotoFolder failed', { error: e.message });
      return null;
    }
  }
};

// グローバルスコープにエクスポート
if (typeof module !== 'undefined') {
  module.exports = ImageService;
}
