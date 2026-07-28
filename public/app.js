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
  visualizerSource: null,
  visualizerSources: [],
  visualizerAnimId: null,
  visualizerEnabled: false,
  selectionMode: false,
  selectedSongIds: new Set(),
  audioPool: [],
  activeAudio: null,
  preloadTimer: null,
  lastVolume: 1
};

const STORAGE_KEY = 'sonicstream-state-v1';
let apiKey = window.localStorage.getItem('sonicstream-api-key') || '';

function getActiveAudio() {
  return state.activeAudio || elements.audio;
}

async function apiFetch(url, options = {}) {
  const { _authRetry, ...requestOptions } = options;
  const headers = new Headers(options.headers || {});
  if (apiKey) headers.set('X-API-Key', apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 15000);
  try {
    const response = await fetch(url, { ...requestOptions, headers, signal: options.signal || controller.signal });
    if (response.status === 401 && !_authRetry && requestOptions.method && requestOptions.method.toUpperCase() !== 'GET') {
      const enteredKey = window.prompt('Masukkan API key SonicStream untuk meneruskan tindakan:');
      if (enteredKey) {
        apiKey = enteredKey.trim();
        window.localStorage.setItem('sonicstream-api-key', apiKey);
        return apiFetch(url, { ...options, _authRetry: true });
      }
    }
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      const message = typeof data === 'object' && data?.error ? (data.error.message || data.error) : data;
      throw new Error(message || `Request gagal (${response.status})`);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Request tamat masa. Semak sambungan server.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function loadPersistedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (Number.isFinite(saved.volume)) state.volume = Math.min(1, Math.max(0, saved.volume));
    state.isShuffle = Boolean(saved.isShuffle);
    state.isRepeat = Boolean(saved.isRepeat);
    state.activeTab = saved.activeTab || state.activeTab;
    state.lastSongId = saved.lastSongId || null;
    state.lastPosition = Number.isFinite(saved.lastPosition) ? saved.lastPosition : 0;
  } catch (error) {
    console.warn('Unable to restore player state:', error);
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    volume: state.volume,
    isShuffle: state.isShuffle,
    isRepeat: state.isRepeat,
    activeTab: state.activeTab,
    lastSongId: state.currentSong?.id || state.lastSongId || null,
    lastPosition: getActiveAudio().currentTime || 0
  }));
}

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
  loadPersistedState();
  initEvents();
  fetchServerStatus();
  fetchSongs();
  fetchPlaylists();
});

// Setup Event Listeners
function initEvents() {
  document.addEventListener('click', handleDelegatedAction);
  document.addEventListener('error', handleImageError, true);

  document.getElementById('selection-mode-btn')?.addEventListener('click', () => toggleSelectionMode());
  document.getElementById('select-all-songs-btn')?.addEventListener('click', () => toggleSelectAllSongs());
  document.getElementById('delete-selected-btn')?.addEventListener('click', deleteSelectedSongs);
  document.getElementById('cancel-selection-btn')?.addEventListener('click', () => toggleSelectionMode(false));
  document.getElementById('select-all-songs-checkbox')?.addEventListener('change', event => toggleSelectAllSongs(event.target.checked));
  document.getElementById('open-bulk-add-btn')?.addEventListener('click', openBulkAddModal);
  document.getElementById('open-bulk-remove-btn')?.addEventListener('click', () => {
    showAppAlert('Fungsi buang banyak lagu belum tersedia.', 'Makluman', 'warning');
  });
  document.getElementById('choose-audio-btn')?.addEventListener('click', () => elements.fileInput.click());
  document.getElementById('close-add-playlist-modal')?.addEventListener('click', closeAddPlaylistModal);
  document.getElementById('close-add-playlist-btn')?.addEventListener('click', closeAddPlaylistModal);
  document.getElementById('close-bulk-add-modal')?.addEventListener('click', closeBulkAddModal);
  document.getElementById('cancel-bulk-add-btn')?.addEventListener('click', closeBulkAddModal);
  document.getElementById('select-all-bulk-btn')?.addEventListener('click', () => selectAllBulk(true));
  document.getElementById('reset-bulk-btn')?.addEventListener('click', () => selectAllBulk(false));
  document.getElementById('submit-bulk-add-btn')?.addEventListener('click', submitBulkAdd);
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
    const activeAudio = getActiveAudio();
    if (activeAudio.volume > 0) {
      state.lastVolume = activeAudio.volume;
      setVolume(0);
      elements.volumeSlider.value = 0;
      elements.mVolumeSlider.value = 0;
      elements.btnMute.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    } else {
      setVolume(state.lastVolume || 1);
    }
  });

  // Audio Element Events
  initAudioPool();

  // Visualizer Toggle Button
  const visualizerBtn = document.getElementById('toggle-visualizer');
  if (visualizerBtn) {
    visualizerBtn.addEventListener('click', () => {
      toggleVisualizer(visualizerBtn);
    });
  }

  const mobileVisualizerBtn = document.getElementById('m-eq-btn');
  if (mobileVisualizerBtn) {
    mobileVisualizerBtn.addEventListener('click', () => toggleVisualizer(mobileVisualizerBtn));
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
    copyBtn.addEventListener('click', async () => {
      const liveUrl = window.location.origin;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(liveUrl);
        } else {
          const fallback = document.createElement('textarea');
          fallback.value = liveUrl;
          fallback.style.position = 'fixed';
          fallback.style.opacity = '0';
          document.body.appendChild(fallback);
          fallback.select();
          if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
          fallback.remove();
        }
      } catch (_error) {
        await showAppAlert('Pautan tidak dapat disalin pada browser ini.', 'Salinan gagal', 'warning');
        return;
      }
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

function handleImageError(event) {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.dataset.fallbackCover !== undefined) {
    delete image.dataset.fallbackCover;
    image.src = '/default-cover.svg';
  }
}

