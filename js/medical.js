/**
 * js/medical.js
 * 医療・防災手帳ロジック
 */

let currentDogId = null;
let printModal = null;

window.onload = function() {
    printModal = new bootstrap.Modal(document.getElementById('printModal'));
    
    initLiff((userId) => {
        const urlParams = new URLSearchParams(window.location.search);
        currentDogId = urlParams.get('dogId');
        fetchMedicalData(userId, currentDogId);
    });
};

function fetchMedicalData(userId, dogId) {
    let url = `${Config.GAS_URL}?userId=${userId}&t=${Date.now()}`;
    if(dogId) url += `&dogId=${dogId}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if(data.error) { showError('エラー', data.error); return; }
            
            if(data.dog) currentDogId = data.dog.id;
            renderMedicalData(data);
            
            if(currentDogId) fetchProfileImage(userId, currentDogId);
            
            document.getElementById('loading').style.display = 'none';
            document.getElementById('main-display').style.display = 'block';
            document.getElementById('controls').style.display = 'block';
        })
        .catch(e => showError('通信エラー', e.message));
}

function renderMedicalData(data) {
    const c = data.customer || {};
    const d = data.dog || {};
    
    const setText = (id, txt) => { 
        const el = document.getElementById(id); 
        if(el) el.textContent = txt || '-'; 
    };

    setText('d_name', d.name_disp);
    setText('d_breed', d.breed);
    // ... (他の項目も同様にセット) ...
    
    // マスク機能の初期化
    setMaskedText('c_address', c.address);
    setMaskedText('c_phone', c.phone);
}

function generatePdf(type) {
    if(!currentUserId || !currentDogId) return;
    const btn = document.getElementById(`btn-${type}`);
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 作成中...';
    btn.disabled = true;

    // Config.GAS_URL を使用
    const url = `${Config.GAS_URL}?userId=${currentUserId}&dogId=${currentDogId}&type=pdf_${type}`;
    
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if(data.url) {
                // ダウンロード処理
                window.open(data.url, '_blank');
                printModal.show();
            } else {
                alert('作成に失敗しました: ' + (data.error || '不明なエラー'));
            }
        })
        .catch(e => alert('通信エラー'))
        .finally(() => {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        });
}

// ... (toggleMask, setMaskedText 等のUIヘルパー) ...
