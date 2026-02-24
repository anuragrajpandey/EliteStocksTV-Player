/* ══════════════════════════════════════════════════════════════
   ELITESTOCKS TV · CEO Edition
   script.js
══════════════════════════════════════════════════════════════ */

/* ── CONFIG ── */
const M3U   = 'https://iptv-org.github.io/iptv/index.m3u';
const CHUNK = 4;   // category groups loaded per scroll tick
const RPR   = 12;  // channels per row
const SLIM  = 40;  // max search results

/* ── STATE ── */
let all      = [];
let groups   = {};
let cats     = [];
let gIdx     = 0;

let hlsInst    = new Hls({ enableWorker: true });
let bufTimer   = null;
let ctrlTimer  = null;
let curChannel = null;

let favs   = lsGet('estv_favs')   || [];
let recent = lsGet('estv_recent') || [];

/* ── LOADING QUIPS ── */
const QUIPS = [
  'Waking up satellites… please wait.',
  'Luxury streams don\'t rush.',
  'Optimizing pixels for premium eyes.',
  'CEO is personally approving this stream.',
  'Calibrating cinematic experience.',
  'Negotiating with the internet gods.',
  'Checking signal quality twice… just to be sure.',
  'Almost there… hold tight.'
];

/* ════════════════════════════════════════
   LOCAL STORAGE HELPERS
════════════════════════════════════════ */
function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); }
  catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); }
  catch { /* storage unavailable */ }
}

/* ════════════════════════════════════════
   SCREEN HELPERS
════════════════════════════════════════ */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}
function setLoader(pct, text) {
  document.getElementById('ld-fill').style.width = pct + '%';
  if (text) document.getElementById('ld-text').textContent = text;
}

