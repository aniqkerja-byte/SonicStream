const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const musicMetadata = require('music-metadata');
const chokidar = require('chokidar');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const MUSIC_DIR = process.env.MUSIC_DIR || path.join(__dirname, 'music');
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MUSIC_DIR);
  },
  filename: (req, file, cb) => {
    // preserve original name or sanitize
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}_${sanitized}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(mp3|m4a|flac|wav|aac|ogg|wma|opus)$/i;
    if (file.originalname.match(allowedTypes)) {
      return cb(null, true);
    }
    cb(new Error('Format fail audio disokong! Sila muat naik fail audio (MP3, M4A, FLAC, WAV, OGG, etc.)'));
  }
});

// In-memory Database & Cache
let db = {
  songs: [],
  playlists: [
    { id: 'favs', name: 'Lagu Kegemaran ❤️', songs: [] },
    { id: 'chill', name: 'Chill Vibes ☕', songs: [] }
  ],
  favorites: []
};

// Load database if exists
if (fs.existsSync(DB_FILE)) {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const loaded = JSON.parse(raw);
    db.playlists = loaded.playlists || db.playlists;
    db.favorites = loaded.favorites || [];
  } catch (err) {
    console.error('Error reading db.json:', err);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify({
      playlists: db.playlists,
      favorites: db.favorites
    }, null, 2));
  } catch (err) {
    console.error('Error saving db.json:', err);
  }
}

// Generate simple hash ID for files
function getFileId(filename) {
  let hash = 0;
  for (let i = 0; i < filename.length; i++) {
    hash = ((hash << 5) - hash) + filename.charCodeAt(i);
    hash |= 0;
  }
  return 's_' + Math.abs(hash).toString(36) + '_' + Buffer.from(filename).toString('hex').slice(0, 8);
}

// Scan Music Folder
async function scanMusicFiles() {
  console.log('🔄 Scanning music directory:', MUSIC_DIR);
  try {
    const files = fs.readdirSync(MUSIC_DIR);
    const audioFiles = files.filter(f => f.match(/\.(mp3|m4a|flac|wav|aac|ogg|wma|opus)$/i));

    const songList = [];

    for (const file of audioFiles) {
      const filePath = path.join(MUSIC_DIR, file);
      const fileId = getFileId(file);
      const stat = fs.statSync(filePath);

      let title = path.parse(file).name.replace(/_/g, ' ');
      let artist = 'Artis Tidak Diketahui';
      let album = 'Album Tidak Diketahui';
      let duration = 0;
      let year = null;
      let genre = null;
      let hasPicture = false;

      try {
        const metadata = await musicMetadata.parseFile(filePath, { duration: true });
        if (metadata.common.title) title = metadata.common.title;
        if (metadata.common.artist) artist = metadata.common.artist;
        if (metadata.common.album) album = metadata.common.album;
        if (metadata.common.year) year = metadata.common.year;
        if (metadata.common.genre && metadata.common.genre.length > 0) genre = metadata.common.genre[0];
        if (metadata.format.duration) duration = metadata.format.duration;
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          hasPicture = true;
        }
      } catch (e) {
        // use fallback file stats
      }

      songList.push({
        id: fileId,
        filename: file,
        title,
        artist,
        album,
        duration: Math.round(duration),
        year,
        genre,
        size: stat.size,
        addedAt: stat.birthtime || stat.mtime,
        hasPicture
      });
    }

    db.songs = songList;
    console.log(`✅ Scan completed! Found ${db.songs.length} song(s).`);
  } catch (err) {
    console.error('❌ Error scanning music directory:', err);
  }
}

// Watch directory for changes, but scan once after a batch of file events.
let scanTimer = null;
function scheduleMusicScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => {
    scanMusicFiles().catch(error => console.error('Scheduled music scan failed:', error));
  }, 400);
}

const watcher = chokidar.watch(MUSIC_DIR, { ignoreInitial: true });
watcher.on('add', scheduleMusicScan);
watcher.on('unlink', scheduleMusicScan);
watcher.on('change', scheduleMusicScan);

// Initial scan
scanMusicFiles();

