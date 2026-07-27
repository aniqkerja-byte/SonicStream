// App State
const state = {
  songs: [],
  filteredSongs: [],
  favorites: [],
  playlists: [],
  currentSong: null,
  currentIndex: -1,
  isPlaying: false,
  isShuffle: false,
  isRepeat: false,
  volume: 1,
  serverInfo: null,
  activeTab: 'all-songs',
  audioCtx: null,
  analyser: null,
  visualizerAnimId: null
};

// DOM Elements
const elements = {
  audio: document.getElementById('audio-player'),
  songList: document.getElementById('song-list'),
  favoritesList: document.getElementById('favorites-list'),
  playlistsGrid: document.getElementById('playlists-grid'),
  totalSongsVal: document.getElementById('total-songs-val'),
  searchInput: document.getElementById('search-input'),
  clearSearch: document.getElementById('clear-search'),
  
  // Player bar
  playerCover: document.getElementById('player-cover'),
  playerTitle: document.getElementById('player-title'),
  playerArtist: document.getElementById('player-artist'),
  playerFavBtn: document.getElementById('player-fav-btn'),
  btnPlayPause: document.getElementById('btn-play-pause'),
  btnPrev: document.getElementById('btn-prev'),
  btnNext: document.getElementById('btn-next'),
  btnShuffle: document.getElementById('btn-shuffle'),
  btnRepeat: document.getElementById('btn-repeat'),
  currTime: document.getElementById('curr-time'),
  totalTime: document.getElementById('total-time'),
  progressWrapper: document.getElementById('progress-wrapper'),
  progressFill: document.getElementById('progress-fill'),
  volumeSlider: document.getElementById('volume-slider'),
  btnMute: document.getElementById('btn-mute'),

  // Mobile Player
  mobilePlayer: document.getElementById('mobile-player'),
  mPlayerCover: document.getElementById('m-player-cover'),
  mPlayerTitle: document.getElementById('m-player-title'),
  mPlayerArtist: document.getElementById('m-player-artist'),
  mPlayerFavBtn: document.getElementById('m-player-fav-btn'),
  mBtnPlayPause: document.getElementById('m-btn-play-pause'),
  mBtnPrev: document.getElementById('m-btn-prev'),
  mBtnNext: document.getElementById('m-btn-next'),
  mBtnShuffle: document.getElementById('m-btn-shuffle'),
  mBtnRepeat: document.getElementById('m-btn-repeat'),
  mCurrTime: document.getElementById('m-curr-time'),
  mTotalTime: document.getElementById('m-total-time'),
  mProgressWrapper: document.getElementById('m-progress-wrapper'),
  mProgressFill: document.getElementById('m-progress-fill'),
  mVolumeSlider: document.getElementById('m-volume-slider'),
  closeMobilePlayer: document.getElementById('close-mobile-player'),
  expandMobilePlayer: document.getElementById('expand-mobile-player'),
  playerInfoTrigger: document.getElementById('player-info-trigger'),

  // Modals & Nav
  sidebar: document.getElementById('sidebar'),
  menuToggle: document.getElementById('menu-toggle'),
  cfModal: document.getElementById('cloudflare-modal'),
  openCfBtn: document.getElementById('open-cloudflare-modal'),
  openCfQuick: document.getElementById('open-cf-quick'),
  closeCfBtn: document.getElementById('close-cf-modal'),

  // Upload
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  uploadProgressList: document.getElementById('upload-progress-list')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  fetchServerStatus();
  fetchSongs();
  fetchPlaylists();
});

