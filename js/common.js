/**
 * js/common.js
 * 共通関数・LIFF初期化ロジック + 【緊急デバッグモード】
 * 最終更新: 2025-12-29 Debug
 */

// ==========================================
// 1. 緊急デバッグ機能 (画面へのログ出力)
// ==========================================
const DEBUG_VERSION = "v18.1-DEBUG"; // 更新されたか確認するためのスタンプ

// ログ保存用バッファ (画面描画前に発生したログを溜める)
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
        
        consoleDiv.prepend(line); // 新しいものを上に
    } else {
        logBuffer.push({ type, msg });
    }
}

// コンソール関数のオーバーライド (標準のコンソールにも出しつつ、画面にも出す)
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    originalLog.apply(console, args);
    // オブジェクトの場合はJSON文字列化を試みる
    const msg = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
    appendLogToScreen('log', msg);
};

console.error = function(...args) {
    originalError.apply(console, args);
    const msg = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
    appendLogToScreen('error', msg);
};

// 予期せぬエラーの捕捉
window.onerror = function(message, source, lineno, colno, error) {
    appendLogToScreen('error', `Global Error: ${message} (${source}:${lineno})`);
};

// 画面構築 (DOMが準備できたらコンソールを表示)
document.addEventListener('DOMContentLoaded', () => {
    // 1. スタイルの注入
    const style = document.createElement('style');
    style.innerHTML = `
        #floating-debug-wrapper {
            position: fixed; bottom: 0; left: 0; width: 100%; height: 30vh;
            background: rgba(0,0,0,0.85); color: #0f0; z-index: 2147483647;
            display: flex; flex-direction: column; border-top: 2px solid #00ff00;
            transition: height 0.3s;
        }
        #floating-debug-wrapper.minimized { height: 30px; }
        #floating-header {
            background: #004400; color: #fff; padding: 5px 10px; cursor: pointer;
            font-size: 12px; font-weight: bold; display: flex; justify-content: space-between;
        }
        #floating-console-output {
            flex: 1; overflow-y: scroll; padding: 10px;
        }
        #version-stamp-fixed {
            position: fixed; top: 0; left: 0; background: #ff0000; color: #fff;
            padding: 2px 5px; font-size: 10px; z-index: 2147483647; pointer-events: none;
        }
    `;
    document.head.appendChild(style);

    // 2. スタンプ表示
    const stamp = document.createElement('div');
    stamp.id = 'version-stamp-fixed';
    stamp.innerText = DEBUG_VERSION;
    document.body.appendChild(stamp);

    // 3. コンソール画面表示
    const wrapper = document.createElement('div');
    wrapper.id = 'floating-debug-wrapper';
    wrapper.innerHTML = `
        <div id="floating-header" onclick="document.getElementById('floating-debug-wrapper').classList.toggle('minimized')">
            <span>▼ Debug Console (Tap to toggle)</span>
            <span onclick="document.getElementById('floating-console-output').innerHTML=''">Clear</span>
        </div>
        <div id="floating-console-output"></div>
    `;
    document.body.appendChild(wrapper);

    // 4. バッファに溜まっていたログを吐き出す
    logBuffer.forEach(item => appendLogToScreen(item.type, item.msg));
    
    // 5. Tipsスライダー開始 (既存機能)
    startTipsSlider();
});


// ==========================================
// 2. 既存の共通ロジック (そのまま維持)
// ==========================================

let currentUserId = null;

/**
 * LIFF初期化ラッパー
 */
async function initLiff(successCallback) {
    if (typeof liff === 'undefined') {
        showError('SDK Error', 'LIFF SDK not loaded.');
        return;
    }
    try {
        console.log('LIFF Init Start...'); // ログ確認用
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

/**
 * 簡易ログ出力ラッパー (後方互換性のため残すが、実態はconsole.log)
 */
function log(msg) {
    console.log(msg); 
}

/**
 * エラー表示
 */
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
        
        if (userId) {
            const idBox = document.getElementById('dispLineId');
            if(idBox) {
                idBox.innerText = userId;
                idBox.style.display = 'block';
            }
        }
    } else {
        // エラー画面要素がないページ用
        alert(`【Error】${title}\n${msg}`);
    }
}

/**
 * ローディング制御
 */
function showLoading() {
    const el = document.getElementById('loadingOverlay');
    if(el) {
        el.style.visibility = 'visible';
        el.style.opacity = '1';
    }
}

function hideLoading() {
    const el = document.getElementById('loadingOverlay');
    if(el) {
        el.style.opacity = '0';
        setTimeout(() => { el.style.visibility = 'hidden'; }, 500);
    }
    document.body.classList.add('loaded');
}

/**
 * Tipsスライダー
 */
function startTipsSlider() {
    const tipsText = document.getElementById('tipsText');
    if(!tipsText) return;
    
    const dogTips = [
        "犬の鼻紋は人間の指紋と同じで、一頭一頭違います。", "犬は人間の約4倍の聴力を持っています。",
        "犬の嗅覚は人間の100万倍〜1億倍とも言われます。", "犬は汗を肉球からしかかけません。",
        "犬があくびをするのは、ストレスを感じて落ち着こうとしている時もあります。",
        "小型犬の方が大型犬よりも長生きする傾向があります。", "犬は夢を見ます。寝言を言ったり足を動かすのはその証拠です。"
    ];
    
    let currentTipIndex = Math.floor(Math.random() * dogTips.length);
    tipsText.innerText = dogTips[currentTipIndex];
    
    setInterval(() => {
        currentTipIndex = (currentTipIndex + 1) % dogTips.length;
        tipsText.innerText = dogTips[currentTipIndex];
    }, 2500);
}

/**
 * Google Drive URLからファイルIDを抽出
 */
function extractFileId(url) {
    if (!url) return null;
    const match = url.match(/id=([-\w]{25,})/) || url.match(/\/d\/([-\w]{25,})/) || url.match(/[-\w]{25,}/);
    return match ? match[1] : null;
}