// Helper to get local IP addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// API ROUTES

// Get system status & connection info
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    port: PORT,
    localIps: getLocalIPs(),
    totalSongs: db.songs.length,
    musicDir: MUSIC_DIR,
    hostname: os.hostname(),
    platform: os.platform()
  });
});

// Force Sync / Clear Cache
app.post('/api/sync', async (req, res) => {
  await scanMusicFiles();
  res.json({ message: 'Server cache cleared and synced successfully!' });
});

// Get all songs
app.get('/api/songs', (req, res) => {
  const songsWithFav = db.songs.map(song => ({
    ...song,
    isFavorite: db.favorites.includes(song.id)
  }));
  res.json(songsWithFav);
});

// Get song metadata cover image
app.get('/api/cover/:id', async (req, res) => {
  const song = db.songs.find(s => s.id === req.params.id);
  if (!song) return res.status(404).send('Song not found');

  const filePath = path.join(MUSIC_DIR, song.filename);
  try {
    const metadata = await musicMetadata.parseFile(filePath);
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0];
      res.set('Content-Type', pic.format);
      return res.send(pic.data);
    }
  } catch (e) {
    // fallback below
  }

  // Fallback to default cover generator SVG
  res.sendFile(path.join(PUBLIC_DIR, 'default-cover.svg'));
});

// Stream audio file with HTTP Range support
app.get('/api/stream/:id', (req, res) => {
  const song = db.songs.find(s => s.id === req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found' });

  const filePath = path.join(MUSIC_DIR, song.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Audio file missing from server' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const lastModified = stat.mtime.toUTCString();
  const etag = `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`;

  const ext = path.extname(song.filename).toLowerCase();
  let contentType = 'audio/mpeg';
  if (ext === '.m4a' || ext === '.aac') contentType = 'audio/mp4';
  if (ext === '.flac') contentType = 'audio/flac';
  if (ext === '.wav') contentType = 'audio/wav';
  if (ext === '.ogg') contentType = 'audio/ogg';

  res.set({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'CDN-Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Encoding': 'identity',
    'Last-Modified': lastModified,
    ETag: etag,
    'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag, Last-Modified',
    'X-Content-Type-Options': 'nosniff'
  });

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const requestedEnd = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (Number.isNaN(start) || start >= fileSize) {
      return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
    }
    const end = Math.min(requestedEnd, fileSize - 1);
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end, highWaterMark: 1024 * 1024 });

    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 }).pipe(res);
  }
});

// Upload song
app.post('/api/upload', upload.array('songs', 20), async (req, res) => {
  scheduleMusicScan();
  res.status(202).json({
    message: 'Lagu berjaya diterima. Senarai lagu sedang dikemas kini...',
    uploaded: req.files ? req.files.length : 0
  });
});

// Toggle Favorite
app.post('/api/favorites/toggle', (req, res) => {
  const { songId } = req.body;
  if (!songId) return res.status(400).json({ error: 'songId required' });

  const idx = db.favorites.indexOf(songId);
  let isFavorite = false;
  if (idx >= 0) {
    db.favorites.splice(idx, 1);
  } else {
    db.favorites.push(songId);
    isFavorite = true;
  }
  saveDb();
  res.json({ songId, isFavorite, favorites: db.favorites });
});

// Playlists endpoints
app.get('/api/playlists', (req, res) => {
  res.json(db.playlists);
});

app.post('/api/playlists', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Playlist name is required' });

  const newPlaylist = {
    id: 'pl_' + Date.now(),
    name,
    songs: []
  };

  db.playlists.push(newPlaylist);
  saveDb();
  res.json(newPlaylist);
});

app.post('/api/playlists/:id/songs', (req, res) => {
  const { id } = req.params;
  const { songId, songIds } = req.body;
  const pl = db.playlists.find(p => p.id === id);
  if (!pl) return res.status(404).json({ error: 'Playlist not found' });

  let modified = false;

  // Handle bulk array
  if (Array.isArray(songIds)) {
    for (const sId of songIds) {
      if (!pl.songs.includes(sId)) {
        pl.songs.push(sId);
        modified = true;
      }
    }
  } 
  // Handle single
  else if (songId) {
    if (!pl.songs.includes(songId)) {
      pl.songs.push(songId);
      modified = true;
    }
  }

  if (modified) saveDb();
  res.json(pl);
});

