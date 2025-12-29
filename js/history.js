/**
 * js/history.js
 * 履歴画面ロジック
 */

let allHistoryData = [];
let customerData = {};
let currentDogId = null;
let globalDogList = [];

window.onload = function() {
    startTipsSlider();
    initLiff((userId) => {
        const urlParams = new URLSearchParams(window.location.search);
        currentDogId = urlParams.get('dogId');
        fetchHistoryData(userId, currentDogId);
    });
};

function fetchHistoryData(userId, dogId) {
    let url = `${Config.GAS_URL}?userId=${userId}&t=${new Date().getTime()}`;
    if (dogId) url += `&dogId=${dogId}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                showError('データ取得エラー', data.error);
                return;
            }
            
            allHistoryData = data.score_history || [];
            customerData = data.customer || {};
            if(data.dog) currentDogId = data.dog.id;
            
            if (data.all_dogs && data.all_dogs.length > 1) {
                globalDogList = data.all_dogs;
                document.getElementById('btnSwitchDog').style.display = 'block';
                document.getElementById('btnSwitchDog').onclick = openDogSelectModal;
            }

            // タイトル設定
            if (data.dog && data.dog.name_disp) {
                document.getElementById('pageTitle').innerText = `${data.dog.name_disp}'s History`;
            }

            renderHistoryList();
            renderHistoryChart(); // チャート描画ロジックへ
            
            // ギャラリー
            if (allHistoryData.length > 0) {
                fetchGalleryImages(userId, currentDogId);
            } else {
                document.getElementById('mainGalleryContainer').innerHTML = '<div class="text-muted small ms-3">写真はまだありません</div>';
            }

            hideLoading();
        })
        .catch(err => showError('通信エラー', err.message));
}

// ... (renderHistoryList, renderHistoryChart, fetchGalleryImages 等) ...
