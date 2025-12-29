/**
 * js/home.js
 * ホーム画面ロジック (Fix: Missing functions added)
 */

let currentDogId = null;
let chartInstance1 = null;
let chartInstance2 = null;
let cachedMilestones = [];
let globalDogList = [];

// 初期化
window.onload = function() {
    initLiff((userId) => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlDogId = urlParams.get('dogId');
        fetchHomeData(userId, urlDogId);
    });
};

function fetchHomeData(userId, dogId = null) {
    let url = `${Config.GAS_URL}?userId=${userId}&t=${new Date().getTime()}`;
    if (dogId) url += `&dogId=${dogId}`;

    log('Fetching data...');
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                if (data.error === 'Unregistered') {
                    showError('未登録のユーザーです', 'IDをトレーナーにお伝えください', userId);
                } else {
                    showError('データ取得エラー', data.error);
                }
                return;
            }

            // メインデータ描画
            renderHome(data);
            
            // データセット
            currentDogId = data.dog ? data.dog.id : null;
            if (data.all_dogs && data.all_dogs.length > 1) {
                globalDogList = data.all_dogs;
                document.getElementById('btnSwitchDog').style.display = 'block';
                document.getElementById('btnSwitchDog').onclick = () => showDogSelectModal(globalDogList);
            }

            // 画像読み込み (ここが前回のエラー箇所)
            fetchProfileImage(userId, currentDogId);
            
            if (data.latest && data.latest.has_photos) {
                fetchLessonImages(userId, currentDogId);
            } else {
                document.getElementById('photoArea').innerHTML = '<div class="text-muted small ms-3">写真はありません</div>';
            }

            // マイルストーン
            if (currentDogId) {
                fetchMilestones(userId, currentDogId);
            }
            
            // 履歴リンク更新
            const histLink = document.getElementById('historyLinkBtn');
            if(histLink) histLink.href = currentDogId ? `history.html?dogId=${currentDogId}` : `history.html`;

            hideLoading();
        })
        .catch(err => showError('通信エラー', err.message));
}

function renderHome(data) {
    const c = data.customer || {};
    const d = data.dog || {};
    
    document.getElementById('custName').innerText = c.name ? c.name + ' 様' : 'ゲスト 様';
    document.getElementById('dogName').innerText = d.name_disp || d.name || 'Your Dog';
    if(document.getElementById('ticketCount')) {
        document.getElementById('ticketCount').innerText = data.ticket_count || '-';
    }

    const l = data.latest;
    if (l) {
        document.getElementById('lessonDate').innerText = 'Last: ' + l.date;
        document.getElementById('goalText').innerText = l.goal || '---';
        document.getElementById('doneText').innerText = l.done || '---';
        document.getElementById('unableText').innerText = l.unable || '---';
        document.getElementById('homeworkText').innerText = l.homework || '---';
        document.getElementById('trainerComment').innerText = l.comment || '---';
        document.getElementById('nextGoalText').innerText = l.next_goal || 'トレーナーと相談しましょう';

        // 詳細
        let d1 = '', d2 = '';
        if(l.details) {
            for(let i=0; i<5; i++) { d1 += `[${i+1}] ${l.details[i] || 'なし'}\n`; }
            for(let i=5; i<10; i++) { d2 += `[${i+1}] ${l.details[i] || 'なし'}\n`; }
        }
        document.getElementById('detail1').innerText = d1 || '特になし';
        document.getElementById('detail2').innerText = d2 || '特になし';

        // チャート描画
        if (l.scores) {
            if (chartInstance1) chartInstance1.destroy();
            if (chartInstance2) chartInstance2.destroy();
            chartInstance1 = renderChart('chart1', l.scores.slice(0, 5), ['指示理解','集中力','報酬','ボディ','コンタクト'], 'rgba(87, 195, 194, 0.2)', '#57C3C2'); 
            chartInstance2 = renderChart('chart2', l.scores.slice(5, 10), ['指示出し','対応力','リード','ボディ','コンタクト'], 'rgba(47, 93, 98, 0.1)', '#2F5D62'); 
        }
    } else {
        document.getElementById('lessonDate').innerText = 'レッスン履歴なし';
    }
}