function closeAddPlaylistModal() {
  document.getElementById('add-to-playlist-modal').style.display = 'none';
  currentSongToAdd = null;
}

function closeBulkAddModal() {
  document.getElementById('bulk-add-modal').style.display = 'none';
  bulkSelectedSongs.clear();
}

function handleDelegatedAction(event) {
  const actionElement = event.target.closest('[data-action]');
  if (actionElement) {
    event.stopPropagation();
    const { action, songId, playlistId } = actionElement.dataset;
    if (action === 'favorite') toggleFavorite(songId);
    if (action === 'add-playlist') showAddPlaylistModal(songId);
    if (action === 'delete-song') deleteSongFromLibrary(songId);
    if (action === 'remove-playlist-song') removeSongFromPlaylist(songId);
    if (action === 'add-playlist-item') addSongToPlaylist(playlistId);
    if (action === 'select-song') toggleSongSelection(songId, actionElement.checked);
    if (action === 'bulk-song' && !actionElement.classList.contains('disabled')) toggleBulkSongItem(songId);
    if (action === 'open-playlist') openPlaylist(playlistId);
    return;
  }
  const songCard = event.target.closest('.song-card[data-song-id]');
  if (songCard && !event.target.closest('button, input, a')) {
    if (state.selectionMode) toggleSongSelection(songCard.dataset.songId);
    else playSpecificSong(songCard.dataset.songId);
  }
}

// Fetch Data from Server API
async function fetchServerStatus() {
  try {
      const data = await apiFetch('/api/status');
    state.serverInfo = data;
    
    const hostnameEl = document.getElementById('info-hostname');
    if (hostnameEl) hostnameEl.textContent = 'Server aktif';

  } catch (e) {
    console.error('Error fetching server status:', e);
  }
}