// Setup Event Listeners
function initEvents() {
  // Navigation Tabs
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
      if (window.innerWidth <= 900) {
        elements.sidebar.classList.remove('open');
      }
    });
  });

  // Sidebar toggle
  elements.menuToggle.addEventListener('click', () => {
    elements.sidebar.classList.toggle('open');
  });

  // Search
  elements.searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    elements.clearSearch.style.display = val ? 'block' : 'none';
    filterSongs(val);
  });

  elements.clearSearch.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.clearSearch.style.display = 'none';
    filterSongs('');
  });

  // Sorting
  document.getElementById('sort-select').addEventListener('change', (e) => {
    sortSongs(e.target.value);
  });

  // Play All / Shuffle All
  document.getElementById('play-all-btn').addEventListener('click', () => {
    if (state.filteredSongs.length > 0) {
      playSongIndex(0);
    }
  });

  document.getElementById('shuffle-all-btn').addEventListener('click', () => {
    if (state.filteredSongs.length > 0) {
      state.isShuffle = true;
      updateControlButtons();
      const randomIndex = Math.floor(Math.random() * state.filteredSongs.length);
      playSongIndex(randomIndex);
    }
  });

  // Audio Player Controls
  elements.btnPlayPause.addEventListener('click', togglePlayPause);
  elements.mBtnPlayPause.addEventListener('click', togglePlayPause);
  elements.btnPrev.addEventListener('click', playPrev);
  elements.mBtnPrev.addEventListener('click', playPrev);
  elements.btnNext.addEventListener('click', playNext);
  elements.mBtnNext.addEventListener('click', playNext);

  // Shuffle & Repeat
  elements.btnShuffle.addEventListener('click', toggleShuffle);
  elements.mBtnShuffle.addEventListener('click', toggleShuffle);
  elements.btnRepeat.addEventListener('click', toggleRepeat);
  elements.mBtnRepeat.addEventListener('click', toggleRepeat);

  // Progress Seek
  elements.progressWrapper.addEventListener('click', handleSeek);
  elements.mProgressWrapper.addEventListener('click', handleSeek);

  // Volume
  elements.volumeSlider.addEventListener('input', (e) => {
    setVolume(parseFloat(e.target.value));
  });
  elements.mVolumeSlider.addEventListener('input', (e) => {
    setVolume(parseFloat(e.target.value));
  });

  elements.btnMute.addEventListener('click', () => {
    if (elements.audio.volume > 0) {
      elements.audio.volume = 0;
      elements.volumeSlider.value = 0;
      elements.mVolumeSlider.value = 0;
      elements.btnMute.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    } else {
      setVolume(state.volume || 1);
    }
  });

  // Audio Element Events
  elements.audio.addEventListener('timeupdate', updateProgress);
  elements.audio.addEventListener('ended', onSongEnded);
  elements.audio.addEventListener('play', () => setPlayingState(true));
  elements.audio.addEventListener('pause', () => setPlayingState(false));

  // Visualizer Toggle Button
  const visualizerBtn = document.getElementById('toggle-visualizer');
  if (visualizerBtn) {
    visualizerBtn.addEventListener('click', () => {
      initVisualizer();
      visualizerBtn.classList.toggle('active', state.audioCtx != null);
    });
  }

  // Favorite Buttons
  elements.playerFavBtn.addEventListener('click', () => {
    if (state.currentSong) toggleFavorite(state.currentSong.id);
  });
  elements.mPlayerFavBtn.addEventListener('click', () => {
    if (state.currentSong) toggleFavorite(state.currentSong.id);
  });

  // Mobile Player Drawer Controls
  elements.playerInfoTrigger.addEventListener('click', openMobilePlayer);
  elements.expandMobilePlayer.addEventListener('click', openMobilePlayer);
  elements.closeMobilePlayer.addEventListener('click', closeMobilePlayer);

  // Copy Live URL Button
  const copyBtn = document.getElementById('copy-live-url');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText('https://music.jomtek.my');
      const label = copyBtn.querySelector('.btn-label');
      if (label) {
        const originalText = label.textContent;
        label.textContent = 'Disalin!';
        setTimeout(() => label.textContent = originalText, 2000);
      }
    });
  }

  // File Upload Handlers
  initUploadHandlers();
}

// Fetch Data from Server API
async function fetchServerStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.serverInfo = data;
    
    const hostnameEl = document.getElementById('info-hostname');
    if (hostnameEl) hostnameEl.textContent = data.hostname;

  } catch (e) {
    console.error('Error fetching server status:', e);
  }
}

