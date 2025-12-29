/**
 * js/common.js
 * 共通関数 + デバッグコンソール（ページ下部埋め込み版）
 * v18.2-Fix-Console
 */

// ==========================================
// 1. デバッグ機能 (埋め込み表示)
// ==========================================
const DEBUG_VERSION = "v18.2-Debug-Inline"; 
const logBuffer = [];

function appendLogToScreen(type, msg) {
    const consoleDiv = document.getElementById('floating-console-output');
    if (consoleDiv) {
        const line = document.createElement('div');
        line.style.borderBottom = "1px solid #333";
        line.style.padding = "2px 0";
        line.style.color = type === 'error' ? '#ff4444' : '#00ff00';
        line.style.fontSize = "11px";
        line.style.fontFamily = "monospace";
        line.style.wordBreak = "break-all";
        
        const time = new Date().toLocaleTimeString();
        line.innerText = `[${time}] ${msg}`;
        
        consoleDiv.prepend(line); 
    } else {
        logBuffer.push({ type, msg });
    }
}

// コンソールジャック
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    originalLog.apply(console, args);
    const msg = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
    appendLogToScreen('log', msg);
};

console.error = function(...args) {
    originalError.apply(console, args);
    const msg = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
    appendLogToScreen('error', msg);
};

window.onerror = function(message, source, lineno, colno, error) {
    appendLogToScreen('error', `Global Error: ${message} (${source}:${lineno})`);
};

// DOM構築後
document.addEventListener('DOMContentLoaded', () => {
    // スタイル定義 (position: fixed を削除し、最下部に追加されるように変更)
    const style = document.createElement('style');
    style.innerHTML = `
        #floating-debug-wrapper {
            width: 100%; 
            background: #111; 
            color: #0f0; 
            z-index: 9999;
            display: flex; 
            flex-direction: column; 
            border-top: 2px solid #00ff00;
            margin-top: 50px; /* フッターとの余白 */
            padding-bottom: 50px; /* スクロール余裕 */
        }
        #floating-header {
            background: #004400; color: #fff; padding: 5px 10px; cursor: pointer;
            font-size: 12px; font-weight: bold; display: flex; justify-content: space-between;
        }
        #floating-console-output {
            padding: 10px;
            max-height: 400px; /* 必要なら高さ制限 */
            overflow-y: auto;
        }
        #version-stamp-fixed {
            position: fixed; top: 0; left: 0; background: #ff0000; color: #fff;
            padding: 2px 5px; font-size: 10px; z-index: 2147483647; pointer-events: none;
        }
    `;
    document.head.appendChild(style);

    // スタンプ (これは画面左上に固定のまま)
    const stamp = document.createElement('div');
    stamp.id = 'version-stamp-fixed';
    stamp.innerText = DEBUG_VERSION;
    document.body.appendChild(stamp);

    // コンソール本体 (bodyの最後に追加)
    const wrapper = document.createElement('div');
    wrapper.id = 'floating-debug-wrapper';
    wrapper.innerHTML = `
        <div id="floating-header">
            <span>▼ System Log</span>
            <span onclick="document.getElementById('floating-console-output').innerHTML=''">Clear</span>
        </div>
        <div id="floating-console-output"></div>
    `;
    document.body.appendChild(wrapper);

    // バッファ出力
    logBuffer.forEach(item => appendLogToScreen(item.type, item.msg));
    
    startTipsSlider();
});

// ==========================================
// 2. 共通ロジック
// ==========================================
let currentUserId = null;

async function initLiff(successCallback) {
    if (typeof liff === 'undefined') {
        showError('SDK Error', 'LIFF SDK not loaded.');
        return;
    }
    try {
        console.log('LIFF Init Start...'); 
        await liff.init({ liffId: Config.LIFF_ID });
        console.log('LIFF Init Success. LoggedIn: ' + liff.isLoggedIn());

        if (!liff.isLoggedIn()) {
            console.log('Not logged in. Redirecting...');
            liff.login({ redirectUri: window.location.href });
            return;
        }

        const profile = await liff.getProfile();
        currentUserId = profile.userId;
        console.log(`User ID Acquired: ${currentUserId}`);

        if (successCallback) successCallback(currentUserId);

    } catch (err) {
        console.error('LIFF Init Error: ' + err.message);
        showError('LIFF Init Error', err.message);
    }
}

function log(msg) { console.log(msg); } // 互換性

function showError(title, msg, userId) {
    hideLoading();
    console.error(`[UI Error] ${title}: ${msg}`);
    
    const main = document.getElementById('mainContent') || document.getElementById('mainWrapper');
    if(main) main.style.display = 'none';
    
    const errDiv = document.getElementById('errorView') || document.getElementById('errorContainer');
    if(errDiv) {
        errDiv.style.display = 'block';
        const tEl = document.getElementById('errorTitle');
        const mEl = document.getElementById('errorMessage') || document.getElementById('errorMsg');
        if(tEl) tEl.innerText = title;
        if(mEl) mEl.innerText = msg;
        if (userId && document.getElementById('dispLineId')) {
            document.getElementById('dispLineId').innerText = userId;
            document.getElementById('dispLineId').style.display = 'block';
        }
    } else {
        alert(`【Error】${title}\n${msg}`);
    }
}

function showLoading() {
    const el = document.getElementById('loadingOverlay');
    if(el) { el.style.visibility = 'visible'; el.style.opacity = '1'; }
}

function hideLoading() {
    const el = document.getElementById('loadingOverlay');
    if(el) {
        el.style.opacity = '0';
        setTimeout(() => { el.style.visibility = 'hidden'; }, 500);
    }
    document.body.classList.add('loaded');
}

function startTipsSlider() {
    const tipsText = document.getElementById('tipsText');
    if(!tipsText) return;
    const dogTips = ["犬の鼻紋は指紋と同じ", "聴力は人の4倍", "嗅覚は人の100万倍", "汗は肉球から", "あくびは落ち着くサイン"];
    let idx = 0;
    tipsText.innerText = dogTips[idx];
    setInterval(() => {
        idx = (idx + 1) % dogTips.length;
        tipsText.innerText = dogTips[idx];
    }, 2500);
}

function extractFileId(url) {
    if (!url) return null;
    const match = url.match(/id=([-\w]{25,})/) || url.match(/\/d\/([-\w]{25,})/) || url.match(/[-\w]{25,}/);
    return match ? match[1] : null;
}