async function fetchSongs() {
  try {
    const songs = await apiFetch('/api/songs');
    state.songs = songs;
    state.filteredSongs = [...songs];
    state.selectedSongIds.forEach(id => {
      if (!songs.some(song => song.id === id)) state.selectedSongIds.delete(id);
    });
    state.favorites = songs.filter(s => s.isFavorite).map(s => s.id);
    
    elements.totalSongsVal.textContent = songs.length;
    document.getElementById('info-count').textContent = `${songs.length} Lagu`;
    
    renderSongList();
    renderFavoritesList();
    updateSelectionControls();
  } catch (e) {
    console.error('Error fetching songs:', e);
    elements.songList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Gagal memuatkan senarai lagu dari laptop server.</p></div>`;
  }
}

async function fetchPlaylists() {
  try {
    state.playlists = await apiFetch('/api/playlists');
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
    const isSelected = state.selectedSongIds.has(song.id);

    return `
      <div class="song-card ${isCurrent ? 'playing' : ''} ${isSelected ? 'selected-for-delete' : ''}" data-index="${index}" data-song-id="${escapeHtml(song.id)}">
        <div class="song-select-cell">
          ${state.selectionMode ? `<input type="checkbox" data-action="select-song" data-song-id="${escapeHtml(song.id)}" aria-label="Pilih ${escapeHtml(song.title)}" ${isSelected ? 'checked' : ''}>` : ''}
        </div>
        <div class="song-num">
          ${isPlaying ? '<i class="fa-solid fa-chart-simple fa-beat" style="color:var(--spotify-green)"></i>' : (index + 1)}
        </div>
        <img class="song-cover" src="${coverUrl}" data-fallback-cover alt="Cover">
        <div class="song-details">
          <div class="song-title">${escapeHtml(song.title)}</div>
          <div class="song-artist">${escapeHtml(song.artist)}</div>
        </div>
        <div class="song-album">${escapeHtml(song.album || '—')}</div>
        <div class="song-duration">${durationStr}</div>
        <button class="icon-btn-ghost" data-action="add-playlist" data-song-id="${escapeHtml(song.id)}" title="Tambah ke Playlist">
          <i class="fa-solid fa-plus"></i>
        </button>
        <button class="icon-btn-ghost ${isFav ? 'active' : ''}" data-action="favorite" data-song-id="${escapeHtml(song.id)}">
          <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
        </button>
        <button class="icon-btn-ghost" data-action="delete-song" data-song-id="${escapeHtml(song.id)}" title="Padam dari Laptop" style="color:var(--text-subdued);">
          <i class="fa-solid fa-trash-can"></i>
        </button>
        <span class="song-action-spacer" aria-hidden="true"></span>
      </div>
    `;
  }).join('');
}
function getVisibleSongIds() {
  return state.filteredSongs.map(song => song.id);
}
function updateSelectionControls() {
  const actions = document.getElementById('selection-actions');
  const header = document.getElementById('song-select-header');
  const selectAllCheckbox = document.getElementById('select-all-songs-checkbox');
  const deleteButton = document.getElementById('delete-selected-btn');
  const count = document.getElementById('selected-songs-count');
  const selectionButton = document.getElementById('selection-mode-btn');
  const visibleIds = getVisibleSongIds();
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => state.selectedSongIds.has(id));

  if (actions) actions.hidden = !state.selectionMode;
  if (selectionButton) selectionButton.hidden = state.selectionMode;
  if (header) header.classList.toggle('selection-mode-active', state.selectionMode);
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = allSelected;
    selectAllCheckbox.indeterminate = !allSelected && visibleIds.some(id => state.selectedSongIds.has(id));
  }
  if (count) count.textContent = `(${state.selectedSongIds.size})`;
  if (deleteButton) deleteButton.disabled = state.selectedSongIds.size === 0;
}

window.toggleSelectionMode = function(enabled = !state.selectionMode) {
  state.selectionMode = enabled;
  if (!enabled) state.selectedSongIds.clear();
  const button = document.getElementById('selection-mode-btn');
  if (button) button.classList.toggle('active', state.selectionMode);
  renderSongList();
  updateSelectionControls();
};

window.toggleSongSelection = function(songId, selected) {
  if (selected === undefined) selected = !state.selectedSongIds.has(songId);
  if (selected) state.selectedSongIds.add(songId);
  else state.selectedSongIds.delete(songId);
  renderSongList();
  updateSelectionControls();
};

window.toggleSelectAllSongs = function(selected) {
  const visibleIds = getVisibleSongIds();
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => state.selectedSongIds.has(id));
  const shouldSelect = selected === undefined ? !allSelected : selected;
  visibleIds.forEach(id => {
    if (shouldSelect) state.selectedSongIds.add(id);
    else state.selectedSongIds.delete(id);
  });
  renderSongList();
  updateSelectionControls();
};

window.deleteSelectedSongs = async function() {
  const songIds = Array.from(state.selectedSongIds);
  if (songIds.length === 0) return;

  const message = `Padam ${songIds.length} lagu terpilih secara kekal daripada laptop?`;
  if (!await showAppConfirm(message, 'Padam lagu terpilih?', 'danger')) return;

  try {
    const data = await apiFetch('/api/songs/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songIds })
    });

    state.selectedSongIds.clear();
    state.selectionMode = false;
    await fetchSongs();
    await fetchPlaylists();
    updateSelectionControls();
    await showAppAlert(data.message || 'Lagu terpilih berjaya dipadam.', 'Lagu dipadam');
  } catch (error) {
    console.error('Bulk delete failed:', error);
    await showAppAlert('Ralat semasa memadam lagu terpilih.', 'Padam gagal', 'danger');
  }
};

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
      <div class="song-card ${isCurrent ? 'playing' : ''}" data-song-id="${escapeHtml(song.id)}">
        <div class="song-select-cell" aria-hidden="true"></div>
        <div class="song-num">${index + 1}</div>
        <img class="song-cover" src="${coverUrl}" data-fallback-cover alt="Cover">
        <div class="song-details">
          <div class="song-title">${escapeHtml(song.title)}</div>
          <div class="song-artist">${escapeHtml(song.artist)}</div>
        </div>
        <div class="song-album">${escapeHtml(song.album || '—')}</div>
        <div class="song-duration">${formatTime(song.duration)}</div>
        <button class="icon-btn-ghost" data-action="add-playlist" data-song-id="${escapeHtml(song.id)}" title="Tambah ke Playlist">
          <i class="fa-solid fa-plus"></i>
        </button>
        <button class="icon-btn-ghost active" data-action="favorite" data-song-id="${escapeHtml(song.id)}">
          <i class="fa-solid fa-heart"></i>
        </button>
        <button class="icon-btn-ghost" data-action="delete-song" data-song-id="${escapeHtml(song.id)}">
          <i class="fa-solid fa-trash-can"></i>
        </button>
        <span class="song-action-spacer" aria-hidden="true"></span>
      </div>
    `;
  }).join('');
}