async function fetchSongs() {
  try {
    const res = await fetch('/api/songs');
    const songs = await res.json();
    state.songs = songs;
    state.filteredSongs = [...songs];
    state.favorites = songs.filter(s => s.isFavorite).map(s => s.id);
    
    elements.totalSongsVal.textContent = songs.length;
    document.getElementById('info-count').textContent = `${songs.length} Lagu`;
    
    renderSongList();
    renderFavoritesList();
  } catch (e) {
    console.error('Error fetching songs:', e);
    elements.songList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Gagal memuatkan senarai lagu dari laptop server.</p></div>`;
  }
}

async function fetchPlaylists() {
  try {
    const res = await fetch('/api/playlists');
    state.playlists = await res.json();
    renderPlaylists();
  } catch (e) {
    console.error('Error fetching playlists:', e);
  }
}

// Render Song List
function renderSongList() {
  if (state.filteredSongs.length === 0) {
    elements.songList.innerHTML = `
      <div class="empty-state" style="padding:48px; text-align:center; color:var(--text-subdued);">
        <i class="fa-solid fa-compact-disc" style="font-size:40px; margin-bottom:12px;"></i>
        <p>Tiada lagu ditemui dalam perpustakaan anda.</p>
      </div>
    `;
    return;
  }

  elements.songList.innerHTML = state.filteredSongs.map((song, index) => {
    const isCurrent = state.currentSong && state.currentSong.id === song.id;
    const isPlaying = isCurrent && state.isPlaying;
    const durationStr = formatTime(song.duration);
    const coverUrl = `/api/cover/${song.id}`;
    const isFav = state.favorites.includes(song.id);

    return `
      <div class="song-card ${isCurrent ? 'playing' : ''}" data-index="${index}" onclick="playSongIndex(${index})">
        <div class="song-num">
          ${isPlaying ? '<i class="fa-solid fa-chart-simple fa-beat" style="color:var(--spotify-green)"></i>' : (index + 1)}
        </div>
        <img class="song-cover" src="${coverUrl}" alt="Cover" onerror="this.src='default-cover.svg'">
        <div class="song-details">
          <div class="song-title">${escapeHtml(song.title)}</div>
          <div class="song-artist">${escapeHtml(song.artist)}</div>
        </div>
        <div class="song-album">${escapeHtml(song.album || '—')}</div>
        <div class="song-duration">${durationStr}</div>
        <button class="icon-btn-ghost" onclick="event.stopPropagation(); showAddPlaylistModal('${song.id}')" title="Tambah ke Playlist">
          <i class="fa-solid fa-plus"></i>
        </button>
        <button class="icon-btn-ghost" onclick="event.stopPropagation(); deleteSongFromLibrary('${song.id}')" title="Padam dari Laptop" style="color:var(--text-subdued);">
          <i class="fa-solid fa-trash-can"></i>
        </button>
        <button class="icon-btn-ghost ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${song.id}')">
          <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
        </button>
        <button class="icon-btn-ghost" onclick="event.stopPropagation(); deleteSong('${song.id}')" title="Padam Lagu">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    `;
  }).join('');
}

function renderFavoritesList() {
  const favSongs = state.songs.filter(s => state.favorites.includes(s.id));
  if (favSongs.length === 0) {
    elements.favoritesList.innerHTML = `
      <div class="empty-state" style="padding:48px; text-align:center; color:var(--text-subdued);">
        <i class="fa-regular fa-heart" style="font-size:40px; margin-bottom:12px; color:var(--spotify-green);"></i>
        <p>Belum ada lagu kegemaran. Tekan ikon ❤️ pada lagu untuk memasukkan ke sini!</p>
      </div>
    `;
    return;
  }

  elements.favoritesList.innerHTML = favSongs.map((song, index) => {
    const isCurrent = state.currentSong && state.currentSong.id === song.id;
    const coverUrl = `/api/cover/${song.id}`;

    return `
      <div class="song-card ${isCurrent ? 'playing' : ''}" onclick="playSpecificSong('${song.id}')">
        <div class="song-num">${index + 1}</div>
        <img class="song-cover" src="${coverUrl}" alt="Cover" onerror="this.src='default-cover.svg'">
        <div class="song-details">
          <div class="song-title">${escapeHtml(song.title)}</div>
          <div class="song-artist">${escapeHtml(song.artist)}</div>
        </div>
        <div class="song-album">${escapeHtml(song.album || '—')}</div>
        <div class="song-duration">${formatTime(song.duration)}</div>
        <button class="icon-btn-ghost" onclick="event.stopPropagation(); showAddPlaylistModal('${song.id}')" title="Tambah ke Playlist">
          <i class="fa-solid fa-plus"></i>
        </button>
        <button class="icon-btn-ghost active" onclick="event.stopPropagation(); toggleFavorite('${song.id}')">
          <i class="fa-solid fa-heart"></i>
        </button>
        <button class="icon-btn-ghost" onclick="event.stopPropagation(); deleteSong('${song.id}')">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    `;
  }).join('');
}

function renderPlaylists() {
  elements.playlistsGrid.innerHTML = state.playlists.map(pl => `
    <div class="playlist-card" onclick="openPlaylist('${pl.id}')">
      <img class="playlist-card-cover" src="default-cover.svg" alt="Playlist Cover">
      <button class="btn-circle-play" title="Buka Playlist"><i class="fa-solid fa-play"></i></button>
      <div class="playlist-card-title">${escapeHtml(pl.name)}</div>
      <div class="playlist-card-sub">${pl.songs.length} Lagu</div>
    </div>
  `).join('');
}

// Audio Playback Actions
function playSongIndex(index) {
  if (index < 0 || index >= state.filteredSongs.length) return;

  state.currentIndex = index;
  state.currentSong = state.filteredSongs[index];

  const song = state.currentSong;
  const streamUrl = `/api/stream/${song.id}`;
  const coverUrl = `/api/cover/${song.id}`;

  elements.audio.src = streamUrl;
  elements.audio.play();

  // Update UI Elements
  elements.playerTitle.textContent = song.title;
  elements.playerArtist.textContent = song.artist;
  elements.playerCover.src = coverUrl;

  elements.mPlayerTitle.textContent = song.title;
  elements.mPlayerArtist.textContent = song.artist;
  elements.mPlayerCover.src = coverUrl;

  updateFavIcon();
  renderSongList();
  setupMediaSession(song);
}

function playSpecificSong(songId) {
  const index = state.filteredSongs.findIndex(s => s.id === songId);
  if (index !== -1) {
    playSongIndex(index);
  }
}

function togglePlayPause() {
  if (!state.currentSong) {
    if (state.filteredSongs.length > 0) playSongIndex(0);
    return;
  }

  if (elements.audio.paused) {
    elements.audio.play();
  } else {
    elements.audio.pause();
  }
}

function setPlayingState(playing) {
  state.isPlaying = playing;

  const icon = playing ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
  elements.btnPlayPause.innerHTML = icon;
  elements.mBtnPlayPause.innerHTML = icon;

  if (state.currentSong) {
    renderSongList();
  }
}

function playNext() {
  if (state.filteredSongs.length === 0) return;

  if (state.isShuffle) {
    const nextIdx = Math.floor(Math.random() * state.filteredSongs.length);
    playSongIndex(nextIdx);
  } else {
    let nextIdx = state.currentIndex + 1;
    if (nextIdx >= state.filteredSongs.length) nextIdx = 0;
    playSongIndex(nextIdx);
  }
}

function playPrev() {
  if (state.filteredSongs.length === 0) return;

  if (elements.audio.currentTime > 3) {
    elements.audio.currentTime = 0;
    return;
  }

  let prevIdx = state.currentIndex - 1;
  if (prevIdx < 0) prevIdx = state.filteredSongs.length - 1;
  playSongIndex(prevIdx);
}

function onSongEnded() {
  if (state.isRepeat) {
    elements.audio.currentTime = 0;
    elements.audio.play();
  } else {
    playNext();
  }
}

function toggleShuffle() {
  state.isShuffle = !state.isShuffle;
  updateControlButtons();
}

function toggleRepeat() {
  state.isRepeat = !state.isRepeat;
  updateControlButtons();
}

function updateControlButtons() {
  elements.btnShuffle.classList.toggle('active', state.isShuffle);
  elements.mBtnShuffle.classList.toggle('active', state.isShuffle);
  elements.btnRepeat.classList.toggle('active', state.isRepeat);
  elements.mBtnRepeat.classList.toggle('active', state.isRepeat);
}

function setVolume(val) {
  state.volume = val;
  elements.audio.volume = val;
  elements.volumeSlider.value = val;
  elements.mVolumeSlider.value = val;
  elements.btnMute.innerHTML = val === 0 
    ? '<i class="fa-solid fa-volume-xmark"></i>' 
    : (val < 0.5 ? '<i class="fa-solid fa-volume-low"></i>' : '<i class="fa-solid fa-volume-high"></i>');
}

function updateProgress() {
  const curr = elements.audio.currentTime || 0;
  const dur = elements.audio.duration || 0;
  const pct = dur > 0 ? (curr / dur) * 100 : 0;

  elements.progressFill.style.width = `${pct}%`;
  elements.mProgressFill.style.width = `${pct}%`;

  elements.currTime.textContent = formatTime(curr);
  elements.mCurrTime.textContent = formatTime(curr);

  if (dur) {
    elements.totalTime.textContent = formatTime(dur);
    elements.mTotalTime.textContent = formatTime(dur);
  }
}

function handleSeek(e) {
  if (!elements.audio.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const width = rect.width;
  const pct = clickX / width;
  elements.audio.currentTime = pct * elements.audio.duration;
}

// MediaSession API Integration (For Lock Screen Controls on Android/iOS/Bluetooth)
function setupMediaSession(song) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      album: song.album || 'SonicStream',
      artwork: [
        { src: `/api/cover/${song.id}`, sizes: '512x512', type: 'image/png' }
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => elements.audio.play());
    navigator.mediaSession.setActionHandler('pause', () => elements.audio.pause());
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.fastSeek && ('fastSeek' in elements.audio)) {
        elements.audio.fastSeek(details.seekTime);
      } else {
        elements.audio.currentTime = details.seekTime;
      }
    });
  }
}

// Visualizer Canvas Effect
function initVisualizer() {
  if (state.audioCtx) return;

  // iOS STRICT BACKGROUND AUDIO FIX: 
  // Connecting an <audio> element to an AudioContext breaks native background playback on iOS Safari.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
  if (isIOS) {
    console.log('Visualizer disabled on iOS to allow background audio playback.');
    return;
  }

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AudioContext();
    const source = state.audioCtx.createMediaElementSource(elements.audio);
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 64;
    source.connect(state.analyser);
    state.analyser.connect(state.audioCtx.destination);
    drawVisualizer();
  } catch (e) {
    console.log('Audio visualizer init fallback:', e);
  }
}

function drawVisualizer() {
  const canvas = document.getElementById('visualizer-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const bufferLength = state.analyser ? state.analyser.frequencyBinCount : 0;
  const dataArray = new Uint8Array(bufferLength);

  function render() {
    state.visualizerAnimId = requestAnimationFrame(render);
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 80;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!state.analyser || !state.isPlaying) return;

    state.analyser.getByteFrequencyData(dataArray);

    const barWidth = (canvas.width / bufferLength) * 1.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
      gradient.addColorStop(0, 'rgba(30, 215, 96, 0.2)');
      gradient.addColorStop(1, 'rgba(31, 223, 100, 0.9)');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
      x += barWidth;
    }
  }

  render();
}

// Favorites & Song Deletion
async function toggleFavorite(songId) {
  try {
    const res = await fetch('/api/favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId })
    });
    const data = await res.json();
    state.favorites = data.favorites;

    updateFavIcon();
    renderSongList();
    renderFavoritesList();
  } catch (e) {
    console.error('Error toggling favorite:', e);
  }
}

function updateFavIcon() {
  if (!state.currentSong) return;
  const isFav = state.favorites.includes(state.currentSong.id);
  const icon = isFav ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
  elements.playerFavBtn.innerHTML = icon;
  elements.mPlayerFavBtn.innerHTML = icon;
  elements.playerFavBtn.classList.toggle('active', isFav);
  elements.mPlayerFavBtn.classList.toggle('active', isFav);
}

async function deleteSong(songId) {
  if (!confirm('Adakah anda pasti mahu memadam lagu ini daripada laptop server?')) return;

  try {
    const res = await fetch(`/api/songs/${encodeURIComponent(songId)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed');
    await fetchSongs();
    await fetchPlaylists();
    alert(data.message || 'Lagu berjaya dipadam.');
  } catch (e) {
    alert('Gagal memadam lagu.');
  }
}

// Upload Handler
function initUploadHandlers() {
  const dropzone = elements.dropzone;

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--spotify-green)';
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'var(--border-subtle)';
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--border-subtle)';
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  });

  elements.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  });
}

