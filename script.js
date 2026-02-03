/* ================= CONFIG ================= */
const M3U_URL = "https://iptv-org.github.io/iptv/index.m3u";
const CHUNK_GROUPS = 4;
const CHANNELS_PER_ROW = 12;
const SEARCH_LIMIT = 40;

/* ================= STATE ================= */
let allItems = [];
let groupedItems = {};
let categoryList = [];
let loadedGroupIndex = 0;

let recentlyWatched = JSON.parse(localStorage.getItem("estv_recent")) || [];
let hls = new Hls();
let funnyInterval = null;

/* ================= FUNNY LOADING TEXT ================= */
const funnyLines = [
    "Waking up satellites… please wait.",
    "Luxury streams don’t rush.",
    "Optimizing pixels for premium eyes.",
    "Negotiating with the internet gods.",
    "Almost there… hold tight.",
    "CEO is personally approving this stream.",
    "Calibrating cinematic experience.",
    "Checking signal quality twice… just to be sure."
];

/* ================= BASIC UI HELPERS ================= */
function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");
}

function updateLoader(pct, text) {
    document.getElementById("progress-fill").style.width = pct + "%";
    if (text) document.getElementById("loader-text").innerText = text;
}

/* ================= APP START ================= */
async function handleLogin() {
    showScreen("loader-screen");
    updateLoader(15, "INITIALIZING…");

    let data = null;
    const sources = [
        M3U_URL,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(M3U_URL)}`
    ];

    for (let url of sources) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                const txt = await res.text();
                if (txt.includes("#EXTM3U")) {
                    data = txt;
                    break;
                }
            }
        } catch (e) {}
    }

    if (!data) {
        alert("Playlist blocked. Try VPN.");
        showScreen("splash-screen");
        return;
    }

    updateLoader(60, "PARSING CHANNELS…");
    parseM3U(data);

    updateLoader(100, "READY");
    setTimeout(() => {
        showScreen("main-dashboard");
        renderHero();
        renderNextGroups();
        initInfiniteScroll();
    }, 600);
}

/* ================= PARSE M3U ================= */
function parseM3U(data) {
    allItems = [];
    groupedItems = {};
    categoryList = [];
    loadedGroupIndex = 0;

    let current = null;

    data.split("\n").forEach(line => {
        line = line.trim();

        if (line.startsWith("#EXTINF")) {
            current = {
                name: line.split(",").pop().trim(),
                logo: line.match(/tvg-logo="([^"]+)"/i)?.[1] || "",
                group: line.match(/group-title="([^"]+)"/i)?.[1] || "Other"
            };
        } else if (line.startsWith("http") && current) {
            current.url = line;
            allItems.push(current);

            if (!groupedItems[current.group]) {
                groupedItems[current.group] = [];
                categoryList.push(current.group);
            }
            groupedItems[current.group].push(current);
            current = null;
        }
    });
}

/* ================= HERO ================= */
function renderHero() {
    const hero = allItems[Math.floor(Math.random() * allItems.length)];
    document.getElementById("hero-title").innerText = hero.name;
    document.getElementById("hero-bg").src =
        hero.logo || "https://via.placeholder.com/1600x900/000/111?text=ESTV";
    document.getElementById("hero-play-btn").onclick =
        () => openPlayer(hero.url, hero.name);
}

/* ================= ROWS ================= */
function renderNextGroups() {
    const container = document.getElementById("rows-container");

    if (loadedGroupIndex === 0 && recentlyWatched.length) {
        container.appendChild(createRow("Recently Watched", recentlyWatched));
    }

    const nextCats = categoryList.slice(
        loadedGroupIndex,
        loadedGroupIndex + CHUNK_GROUPS
    );

    nextCats.forEach(cat => {
        const items = groupedItems[cat].slice(0, CHANNELS_PER_ROW);
        container.appendChild(createRow(cat, items));
    });

    loadedGroupIndex += CHUNK_GROUPS;
}

function createRow(title, items) {
    const row = document.createElement("div");
    row.className = "row-item";

    row.innerHTML = `
        <h3 class="row-title">${title}</h3>
        <div class="row-scroller">
            ${items.map(i => `
                <div class="card-item"
                     onclick="openPlayer('${i.url}','${i.name.replace(/'/g,"\\'")}')">
                    <img src="${i.logo}"
                         onerror="this.src='https://via.placeholder.com/300x170/000/111?text=ESTV'">
                    <div class="card-overlay">${i.name}</div>
                </div>
            `).join("")}
        </div>
    `;
    return row;
}

/* ================= INFINITE SCROLL ================= */
function initInfiniteScroll() {
    const area = document.getElementById("scroll-area");

    area.onscroll = () => {
        if (area.scrollTop + area.clientHeight >= area.scrollHeight - 350) {
            const loader = document.getElementById("infinite-loader");
            loader.style.display = "block";

            setTimeout(() => {
                renderNextGroups();
                loader.style.display = "none";
            }, 700);
        }
    };
}

/* ================= SEARCH ================= */
function toggleSearch() {
    document.getElementById("search-bar-wrap").classList.toggle("hidden");
    document.getElementById("search-input").value = "";
    document.getElementById("search-results").innerHTML = "";
}

function handleSearch() {
    const q = document.getElementById("search-input").value.toLowerCase();
    const box = document.getElementById("search-results");
    box.innerHTML = "";

    if (!q) return;

    allItems
        .filter(i => i.name.toLowerCase().includes(q))
        .slice(0, SEARCH_LIMIT)
        .forEach(i => {
            const div = document.createElement("div");
            div.className = "card-item";
            div.innerHTML = `
                <img src="${i.logo}"
                     onerror="this.src='https://via.placeholder.com/300x170/000/111?text=ESTV'">
                <div class="card-overlay">${i.name}</div>
            `;
            div.onclick = () => {
                toggleSearch();
                openPlayer(i.url, i.name);
            };
            box.appendChild(div);
        });
}

/* ================= CATEGORIES ================= */
function toggleCategoryPopup() {
    const modal = document.getElementById("category-popup");
    modal.classList.toggle("hidden");

    if (!modal.classList.contains("hidden")) {
        document.getElementById("vertical-category-list").innerHTML =
            categoryList.map(c =>
                `<div class="cat-item" onclick="openCategory('${c.replace(/'/g,"\\'")}')">${c}</div>`
            ).join("");
    }
}