/* ════════════════════════════════════════
   BOOT / LOGIN
════════════════════════════════════════ */
async function handleLogin() {
  show('loader');
  setLoader(12, 'INITIALIZING…');

  let data = null;
  const sources = [
    M3U,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(M3U)}`
  ];

  for (const url of sources) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const txt = await res.text();
        if (txt.includes('#EXTM3U')) { data = txt; break; }
      }
    } catch { /* try next source */ }
  }

  if (!data) {
    alert('Playlist blocked. Try a VPN.');
    show('splash');
    return;
  }

  setLoader(60, 'PARSING CHANNELS…');
  parseM3U(data);
  setLoader(100, 'READY');

  setTimeout(() => {
    show('dash');
    renderHero();
    renderChunk();
    initInfiniteScroll();
  }, 550);
}

/* ════════════════════════════════════════
   M3U PARSER
════════════════════════════════════════ */
function parseM3U(raw) {
  all = []; groups = {}; cats = []; gIdx = 0;
  let cur = null;

  raw.split('\n').forEach(line => {
    line = line.trim();

    if (line.startsWith('#EXTINF')) {
      cur = {
        name:  line.split(',').pop().trim(),
        logo:  line.match(/tvg-logo="([^"]+)"/i)?.[1]  || '',
        group: line.match(/group-title="([^"]+)"/i)?.[1] || 'Other'
      };
    } else if (line.startsWith('http') && cur) {
      cur.url = line;
      all.push(cur);
      if (!groups[cur.group]) { groups[cur.group] = []; cats.push(cur.group); }
      groups[cur.group].push(cur);
      cur = null;
    }
  });
}

/* ════════════════════════════════════════
   HERO BANNER
════════════════════════════════════════ */
function renderHero() {
  const h = all[Math.floor(Math.random() * all.length)];
  document.getElementById('hero-ttl').textContent = h.name;
  document.getElementById('hero-img').src = h.logo || placeholder();
  document.getElementById('hero-btn').onclick = () => openPlayer(h);
}

/* ════════════════════════════════════════
   CHANNEL ROWS
════════════════════════════════════════ */
function renderChunk() {
  const container = document.getElementById('rows');

  // Prepend "Recently Watched" on first load
  if (gIdx === 0 && recent.length) {
    container.appendChild(makeRow('Recently Watched', recent));
  }

  cats.slice(gIdx, gIdx + CHUNK).forEach(group => {
    container.appendChild(makeRow(group, groups[group].slice(0, RPR)));
  });

  gIdx += CHUNK;
}

function makeRow(title, items) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `
    <div class="row-head">${title}</div>
    <div class="row-scroll">
      ${items.map(cardHTML).join('')}
    </div>
  `;
  row.querySelectorAll('.card').forEach((el, i) => {
    el.addEventListener('click', () => openPlayer(items[i]));
  });
  return row;
}

function cardHTML(item) {
  return `
    <div class="card">
      <img src="${item.logo}" onerror="this.src='${placeholder()}'" loading="lazy">
      <div class="card-name">${item.name}</div>
    </div>
  `;
}

function placeholder() {
  return 'https://via.placeholder.com/320x180/0a0a0a/1a1a1a?text=ESTV';
}

/* ════════════════════════════════════════
   INFINITE SCROLL
════════════════════════════════════════ */
function initInfiniteScroll() {
  const area = document.getElementById('scroll-area');
  area.addEventListener('scroll', () => {
    if (area.scrollTop + area.clientHeight < area.scrollHeight - 300) return;
    const dots = document.getElementById('dots');
    dots.style.display = 'flex';
    setTimeout(() => { renderChunk(); dots.style.display = 'none'; }, 700);
  });
}

/* ════════════════════════════════════════
   SEARCH
════════════════════════════════════════ */
function toggleSearch() {
  const wrap = document.getElementById('search-wrap');
  wrap.classList.toggle('hidden');
  if (!wrap.classList.contains('hidden')) {
    document.getElementById('s-in').value = '';
    document.getElementById('s-grid').innerHTML = '';
    setTimeout(() => document.getElementById('s-in').focus(), 80);
  }
}

function doSearch() {
  const q    = document.getElementById('s-in').value.toLowerCase().trim();
  const grid = document.getElementById('s-grid');
  grid.innerHTML = '';
  if (!q) return;

  all.filter(i => i.name.toLowerCase().includes(q))
     .slice(0, SLIM)
     .forEach(item => {
       const d = document.createElement('div');
       d.className = 'card';
       d.innerHTML = `
         <img src="${item.logo}" onerror="this.src='${placeholder()}'" loading="lazy">
         <div class="card-name">${item.name}</div>
       `;
       d.addEventListener('click', () => { toggleSearch(); openPlayer(item); });
       grid.appendChild(d);
     });
}

/* ════════════════════════════════════════
   CATEGORIES
════════════════════════════════════════ */
function toggleCat() {
  const modal = document.getElementById('cat-modal');
  modal.classList.toggle('hidden');

  if (!modal.classList.contains('hidden')) {
    document.getElementById('cat-list').innerHTML = cats.map(cat =>
      `<div class="cat-item" data-cat="${cat}">${cat}</div>`
    ).join('');

    document.querySelectorAll('.cat-item').forEach(el => {
      el.addEventListener('click', () => {
        const cat = el.dataset.cat;
        document.getElementById('rows').innerHTML = '';
        gIdx = 0;
        document.getElementById('rows').appendChild(makeRow(cat, groups[cat].slice(0, 40)));
        toggleCat();
      });
    });
  }
}

/* ════════════════════════════════════════
   PLAYER — OPEN
════════════════════════════════════════ */
function openPlayer(channel) {
  curChannel = channel;

  // Save to recently watched
  recent = [channel, ...recent.filter(i => i.name !== channel.name)].slice(0, 12);
  lsSet('estv_recent', recent);

  // Show player shell
  document.getElementById('player').classList.remove('hidden');
  document.getElementById('buffer').classList.remove('hidden');
  document.getElementById('stage-ttl').textContent = channel.name;
  document.getElementById('info-ch').textContent   = channel.name;
  document.getElementById('info-grp').textContent  = channel.group;
  updateFavIcon();

  // Buffer quip cycling
  clearInterval(bufTimer);
  const msg = document.getElementById('buf-msg');
  msg.textContent = QUIPS[0];
  bufTimer = setInterval(() => {
    msg.textContent = QUIPS[Math.floor(Math.random() * QUIPS.length)];
  }, 3200);

  // Load stream
  const vid = document.getElementById('vid');
  vid.onplaying = () => {
    document.getElementById('buffer').classList.add('hidden');
    clearInterval(bufTimer);
  };

  if (Hls.isSupported()) {
    hlsInst.destroy();
    hlsInst = new Hls({ enableWorker: true });
    hlsInst.loadSource(channel.url);
    hlsInst.attachMedia(vid);
    hlsInst.on(Hls.Events.MANIFEST_PARSED, () => vid.play().catch(() => {}));
    hlsInst.on(Hls.Events.BUFFER_APPENDED, updateBuffered);
  } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
    vid.src = channel.url;
    vid.play().catch(() => {});
  }

  renderSuggested(channel);
  setupControls();
}

/* ════════════════════════════════════════
   PLAYER — CLOSE
════════════════════════════════════════ */
function closePlayer() {
  hlsInst.destroy();
  clearInterval(bufTimer);
  clearTimeout(ctrlTimer);

  const vid = document.getElementById('vid');
  vid.pause();
  vid.src = '';

  document.getElementById('player').classList.add('hidden');
  document.getElementById('buffer').classList.add('hidden');
}

/* ════════════════════════════════════════
   CONTROLS SETUP (called each time player opens)
════════════════════════════════════════ */
function setupControls() {
  const vid   = document.getElementById('vid');
  const ctrl  = document.getElementById('ctrl');
  const stage = document.getElementById('stage');
  const stTop = document.getElementById('stage-top');
  const wrap  = document.getElementById('prog-wrap');
  const fill  = document.getElementById('prog-fill');
  const thumb = document.getElementById('prog-thumb');
  const tt    = document.getElementById('prog-tt');
  const ppBtn = document.getElementById('pp-btn');

  /* ─ Time update ─ */
  vid.ontimeupdate = () => {
    if (!vid.duration) return;
    const pct = (vid.currentTime / vid.duration) * 100;
    fill.style.width  = pct + '%';
    thumb.style.left  = pct + '%';
    document.getElementById('td').textContent =
      `${fmt(vid.currentTime)} / ${fmt(vid.duration)}`;
  };

  /* ─ Play / pause icon sync ─ */
  vid.onplay  = () => ppBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  vid.onpause = () => ppBtn.innerHTML = '<i class="fa-solid fa-play"></i>';

  /* ─ Progress scrubbing ─ */
  let scrubbing = false;

  function scrubAt(clientX) {
    const rect = wrap.getBoundingClientRect();
    const x    = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const pct  = x * 100;
    fill.style.width   = pct + '%';
    thumb.style.left   = pct + '%';
    tt.style.left      = pct + '%';
    tt.textContent     = vid.duration ? fmt(x * vid.duration) : 'Live';
    if (scrubbing && vid.duration) vid.currentTime = x * vid.duration;
  }

  wrap.addEventListener('mousemove', e => scrubAt(e.clientX));
  wrap.addEventListener('mousedown', e => {
    scrubbing = true;
    scrubAt(e.clientX);
    const onUp = () => { scrubbing = false; window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mouseup', onUp);
  });
  wrap.addEventListener('touchstart', e => { scrubbing = true; scrubAt(e.touches[0].clientX); }, { passive: true });
  wrap.addEventListener('touchmove',  e => { if (scrubbing) scrubAt(e.touches[0].clientX); }, { passive: true });
  wrap.addEventListener('touchend',   () => scrubbing = false);

  /* ─ Click video to toggle play, double-click to fullscreen ─ */
  vid.addEventListener('click',    () => { togglePlay(); doFlash(); });
  vid.addEventListener('dblclick', toggleFS);

  /* ─ Auto-hide controls after 3 s of inactivity ─ */
  function showControls() {
    ctrl.classList.add('vis');
    stTop.classList.add('vis');
    clearTimeout(ctrlTimer);
    ctrlTimer = setTimeout(() => {
      if (!vid.paused) {
        ctrl.classList.remove('vis');
        stTop.classList.remove('vis');
      }
    }, 3000);
  }
  stage.addEventListener('mousemove',  showControls);
  stage.addEventListener('touchstart', showControls, { passive: true });

  /* ─ Volume slider gradient fill ─ */
  document.getElementById('vol-s').addEventListener('input', function () {
    const pct = this.value * 100;
    this.style.background =
      `linear-gradient(to right, #fff ${pct}%, rgba(255,255,255,0.2) ${pct}%)`;
  });
}