async function uploadFiles(files) {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('songs', files[i]);
  }

  elements.uploadProgressList.innerHTML = `<div class="loading-state" style="padding:24px; text-align:center;"><i class="fa-solid fa-circle-notch fa-spin"></i><p>Memuat naik ${files.length} lagu ke server laptop...</p></div>`;

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    elements.uploadProgressList.innerHTML = `<div class="empty-state" style="padding:24px; text-align:center; color:var(--spotify-green);"><i class="fa-solid fa-circle-check"></i><p>${data.message}</p></div>`;
    fetchSongs();
  } catch (e) {
    elements.uploadProgressList.innerHTML = `<div class="empty-state" style="padding:24px; text-align:center; color:var(--text-negative);"><i class="fa-solid fa-triangle-exclamation"></i><p>Gagal memuat naik lagu.</p></div>`;
  }
}

// Search & Filter
function filterSongs(query) {
  if (!query) {
    state.filteredSongs = [...state.songs];
  } else {
    state.filteredSongs = state.songs.filter(s =>
      s.title.toLowerCase().includes(query) ||
      s.artist.toLowerCase().includes(query) ||
      (s.album && s.album.toLowerCase().includes(query))
    );
  }
  renderSongList();
}

function sortSongs(type) {
  if (type === 'title') {
    state.filteredSongs.sort((a, b) => a.title.localeCompare(b.title));
  } else if (type === 'artist') {
    state.filteredSongs.sort((a, b) => a.artist.localeCompare(b.artist));
  } else if (type === 'newest') {
    state.filteredSongs.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  }
  renderSongList();
}