function renderPlaylists() {
  elements.playlistsGrid.innerHTML = state.playlists.map(pl => `
      <div class="playlist-card" data-action="open-playlist" data-playlist-id="${escapeHtml(pl.id)}" role="button" tabindex="0">
      <img class="playlist-card-cover" src="default-cover.svg" alt="Playlist Cover">
      <button class="btn-circle-play" title="Buka Playlist"><i class="fa-solid fa-play"></i></button>
      <div class="playlist-card-title">${escapeHtml(pl.name)}</div>
      <div class="playlist-card-sub">${pl.songs.length} Lagu</div>
    </div>
  `).join('');
}

// Audio Playback Actions
function initAudioPool() {
  state.audioPool = [elements.audio, new Audio()];
  state.activeAudio = elements.audio;
  state.audioPool.forEach(audio => {
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.addEventListener('timeupdate', () => {
      if (audio === state.activeAudio) {
        updateProgress();
        persistState();
      }
    });
    audio.addEventListener('ended', () => {
      if (audio === state.activeAudio) onSongEnded();
    });
    audio.addEventListener('play', () => {
      if (audio === state.activeAudio) setPlayingState(true);
    });
    audio.addEventListener('pause', () => {
      if (audio === state.activeAudio) setPlayingState(false);
    });
    audio.addEventListener('canplay', () => {
      if (audio === state.activeAudio && state.isPlaying) schedulePreloadNextSong(true);
    });
  });
}

function getNextSongIndex() {
  if (state.filteredSongs.length === 0) return -1;
  if (state.isShuffle) return Math.floor(Math.random() * state.filteredSongs.length);
  return (state.currentIndex + 1) % state.filteredSongs.length;
}

function preloadNextSong() {
  const nextIndex = getNextSongIndex();
  if (nextIndex < 0 || nextIndex === state.currentIndex) return;

  const nextUrl = `/api/stream/${state.filteredSongs[nextIndex].id}`;
  const preloadAudio = state.audioPool.find(audio => audio !== state.activeAudio);
  if (!preloadAudio || preloadAudio.src === new URL(nextUrl, window.location.href).href) return;

  preloadAudio.volume = state.volume;
  preloadAudio.src = nextUrl;
  preloadAudio.load();
}

function schedulePreloadNextSong(isReady = false) {
  clearTimeout(state.preloadTimer);
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const isSlowConnection = connection && (connection.saveData || ['slow-2g', '2g'].includes(connection.effectiveType));
  const delay = isReady ? (isSlowConnection ? 1800 : 250) : 2500;
  state.preloadTimer = setTimeout(() => {
    if (state.isPlaying) preloadNextSong();
  }, delay);
}

