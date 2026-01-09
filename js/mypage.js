/**
 * ============================================================================
 * K9 Harmony - MyPage
 * ============================================================================
 * マイページのメインロジック
 * 最終更新: 2026-01-09
 */

class MyPageApp {
  constructor() {
    // データ管理
    this.customerData = null;
    this.reservations = [];
    this.upcomingReservations = [];
    this.pastReservations = [];
    
    // 選択中の予約
    this.selectedReservation = null;
    
    // UI要素
    this.loadingOverlay = null;
    this.lottieAnimation = null;
  }

  /**
   * アプリ初期化
   */
  async init() {
    try {
      this.showLoading('初期化中...');
      
      // LIFF初期化
      const liffSuccess = await liffHandler.init();
      if (!liffSuccess) {
        return; // ログイン画面にリダイレクト済み
      }
      
      // データ読み込み
      await this.loadData();
      
      // UI初期化
      this.initUI();
      
      // 予約リスト表示
      this.renderReservations();
      
      this.hideLoading();
      
    } catch (error) {
      console.error('[MyPage] Initialization failed:', error);
      this.hideLoading();
      this.showError(error.message);
    }
  }

  /**
   * データ読み込み
   */
  async loadData() {
    try {
      // 顧客情報取得
      const customerResponse = await apiClient.getCustomerData();
      this.customerData = customerResponse.customer;
      
      // 予約一覧取得
      const reservationsResponse = await apiClient.getMyReservations();
      this.reservations = reservationsResponse.reservations || [];
      
      // 予約を今後/過去で分類
      this.classifyReservations();
      
      console.log('[MyPage] Data loaded:', {
        customer: this.customerData,
        total: this.reservations.length,
        upcoming: this.upcomingReservations.length,
        past: this.pastReservations.length
      });
      
    } catch (error) {
      console.error('[MyPage] Failed to load data:', error);
      throw error;
    }
  }

  /**
   * 予約を今後/過去で分類
   */
  classifyReservations() {
    const now = new Date();
    
    this.upcomingReservations = this.reservations.filter(r => {
      const reservationDate = new Date(`${r.reservation_date} ${r.start_time}`);
      return reservationDate >= now && (r.status === 'CONFIRMED' || r.status === 'LOCKED');
    }).sort((a, b) => {
      const dateA = new Date(`${a.reservation_date} ${a.start_time}`);
      const dateB = new Date(`${b.reservation_date} ${b.start_time}`);
      return dateA - dateB;
    });
    
    this.pastReservations = this.reservations.filter(r => {
      const reservationDate = new Date(`${r.reservation_date} ${r.start_time}`);
      return reservationDate < now || r.status === 'COMPLETED' || r.status === 'CANCELLED' || r.status === 'NO_SHOW';
    }).sort((a, b) => {
      const dateA = new Date(`${a.reservation_date} ${a.start_time}`);
      const dateB = new Date(`${b.reservation_date} ${b.start_time}`);
      return dateB - dateA; // 新しい順
    });
  }

  /**
   * UI初期化
   */
  initUI() {
    // ローディングオーバーレイ取得
    this.loadingOverlay = document.getElementById('loading-overlay');
    
    // Lottieアニメーション初期化
    this.initLottieAnimation();
    
    // 顧客情報表示
    this.renderCustomerInfo();
    
    // イベントリスナー設定
    this.attachEventListeners();
    
    console.log('[MyPage] UI initialized');
  }

  /**
   * Lottieアニメーション初期化
   */
  initLottieAnimation() {
    const container = document.getElementById('lottie-animation');
    
    if (container) {
      this.lottieAnimation = lottie.loadAnimation({
        container: container,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: FRONTEND_CONFIG.LOTTIE.LOADING_DOG
      });
    }
  }