// Navigation & Modals
function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tabId}`);
  });
}

function openMobilePlayer() {
  elements.mobilePlayer.classList.add('active');
}

function closeMobilePlayer() {
  elements.mobilePlayer.classList.remove('active');
}

// Utilities
function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// =========================================================
// PLAYLIST UI LOGIC
// =========================================================

function openPlaylist(id) {
  const pl = state.playlists.find(p => p.id === id);
  if (!pl) return;
  state.currentPlaylistId = id;
  
  document.getElementById('playlists-main-view').style.display = 'none';
  document.getElementById('playlist-detail-view').style.display = 'block';
  
  document.getElementById('pl-detail-name').textContent = pl.name;
  document.getElementById('pl-detail-desc').textContent = `${pl.songs.length} Lagu`;
  
  renderPlaylistSongs(pl);
}

function closePlaylist() {
  state.currentPlaylistId = null;
  document.getElementById('playlists-main-view').style.display = 'block';
  document.getElementById('playlist-detail-view').style.display = 'none';
}

function renderPlaylistSongs(pl) {
  const plSongs = pl.songs.map(songId => state.songs.find(s => s.id === songId)).filter(Boolean);
  const container = document.getElementById('playlist-songs-list');
  
  if (plSongs.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:48px;text-align:center;"><i class="fa-solid fa-list-ul" style="font-size:40px; margin-bottom:12px; color:var(--text-subdued);"></i><p>Belum ada lagu dalam playlist ini.</p></div>`;
    return;
  }

  container.innerHTML = plSongs.map((song, index) => {
    const isCurrent = state.currentSong && state.currentSong.id === song.id;
    const coverUrl = `/api/cover/${song.id}`;
    
    return `
      <div class="song-card ${isCurrent ? 'playing' : ''}" onclick="playSpecificSong('${song.id}')">
        <div class="song-num">${index + 1}</div>
        <img class="song-cover" src="${coverUrl}" alt="Cover" onerror="this.src='default-cover.svg'">
        <div class="song-details">
          <div class="song-title">${escapeHtml(song.title)}</div>
          <div class="song-artist">${escapeHtml(song.artist)}</div>
        </div>
        <div class="song-album">${escapeHtml(song.album || '—')}</div>
        <div class="song-duration">${formatTime(song.duration)}</div>
        <button class="icon-btn-ghost" onclick="event.stopPropagation(); removeSongFromPlaylist('${song.id}')" title="Buang dari Playlist">
          <i class="fa-solid fa-minus"></i>
        </button>
      </div>
    `;
  }).join('');
}

