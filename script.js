const M3U_URL = "https://iptv-org.github.io/iptv/index.m3u";
let allItems = [];
let recentlyWatched = JSON.parse(localStorage.getItem('estv_recent')) || [];
let loadedRows = 0;
let hls = new Hls();
let funnyInterval;

const funnyLines = [
    "Our CEO Anurag Pandey is personally hand-painting the pixels for you.",
    "Bribing the internet provider with virtual chai for better speed...",
    "Wait, Anurag Pandey is just checking if the satellites are awake.",
    "Calculated stream quality: Anurag Pandey Approved.",
    "Anurag Pandey is currently wrestling a satellite to get you signal.",
    "Anurag Pandey: 'Stay calm, the luxury is worth the wait.'",
    "Fetching high-bandwidth bits for Anurag Pandey's stream.",
    "ESTV servers are drinking coffee to keep up with CEO Pandey's standards.",
    "Anurag Pandey once watched a 4K movie on a flip phone. Legend.",
    "Syncing the cinematic experience... Anurag Pandey is watching.",
    "Anurag Pandey says: 'Life is too short for buffering.'"
];

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function updateLoader(pct, text) {
    document.getElementById('progress-fill').style.width = pct + '%';
    if(text) document.getElementById('loader-text').innerText = text;
}

// 1. DATA HANDLER
async function handleLogin() {
    showScreen('loader-screen');
    updateLoader(20, "INITIALIZING...");

    const targets = [M3U_URL, `https://api.allorigins.win/raw?url=${encodeURIComponent(M3U_URL)}` ];
    let data = null;
    for (let url of targets) {
        try {
            const res = await fetch(url);
            if(res.ok) { data = await res.text(); if(data.includes("#EXTM3U")) break; }
        } catch(e) {}
    }

    if (data) {
        parseM3U(data);
        updateLoader(100, "SYNCED");
        setTimeout(() => { 
            showScreen('main-dashboard'); 
            initInfiniteScroll();
            renderInitialDashboard(); 
        }, 600);
    } else {
        alert("Server Refused. Try a VPN.");
        showScreen('splash-screen');
    }
}

function parseM3U(data) {
    const lines = data.split('\n');
    allItems = [];
    let current = null;
    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('#EXTINF:')) {
            const name = line.split(',').pop().trim();
            const logo = line.match(/tvg-logo="([^"]+)"/i)?.[1];
            const group = line.match(/group-title="([^"]+)"/i)?.[1] || "International";
            current = { name, logo, group };
        } else if (line.startsWith('http')) {
            if (current) { current.url = line; allItems.push(current); current = null; }
        }
    }
}

// 2. DASHBOARD
function renderInitialDashboard() {
    const hero = allItems[Math.floor(Math.random() * allItems.length)];
    document.getElementById('hero-title').innerText = hero.name;
    document.getElementById('hero-bg').src = hero.logo || "https://images.unsplash.com/photo-1574267432553-4b4628081c31?q=80&w=2000";
    document.getElementById('hero-play-btn').onclick = () => openPlayer(hero.url, hero.name);
    renderRows();
}

function renderRows() {
    const container = document.getElementById('rows-container');
    if (loadedRows === 0 && recentlyWatched.length > 0) {
        container.appendChild(createRow("Recently Watched", recentlyWatched));
    }
    const groups = [...new Set(allItems.map(i => i.group))];
    const nextGroups = groups.slice(loadedRows, loadedRows + 5);
    nextGroups.forEach(group => {
        const channels = allItems.filter(i => i.group === group).slice(0, 15);
        if (channels.length > 0) container.appendChild(createRow(group, channels));
    });
    loadedRows += 5;
}

function createRow(title, items) {
    const div = document.createElement('div');
    div.className = 'row-item';
    div.innerHTML = `<h3 class="row-title">${title}</h3><div class="row-scroller">${items.map(item => `<div class="card-item" onclick="openPlayer('${item.url}', '${item.name.replace(/'/g, "\\'")}')"><img src="${item.logo || 'https://via.placeholder.com/300x170/000/111?text=ESTV'}" loading="lazy"><div class="card-overlay">${item.name}</div></div>`).join('')}</div>`;
    return div;
}

function initInfiniteScroll() {
    document.getElementById('scroll-area').onscroll = (e) => {
        if (e.target.scrollTop + e.target.clientHeight >= e.target.scrollHeight - 300) renderRows();
    };
}

// 3. PLAYER & FUNNY TEXT ENGINE
function startFunnyText() {
    const textEl = document.getElementById('funny-load-text');
    const update = () => {
        textEl.style.opacity = 0;
        setTimeout(() => {
            textEl.innerText = funnyLines[Math.floor(Math.random() * funnyLines.length)];
            textEl.style.opacity = 1;
        }, 500);
    };
    update();
    funnyInterval = setInterval(update, 4000);
}

function openPlayer(url, name) {
    const channel = allItems.find(i => i.name === name) || { name, url };
    recentlyWatched = [channel, ...recentlyWatched.filter(i => i.name !== name)].slice(0, 15);
    localStorage.setItem('estv_recent', JSON.stringify(recentlyWatched));

    const modal = document.getElementById('player-modal');
    modal.classList.remove('hidden');
    document.getElementById('modal-title').innerText = name;
    
    const buffer = document.getElementById('video-buffer-screen');
    buffer.classList.remove('hidden');
    startFunnyText();

    const video = document.getElementById('video');
    video.onplaying = () => {
        buffer.classList.add('hidden');
        clearInterval(funnyInterval);
    };

    if (Hls.isSupported()) {
        hls.destroy(); hls = new Hls();
        hls.loadSource(url); hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else { video.src = url; }
}

function closePlayer() {
    hls.destroy();
    document.getElementById('player-modal').classList.add('hidden');
    document.getElementById('video').pause();
    clearInterval(funnyInterval);
}

function togglePlay() {
    const v = document.getElementById('video');
    const icon = document.getElementById('play-pause-icon');
    if (v.paused) { v.play(); icon.className = "fa-solid fa-pause"; }
    else { v.pause(); icon.className = "fa-solid fa-play"; }
}

function setVolume(v) { document.getElementById('video').volume = v; }
function toggleFullscreen() {
    const v = document.getElementById('video');
    if (v.requestFullscreen) v.requestFullscreen();
    else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
}

function toggleSearch() { document.getElementById('search-bar-wrap').classList.toggle('hidden'); }
function handleSearch() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const results = allItems.filter(i => i.name.toLowerCase().includes(q)).slice(0, 20);
    const container = document.getElementById('rows-container');
    container.innerHTML = "";
    if (results.length > 0) container.appendChild(createRow("Search Results", results));
}

function toggleCategoryPopup() {
    const modal = document.getElementById('category-popup');
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) {
        const groups = [...new Set(allItems.slice(0, 1000).map(i => i.group))].slice(0, 50);
        document.getElementById('vertical-category-list').innerHTML = groups.map(cat => `<div class="cat-item" onclick="setCategory('${cat}')">${cat}</div>`).join('');
    }
}

function setCategory(cat) {
    const list = allItems.filter(i => i.group === cat).slice(0, 50);
    const container = document.getElementById('rows-container');
    container.innerHTML = "";
    container.appendChild(createRow(`Browsing: ${cat}`, list));
    toggleCategoryPopup();
}