// --- 追加: 画像取得関数 ---
function fetchProfileImage(userId, dogId) {
    let url = `${Config.GAS_URL}?userId=${userId}&type=img_profile`;
    if(dogId) url += `&dogId=${dogId}`;
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
         const container = document.getElementById('dogImgContainer');
         if(data.image) {
             const img = new Image();
             img.className = 'dog-img';
             img.onload = () => {
                 container.innerHTML = '';
                 container.appendChild(img);
                 setTimeout(() => img.classList.add('loaded'), 10);
             };
             img.src = data.image;
         } else {
             container.innerHTML = '<span style="font-size:0.8rem; color:#aaa;">No Image</span>';
         }
      })
      .catch(e => console.log('Profile Image Error', e));
}

function fetchLessonImages(userId, dogId) {
    let url = `${Config.GAS_URL}?userId=${userId}&type=img_latest`;
    if(dogId) url += `&dogId=${dogId}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
         const pArea = document.getElementById('photoArea');
         pArea.innerHTML = '';
         if (data.images && data.images.length > 0) {
           data.images.forEach(b64 => {
             const img = document.createElement('img');
             img.className = 'photo-item zoomable';
             img.onload = () => img.classList.add('loaded');
             img.src = b64;
             pArea.appendChild(img);
           });
           try { mediumZoom('.zoomable', { margin: 24, background: 'rgba(0,0,0,0.8)' }); } catch(e){}
         } else {
           pArea.innerHTML = '<div class="text-muted small ms-3">写真はありません</div>';
         }
      })
      .catch(e => console.log('Lesson Image Error', e));
}

// --- チャート描画 ---
function renderChart(id, data, labels, bgColor, borderColor) {
    const ctx = document.getElementById(id);
    if(!ctx) return null;
    return new Chart(ctx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: bgColor, borderColor: borderColor, pointBackgroundColor: borderColor, borderWidth: 2
        }]
      },
      options: {
        scales: { r: { min: 0, max: 5, ticks: { display: false }, pointLabels: { font: { size: 10 } } } },
        plugins: { legend: { display: false } }
      }
    });
}

// --- マイルストーン ---
function fetchMilestones(userId, dogId) {
    let url = `${Config.GAS_URL}?userId=${userId}&dogId=${dogId}&type=milestone`;
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success' && data.badges) {
                renderMilestones(data.badges);
            } else {
                document.getElementById('tier-header').innerText = '準備中';
                document.getElementById('tier-scroll').innerHTML = '<div class="text-center w-100 small">データなし</div>';
            }
        })
        .catch(e => {
            console.log('MS Error', e);
            document.getElementById('tier-header').innerText = 'エラー';
        });
}

function renderMilestones(badges) {
    const container = document.getElementById('tier-scroll');
    const header = document.getElementById('tier-header');
    container.innerHTML = '';
    
    // (簡易ロジック: 獲得済みと未獲得を表示)
    // 実装簡略化のため、すべてのバッジを表示します
    badges.forEach(badge => {
        const isLocked = !badge.is_acquired;
        const colorClass = isLocked ? 'locked' : 'bg-trust'; // 簡易色
        const iconHtml = isLocked ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-solid fa-paw"></i>';
        
        const html = `
            <div class="ms-badge ${isLocked?'locked':''}">
                <div class="ms-icon-box ${colorClass}">
                    ${iconHtml}
                </div>
                <div class="ms-label">${badge.title}</div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
    header.innerText = 'コレクション';
}

function showDogSelectModal(dogs) {
    const body = document.getElementById('dogSelectBody');
    body.innerHTML = '';
    dogs.forEach(dog => {
        const btn = document.createElement('button');
        btn.className = 'dog-select-btn';
        btn.innerText = dog.name_disp;
        btn.onclick = () => {
            // モーダル閉じてリロード
            const modal = bootstrap.Modal.getInstance(document.getElementById('dogSelectModal'));
            modal.hide();
            showLoading();
            fetchHomeData(currentUserId, dog.id);
        };
        body.appendChild(btn);
    });
    new bootstrap.Modal(document.getElementById('dogSelectModal')).show();
}
