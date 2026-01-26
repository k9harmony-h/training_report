/**
 * ============================================================================
 * K9 Harmony - Debug Utilities
 * ============================================================================
 * デバッグ用のログスタンプとコンソール表示
 * 最終更新: 2026-01-17
 */

const DEBUG_MODE = true; // 本番環境では false に設定

class DebugConsole {
  constructor() {
    this.logs = [];
    this.maxLogs = 100;
    this.isMinimized = false;
    
    if (DEBUG_MODE) {
      this.init();
    }
  }

  /**
   * 初期化
   */
  init() {
    // ページロード時刻表示
    this.updateTimestamp();
    
    // コンソールボタンイベント
    this.attachEventListeners();
    
    // console.log, console.error等をオーバーライド
    this.overrideConsole();
    
    // グローバルエラーキャッチ
    this.catchGlobalErrors();
    
    this.log('Debug mode enabled', 'info');
  }

  /**
   * タイムスタンプ更新
   */
  updateTimestamp() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const timestampEl = document.getElementById('page-load-time');
    if (timestampEl) {
      timestampEl.textContent = `Loaded at ${timeStr}`;
    }
  }

  /**
   * イベントリスナー設定
   */
  attachEventListeners() {
    // Clearボタン
    const clearBtn = document.getElementById('debug-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clear());
    }
    
    // Minimize/Maximizeボタン
    const toggleBtn = document.getElementById('debug-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggle());
    }
  }

  /**
   * コンソールメソッドをオーバーライド
   */
  overrideConsole() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = (...args) => {
      originalLog.apply(console, args);
      this.log(args.join(' '), 'info');
    };
    
    console.error = (...args) => {
      originalError.apply(console, args);
      this.log(args.join(' '), 'error');
    };
    
    console.warn = (...args) => {
      originalWarn.apply(console, args);
      this.log(args.join(' '), 'warn');
    };
  }

  /**
   * グローバルエラーキャッチ
   */
  catchGlobalErrors() {
    window.addEventListener('error', (event) => {
      this.log(`❌ ${event.message} at ${event.filename}:${event.lineno}`, 'error');
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.log(`❌ Unhandled Promise Rejection: ${event.reason}`, 'error');
    });
  }

  /**
   * ログ追加
   */
  log(message, level = 'info') {
    if (!DEBUG_MODE) return;
    
    const timestamp = new Date().toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    
    const logEntry = {
      timestamp,
      message,
      level
    };
    
    this.logs.push(logEntry);
    
    // 最大ログ数を超えたら古いものを削除
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    this.render();
  }

  /**
   * ログ表示
   */
  render() {
    const consoleBody = document.getElementById('debug-console-body');
    if (!consoleBody) return;
    
    consoleBody.innerHTML = '';
    
    this.logs.forEach(log => {
      const logDiv = document.createElement('div');
      logDiv.className = `debug-log ${log.level}`;
      logDiv.innerHTML = `<span class="timestamp">${log.timestamp}</span>${log.message}`;
      consoleBody.appendChild(logDiv);
    });
    
    // 最新ログにスクロール
    consoleBody.scrollTop = consoleBody.scrollHeight;
  }

  /**
   * ログクリア
   */
  clear() {
    this.logs = [];
    this.render();
    this.log('Console cleared', 'info');
  }

  /**
   * 最小化/最大化トグル
   */
  toggle() {
    const consoleEl = document.getElementById('debug-console');
    const toggleBtn = document.getElementById('debug-toggle-btn');
    
    if (consoleEl) {
      this.isMinimized = !this.isMinimized;
      consoleEl.classList.toggle('minimized', this.isMinimized);
      
      if (toggleBtn) {
        toggleBtn.textContent = this.isMinimized ? 'Maximize' : 'Minimize';
      }
    }
  }
}

// グローバルインスタンス
const debugConsole = new DebugConsole();

/**
 * グローバル関数: デバッグログ
 */
window.debugLog = function(message, level = 'info') {
  debugConsole.log(message, level);
};