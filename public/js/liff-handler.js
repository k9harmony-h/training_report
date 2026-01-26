/**
 * ============================================================================
 * K9 Harmony - LIFF Handler
 * ============================================================================
 * LIFF SDK初期化とユーザー情報管理
 * 最終更新: 2026-01-26
 * 変更内容: FRONTEND_CONFIG → CONFIG に統一
 */

class LiffHandler {
    constructor() {
      this.isInitialized = false;
      this.accessToken = null;
      this.userId = null;
      this.userProfile = null;
    }
  
    /**
     * LIFF初期化
     * @returns {Promise<boolean>} 初期化成功/失敗
     */
    async init() {
      try {
        console.log('[LIFF] Initializing...');
        
        await liff.init({
          liffId: CONFIG.LIFF.ID
        });
        
        this.isInitialized = true;
        console.log('[LIFF] Initialized successfully');
        
        // ログイン状態チェック
        if (!liff.isLoggedIn()) {
          console.log('[LIFF] User not logged in, redirecting to login...');
          liff.login();
          return false;
        }
        
        // アクセストークン取得
        this.accessToken = liff.getAccessToken();
        console.log('[LIFF] Access token obtained');
        
        // ユーザー情報取得
        await this.loadUserProfile();
        
        return true;
        
      } catch (error) {
        console.error('[LIFF] Initialization failed:', error);
        throw new Error(CONFIG.ERROR_MESSAGES.LIFF_INIT_FAILED);
      }
    }
  
    /**
     * ユーザープロフィール取得
     */
    async loadUserProfile() {
      try {
        this.userProfile = await liff.getProfile();
        this.userId = this.userProfile.userId;
        
        console.log('[LIFF] User profile loaded:', {
          userId: this.userId,
          displayName: this.userProfile.displayName
        });
        
      } catch (error) {
        console.error('[LIFF] Failed to load user profile:', error);
        throw error;
      }
    }
  
    /**
     * アクセストークン取得
     * @returns {string} アクセストークン
     */
    getAccessToken() {
      if (!this.accessToken) {
        throw new Error(CONFIG.ERROR_MESSAGES.NOT_LOGGED_IN);
      }
      return this.accessToken;
    }
  
    /**
     * ユーザーID取得
     * @returns {string} ユーザーID
     */
    getUserId() {
      if (!this.userId) {
        throw new Error(CONFIG.ERROR_MESSAGES.NOT_LOGGED_IN);
      }
      return this.userId;
    }
  
    /**
     * ユーザー表示名取得
     * @returns {string} 表示名
     */
    getUserDisplayName() {
      return this.userProfile ? this.userProfile.displayName : '';
    }
  
    /**
     * ユーザープロフィール画像URL取得
     * @returns {string} プロフィール画像URL
     */
    getUserPictureUrl() {
      return this.userProfile ? this.userProfile.pictureUrl : '';
    }
  
    /**
     * LIFFブラウザで開いているかチェック
     * @returns {boolean}
     */
    isInClient() {
      return liff.isInClient();
    }
  
    /**
     * LIFF終了（LINEアプリに戻る）
     */
    closeWindow() {
      if (this.isInClient()) {
        liff.closeWindow();
      } else {
        // 外部ブラウザの場合はページを閉じる
        window.close();
      }
    }
  
    /**
     * LINEトークへメッセージ送信
     * @param {Array} messages - 送信するメッセージ配列
     */
    async sendMessages(messages) {
      try {
        if (!this.isInClient()) {
          console.warn('[LIFF] sendMessages is only available in LINE app');
          return false;
        }
        
        await liff.sendMessages(messages);
        console.log('[LIFF] Messages sent successfully');
        return true;
        
      } catch (error) {
        console.error('[LIFF] Failed to send messages:', error);
        return false;
      }
    }
  
    /**
     * 外部URLを開く
     * @param {string} url - 開くURL
     */
    openExternalUrl(url) {
      if (this.isInClient()) {
        liff.openWindow({
          url: url,
          external: true
        });
      } else {
        window.open(url, '_blank');
      }
    }
  }
  
  // グローバルインスタンス
  const liffHandler = new LiffHandler();