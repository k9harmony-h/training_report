/**
 * js/diagnosis.js
 * 愛犬の性格診断ロジック
 */

const STORAGE_KEY = 'k9_progress_state';
let state = { userId: null, dogName: "", answers: {}, typeName: "" };

window.onload = function() {
    startOpeningSequence(); // アニメーション開始
    initLiff((userId) => {
        state.userId = userId;
        saveState();
    });
    
    // マスタデータの取得 (GASから)
    fetchMasterData();
};

function fetchMasterData() {
    // Config.GAS_URL を使用
    fetch(`${Config.GAS_URL}?action=fetchMaster`) // ※Main.gsにこのActionがなければ追加が必要
        .then(res => res.json())
        .then(data => {
            // マスタデータセット
            // ... (画面のボタン有効化など) ...
        })
        .catch(e => console.error(e));
}

// ... (navigate, buildSection, processFinal 等の診断ロジック) ...
// ※ `CONFIG.GAS_URL` ではなく `Config.GAS_URL` を使うように修正してください