  /**
   * イベントリスナー設定
   */
  attachEventListeners() {
    // キャンセルモーダル
    const cancelModal = document.getElementById('cancel-modal');
    const modalClose = document.getElementById('modal-close');
    const cancelNo = document.getElementById('cancel-no');
    const cancelYes = document.getElementById('cancel-yes');
    
    if (modalClose) {
      modalClose.addEventListener('click', () => this.hideCancelModal());
    }
    if (cancelNo) {
      cancelNo.addEventListener('click', () => this.hideCancelModal());
    }
    if (cancelYes) {
      cancelYes.addEventListener('click', () => this.confirmCancel());
    }
    
    // 詳細モーダル
    const detailClose = document.getElementById('detail-close');
    const detailOk = document.getElementById('detail-ok');
    
    if (detailClose) {
      detailClose.addEventListener('click', () => this.hideDetailModal());
    }
    if (detailOk) {
      detailOk.addEventListener('click', () => this.hideDetailModal());
    }
    
    // モーダルオーバーレイクリック
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      const overlay = modal.querySelector('.modal-overlay');
      if (overlay) {
        overlay.addEventListener('click', () => {
          if (modal.id === 'cancel-modal') {
            this.hideCancelModal();
          } else if (modal.id === 'detail-modal') {
            this.hideDetailModal();
          }
        });
      }
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // レンダリング
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 顧客情報表示
   */
  renderCustomerInfo() {
    const nameElement = document.getElementById('customer-name');
    const badgeElement = document.getElementById('lifecycle-badge');
    
    if (nameElement && this.customerData) {
      nameElement.textContent = `${this.customerData.customer_name} 様`;
    }
    
    if (badgeElement && this.customerData) {
      const lifecycle = this.customerData.lifecycle_stage || 'BRONZE';
      badgeElement.textContent = lifecycle;
      badgeElement.className = `lifecycle-badge lifecycle-${lifecycle.toLowerCase()}`;
    }
  }

  /**
   * 予約リスト表示
   */
  renderReservations() {
    // 今後の予約
    this.renderUpcomingReservations();
    
    // 過去の予約
    this.renderPastReservations();
  }

  /**
   * 今後の予約表示
   */
  renderUpcomingReservations() {
    const container = document.getElementById('upcoming-reservations');
    const emptyState = document.getElementById('upcoming-empty');
    const countElement = document.getElementById('upcoming-count');
    
    if (countElement) {
      countElement.textContent = `${this.upcomingReservations.length}件`;
    }
    
    if (this.upcomingReservations.length === 0) {
      if (container) container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    if (container) {
      container.innerHTML = '';
      this.upcomingReservations.forEach(reservation => {
        const card = this.createReservationCard(reservation, true);
        container.appendChild(card);
      });
    }
  }

  /**
   * 過去の予約表示
   */
  renderPastReservations() {
    const container = document.getElementById('past-reservations');
    const emptyState = document.getElementById('past-empty');
    const countElement = document.getElementById('past-count');
    
    if (countElement) {
      countElement.textContent = `${this.pastReservations.length}件`;
    }
    
    if (this.pastReservations.length === 0) {
      if (container) container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    if (container) {
      container.innerHTML = '';
      this.pastReservations.forEach(reservation => {
        const card = this.createReservationCard(reservation, false);
        container.appendChild(card);
      });
    }
  }

  /**
   * 予約カード作成
   */
  createReservationCard(reservation, canCancel) {
    const card = document.createElement('div');
    card.className = 'reservation-card';
    
    // 日時フォーマット
    const date = new Date(reservation.reservation_date);
    const dateStr = date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
    
    // ステータスバッジ
    const statusBadge = this.getStatusBadge(reservation.status);
    
    // キャンセル可能かチェック（24時間前まで）
    const reservationDateTime = new Date(`${reservation.reservation_date} ${reservation.start_time}`);
    const now = new Date();
    const hoursDiff = (reservationDateTime - now) / (1000 * 60 * 60);
    const cancelable = canCancel && hoursDiff >= 24;
    
    card.innerHTML = `
      <div class="reservation-card-header">
        <div class="reservation-date">${dateStr} ${reservation.start_time}</div>
        ${statusBadge}
      </div>
      <div class="reservation-card-body">
        <div class="reservation-info">
          <div class="info-row">
            <span class="info-icon">🐕</span>
            <span class="info-text">${reservation.dog_name || '-'}</span>
          </div>
          <div class="info-row">
            <span class="info-icon">📦</span>
            <span class="info-text">${reservation.product_name || '-'}</span>
          </div>
          <div class="info-row">
            <span class="info-icon">👤</span>
            <span class="info-text">${reservation.trainer_name || 'スタッフ'}</span>
          </div>
          <div class="info-row">
            <span class="info-icon">🔖</span>
            <span class="info-text">予約番号: ${reservation.reservation_code || '-'}</span>
          </div>
        </div>
      </div>
      <div class="reservation-card-footer">
        <button class="btn btn-secondary btn-sm" data-action="detail" data-id="${reservation.reservation_id}">
          詳細
        </button>
        ${cancelable ? `
          <button class="btn btn-danger btn-sm" data-action="cancel" data-id="${reservation.reservation_id}">
            キャンセル
          </button>
        ` : ''}
      </div>
    `;
    
    // イベントリスナー
    const detailBtn = card.querySelector('[data-action="detail"]');
    if (detailBtn) {
      detailBtn.addEventListener('click', () => this.showDetail(reservation));
    }
    
    const cancelBtn = card.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.showCancelModal(reservation));
    }
    
    return card;
  }

  /**
   * ステータスバッジ取得
   */
  getStatusBadge(status) {
    const badges = {
      'CONFIRMED': '<span class="status-badge status-confirmed">確定</span>',
      'LOCKED': '<span class="status-badge status-locked">仮予約</span>',
      'COMPLETED': '<span class="status-badge status-completed">完了</span>',
      'CANCELLED': '<span class="status-badge status-cancelled">キャンセル</span>',
      'NO_SHOW': '<span class="status-badge status-noshow">欠席</span>'
    };
    return badges[status] || '';
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // モーダル操作
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 詳細表示
   */
  showDetail(reservation) {
    this.selectedReservation = reservation;
    
    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('detail-content');
    
    if (content) {
      const date = new Date(reservation.reservation_date);
      const dateStr = date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      });
      
      content.innerHTML = `
        <div class="detail-section">
          <h4>予約情報</h4>
          <dl class="detail-list">
            <dt>予約番号</dt>
            <dd>${reservation.reservation_code || '-'}</dd>
            <dt>日時</dt>
            <dd>${dateStr} ${reservation.start_time}</dd>
            <dt>所要時間</dt>
            <dd>${reservation.duration || 90}分</dd>
            <dt>ステータス</dt>
            <dd>${this.getStatusBadge(reservation.status)}</dd>
          </dl>
        </div>
        
        <div class="detail-section">
          <h4>レッスン内容</h4>
          <dl class="detail-list">
            <dt>犬</dt>
            <dd>${reservation.dog_name || '-'}</dd>
            <dt>コース</dt>
            <dd>${reservation.product_name || '-'}</dd>
            <dt>担当トレーナー</dt>
            <dd>${reservation.trainer_name || 'スタッフ'}</dd>
          </dl>
        </div>
        
        ${reservation.amount ? `
          <div class="detail-section">
            <h4>料金</h4>
            <dl class="detail-list">
              <dt>合計金額</dt>
              <dd>¥${Number(reservation.amount).toLocaleString('ja-JP')}</dd>
            </dl>
          </div>
        ` : ''}
      `;
    }
    
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  /**
   * 詳細モーダルを閉じる
   */
  hideDetailModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    this.selectedReservation = null;
  }