app.delete('/api/playlists/:id/songs/:songId', (req, res) => {
  const { id, songId } = req.params;
  const pl = db.playlists.find(p => p.id === id);
  if (!pl) return res.status(404).json({ error: 'Playlist not found' });

  pl.songs = pl.songs.filter(s => s !== songId);
  saveDb();
  res.json(pl);
});

// Bulk remove songs from playlist
app.delete('/api/playlists/:id/songs', (req, res) => {
  const { id } = req.params;
  const { songIds } = req.body;
  const pl = db.playlists.find(p => p.id === id);
  if (!pl) return res.status(404).json({ error: 'Playlist not found' });

  if (Array.isArray(songIds) && songIds.length > 0) {
    const toRemove = new Set(songIds);
    pl.songs = pl.songs.filter(sId => !toRemove.has(sId));
    saveDb();
  }
  res.json(pl);
});

app.delete('/api/playlists/:id', (req, res) => {
  const { id } = req.params;
  const idx = db.playlists.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Playlist not found' });

  db.playlists.splice(idx, 1);
  saveDb();
  res.json({ message: 'Playlist deleted' });
});

app.delete('/api/songs/:id', async (req, res) => {
  const song = db.songs.find(s => s.id === req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found' });

  const filePath = path.resolve(MUSIC_DIR, song.filename);
  const musicDir = path.resolve(MUSIC_DIR);
  if (path.dirname(filePath) !== musicDir) {
    return res.status(400).json({ error: 'Invalid song file path' });
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Failed to delete file: ${filePath}`, error);
      return res.status(500).json({ error: 'Failed to delete song file' });
    }
  }

  db.playlists.forEach(playlist => {
    playlist.songs = playlist.songs.filter(songId => songId !== song.id);
  });
  db.favorites = db.favorites.filter(songId => songId !== song.id);
  saveDb();
  await scanMusicFiles();
  res.json({ message: 'Lagu berjaya dipadam', songId: song.id });
});

// Bulk delete songs from disk library
app.post('/api/songs/bulk-delete', async (req, res) => {
  const { songIds } = req.body;
  if (!Array.isArray(songIds) || songIds.length === 0) {
    return res.status(400).json({ error: 'No song IDs provided' });
  }

  const songs = [...new Map(songIds.map(id => [id, db.songs.find(s => s.id === id)])).values()]
    .filter(Boolean);
  const deletedIds = [];
  const failedIds = [];
  const musicDir = path.resolve(MUSIC_DIR);

  for (const song of songs) {
    const filePath = path.resolve(MUSIC_DIR, song.filename);
    if (path.dirname(filePath) !== musicDir) {
      failedIds.push(song.id);
      continue;
    }
    try {
      await fs.promises.unlink(filePath);
      deletedIds.push(song.id);
    } catch (error) {
      if (error.code === 'ENOENT') deletedIds.push(song.id);
      else {
        failedIds.push(song.id);
        console.error(`Failed to delete file: ${filePath}`, error);
      }
    }
  }

  const deletedSet = new Set(deletedIds);
  db.playlists.forEach(playlist => {
    playlist.songs = playlist.songs.filter(songId => !deletedSet.has(songId));
  });
  db.favorites = db.favorites.filter(songId => !deletedSet.has(songId));
  if (deletedIds.length > 0) saveDb();
  await scanMusicFiles();
  res.status(failedIds.length > 0 ? 207 : 200).json({
    message: `Berjaya memadam ${deletedIds.length} lagu`,
    count: deletedIds.length,
    failedIds
  });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🎵 ========================================================= 🎵
   SONIC STREAM SERVER IS RUNNING!
   ---------------------------------------------------------
   Local Laptop Access:  http://localhost:${PORT}
   Network LAN Access:   http://${getLocalIPs()[0] || 'localhost'}:${PORT}
   Music Folder:         ${MUSIC_DIR}
🎵 ========================================================= 🎵
  `);
});