/* ════════════════════════════════════════
   PLAYBACK CONTROLS
════════════════════════════════════════ */
function togglePlay() {
  const v = document.getElementById('vid');
  v.paused ? v.play() : v.pause();
}

function skipBack() {
  const v = document.getElementById('vid');
  if (v.duration) v.currentTime = Math.max(0, v.currentTime - 10);
  showSkipBadge('l');
}

function skipFwd() {
  const v = document.getElementById('vid');
  if (v.duration) v.currentTime = Math.min(v.duration, v.currentTime + 10);
  showSkipBadge('r');
}

function showSkipBadge(side) {
  const el = document.getElementById(side === 'l' ? 'skip-l' : 'skip-r');
  el.classList.remove('show');
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 700);
}

function toggleMute() {
  const v = document.getElementById('vid');
  const b = document.getElementById('mute-btn');
  v.muted = !v.muted;
  b.innerHTML = v.muted
    ? '<i class="fa-solid fa-volume-xmark"></i>'
    : '<i class="fa-solid fa-volume-high"></i>';
}

function setVol(val) {
  const v = document.getElementById('vid');
  const b = document.getElementById('mute-btn');
  v.volume = val;
  b.innerHTML = +val === 0
    ? '<i class="fa-solid fa-volume-xmark"></i>'
    : '<i class="fa-solid fa-volume-high"></i>';
}

