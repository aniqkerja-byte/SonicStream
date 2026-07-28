# 🎵 SonicStream - Laptop-to-Phone Music Streaming Platform

**SonicStream** turns your laptop into a self-hosted **media server**, allowing you to stream and control your music library from any phone or browser.

---

## 🌟 Key Features
- **Self-Hosted Laptop Server**: Store MP3, M4A, FLAC, WAV, and OGG files on your laptop with no monthly fees.
- **Cloudflare Tunnel Access**: Secure HTTPS access from anywhere without a public IP or port forwarding.
- **Auto-Sync Folder**: Add or copy songs to the laptop's `music/` folder and the web library updates automatically.
- **Premium Responsive UI**: A modern Spotify/Apple Music-inspired dark interface with touch support and a full-screen player drawer.
- **Phone Lock Screen Controls (MediaSession API)**: Control playback from your phone lock screen or Bluetooth car/headphone audio.
- **Web Audio Visualizer**: See a dynamic audio visualizer while music is playing.

---

## 🚀 Running the Server

### Step 1: Start the Main Server
Open PowerShell in the project folder and run:
```powershell
cd "C:\Users\<username>\SonicStream"
$env:API_KEY="replace-with-a-long-random-secret"
$env:ALLOWED_ORIGINS="http://localhost:3000,https://music.jomtek.my"
npm start
```
> The server will be available at `http://localhost:3000`.

### Environment Variables
- `PORT` - Port HTTP server, default `3000`.
- `MUSIC_DIR` - Music library folder, default `./music`.
- `API_KEY` - Required for uploads, deletes, sync, favorites, and playlists. Never commit this key.
- `ALLOWED_ORIGINS` - Comma-separated allowed origins. Defaults to localhost and `https://music.jomtek.my`.
- `MAX_UPLOAD_SIZE` - File size limit in bytes, default 1 GB.
- `NODE_ENV=production` - Enables HSTS when the server is behind HTTPS.

The frontend asks for the API key when the first mutation is made and stores it in browser `localStorage`. For additional security, use Cloudflare Access or a private tunnel.

---

## 📱 Connect Your Phone (Cloudflare Tunnel)

### Method 1: Access Anywhere (Outside Home / 4G/5G)
Use the **Cloudflare Tunnel** configured on the laptop:

1. Open a new terminal tab on the laptop and run:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
2. Cloudflare will generate a free HTTPS URL like this:
   ```text
   +-----------------------------------------------------------------------------------+
   | Your quick Tunnel has been created! Visit it at:                                  |
   | https://random-subdomain.trycloudflare.com                                       |
   +-----------------------------------------------------------------------------------+
   ```
3. Open the `https://xxxx.trycloudflare.com` URL in Chrome or Safari on your phone.

---

### Method 2: Local Access (Same Wi-Fi)
If the laptop and phone are connected to the same Wi-Fi network:
1. Open a browser on your phone and enter the laptop IP address:
   ```text
   http://192.168.0.21:3000
   ```
2. You can also use the **Connect Phone** button on the laptop web app to scan a QR code with your phone camera.

---

## 📁 Adding Songs to the Server

### Method A: Copy Directly to the Laptop
Copy MP3, WAV, FLAC, or M4A files directly into this folder:
```text
./music
```
> The server will **auto-detect** new songs without a restart.

### Method B: Upload from the Web UI
1. Open SonicStream on the laptop or phone.
2. Open the **Upload Songs** menu.
3. Drag and drop or choose audio files from your phone or laptop.

---

## 🛠️ Project Structure
- `server.js` - Express backend for audio streaming, range requests, metadata scanning, and uploads.
- `public/` - Web player interface (HTML5, vanilla CSS glassmorphism, Web Audio API, MediaSession).
- `music/` - Main folder for your music library.
- `generate-sample-music.js` - Local sample music generator.

## 🧪 Code Checks

```powershell
npm test
npm run lint
npm run check
npm audit
```

The database is written atomically to `data/db.json`, with the latest backup stored as `data/db.json.bak`. Database, music, and credential files are not stored in git.

## 🔒 Production Notes

- Do not run the public server without `API_KEY`.
- Do not expose the Node port directly to the internet; use Cloudflare Tunnel or an HTTPS reverse proxy.
- Keep Cloudflare credential files outside the repository.
- Back up the `music/` folder and `data/db.json` regularly.
