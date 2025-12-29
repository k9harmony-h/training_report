/**
 * js/heritage.js
 * ブランドストーリー・アニメーション制御
 */

window.addEventListener('DOMContentLoaded', () => {
    // URLパラメータから名前を取得して埋め込み
    const params = new URLSearchParams(window.location.search);
    const owner = params.get('ownerName') || 'オーナー様';
    const dog = params.get('dogName') || '愛犬';

    document.getElementById('owner-name-placeholder').textContent = owner;
    document.getElementById('dog-name-placeholder').textContent = dog;

    // 街並み生成
    buildCity();
});

// スクロール連動ロジック
window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    
    // DOM要素取得
    const cover = document.getElementById('cover-layer');
    const text1 = document.getElementById('text-1');
    // ...

    // パララックス計算
    // Scene 1
    cover.style.transform = `rotateY(-${Math.min(scrollY / 4, 100)}deg)`;
    cover.style.opacity = scrollY > 300 ? 0 : 1;

    // ... (元のHTML内にあったスクロール計算ロジックをここに移植) ...
});

function buildCity() {
    const cityContainer = document.getElementById('bg-city');
    const windowWidth = window.innerWidth;
    let currentWidth = 0;
    while (currentWidth < windowWidth) {
        const block = document.createElement('div');
        block.classList.add('city-block');
        const w = Math.floor(Math.random() * 50) + 40;
        const hPercent = Math.floor(Math.random() * 45) + 35; 
        block.style.width = `${w}px`; block.style.height = `${hPercent}%`;
        if (Math.random() > 0.9) block.style.zIndex = '5';
        cityContainer.appendChild(block); currentWidth += w;
    }
}