function openCategory(cat) {
    const container = document.getElementById("rows-container");
    container.innerHTML = "";

    container.appendChild(
        createRow(cat, groupedItems[cat].slice(0, 40))
    );

    loadedGroupIndex = 0;
    toggleCategoryPopup();
}

/* ================= PLAYER ================= */
function startFunnyText() {
    const el = document.getElementById("funny-load-text");
    el.innerText = funnyLines[0];

    funnyInterval = setInterval(() => {
        el.innerText = funnyLines[Math.floor(Math.random() * funnyLines.length)];
    }, 3500);
}

function openPlayer(url, name) {
    const channel = allItems.find(i => i.name === name);
    if (!channel) return;

    /* Save recently watched */
    recentlyWatched = [
        channel,
        ...recentlyWatched.filter(i => i.name !== name)
    ].slice(0, 12);
    localStorage.setItem("estv_recent", JSON.stringify(recentlyWatched));

    /* Show player */
    document.getElementById("player-modal").classList.remove("hidden");
    document.getElementById("video-buffer-screen").classList.remove("hidden");
    document.getElementById("yt-video-title").innerText = name;

    startFunnyText();

    const video = document.getElementById("video");
    video.onplaying = () => {
        document.getElementById("video-buffer-screen").classList.add("hidden");
        clearInterval(funnyInterval);
    };

    if (Hls.isSupported()) {
        hls.destroy();
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else {
        video.src = url;
        video.play();
    }

    renderSuggested(channel);
}

function renderSuggested(channel) {
    const box = document.getElementById("suggested-channels");
    box.innerHTML = "";

    groupedItems[channel.group]
        .filter(i => i.name !== channel.name)
        .slice(0, 15)
        .forEach(i => {
            const div = document.createElement("div");
            div.className = "card-item";
            div.innerHTML = `
                <img src="${i.logo}"
                     onerror="this.src='https://via.placeholder.com/300x170/000/111?text=ESTV'">
                <div class="card-overlay">${i.name}</div>
            `;
            div.onclick = () => openPlayer(i.url, i.name);
            box.appendChild(div);
        });
}

function closePlayer() {
    if (hls) hls.destroy();
    clearInterval(funnyInterval);

    const video = document.getElementById("video");
    video.pause();
    video.src = "";

    document.getElementById("player-modal").classList.add("hidden");
}
