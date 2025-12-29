/**
 * js/admin.js
 * 管理画面ロジック (Fetch API Only)
 */

window.onload = function() {
    fetchDashboard();
};

async function fetchDashboard() {
    try {
        const payload = {
            action: 'get_admin_dashboard',
            apiKey: Config.ADMIN_KEY // Configからキー参照
        };

        const response = await fetch(Config.GAS_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.status === 'success') {
            renderDashboard(result.data);
        } else {
            alert('認証エラー: ' + result.message);
        }
    } catch (e) {
        console.error(e);
        document.getElementById('loading-spinner').innerText = '通信エラー';
    }
}

// ... (renderDashboard, toggleSystem 等) ...