// Add event listener to Create Playlist
document.getElementById('create-playlist-btn').addEventListener('click', async () => {
  const name = prompt('Nama Playlist Baru:');
  if (!name) return;
  try {
    await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    fetchPlaylists();
  } catch (e) {
    console.error(e);
  }
});

document.getElementById('back-to-playlists').addEventListener('click', closePlaylist);

let currentSongToAdd = null;
window.showAddPlaylistModal = function(songId) {
  currentSongToAdd = songId;
  const modal = document.getElementById('add-to-playlist-modal');
  const list = document.getElementById('add-to-pl-list');
  
  if (state.playlists.length === 0) {
    list.innerHTML = `<p style="color:var(--text-subdued); font-size:13px; text-align:center; padding:20px;">Anda belum mempunyai sebarang Playlist.</p>`;
  } else {
    list.innerHTML = state.playlists.map(pl => `
      <div class="bulk-song-item" onclick="addSongToPlaylist('${pl.id}')" style="justify-content: space-between;">
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="default-cover.svg" style="width:38px; height:38px; border-radius:6px;">
          <div style="display:flex; flex-direction:column;">
            <span style="font-weight:700; font-size:14px; color:white;">${escapeHtml(pl.name)}</span>
            <span style="font-size:11px; color:var(--text-subdued);">${pl.songs.length} Lagu</span>
          </div>
        </div>
        <i class="fa-solid fa-plus" style="color:var(--spotify-green); font-size:14px;"></i>
      </div>
    `).join('');
  }
  
  modal.style.display = 'flex';
};

