/**
 * js/reservation.js
 * 予約・決済ロジック
 */

let sqCard = null;
let userData = null;
let selectedDog = null;
let paymentToken = null;

window.onload = async function() {
    restoreSessionData();
    // 日付選択カレンダーの初期化
    // ...

    initLiff((userId) => {
        fetchUserData(userId);
    });
};

function fetchUserData(userId) {
    showLoading();
    fetch(`${Config.GAS_URL}?userId=${userId}&type=data&t=${Date.now()}`)
        .then(res => res.json())
        .then(json => {
            userData = json.customer;
            // ... (画面描画) ...
            hideLoading();
        });
}

async function initSquare(targetId) {
    try {
        if(!sqCard) {
            const payments = Square.payments(Config.SQUARE.APP_ID, Config.SQUARE.LOCATION_ID);
            sqCard = await payments.card();
            await sqCard.attach('#sq-card-div');
        }
        // ... (要素の移動など) ...
    } catch(e) { alert("決済システムのエラー"); }
}

function submitReservation() {
    showLoading();
    
    // 決済・予約リクエスト構築
    const payload = {
        action: 'execute_payment', // まず決済
        userId: userData ? userData.unique_key : 'NEW_USER',
        lineUserId: currentUserId,
        // ... (フォーム値) ...
        amount: calculateTotal(),
        token: paymentToken
    };

    fetch(Config.GAS_URL, { method:'POST', body:JSON.stringify(payload) })
        .then(res => res.json())
        .then(json => {
            if(json.status === 'success') {
                // 決済成功 → 予約確定リクエストへ
                const resPayload = { ...payload, action: 'add_reservation', paymentStatus: 'PAID' };
                return fetch(Config.GAS_URL, { method:'POST', body:JSON.stringify(resPayload) });
            } else {
                throw new Error(json.message);
            }
        })
        .then(res => res.json())
        .then(json => {
            if(json.status === 'success') {
                goToView(6); // 完了画面
            } else {
                alert('予約登録失敗: ' + json.message);
            }
        })
        .catch(e => alert('エラー: ' + e.message))
        .finally(() => hideLoading());
}