function playSongIndex(index) {
  if (index < 0 || index >= state.filteredSongs.length) return;

  state.currentIndex = index;
  state.currentSong = state.filteredSongs[index];

  const song = state.currentSong;
  const streamUrl = `/api/stream/${song.id}`;
  const coverUrl = `/api/cover/${song.id}`;

  const streamAbsoluteUrl = new URL(streamUrl, window.location.href).href;
  const preparedAudio = state.audioPool.find(audio => audio !== state.activeAudio && audio.src === streamAbsoluteUrl);
  const previousAudio = state.activeAudio;

  if (preparedAudio) {
    previousAudio.pause();
    state.activeAudio = preparedAudio;
    preparedAudio.volume = state.volume;
  } else {
    const activeAudio = getActiveAudio();
    activeAudio.volume = state.volume;
    activeAudio.src = streamUrl;
  }

  const activeAudio = getActiveAudio();
  const playback = activeAudio.play();
  if (playback) playback.catch(error => console.warn('Audio playback could not start:', error));
  if (state.lastSongId === song.id && state.lastPosition > 0) {
    activeAudio.addEventListener('loadedmetadata', () => {
      activeAudio.currentTime = Math.min(state.lastPosition, activeAudio.duration || state.lastPosition);
      state.lastPosition = 0;
    }, { once: true });
  }
  state.lastSongId = song.id;
  persistState();

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
  schedulePreloadNextSong();
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

  const activeAudio = getActiveAudio();
  if (activeAudio.paused) {
    activeAudio.play();
  } else {
    activeAudio.pause();
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
  playSongIndex(getNextSongIndex());
}

function playPrev() {
  if (state.filteredSongs.length === 0) return;

  const activeAudio = getActiveAudio();
  if (activeAudio.currentTime > 3) {
    activeAudio.currentTime = 0;
    return;
  }

  let prevIdx = state.currentIndex - 1;
  if (prevIdx < 0) prevIdx = state.filteredSongs.length - 1;
  playSongIndex(prevIdx);
}

function onSongEnded() {
  if (state.isRepeat) {
    const activeAudio = getActiveAudio();
    activeAudio.currentTime = 0;
    activeAudio.play();
  } else {
    playNext();
  }
}

function toggleShuffle() {
  state.isShuffle = !state.isShuffle;
  persistState();
  updateControlButtons();
}

function toggleRepeat() {
  state.isRepeat = !state.isRepeat;
  persistState();
  updateControlButtons();
}

function updateControlButtons() {
  elements.btnShuffle.classList.toggle('active', state.isShuffle);
  elements.mBtnShuffle.classList.toggle('active', state.isShuffle);
  elements.btnRepeat.classList.toggle('active', state.isRepeat);
  elements.mBtnRepeat.classList.toggle('active', state.isRepeat);
}

function setVolume(val) {
  state.volume = Math.min(1, Math.max(0, val));
  state.lastVolume = state.volume || state.lastVolume || 1;
  state.audioPool.forEach(audio => { audio.volume = state.volume; });
  elements.volumeSlider.value = state.volume;
  elements.mVolumeSlider.value = state.volume;
  elements.btnMute.innerHTML = state.volume === 0
    ? '<i class="fa-solid fa-volume-xmark"></i>' 
    : (state.volume < 0.5 ? '<i class="fa-solid fa-volume-low"></i>' : '<i class="fa-solid fa-volume-high"></i>');
  persistState();
}

function updateProgress() {
  const activeAudio = getActiveAudio();
  const curr = activeAudio.currentTime || 0;
  const dur = activeAudio.duration || 0;
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
  const activeAudio = getActiveAudio();
  if (!activeAudio.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const width = rect.width;
  const pct = clickX / width;
  activeAudio.currentTime = pct * activeAudio.duration;
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

    navigator.mediaSession.setActionHandler('play', () => getActiveAudio().play());
    navigator.mediaSession.setActionHandler('pause', () => getActiveAudio().pause());
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      const activeAudio = getActiveAudio();
      if (details.fastSeek && ('fastSeek' in activeAudio)) {
        activeAudio.fastSeek(details.seekTime);
      } else {
        activeAudio.currentTime = details.seekTime;
      }
    });
  }
}

// Visualizer Canvas Effect
function initVisualizer() {
  if (state.audioCtx) {
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
    return true;
  }

  // iOS STRICT BACKGROUND AUDIO FIX: 
  // Connecting an <audio> element to an AudioContext breaks native background playback on iOS Safari.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
  if (isIOS) {
    showAppAlert('Visualizer tidak disokong pada iPhone kerana Safari mengehadkan sambungan audio masa nyata. Player dan kawalan volume masih berfungsi seperti biasa.', 'Visualizer iPhone');
    return false;
  }

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AudioContext();
    state.audioCtx.resume();
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 64;
    state.visualizerSources = state.audioPool.map(audio => {
      const source = state.audioCtx.createMediaElementSource(audio);
      source.connect(state.analyser);
      return source;
    });
    state.visualizerSource = state.visualizerSources[0];
    state.analyser.connect(state.audioCtx.destination);
    drawVisualizer();
    return true;
  } catch (e) {
    console.log('Audio visualizer init fallback:', e);
    showAppAlert('Visualizer tidak dapat dimulakan pada browser ini.', 'Visualizer tidak tersedia', 'warning');
    return false;
  }
}

function toggleVisualizer(_sourceButton) {
  const visualizerStatus = document.getElementById('visualizer-status');
  if (state.audioCtx) {
    state.visualizerEnabled = !state.visualizerEnabled;
  } else {
    const initialized = initVisualizer();
    if (!initialized) return false;
    state.visualizerEnabled = true;
  }

  const enabled = state.visualizerEnabled;
  document.querySelectorAll('#toggle-visualizer, #m-eq-btn').forEach(button => {
    button.classList.toggle('active', enabled);
    button.setAttribute('aria-pressed', String(enabled));
    button.title = enabled ? 'Matikan visualizer' : 'Hidupkan visualizer';
  });
  if (visualizerStatus) {
    visualizerStatus.innerHTML = enabled
      ? '<i class="fa-solid fa-chart-simple"></i> Visualizer On'
      : '<i class="fa-solid fa-chart-simple"></i> Visualizer Off';
    visualizerStatus.classList.toggle('active', enabled);
  }
  return enabled;
}

