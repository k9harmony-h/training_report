/**
 * js/common.js
 * 共通関数・LIFF初期化ロジック
 */

// グローバル変数
let currentUserId = null;

// ページ読み込み時の共通処理
document.addEventListener('DOMContentLoaded', () => {
    // Tipsスライダーの開始 (もし要素があれば)
    startTipsSlider();
});

/**
 * LIFF初期化ラッパー
 * @param {Function} successCallback - ログイン成功時に実行する関数
 */
async function initLiff(successCallback) {
    if (typeof liff === 'undefined') {
        showError('SDK Error', 'LIFF SDK not loaded.');
        return;
    }
    try {
        await liff.init({ liffId: Config.LIFF_ID });
        
        // ログインしていない場合はログイン画面へ
        if (!liff.isLoggedIn()) {
            liff.login({ redirectUri: window.location.href });
            return;
        }

        const profile = await liff.getProfile();
        currentUserId = profile.userId;
        log(`User: ${currentUserId}`);

        // コールバック実行
        if (successCallback) successCallback(currentUserId);

    } catch (err) {
        showError('LIFF Init Error', err.message);
    }
}

/**
 * 簡易ログ出力 (デバッグ用)
 */
function log(msg) {
    console.log(msg);
    const el = document.getElementById('debug-console');
    if(el) el.innerHTML = `[${new Date().toLocaleTimeString()}] ${msg}<br>` + el.innerHTML;
}

/**
 * エラー表示
 */
function showError(title, msg, userId) {
    hideLoading();
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
        alert(`${title}: ${msg}`);
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
 * Tipsスライダー (ローディング中の豆知識)
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
