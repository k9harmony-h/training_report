/**
 * js/home.js
 * ホーム画面ロジック (完全版)
 */

let currentDogId = null;
let chartInstance1 = null;
let chartInstance2 = null;
let cachedMilestones = [];
let globalDogList = [];

// 初期化処理
window.onload = function() {
    // common.js の Tipsスライダーを開始
    if (typeof startTipsSlider === 'function') startTipsSlider();

    // LIFF初期化 (common.js)
    initLiff((userId) => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlDogId = urlParams.get('dogId');
        fetchHomeData(userId, urlDogId);
    });
};

// メインデータ取得
function fetchHomeData(userId, dogId = null) {
    let url = `${Config.GAS_URL}?userId=${userId}&t=${new Date().getTime()}`;
    if (dogId) url += `&dogId=${dogId}`;

    log('Fetching data...');
    fetch(url)
        .then(res => res.json())
        .then(data => {
            // エラー判定
            if (data.error) {
                if (data.error === 'Unregistered') {
                    showError('未登録のユーザーです', 'IDをトレーナーにお伝えください', userId);
                } else {
                    showError('データ取得エラー', data.error);
                }
                return;
            }

            // 1. テキストデータの描画
            renderHome(data);
            
            // 2. データセット (犬IDなど)
            currentDogId = data.dog ? data.dog.id : null;
            if (data.all_dogs && data.all_dogs.length > 1) {
                globalDogList = data.all_dogs;
                document.getElementById('btnSwitchDog').style.display = 'block';
                document.getElementById('btnSwitchDog').onclick = () => showDogSelectModal(globalDogList);
            }

            // 3. 画像読み込み (ここがエラーの原因でした)
            fetchProfileImage(userId, currentDogId);
            
            if (data.latest && data.latest.has_photos) {
                fetchLessonImages(userId, currentDogId);
            } else {
                document.getElementById('photoArea').innerHTML = '<div class="text-muted small ms-3">写真はありません</div>';
            }

            // 4. マイルストーン読み込み
            if (currentDogId) {
                fetchMilestones(userId, currentDogId);
            }
            
            // 5. 履歴リンク更新
            const histLink = document.getElementById('historyLinkBtn');
            if(histLink) histLink.href = currentDogId ? `history.html?dogId=${currentDogId}` : `history.html`;

            // ローディング解除
            hideLoading();
        })
        .catch(err => showError('通信エラー', err.message));
}

// 画面描画 (テキスト部分)
function renderHome(data) {
    const c = data.customer || {};
    const d = data.dog || {};
    
    document.getElementById('custName').innerText = c.name ? c.name + ' 様' : 'ゲスト 様';
    document.getElementById('dogName').innerText = d.name_disp || d.name || 'Your Dog';
    if(document.getElementById('ticketCount')) {
        document.getElementById('ticketCount').innerText = data.ticket_count || '-';
    }

    // 誕生日メッセージ
    checkBirthday(c.birth_date, 'custBirthdayMsg');
    checkBirthday(d.birth_date, 'dogBirthdayMsg');

    const l = data.latest;
    if (l) {
        document.getElementById('lessonDate').innerText = 'Last: ' + l.date;
        document.getElementById('goalText').innerText = l.goal || '---';
        document.getElementById('doneText').innerText = l.done || '---';
        document.getElementById('unableText').innerText = l.unable || '---';
        document.getElementById('homeworkText').innerText = l.homework || '---';
        document.getElementById('trainerComment').innerText = l.comment || '---';
        document.getElementById('nextGoalText').innerText = l.next_goal || 'トレーナーと相談しましょう';

        // 詳細項目
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

// ------------------------------------------------
// ここから下：不足していた関数群
// ------------------------------------------------

/**
 * プロフィール画像の取得
 */
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
                 // アニメーション用にクラス付与
                 setTimeout(() => img.classList.add('loaded'), 10);
             };
             img.src = data.image;
         } else {
             container.innerHTML = '<span style="font-size:0.8rem; color:#aaa;">No Image</span>';
         }
      })
      .catch(e => console.log('Profile Image Error', e));
}

/**
 * レッスン画像の取得
 */
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
           // medium-zoom適用
           try { mediumZoom('.zoomable', { margin: 24, background: 'rgba(0,0,0,0.8)' }); } catch(e){}
         } else {
           pArea.innerHTML = '<div class="text-muted small ms-3">写真はありません</div>';
         }
      })
      .catch(e => console.log('Lesson Image Error', e));
}

/**
 * レーダーチャート描画
 */
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

/**
 * マイルストーン取得
 */
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

/**
 * マイルストーン描画
 */
function renderMilestones(badges) {
    const container = document.getElementById('tier-scroll');
    const header = document.getElementById('tier-header');
    container.innerHTML = '';
    
    // バッジ生成
    badges.forEach(badge => {
        const isLocked = !badge.is_acquired;
        // 未獲得ならグレー、獲得済みなら緑(trust)
        const colorClass = isLocked ? 'locked' : 'bg-trust'; 
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

/**
 * 犬選択モーダル表示
 */
function showDogSelectModal(dogs) {
    const body = document.getElementById('dogSelectBody');
    body.innerHTML = '';
    dogs.forEach(dog => {
        const btn = document.createElement('button');
        btn.className = 'dog-select-btn';
        btn.innerText = dog.name_disp;
        btn.onclick = () => {
            // モーダルを閉じてリロード
            const modalEl = document.getElementById('dogSelectModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if(modal) modal.hide();
            
            showLoading(); // common.js
            fetchHomeData(currentUserId, dog.id);
        };
        body.appendChild(btn);
    });
    new bootstrap.Modal(document.getElementById('dogSelectModal')).show();
}

/**
 * 誕生日チェック
 */
function checkBirthday(dateStr, elementId) {
    if (!dateStr) return;
    const today = new Date();
    const bDate = new Date(dateStr);
    bDate.setFullYear(today.getFullYear());
    
    const diffTime = bDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // 前後2週間以内なら表示
    if (Math.abs(diffDays) <= 14 || Math.abs(diffDays - 365) <= 14 || Math.abs(diffDays + 365) <= 14) {
        const el = document.getElementById(elementId);
        if(el) el.style.display = 'block';
    }
}