function syncVisualizerStatus() {
  const enabled = Boolean(state.visualizerEnabled);
  document.querySelectorAll('#toggle-visualizer, #m-eq-btn').forEach(button => {
    button.classList.toggle('active', enabled);
    button.setAttribute('aria-pressed', String(enabled));
    button.title = enabled ? 'Matikan visualizer' : 'Hidupkan visualizer';
  });
  const visualizerStatus = document.getElementById('visualizer-status');
  if (visualizerStatus) {
    visualizerStatus.innerHTML = enabled
      ? '<i class="fa-solid fa-chart-simple"></i> Visualizer On'
      : '<i class="fa-solid fa-chart-simple"></i> Visualizer Off';
    visualizerStatus.classList.toggle('active', enabled);
  }
}

function drawVisualizer() {
  const canvases = [
    document.getElementById('visualizer-canvas'),
    document.getElementById('desktop-visualizer-canvas')
  ].filter(Boolean);
  if (canvases.length === 0) return;
  const contexts = canvases.map(canvas => ({ canvas, ctx: canvas.getContext('2d') }));
  const bufferLength = state.analyser ? state.analyser.frequencyBinCount : 0;
  const dataArray = new Uint8Array(bufferLength);

  function render() {
    state.visualizerAnimId = requestAnimationFrame(render);
    contexts.forEach(({ canvas, ctx }) => {
      canvas.width = canvas.clientWidth || canvas.parentElement.clientWidth;
      canvas.height = canvas.id === 'desktop-visualizer-canvas' ? 28 : 80;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    if (!state.analyser || !state.isPlaying || !state.visualizerEnabled) return;

    state.analyser.getByteFrequencyData(dataArray);

    contexts.forEach(({ canvas, ctx }) => {
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = Math.max(2, (dataArray[i] / 255) * canvas.height);
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, 'rgba(30, 215, 96, 0.2)');
        gradient.addColorStop(1, 'rgba(31, 223, 100, 0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }
    });
  }

  render();
}

// Favorites & Song Deletion
async function toggleFavorite(songId) {
  try {
    const data = await apiFetch('/api/favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId })
    });
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
  if (!await showAppConfirm('Adakah anda pasti mahu memadam lagu ini daripada laptop server?', 'Padam lagu ini?', 'danger')) return;

  try {
    const data = await apiFetch(`/api/songs/${encodeURIComponent(songId)}`, { method: 'DELETE' });
    await fetchSongs();
    await fetchPlaylists();
    await showAppAlert(data.message || 'Lagu berjaya dipadam.', 'Lagu dipadam');
  } catch (e) {
    await showAppAlert('Gagal memadam lagu.', 'Padam gagal', 'danger');
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
  const selectedFiles = Array.from(files);
  if (selectedFiles.length === 0) return;

  elements.uploadProgressList.innerHTML = `
    <div class="upload-progress-summary" id="upload-progress-summary">
      <span><i class="fa-solid fa-circle-notch fa-spin"></i> Menyediakan upload...</span>
      <strong id="upload-progress-total">0 / ${selectedFiles.length}</strong>
    </div>
    <div class="upload-progress-items" id="upload-progress-items">
      ${selectedFiles.map((file, index) => `
        <div class="upload-progress-item" id="upload-item-${index}">
          <div class="upload-file-icon"><i class="fa-solid fa-music"></i></div>
          <div class="upload-file-details">
            <div class="upload-file-heading">
              <span class="upload-file-name">${escapeHtml(file.name)}</span>
              <span class="upload-file-status">Menunggu</span>
            </div>
            <div class="upload-progress-track"><div class="upload-progress-fill"></div></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  let completed = 0;
  let failed = 0;

  for (let index = 0; index < selectedFiles.length; index++) {
    const file = selectedFiles[index];
    const item = document.getElementById(`upload-item-${index}`);
    const status = item.querySelector('.upload-file-status');
    const progress = item.querySelector('.upload-progress-fill');
    item.classList.add('uploading');
    status.textContent = 'Memuat naik...';

    try {
      await uploadSingleFile(file, progress, status);
      completed++;
      item.classList.remove('uploading');
      item.classList.add('uploaded');
      status.textContent = 'Selesai';
      progress.style.width = '100%';
    } catch (error) {
      failed++;
      item.classList.remove('uploading');
      item.classList.add('upload-failed');
      status.textContent = 'Gagal';
      console.error(`Upload failed for ${file.name}:`, error);
    }

    document.getElementById('upload-progress-total').textContent = `${completed + failed} / ${selectedFiles.length}`;
  }

  const summary = document.getElementById('upload-progress-summary');
  summary.innerHTML = failed === 0
    ? `<span class="upload-success"><i class="fa-solid fa-circle-check"></i> Semua lagu selesai dimuat naik</span><strong>${completed} / ${selectedFiles.length}</strong>`
    : `<span class="upload-warning"><i class="fa-solid fa-triangle-exclamation"></i> ${completed} berjaya, ${failed} gagal</span><strong>${completed + failed} / ${selectedFiles.length}</strong>`;

  await fetchSongs();
  setTimeout(fetchSongs, 1200);
  elements.fileInput.value = '';
}

function uploadSingleFile(file, progressElement, statusElement) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('songs', file);

    xhr.open('POST', '/api/upload');
    if (!apiKey) {
      const enteredKey = window.prompt('Masukkan API key SonicStream untuk upload:');
      if (enteredKey) {
        apiKey = enteredKey.trim();
        window.localStorage.setItem('sonicstream-api-key', apiKey);
      }
    }
    if (apiKey) xhr.setRequestHeader('X-API-Key', apiKey);
    xhr.upload.addEventListener('progress', event => {
      if (!event.lengthComputable) return;
      progressElement.style.width = `${Math.round((event.loaded / event.total) * 100)}%`;
      statusElement.textContent = `${Math.round((event.loaded / event.total) * 100)}%`;
    });
    xhr.addEventListener('load', () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch (error) { /* handled below */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || `Upload failed (${xhr.status})`));
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
    xhr.send(formData);
  });
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
  persistState();
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tabId}`);
  });
}

function openMobilePlayer() {
  elements.mobilePlayer.classList.add('active');
  syncVisualizerStatus();
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

// Themed app dialogs replace browser alert/confirm popups.
const appDialog = document.getElementById('app-dialog');
const appDialogTitle = document.getElementById('app-dialog-title');
const appDialogMessage = document.getElementById('app-dialog-message');
const appDialogIcon = document.getElementById('app-dialog-icon');
const appDialogCancel = document.getElementById('app-dialog-cancel');
const appDialogConfirm = document.getElementById('app-dialog-confirm');
let appDialogResolver = null;

function closeAppDialog(result) {
  appDialog.style.display = 'none';
  if (appDialogResolver) {
    const resolve = appDialogResolver;
    appDialogResolver = null;
    resolve(result);
  }
}

function resetAppDialog() {
  if (!appDialogResolver) return;
  const resolve = appDialogResolver;
  appDialogResolver = null;
  appDialog.style.display = 'none';
  resolve(false);
}

function showAppDialog({ title, message, confirmText = 'OK', cancelText = 'Batal', type = 'info', showCancel = false }) {
  if (appDialogResolver) resetAppDialog();
  appDialogTitle.textContent = title;
  appDialogMessage.textContent = message;
  appDialogConfirm.textContent = confirmText;
  appDialogCancel.textContent = cancelText;
  appDialogCancel.style.display = showCancel ? 'inline-flex' : 'none';
  appDialogIcon.className = `app-dialog-icon ${type === 'danger' ? 'danger' : type === 'warning' ? 'warning' : ''}`;
  appDialogIcon.innerHTML = type === 'danger'
    ? '<i class="fa-solid fa-trash-can"></i>'
    : type === 'warning'
      ? '<i class="fa-solid fa-triangle-exclamation"></i>'
      : '<i class="fa-solid fa-circle-info"></i>';
  appDialog.style.display = 'flex';
  requestAnimationFrame(() => (showCancel ? appDialogCancel : appDialogConfirm).focus());

  return new Promise(resolve => {
    appDialogResolver = resolve;
  });
}

function showAppAlert(message, title = 'Makluman', type = 'info') {
  return showAppDialog({ title, message, type });
}

function showAppConfirm(message, title = 'Sahkan tindakan', type = 'warning') {
  return showAppDialog({ title, message, type, confirmText: 'Teruskan', showCancel: true });
}

appDialogConfirm.addEventListener('click', () => closeAppDialog(true));
appDialogCancel.addEventListener('click', () => closeAppDialog(false));
appDialog.addEventListener('click', event => {
  if (event.target === appDialog) closeAppDialog(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && appDialog.style.display !== 'none') closeAppDialog(false);
});

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
      <div class="song-card ${isCurrent ? 'playing' : ''}" data-song-id="${escapeHtml(song.id)}">
        <div class="song-select-cell" aria-hidden="true"></div>
        <div class="song-num">${index + 1}</div>
        <img class="song-cover" src="${coverUrl}" data-fallback-cover alt="Cover">
        <div class="song-details">
          <div class="song-title">${escapeHtml(song.title)}</div>
          <div class="song-artist">${escapeHtml(song.artist)}</div>
        </div>
        <div class="song-album">${escapeHtml(song.album || '—')}</div>
        <div class="song-duration">${formatTime(song.duration)}</div>
        <button class="icon-btn-ghost" data-action="remove-playlist-song" data-song-id="${escapeHtml(song.id)}" title="Buang dari Playlist">
          <i class="fa-solid fa-minus"></i>
        </button>
        <span class="song-action-spacer" aria-hidden="true"></span>
        <span class="song-action-spacer" aria-hidden="true"></span>
        <span class="song-action-spacer" aria-hidden="true"></span>
      </div>
    `;
  }).join('');
}