  /**
   * キャンセル確認モーダル表示
   */
  showCancelModal(reservation) {
    this.selectedReservation = reservation;
    
    const modal = document.getElementById('cancel-modal');
    const summary = document.getElementById('cancel-summary');
    
    if (summary) {
      const date = new Date(reservation.reservation_date);
      const dateStr = date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      });
      
      summary.innerHTML = `
        <div class="reservation-summary-item">
          <strong>日時:</strong> ${dateStr} ${reservation.start_time}
        </div>
        <div class="reservation-summary-item">
          <strong>犬:</strong> ${reservation.dog_name}
        </div>
        <div class="reservation-summary-item">
          <strong>コース:</strong> ${reservation.product_name}
        </div>
      `;
    }
    
    // キャンセル理由をクリア
    const reasonInput = document.getElementById('cancel-reason');
    if (reasonInput) {
      reasonInput.value = '';
    }
    
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  /**
   * キャンセル確認モーダルを閉じる
   */
  hideCancelModal() {
    const modal = document.getElementById('cancel-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    this.selectedReservation = null;
  }

  /**
   * キャンセル確定
   */
  async confirmCancel() {
    if (!this.selectedReservation) return;
    
    try {
      this.showLoading('キャンセル処理中...');
      
      const reasonInput = document.getElementById('cancel-reason');
      const reason = reasonInput ? reasonInput.value : '';
      
      const response = await apiClient.cancelReservation(
        this.selectedReservation.reservation_id,
        reason
      );
      
      this.hideLoading();
      this.hideCancelModal();
      
      this.showSuccess('予約をキャンセルしました');
      
      // データ再読み込み
      await this.loadData();
      this.renderReservations();
      
    } catch (error) {
      console.error('[MyPage] Cancel failed:', error);
      this.hideLoading();
      this.showError(error.message);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ローディング・通知
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * ローディング表示
   */
  showLoading(message = '読み込み中...') {
    if (this.loadingOverlay) {
      const loadingText = this.loadingOverlay.querySelector('.loading-text');
      if (loadingText) {
        loadingText.textContent = message;
      }
      this.loadingOverlay.classList.remove('hidden');
    }
  }

  /**
   * ローディング非表示
   */
  hideLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.add('hidden');
    }
  }

  /**
   * エラーメッセージ表示
   */
  showError(message) {
    this.showToast(message, 'error');
  }

  /**
   * 成功メッセージ表示
   */
  showSuccess(message) {
    this.showToast(message, 'success');
  }

  /**
   * トースト表示
   */
  showToast(message, type = 'info') {
    // 既存のトーストを削除
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    // 新しいトースト作成
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 自動削除
    setTimeout(() => {
      toast.remove();
    }, FRONTEND_CONFIG.UI.TOAST_DURATION);
  }
}

// グローバルインスタンス
const myPageApp = new MyPageApp();

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
  myPageApp.init();
});