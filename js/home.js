/**
 * js/home.js
 * ホーム画面ロジック (完全版・修正済み)
 * 最終更新: 2025-12-29
 */

let currentDogId = null;
let currentLineUserId = null; // 追加: 犬切り替え時に使用
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
        currentLineUserId = userId; // ユーザーIDを保持
        const urlParams = new URLSearchParams(window.location.search);
        const urlDogId = urlParams.get('dogId');
        fetchHomeData(userId, urlDogId);
    });
};

// メインデータ取得
function fetchHomeData(userId, dogId = null) {
    let url = `${Config.GAS_URL}?userId=${userId}&t=${new Date().getTime()}`;
    if (dogId) url += `&dogId=${dogId}`;

    log('1. Fetching data from GAS...'); 
    
    fetch(url)
        .then(async res => {
            log(`2. Response received. Status: ${res.status}`);
            const text = await res.text();
            // log(`3. Raw Response: ${text.substring(0, 100)}...`); // デバッグ用

            if (!res.ok) {
                throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
            }

            try {
                return JSON.parse(text); 
            } catch (e) {
                throw new Error(`JSON Parse Failed. Received: ${text.substring(0, 50)}...`);
            }
        })
        .then(data => {
            log('4. JSON Parse Success');

            if (data.error) {
                log('5. API returned Error: ' + data.error);
                if (data.error === 'Unregistered') {
                    showError('未登録のユーザーです', 'IDをトレーナーにお伝えください', userId);
                } else {
                    showError('データ取得エラー', data.error);
                }
                return;
            }

            log('6. Rendering Home...');
            renderHome(data);
            
            log('7. Setting Data...');
            // 犬IDの更新
            if (data.dog && data.dog.id) {
                currentDogId = data.dog.id;
            }
            
            // 犬リスト（切替用）の保持
            if (data.all_dogs && data.all_dogs.length > 1) {
                globalDogList = data.all_dogs;
                const switchBtn = document.getElementById('btnSwitchDog');
                if(switchBtn) {
                    switchBtn.style.display = 'block';
                    switchBtn.onclick = () => showDogSelectModal(globalDogList);
                }
            }

            log('8. Fetching Images...');
            // 画像読み込み
            if (typeof fetchProfileImage === 'function') {
                fetchProfileImage(userId, currentDogId);
            }
            
            if (data.latest && data.latest.has_photos) {
                if (typeof fetchLessonImages === 'function') fetchLessonImages(userId, currentDogId);
            } else {
                const photoArea = document.getElementById('photoArea');
                if(photoArea) photoArea.innerHTML = '<div class="text-muted small ms-3">写真はありません</div>';
            }

            if (currentDogId && typeof fetchMilestones === 'function') {
                fetchMilestones(userId, currentDogId);
            }
            
            const histLink = document.getElementById('historyLinkBtn');
            if(histLink) histLink.href = currentDogId ? `history.html?dogId=${currentDogId}` : `history.html`;

            hideLoading(); // common.js
            log('9. Complete.');
        })
        .catch(err => {
            log(`[FATAL ERROR] ${err.message}`);
            console.error(err);
            showError('通信・処理エラー', err.message);
        });
}

// 画面描画 (テキスト部分)
function renderHome(data) {
    const c = data.customer || {};
    const d = data.dog || {};
    
    // ヘッダー情報
    setText('custName', c.name ? c.name + ' 様' : 'ゲスト 様');
    setText('dogName', d.name_disp || d.name || 'Your Dog');
    setText('ticketCount', data.ticket_count || '-');

    // 誕生日メッセージ
    checkBirthday(c.birth_date, 'custBirthdayMsg');
    checkBirthday(d.birth_date, 'dogBirthdayMsg');

    const l = data.latest;
    if (l) {
        // --- 修正箇所: 新しいキー名(goal, done, unable...)に対応 ---
        setText('lessonDate', 'Last: ' + (l.date || '--/--'));
        setText('goalText', l.goal);
        setText('doneText', l.done);
        setText('unableText', l.unable);
        setText('homeworkText', l.homework);
        setText('trainerComment', l.comment); // trainer_comment -> comment
        setText('nextGoalText', l.next_goal || 'トレーナーと相談しましょう');

        // 詳細項目 (details配列)
        let d1 = '', d2 = '';
        if(l.details && Array.isArray(l.details)) {
            for(let i=0; i<5; i++) { d1 += `[${i+1}] ${l.details[i] || 'なし'}\n`; }
            for(let i=5; i<10; i++) { d2 += `[${i+1}] ${l.details[i] || 'なし'}\n`; }
        }
        setText('detail1', d1 || '特になし');
        setText('detail2', d2 || '特になし');

        // チャート描画
        if (l.scores && Array.isArray(l.scores) && l.scores.length >= 10) {
            if (chartInstance1) chartInstance1.destroy();
            if (chartInstance2) chartInstance2.destroy();
            
            // データが文字列の場合があるため Number() で変換
            const numScores = l.scores.map(s => Number(s));

            chartInstance1 = renderChart('chart1', numScores.slice(0, 5), ['指示理解','集中力','報酬','ボディ','コンタクト'], 'rgba(87, 195, 194, 0.2)', '#57C3C2'); 
            chartInstance2 = renderChart('chart2', numScores.slice(5, 10), ['指示出し','対応力','リード','ボディ','コンタクト'], 'rgba(47, 93, 98, 0.1)', '#2F5D62'); 
        }
    } else {
        setText('lessonDate', 'レッスン履歴なし');
    }
}