function toggleFS() {
  const p = document.getElementById('player');
  if (!document.fullscreenElement) {
    p.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

function togglePip() {
  const v = document.getElementById('vid');
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture().catch(() => {});
  } else {
    v.requestPictureInPicture().catch(() => {});
  }
}

/* ─ Centre flash animation ─ */
function doFlash() {
  const vid   = document.getElementById('vid');
  const flash = document.getElementById('flash');
  flash.innerHTML = vid.paused
    ? '<i class="fa-solid fa-pause"></i>'
    : '<i class="fa-solid fa-play"></i>';
  flash.classList.remove('show');
  void flash.offsetWidth;
  flash.classList.add('show');
}

/* ─ Buffered bar update ─ */
function updateBuffered() {
  const v = document.getElementById('vid');
  const b = document.getElementById('prog-buf');
  if (v.buffered.length && v.duration) {
    b.style.width = (v.buffered.end(v.buffered.length - 1) / v.duration * 100) + '%';
  }
}

/* ════════════════════════════════════════
   FAVOURITES
════════════════════════════════════════ */
function toggleFav() {
  if (!curChannel) return;
  const idx = favs.findIndex(f => f.name === curChannel.name);
  if (idx === -1) favs.push(curChannel);
  else favs.splice(idx, 1);
  lsSet('estv_favs', favs);
  updateFavIcon();
}

function updateFavIcon() {
  if (!curChannel) return;
  const active = favs.some(f => f.name === curChannel.name);
  const ico    = document.getElementById('fav-ico');
  ico.className    = active ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
  ico.style.color  = active ? 'var(--red)' : '';
}

/* ════════════════════════════════════════
   SUGGESTED CHANNELS
════════════════════════════════════════ */
function renderSuggested(channel) {
  const row = document.getElementById('sug-row');
  row.innerHTML = '';

  (groups[channel.group] || [])
    .filter(i => i.name !== channel.name)
    .slice(0, 16)
    .forEach(item => {
      const d = document.createElement('div');
      d.className  = 'card';
      d.style.flex = '0 0 clamp(140px, 22vw, 220px)';
      d.innerHTML  = `
        <img src="${item.logo}" onerror="this.src='${placeholder()}'" loading="lazy">
        <div class="card-name">${item.name}</div>
      `;
      d.addEventListener('click', () => openPlayer(item));
      row.appendChild(d);
    });
}

/* ════════════════════════════════════════
   TIME FORMATTER
════════════════════════════════════════ */
function fmt(seconds) {
  if (!isFinite(seconds)) return 'Live';
  const m  = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}

/* ════════════════════════════════════════
   KEYBOARD SHORTCUTS
════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  // Ignore when typing in inputs
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

  const playerOpen = !document.getElementById('player').classList.contains('hidden');

  switch (e.key) {
    case 'Escape':
      if (!document.getElementById('search-wrap').classList.contains('hidden')) toggleSearch();
      else if (!document.getElementById('cat-modal').classList.contains('hidden')) toggleCat();
      else if (playerOpen) closePlayer();
      break;
    case ' ':
      if (playerOpen) { e.preventDefault(); togglePlay(); doFlash(); }
      break;
    case 'ArrowLeft':
      if (playerOpen) skipBack();
      break;
    case 'ArrowRight':
      if (playerOpen) skipFwd();
      break;
    case 'f':
    case 'F':
      if (playerOpen) toggleFS();
      break;
    case 'm':
    case 'M':
      if (playerOpen) toggleMute();
      break;
  }
});