// Create playlist modal
const createPlaylistModal = document.getElementById('create-playlist-modal');
const createPlaylistForm = document.getElementById('create-playlist-form');
const playlistNameInput = document.getElementById('playlist-name-input');

function closeCreatePlaylistModal() {
  createPlaylistModal.style.display = 'none';
  createPlaylistForm.reset();
}

document.getElementById('create-playlist-btn').addEventListener('click', () => {
  createPlaylistModal.style.display = 'flex';
  requestAnimationFrame(() => playlistNameInput.focus());
});

document.getElementById('close-create-playlist-modal').addEventListener('click', closeCreatePlaylistModal);
document.getElementById('cancel-create-playlist').addEventListener('click', closeCreatePlaylistModal);
createPlaylistModal.addEventListener('click', event => {
  if (event.target === createPlaylistModal) closeCreatePlaylistModal();
});

createPlaylistForm.addEventListener('submit', async event => {
  event.preventDefault();
  const name = playlistNameInput.value.trim();
  if (!name) return;

  const submitButton = createPlaylistForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    await apiFetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    closeCreatePlaylistModal();
    await fetchPlaylists();
  } catch (error) {
    console.error('Playlist creation failed:', error);
    await showAppAlert('Gagal mencipta playlist.', 'Playlist gagal dicipta', 'danger');
  } finally {
    submitButton.disabled = false;
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
      <div class="bulk-song-item" data-action="add-playlist-item" data-playlist-id="${escapeHtml(pl.id)}" style="justify-content: space-between;">
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
    await apiFetch(`/api/playlists/${playlistId}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId: currentSongToAdd })
    });
    document.getElementById('add-to-playlist-modal').style.display = 'none';
    currentSongToAdd = null;
    fetchPlaylists();
    await showAppAlert('Lagu ditambah ke playlist!', 'Playlist dikemas kini');
  } catch (e) {
    console.error(e);
  }
};

window.removeSongFromPlaylist = async function(songId) {
  if (!state.currentPlaylistId) return;
  if (!await showAppConfirm('Buang lagu ini dari playlist?', 'Buang lagu?', 'warning')) return;
  try {
    await apiFetch(`/api/playlists/${state.currentPlaylistId}/songs/${songId}`, {
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
  if (!await showAppConfirm(`Adakah anda pasti untuk memadam "${name}" secara KEKAL daripada simpanan laptop?`, 'Padam lagu secara kekal?', 'danger')) return;
  try {
    const data = await apiFetch(`/api/songs/${encodeURIComponent(songId)}`, { method: 'DELETE' });
    await fetchSongs();
    await fetchPlaylists();
    await showAppAlert(data.message || 'Lagu berjaya dipadam!', 'Lagu dipadam');
  } catch (e) {
    console.error(e);
    await showAppAlert('Ralat semasa memadam lagu.', 'Padam gagal', 'danger');
  }
};

document.getElementById('delete-playlist-btn').addEventListener('click', async () => {
  if (!state.currentPlaylistId) return;
  if (!await showAppConfirm('Padam playlist ini sepenuhnya?', 'Padam playlist?', 'danger')) return;
  try {
    await apiFetch(`/api/playlists/${state.currentPlaylistId}`, {
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
           data-action="bulk-song" data-song-id="${escapeHtml(song.id)}">
        <img class="bulk-song-cover" src="${coverUrl}" data-fallback-cover alt="Cover">
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
    await showAppAlert('Sila pilih sekurang-kurangnya satu lagu.', 'Tiada lagu dipilih', 'warning');
    return;
  }
  
  try {
    await apiFetch(`/api/playlists/${state.currentPlaylistId}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songIds: Array.from(bulkSelectedSongs) })
    });
    
    document.getElementById('bulk-add-modal').style.display = 'none';
    bulkSelectedSongs.clear();
    await fetchPlaylists();
    setTimeout(() => openPlaylist(state.currentPlaylistId), 100);
    await showAppAlert('Lagu-lagu berjaya ditambah ke playlist!', 'Playlist dikemas kini');
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