// ヘルパー: テキストセット（null対策）
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.innerText = text || '---';
    }
}

// ------------------------------------------------
// 画像・チャート・マイルストーン関連
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
          backgroundColor: bgColor, 
          borderColor: borderColor, 
          pointBackgroundColor: borderColor, 
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { 
            r: { 
                min: 0, 
                max: 5, 
                ticks: { display: false, stepSize: 1 }, 
                pointLabels: { font: { size: 10 }, color: '#666' } 
            } 
        },
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
                cachedMilestones = data.badges; // キャッシュ保存
                renderMilestones(data.badges);
                
                // 「一覧を見る」ボタンのイベント設定
                const allBtn = document.getElementById('openAllMilestonesBtn');
                if(allBtn) allBtn.onclick = () => showAllMilestonesModal(data.badges);

            } else {
                document.getElementById('tier-header').innerText = '準備中';
                document.getElementById('tier-scroll').innerHTML = '<div class="text-center w-100 small">データなし</div>';
            }
        })
        .catch(e => {
            console.log('MS Error', e);
            document.getElementById('tier-header').innerText = 'Data Error';
        });
}

/**
 * マイルストーン描画 (横スクロール部分)
 */
function renderMilestones(badges) {
    const container = document.getElementById('tier-scroll');
    const header = document.getElementById('tier-header');
    container.innerHTML = '';
    
    // バッジ生成
    badges.forEach(badge => {
        const isLocked = !badge.is_acquired;
        const colorClass = isLocked ? 'locked' : 'bg-trust'; // bg-trustはCSSで定義が必要、なければ style で指定
        const iconHtml = isLocked ? '<i class="fa-solid fa-lock"></i>' : (badge.icon === 'star' ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-solid fa-paw"></i>');
        
        // div全体をクリック可能にするための属性追加
        const html = `
            <div class="ms-badge ${isLocked?'locked':''}" onclick="openMilestoneModal('${badge.id}')">
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
 * マイルストーン詳細モーダルを開く
 */
window.openMilestoneModal = function(badgeId) {
    const badge = cachedMilestones.find(b => String(b.id) === String(badgeId));
    if(!badge) return;

    // モーダルの内容を書き換え
    document.getElementById('msModalTitle').innerText = badge.title;
    document.getElementById('msModalDesc').innerText = badge.desc || '詳細情報はありません';
    
    const tipsBox = document.getElementById('msModalTipsBox');
    if(badge.is_acquired) {
        document.getElementById('msModalTips').innerText = badge.tips || '獲得おめでとうございます！';
        tipsBox.style.display = 'block';
    } else {
        tipsBox.style.display = 'none';
    }

    // アイコン
    const iconBox = document.getElementById('msModalIconBox');
    const colorClass = badge.is_acquired ? 'bg-trust' : 'locked';
    const iconHtml = badge.is_acquired ? '<i class="fa-solid fa-paw fa-2x"></i>' : '<i class="fa-solid fa-lock fa-2x"></i>';
    iconBox.innerHTML = `<div class="ms-icon-box ${colorClass}" style="width:80px; height:80px; margin:0 auto;">${iconHtml}</div>`;

    // Bootstrap Modal表示
    new bootstrap.Modal(document.getElementById('milestoneModal')).show();
};

/**
 * 全マイルストーン一覧モーダル
 */
function showAllMilestonesModal(badges) {
    const body = document.getElementById('allMilestonesBody');
    body.innerHTML = '';
    
    // Gridレイアウトで全表示
    let html = '<div class="row g-3">';
    badges.forEach(badge => {
         const isLocked = !badge.is_acquired;
         const colorClass = isLocked ? 'locked' : 'bg-trust';
         const opacity = isLocked ? '0.6' : '1.0';
         
         html += `
            <div class="col-4 text-center" onclick="openMilestoneModal('${badge.id}')">
                <div class="ms-icon-box ${colorClass}" style="width:60px; height:60px; margin:0 auto; opacity:${opacity}">
                    ${isLocked ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-solid fa-paw"></i>'}
                </div>
                <div class="small mt-1 fw-bold" style="font-size:0.7rem; color:#555;">${badge.title}</div>
            </div>
         `;
    });
    html += '</div>';
    body.innerHTML = html;
    
    new bootstrap.Modal(document.getElementById('allMilestonesModal')).show();
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
            // グローバル変数の currentLineUserId を使用
            fetchHomeData(currentLineUserId, dog.id);
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
