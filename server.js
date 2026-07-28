const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const musicMetadata = require('music-metadata');
const chokidar = require('chokidar');
const os = require('os');
const crypto = require('crypto');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { fileTypeFromFile } = require('file-type');

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = process.env.APP_VERSION || '1.0.0';
const API_KEY = process.env.API_KEY || '';
const MAX_UPLOAD_SIZE = Number(process.env.MAX_UPLOAD_SIZE || 1024 * 1024 * 1024);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || [
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  'https://music.jomtek.my'
].join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// Directories
const MUSIC_DIR = process.env.MUSIC_DIR || path.join(__dirname, 'music');
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DB_BACKUP_FILE = `${DB_FILE}.bak`;

if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Middleware
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://static.cloudflareinsights.com', 'https://static.cloudflareinsights.com/beacon.min.js'],
      scriptSrcElem: ["'self'", 'https://static.cloudflareinsights.com', 'https://static.cloudflareinsights.com/beacon.min.js'],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'"],
      connectSrc: ["'self'", 'https://cloudflareinsights.com', 'https://*.cloudflareinsights.com', 'https://static.cloudflareinsights.com'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  strictTransportSecurity: process.env.NODE_ENV === 'production' ? undefined : false
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed'));
  },
  credentials: false
}));
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

const writeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } }
});
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'UPLOAD_RATE_LIMITED', message: 'Too many uploads. Try again later.' } }
});
const readRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'READ_RATE_LIMITED', message: 'Too many requests.' } }
});

function authRequired(req, res, next) {
  if (!API_KEY) {
    return res.status(503).json({ error: { code: 'AUTH_NOT_CONFIGURED', message: 'API_KEY is not configured on the server.' } });
  }
  const suppliedKey = req.get('x-api-key') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const valid = suppliedKey && suppliedKey.length === API_KEY.length && crypto.timingSafeEqual(Buffer.from(suppliedKey), Buffer.from(API_KEY));
  if (!valid) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' } });
  return next();
}

function requestError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

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
  limits: { fileSize: MAX_UPLOAD_SIZE, files: 20 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(mp3|m4a|flac|wav|aac|ogg|wma|opus)$/i;
    if (file.originalname.match(allowedTypes)) {
      return cb(null, true);
    }
    cb(requestError(400, 'INVALID_EXTENSION', 'Unsupported audio file format.'));
  }
});

// In-memory Database & Cache
let db = {
  songs: [],
  playlists: [
    { id: 'favs', name: 'Favorites ❤️', songs: [] },
   { id: 'chill', name: 'Chill Vibes ☕', songs: [] }
  ],
  favorites: []
};

let dbSaveQueue = Promise.resolve();
let scanPromise = null;
const metadataCache = new Map();

// Load database if exists
if (fs.existsSync(DB_FILE)) {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const loaded = JSON.parse(raw);
    db.playlists = loaded.playlists || db.playlists;
    db.favorites = loaded.favorites || [];
  } catch (err) {
    console.error('Error reading db.json:', err);
    if (fs.existsSync(DB_BACKUP_FILE)) {
      try {
        const backup = JSON.parse(fs.readFileSync(DB_BACKUP_FILE, 'utf8'));
        db.playlists = backup.playlists || db.playlists;
        db.favorites = backup.favorites || [];
        console.warn('Recovered database from backup.');
      } catch (backupError) {
        console.error('Error reading database backup:', backupError);
      }
    }
  }
}

