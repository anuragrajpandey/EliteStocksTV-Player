/**
 * ELITESTOCKS TV - ULTIMATE EDITION
 * Professional IPTV Engine with Proxy-Rotation & VOD Detection
 */

let allItems = [];
let currentView = 'live'; // 'live', 'movie', 'series'
let currentCategory = 'All';
let hls = new Hls();

// 1. SCREEN CONTROLLER
function showScreen(screenId) {
    const screens = ['login-screen', 'loader-screen', 'main-dashboard'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (id === screenId) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

function updateLoader(percent, text) {
    const fill = document.getElementById('progress-fill');
    const label = document.getElementById('loader-text');
    if (fill) fill.style.width = percent + '%';
    if (label) label.innerText = text;
}

// 2. THE LOGIN & FETCH ENGINE (The part that was failing)
async function handleLogin() {
    const url = document.getElementById('m3u-input').value.trim();
    if (!url) return alert("Please enter a valid M3U URL.");

    showScreen('loader-screen');
    updateLoader(20, "Establishing handshake...");

    // PROXY LIST - We try these in order
    const fetchMethods = [
        { name: "Direct", url: url }, 
        { name: "Proxy Alpha", url: `https://corsproxy.io/?${encodeURIComponent(url)}` },
        { name: "Proxy Beta", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` }
    ];

    let rawData = null;

    for (let method of fetchMethods) {
        try {
            console.log(`EliteStocks TV: Attempting ${method.name} connection...`);
            const response = await fetch(method.url);
            if (response.ok) {
                const text = await response.text();
                // Check if the data is actually an M3U file
                if (text.includes("#EXTM3U")) {
                    rawData = text;
                    console.log(`EliteStocks TV: Success via ${method.name}`);
                    break;
                }
            }
        } catch (e) {
            console.error(`${method.name} failed:`, e);
        }
    }

    if (rawData) {
        updateLoader(60, "Syncing Media Library...");
        parseM3U(rawData);
        
        // Setup Account Info (Expiry/URL)
        document.getElementById('display-url').innerText = url.split('?')[0];
        const expMatch = url.match(/exp_date=([^&]+)/);
        if (expMatch) {
            const date = new Date(expMatch[1] * 1000);
            document.getElementById('display-expiry').innerText = date.toLocaleDateString();
        }

        updateLoader(100, "Cinema Ready.");
        
        setTimeout(() => {
            showScreen('main-dashboard');
            renderDashboard();
        }, 800);
    } else {
        alert("CRITICAL ERROR: Connection Refused.\n\nYour IPTV provider or Browser is blocking the download.\n\nSOLUTION: Install 'Allow CORS' Chrome Extension or check your URL.");
        showScreen('login-screen');
    }
}

// 3. THE M3U PARSER (Sorts Live vs Movies vs Series)
function parseM3U(data) {
    const lines = data.split('\n');
    allItems = [];
    let current = null;

    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('#EXTINF:')) {
            const name = line.split(',').pop().trim();
            const logo = line.match(/tvg-logo="([^"]+)"/i)?.[1];
            const group = line.match(/group-title="([^"]+)"/i)?.[1] || "General";
            current = { name, logo, group };
        } else if (line.startsWith('http')) {
            if (current) {
                current.url = line;
                const lowUrl = line.toLowerCase();
                
                // Smart Detection Logic
                if (lowUrl.includes('/movie/') || lowUrl.endsWith('.mp4') || lowUrl.endsWith('.mkv')) {
                    current.type = 'movie';
                } else if (lowUrl.includes('/series/') || lowUrl.includes('/xmltv/')) {
                    current.type = 'series';
                } else {
                    current.type = 'live';
                }
                
                allItems.push(current);
                current = null;
            }
        }
    }
}

// 4. THE DASHBOARD CONTROLLER
function setView(view) {
    currentView = view;
    currentCategory = 'All';
    
    // Update active button UI
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (view === 'live') document.getElementById('btn-live').classList.add('active');
    if (view === 'movie') document.getElementById('btn-movie').classList.add('active');
    if (view === 'series') document.getElementById('btn-series').classList.add('active');
    
    renderDashboard();
}

function setCategory(cat) {
    currentCategory = cat;
    renderDashboard();
}

function renderDashboard() {
    const grid = document.getElementById('main-grid');
    const scroller = document.getElementById('category-scroller');
    const searchQuery = document.getElementById('search-input').value.toLowerCase();
    
    grid.innerHTML = '';
    
    // 1. Filter by Section (Live/Movie/Series)
    let filtered = allItems.filter(item => item.type === currentView);
    
    // 2. Generate Categories for this section
    const uniqueCats = ['All', ...new Set(filtered.map(i => i.group))];
    scroller.innerHTML = uniqueCats.map(cat => `
        <div class="cat-badge ${currentCategory === cat ? 'active' : ''}" onclick="setCategory('${cat}')">
            ${cat}
        </div>
    `).join('');

    // 3. Filter by Category & Search
    let displayList = filtered.filter(item => {
        const matchCat = (currentCategory === 'All' || item.group === currentCategory);
        const matchSearch = item.name.toLowerCase().includes(searchQuery);
        return matchCat && matchSearch;
    });

    // 4. Build Grid Cards
    displayList.forEach(item => {
        const card = document.createElement('div');
        card.className = 'channel-card scale-in';
        
        const logo = item.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=111&color=fff&size=128`;
        
        card.innerHTML = `
            <img src="${logo}" loading="lazy" onerror="this.src='https://via.placeholder.com/150?text=TV'">
            <p>${item.name}</p>
        `;
        
        card.onclick = () => openPlayer(item.url, item.name);
        grid.appendChild(card);
    });
}

function handleSearch() {
    renderDashboard();
}

// 5. THE CINEMA MODAL PLAYER
function openPlayer(url, name) {
    const modal = document.getElementById('player-modal');
    const video = document.getElementById('video');
    document.getElementById('modal-title').innerText = name;
    
    modal.classList.remove('hidden');

    if (Hls.isSupported()) {
        hls.destroy(); // Clear previous session
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(e => console.error("Autoplay prevented:", e));
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Support for Safari/iOS
        video.src = url;
    }
}

function closePlayer() {
    document.getElementById('player-modal').classList.add('hidden');
    document.getElementById('video').pause();
}

// 6. PROFILE & ACCOUNT
function toggleProfile() {
    document.getElementById('profile-modal').classList.toggle('hidden');
}

function logout() {
    location.reload();
}

// Prevent Enter key from refreshing page
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !document.getElementById('login-screen').classList.contains('hidden')) {
        handleLogin();
    }
});