window.addSongToPlaylist = async function(playlistId) {
  if (!currentSongToAdd) return;
  try {
    await fetch(`/api/playlists/${playlistId}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId: currentSongToAdd })
    });
    document.getElementById('add-to-playlist-modal').style.display = 'none';
    currentSongToAdd = null;
    fetchPlaylists();
    alert('Lagu ditambah ke playlist!');
  } catch (e) {
    console.error(e);
  }
};

window.removeSongFromPlaylist = async function(songId) {
  if (!state.currentPlaylistId) return;
  if (!confirm('Buang lagu ini dari playlist?')) return;
  try {
    await fetch(`/api/playlists/${state.currentPlaylistId}/songs/${songId}`, {
      method: 'DELETE'
    });
    await fetchPlaylists();
    setTimeout(() => openPlaylist(state.currentPlaylistId), 100);
  } catch (e) {
    console.error(e);
  }
};

window.deleteSongFromLibrary = async function(songId) {
  const song = state.songs.find(s => s.id === songId);
  const name = song ? song.title : 'lagu ini';
  if (!confirm(`Adakah anda pasti untuk memadam "${name}" secara KEKAL daripada simpanan laptop?`)) return;
  try {
    const res = await fetch(`/api/songs/${encodeURIComponent(songId)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed');
    await fetchSongs();
    await fetchPlaylists();
    alert(data.message || 'Lagu berjaya dipadam!');
  } catch (e) {
    console.error(e);
    alert('Ralat semasa memadam lagu.');
  }
};

document.getElementById('delete-playlist-btn').addEventListener('click', async () => {
  if (!state.currentPlaylistId) return;
  if (!confirm('Padam playlist ini sepenuhnya?')) return;
  try {
    await fetch(`/api/playlists/${state.currentPlaylistId}`, {
      method: 'DELETE'
    });
    await fetchPlaylists();
    closePlaylist();
  } catch (e) {
    console.error(e);
  }
});

document.getElementById('play-playlist-btn').addEventListener('click', () => {
  if (!state.currentPlaylistId) return;
  const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
  if (!pl || pl.songs.length === 0) return;
  
  // Set filteredSongs to playlist songs
  state.filteredSongs = pl.songs.map(songId => state.songs.find(s => s.id === songId)).filter(Boolean);
  if (state.filteredSongs.length > 0) {
    playSongIndex(0);
  }
});

// =========================================================
// BULK ADD UI LOGIC
// =========================================================

let bulkSelectedSongs = new Set();
let bulkSearchQuery = '';

window.openBulkAddModal = function() {
  if (!state.currentPlaylistId) return;
  bulkSelectedSongs.clear();
  bulkSearchQuery = '';
  const searchInput = document.getElementById('bulk-search-input');
  if (searchInput) searchInput.value = '';
  
  document.getElementById('bulk-add-modal').style.display = 'flex';
  renderBulkSongs();
  updateBulkCount();
};

window.renderBulkSongs = function() {
  const container = document.getElementById('bulk-songs-list');
  const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
  const existingIds = pl ? pl.songs : [];

  let filtered = state.songs;
  if (bulkSearchQuery.trim()) {
    const q = bulkSearchQuery.toLowerCase();
    filtered = filtered.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--text-subdued); font-size: 13px;">Tiada lagu ditemui.</div>`;
    return;
  }

  container.innerHTML = filtered.map(song => {
    const isAdded = existingIds.includes(song.id);
    const isChecked = bulkSelectedSongs.has(song.id);
    const coverUrl = `/api/cover/${song.id}`;
    
    return `
      <div class="bulk-song-item ${isAdded ? 'disabled' : (isChecked ? 'selected' : '')}" 
           onclick="${isAdded ? '' : `toggleBulkSongItem('${song.id}')`}">
        <img class="bulk-song-cover" src="${coverUrl}" alt="Cover" onerror="this.src='default-cover.svg'">
        <div class="bulk-song-info">
          <div class="bulk-song-title">${escapeHtml(song.title)}</div>
          <div class="bulk-song-artist">${escapeHtml(song.artist)}</div>
        </div>
        <div class="bulk-checkbox">
          ${isAdded ? '<i class="fa-solid fa-check"></i>' : (isChecked ? '<i class="fa-solid fa-check"></i>' : '')}
        </div>
      </div>
    `;
  }).join('');
};

window.toggleBulkSongItem = function(songId) {
  if (bulkSelectedSongs.has(songId)) {
    bulkSelectedSongs.delete(songId);
  } else {
    bulkSelectedSongs.add(songId);
  }
  renderBulkSongs();
  updateBulkCount();
};

window.toggleBulkSong = function(songId, isChecked) {
  if (isChecked) {
    bulkSelectedSongs.add(songId);
  } else {
    bulkSelectedSongs.delete(songId);
  }
  updateBulkCount();
};

window.selectAllBulk = function(selectAll) {
  const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
  const existingIds = pl ? pl.songs : [];
  
  let filtered = state.songs;
  if (bulkSearchQuery.trim()) {
    const q = bulkSearchQuery.toLowerCase();
    filtered = filtered.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  }

  filtered.forEach(song => {
    if (!existingIds.includes(song.id)) {
      if (selectAll) bulkSelectedSongs.add(song.id);
      else bulkSelectedSongs.delete(song.id);
    }
  });
  
  renderBulkSongs();
  updateBulkCount();
};

window.updateBulkCount = function() {
  document.getElementById('bulk-count').textContent = `(${bulkSelectedSongs.size})`;
};

window.submitBulkAdd = async function() {
  if (!state.currentPlaylistId) return;
  if (bulkSelectedSongs.size === 0) {
    alert('Sila pilih sekurang-kurangnya satu lagu.');
    return;
  }
  
  try {
    await fetch(`/api/playlists/${state.currentPlaylistId}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songIds: Array.from(bulkSelectedSongs) })
    });
    
    document.getElementById('bulk-add-modal').style.display = 'none';
    bulkSelectedSongs.clear();
    await fetchPlaylists();
    setTimeout(() => openPlaylist(state.currentPlaylistId), 100);
    alert('Lagu-lagu berjaya ditambah ke playlist!');
  } catch (e) {
    console.error(e);
  }
};

// Attach search event listener (safe to run once at script load or in init)
const bulkSearchInput = document.getElementById('bulk-search-input');
if (bulkSearchInput) {
  bulkSearchInput.addEventListener('input', (e) => {
    bulkSearchQuery = e.target.value;
    renderBulkSongs();
  });
}

// =========================================================
// BULK DELETE UI LOGIC
// =========================================================

let bulkDeleteSelectedSongs = new Set();
let bulkDeleteSearchQuery = '';
let bulkDeleteMode = 'library'; // 'library' or 'playlist'

window.openBulkDeleteLibraryModal = function() {
  bulkDeleteMode = 'library';
  bulkDeleteSelectedSongs.clear();
  bulkDeleteSearchQuery = '';
  
  const title = document.getElementById('bulk-delete-title');
  const subtext = document.getElementById('bulk-delete-subtext');
  const input = document.getElementById('bulk-delete-search-input');
  
  if (title) title.textContent = 'Padam Lagu dari Laptop (Bulk Delete)';
  if (subtext) subtext.textContent = 'Pilih lagu yang ingin dipadam dari simpanan laptop:';
  if (input) input.value = '';
  
  document.getElementById('bulk-delete-modal').style.display = 'flex';
  renderBulkDeleteSongs();
  updateBulkDeleteCount();
};

window.openBulkRemoveFromPlaylistModal = function() {
  if (!state.currentPlaylistId) return;
  bulkDeleteMode = 'playlist';
  bulkDeleteSelectedSongs.clear();
  bulkDeleteSearchQuery = '';
  
  const title = document.getElementById('bulk-delete-title');
  const subtext = document.getElementById('bulk-delete-subtext');
  const input = document.getElementById('bulk-delete-search-input');
  
  if (title) title.textContent = 'Buang Lagu dari Playlist';
  if (subtext) subtext.textContent = 'Pilih lagu yang ingin dibuang daripada playlist ini:';
  if (input) input.value = '';
  
  document.getElementById('bulk-delete-modal').style.display = 'flex';
  renderBulkDeleteSongs();
  updateBulkDeleteCount();
};

window.renderBulkDeleteSongs = function() {
  const container = document.getElementById('bulk-delete-songs-list');
  let availableSongs = [];
  
  if (bulkDeleteMode === 'playlist') {
    const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
    const songIds = pl ? pl.songs : [];
    availableSongs = songIds.map(id => state.songs.find(s => s.id === id)).filter(Boolean);
  } else {
    availableSongs = state.songs;
  }

  if (bulkDeleteSearchQuery.trim()) {
    const q = bulkDeleteSearchQuery.toLowerCase();
    availableSongs = availableSongs.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  }

  if (availableSongs.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--text-subdued); font-size: 13px;">Tiada lagu ditemui.</div>`;
    return;
  }

  container.innerHTML = availableSongs.map(song => {
    const isChecked = bulkDeleteSelectedSongs.has(song.id);
    const coverUrl = `/api/cover/${song.id}`;
    
    return `
      <div class="bulk-song-item ${isChecked ? 'selected' : ''}" 
           style="${isChecked ? 'border-color: rgba(243, 114, 127, 0.4); background: rgba(243, 114, 127, 0.08);' : ''}"
           onclick="toggleBulkDeleteSongItem('${song.id}')">
        <img class="bulk-song-cover" src="${coverUrl}" alt="Cover" onerror="this.src='default-cover.svg'">
        <div class="bulk-song-info">
          <div class="bulk-song-title">${escapeHtml(song.title)}</div>
          <div class="bulk-song-artist">${escapeHtml(song.artist)}</div>
        </div>
        <div class="bulk-checkbox" style="${isChecked ? 'background: var(--text-negative); border-color: var(--text-negative); color: white;' : ''}">
          ${isChecked ? '<i class="fa-solid fa-check"></i>' : ''}
        </div>
      </div>
    `;
  }).join('');
};

window.toggleBulkDeleteSongItem = function(songId) {
  if (bulkDeleteSelectedSongs.has(songId)) {
    bulkDeleteSelectedSongs.delete(songId);
  } else {
    bulkDeleteSelectedSongs.add(songId);
  }
  renderBulkDeleteSongs();
  updateBulkDeleteCount();
};

window.selectAllBulkDelete = function(selectAll) {
  let availableSongs = [];
  if (bulkDeleteMode === 'playlist') {
    const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
    const songIds = pl ? pl.songs : [];
    availableSongs = songIds.map(id => state.songs.find(s => s.id === id)).filter(Boolean);
  } else {
    availableSongs = state.songs;
  }

  if (bulkDeleteSearchQuery.trim()) {
    const q = bulkDeleteSearchQuery.toLowerCase();
    availableSongs = availableSongs.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  }

  availableSongs.forEach(song => {
    if (selectAll) bulkDeleteSelectedSongs.add(song.id);
    else bulkDeleteSelectedSongs.delete(song.id);
  });

  renderBulkDeleteSongs();
  updateBulkDeleteCount();
};

window.updateBulkDeleteCount = function() {
  const countSpan = document.getElementById('bulk-delete-count');
  if (countSpan) countSpan.textContent = `(${bulkDeleteSelectedSongs.size})`;
};

window.submitBulkDelete = async function() {
  if (bulkDeleteSelectedSongs.size === 0) {
    alert('Sila pilih sekurang-kurangnya satu lagu.');
    return;
  }

  const count = bulkDeleteSelectedSongs.size;
  const targetName = bulkDeleteMode === 'playlist' ? 'dari playlist' : 'secara KEKAL dari simpanan laptop';
  
  if (!confirm(`Adakah anda pasti untuk memadam ${count} lagu ini ${targetName}?`)) {
    return;
  }

  try {
    if (bulkDeleteMode === 'playlist') {
      await fetch(`/api/playlists/${state.currentPlaylistId}/songs`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songIds: Array.from(bulkDeleteSelectedSongs) })
      });
      await fetchPlaylists();
      setTimeout(() => openPlaylist(state.currentPlaylistId), 100);
      alert(`Berjaya membuang ${count} lagu dari playlist!`);
    } else {
      await fetch('/api/songs/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songIds: Array.from(bulkDeleteSelectedSongs) })
      });
      await fetchSongs();
      await fetchPlaylists();
      alert(`Berjaya memadam ${count} lagu dari simpanan laptop!`);
    }

    document.getElementById('bulk-delete-modal').style.display = 'none';
    bulkDeleteSelectedSongs.clear();
  } catch (e) {
    console.error(e);
    alert('Ralat semasa memadam lagu.');
  }
};

const bulkDeleteSearchInput = document.getElementById('bulk-delete-search-input');
if (bulkDeleteSearchInput) {
  bulkDeleteSearchInput.addEventListener('input', (e) => {
    bulkDeleteSearchQuery = e.target.value;
    renderBulkDeleteSongs();
  });
}