function saveDb() {
  const payload = JSON.stringify({ playlists: db.playlists, favorites: db.favorites }, null, 2);
  dbSaveQueue = dbSaveQueue.then(async () => {
    const tempFile = `${DB_FILE}.${process.pid}.tmp`;
    await fs.promises.writeFile(tempFile, payload, 'utf8');
    if (fs.existsSync(DB_FILE)) await fs.promises.copyFile(DB_FILE, DB_BACKUP_FILE);
    await fs.promises.rename(tempFile, DB_FILE);
  }).catch(err => console.error('Error saving db.json:', err));
  return dbSaveQueue;
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

// Scan music folder
async function scanMusicFiles() {
  if (scanPromise) return scanPromise;
  scanPromise = scanMusicFilesInternal();
  try {
    return await scanPromise;
  } finally {
    scanPromise = null;
  }
}

async function scanMusicFilesInternal() {
  console.log('🔄 Scanning music directory:', MUSIC_DIR);
  try {
    const files = fs.readdirSync(MUSIC_DIR);
    const audioFiles = files.filter(f => f.match(/\.(mp3|m4a|flac|wav|aac|ogg|wma|opus)$/i));

    const songList = [];

    for (const file of audioFiles) {
      const filePath = path.join(MUSIC_DIR, file);
      const fileId = getFileId(file);
      const stat = fs.statSync(filePath);

      const cacheKey = `${stat.size}:${stat.mtimeMs}`;
      const cached = metadataCache.get(file);
      if (cached && cached.cacheKey === cacheKey) {
        songList.push({ ...cached.song, filename: file, id: fileId, size: stat.size, addedAt: stat.birthtime || stat.mtime });
        continue;
      }

      let title = path.parse(file).name.replace(/_/g, ' ');
      let artist = 'Unknown Artist';
      let album = 'Unknown Album';
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
      } catch (_error) {
        // use fallback file stats
      }

      const song = {
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
      };
      metadataCache.set(file, { cacheKey, song });
      songList.push(song);
    }

    db.songs = songList;
    const validIds = new Set(songList.map(song => song.id));
    const previousFavorites = db.favorites.length;
    const previousPlaylistCount = db.playlists.reduce((count, playlist) => count + playlist.songs.length, 0);
    db.favorites = db.favorites.filter(id => validIds.has(id));
    db.playlists.forEach(playlist => {
      playlist.songs = playlist.songs.filter(id => validIds.has(id));
    });
    const currentPlaylistCount = db.playlists.reduce((count, playlist) => count + playlist.songs.length, 0);
    if (previousFavorites !== db.favorites.length || previousPlaylistCount !== currentPlaylistCount) saveDb();
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
    status: 'ok',
    version: VERSION,
    totalSongs: db.songs.length,
  });
});

// Force Sync / Clear Cache
app.post('/api/sync', authRequired, writeRateLimit, async (req, res, next) => {
  try {
  await scanMusicFiles();
  res.json({ message: 'Server cache cleared and synced successfully!' });
  } catch (error) { next(error); }
});

// Get all songs
app.get('/api/songs', readRateLimit, (req, res) => {
  const songsWithFav = db.songs.map(song => ({
    ...song,
    isFavorite: db.favorites.includes(song.id)
  }));
  res.json(songsWithFav);
});

// Get song metadata cover image
app.get('/api/cover/:id', readRateLimit, async (req, res, _next) => {
  const song = db.songs.find(s => s.id === req.params.id);
  if (!song) return res.status(404).send('Song not found');

  const filePath = path.join(MUSIC_DIR, song.filename);
  try {
    const metadata = await musicMetadata.parseFile(filePath);
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0];
      const imageBuffer = Buffer.isBuffer(pic.data) ? pic.data : Buffer.from(pic.data);
      res.type(pic.format || 'application/octet-stream');
      res.set('Content-Length', imageBuffer.length);
      return res.end(imageBuffer);
    }
  } catch (_error) {
    // fallback below
  }

  // Fallback to default cover generator SVG
  res.sendFile(path.join(PUBLIC_DIR, 'default-cover.svg'));
});

// Stream audio file with HTTP Range support
app.get('/api/stream/:id', readRateLimit, (req, res, next) => {
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
  if (req.headers['if-none-match'] === etag) return res.status(304).end();

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
    const isSuffixRange = !match[1] && match[2];
    let start = isSuffixRange ? Math.max(fileSize - Number(match[2]), 0) : Number(match[1]);
    let requestedEnd = isSuffixRange || !match[2] ? fileSize - 1 : Number(match[2]);
    if (!Number.isInteger(start) || !Number.isInteger(requestedEnd) || start < 0 || requestedEnd < 0 || start > requestedEnd || start >= fileSize) {
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
app.post('/api/upload', authRequired, uploadRateLimit, upload.array('songs', 20), async (req, res, next) => {
  try {
    for (const file of req.files || []) {
      const detected = await fileTypeFromFile(file.path);
      const allowedMime = /^audio\/(mpeg|mp4|x-m4a|flac|wav|aac|ogg|webm|opus|x-ms-wma)$/i;
      if (!detected || !allowedMime.test(detected.mime)) {
        await Promise.all((req.files || []).map(uploaded => fs.promises.unlink(uploaded.path).catch(() => {})));
        return res.status(400).json({ error: { code: 'INVALID_AUDIO', message: 'The file is not a supported audio format.' } });
      }
    }
  scheduleMusicScan();
  res.status(202).json({
    message: 'Songs accepted. The library is being updated...',
    uploaded: req.files ? req.files.length : 0
  });
  } catch (error) { next(error); }
});

// Toggle Favorite
app.post('/api/favorites/toggle', authRequired, writeRateLimit, (req, res) => {
  const { songId } = req.body;
  if (!songId) return res.status(400).json({ error: 'songId required' });
  if (!db.songs.some(song => song.id === songId)) return res.status(404).json({ error: 'Song not found' });

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
app.get('/api/playlists', readRateLimit, (req, res) => {
  res.json(db.playlists);
});

app.post('/api/playlists', authRequired, writeRateLimit, (req, res) => {
  const { name } = req.body;
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (!normalizedName || normalizedName.length > 80) return res.status(400).json({ error: 'Playlist name is required and must be 1-80 characters' });
  if (db.playlists.some(playlist => playlist.name.toLowerCase() === normalizedName.toLowerCase())) return res.status(409).json({ error: 'Playlist name already exists' });

  const newPlaylist = {
    id: 'pl_' + Date.now(),
    name: normalizedName,
    songs: []
  };

  db.playlists.push(newPlaylist);
  saveDb();
  res.json(newPlaylist);
});

app.post('/api/playlists/:id/songs', authRequired, writeRateLimit, (req, res) => {
  const { id } = req.params;
  const { songId, songIds } = req.body;
  const pl = db.playlists.find(p => p.id === id);
  if (!pl) return res.status(404).json({ error: 'Playlist not found' });
  const ids = Array.isArray(songIds) ? songIds : songId ? [songId] : [];
  if (!ids.every(id => typeof id === 'string' && db.songs.some(song => song.id === id))) return res.status(404).json({ error: 'One or more songs not found' });

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

app.delete('/api/playlists/:id/songs/:songId', authRequired, writeRateLimit, (req, res) => {
  const { id, songId } = req.params;
  const pl = db.playlists.find(p => p.id === id);
  if (!pl) return res.status(404).json({ error: 'Playlist not found' });

  pl.songs = pl.songs.filter(s => s !== songId);
  saveDb();
  res.json(pl);
});

// Bulk remove songs from playlist
app.delete('/api/playlists/:id/songs', authRequired, writeRateLimit, (req, res) => {
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

app.delete('/api/playlists/:id', authRequired, writeRateLimit, (req, res) => {
  const { id } = req.params;
  const idx = db.playlists.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Playlist not found' });

  db.playlists.splice(idx, 1);
  saveDb();
  res.json({ message: 'Playlist deleted' });
});

app.delete('/api/songs/:id', authRequired, writeRateLimit, async (req, res, _next) => {
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
  res.json({ message: 'Song deleted successfully', songId: song.id });
});

// Bulk delete songs from disk library
app.post('/api/songs/bulk-delete', authRequired, writeRateLimit, async (req, res, _next) => {
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
    message: `Successfully deleted ${deletedIds.length} song(s)`,
    count: deletedIds.length,
    failedIds
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the upload size limit.' : 'Invalid upload.';
    return res.status(400).json({ error: { code: err.code, message } });
  }
  if (err.status && err.code) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  if (err.message === 'Origin is not allowed') return res.status(403).json({ error: { code: 'CORS_FORBIDDEN', message: err.message } });
  console.error('Unhandled request error:', err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
});

// Start Server
const server = app.listen(PORT, '0.0.0.0', () => {
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

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down gracefully...`);
  await new Promise(resolve => server.close(resolve));
  await watcher.close();
  if (scanPromise) await scanPromise.catch(() => {});
  await dbSaveQueue;
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
