# 🎵 SonicStream - Platform Penstriman Muzik Laptop Ke Telefon

Tahniah! Platform penstriman muzik **SonicStream** telah siap dibina khas untuk laptop anda. Laptop anda kini berfungsi sebagai **Media Server**, dan anda boleh mendengar serta mengawal semua lagu simpanan laptop terus dari telefon pintar di mana-mana sahaja.

---

## 🌟 Ciri-Ciri Utama Platform
- **Self-Hosted Laptop Server**: Menyimpan semua lagu (MP3, M4A, FLAC, WAV, OGG) dalam laptop anda tanpa sebarang yuran bulanan.
- **Cloudflare Tunnel Access**: Capaian telefon dari mana-mana sahaja secara percuma & selamat (HTTPS) tanpa perlukan Public IP atau Port Forwarding.
- **Auto-Sync Folder**: Tambah/salin lagu terus ke folder `music/` di laptop, dan senarai lagu di web/phone akan dikemas kini secara automatik.
- **UI Kualiti Premium & Responsive**: Antaramuka moden ala-Spotify/Apple Music dengan mod gelap, sokongan skrin sentuh telefon, dan paparan laci *full-screen player*.
- **Kawalan Lockscreen Telefon (MediaSession API)**: Boleh `Play`, `Pause`, `Next`, `Previous` terus dari *Lockscreen* telefon atau *Bluetooth audio* kereta/headphone.
- **Web Audio Visualizer**: Graf audio dinamik semasa lagu dimainkan.

---

## 🚀 Cara Menjalankan Server di Laptop

### Step 1: Jalankan Server Utama
Buka Terminal di laptop dan jalankan:
```powershell
cd "C:\Users\<nama-user>\SonicStream"
$env:API_KEY="gantikan-dengan-kunci-rahsia-panjang"
$env:ALLOWED_ORIGINS="http://localhost:3000,https://music.jomtek.my"
npm start
```
> Server akan berjalan di pautan tempatan: `http://localhost:3000`

### Environment Variables
- `PORT` - Port HTTP server, default `3000`.
- `MUSIC_DIR` - Folder library muzik, default `./music`.
- `API_KEY` - Wajib untuk upload, delete, sync, favorite, dan playlist. Jangan commit key ini.
- `ALLOWED_ORIGINS` - Senarai origin dipisahkan koma. Default membenarkan localhost dan `https://music.jomtek.my`.
- `MAX_UPLOAD_SIZE` - Had saiz fail dalam bytes, default 1 GB.
- `NODE_ENV=production` - Aktifkan HSTS ketika server berada di belakang HTTPS.

Frontend akan meminta API key apabila mutation pertama dibuat dan menyimpannya dalam `localStorage` browser. Untuk keselamatan tambahan, gunakan Cloudflare Access atau private tunnel.

---

## 📱 Cara Sambungkan Telefon Anda (Cloudflare Free Tunnel)

### Cara 1: Akses Dari Mana-Mana Sahaja (Luar Rumah / Internet 4G/5G)
Gunakan **Cloudflare Tunnel** yang telah dipasang pada laptop anda:

1. Buka satu tab Terminal baharu di laptop dan jalankan:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
2. Cloudflare akan menjana URL percuma dengan HTTPS seperti berikut:
   ```text
   +-----------------------------------------------------------------------------------+
   | Your quick Tunnel has been created! Visit it at:                                  |
   | https://random-subdomain.trycloudflare.com                                       |
   +-----------------------------------------------------------------------------------+
   ```
3. Buka pautan `https://xxxx.trycloudflare.com` tersebut di pelayar (Chrome/Safari) telefon anda!

---

### Cara 2: Akses Dalam Rumah (Wi-Fi Yang Sama)
Jika laptop & telefon anda bersambung pada Wi-Fi rumah yang sama:
1. Buka pelayar telefon dan taipkan alamat IP Laptop anda:
   ```text
   http://192.168.0.21:3000
   ```
2. Anda juga boleh tekan butang **"Sambung Phone"** pada web laptop untuk mengimbas **QR Code** terus menggunakan kamera telefon!

---

## 📁 Cara Memasukkan Lagu Ke Laptop Server

### Kaedah A: Copy-Paste Terus Dalam Laptop (Paling Laju)
Salin fail lagu (MP3, WAV, FLAC, M4A) terus ke dalam folder ini di laptop anda:
```text
./music
```
> Server akan **auto-detect** lagu baharu tanpa perlu *restart* server!

### Kaedah B: Muat Naik Dari Web UI (Laptop atau Phone)
1. Buka web SonicStream di laptop atau phone.
2. Klik pada menu **"Muat Naik Lagu"**.
3. Drag & drop atau pilih fail audio dari telefon/laptop anda.

---

## 🛠️ Struktur Projek
- `server.js` - Server Express backend untuk audio streaming, range requests, metadata scanner, dan upload.
- `public/` - Antaramuka web player (HTML5, Vanilla CSS Glassmorphism, Web Audio API, MediaSession).
- `music/` - Folder simpanan utama semua fail lagu anda.
- `generate-sample-music.js` - Skrip penjana lagu contoh tempatan.

## 🧪 Semakan Kod

```powershell
npm test
npm run lint
npm run check
npm audit
```

Database ditulis secara atomic ke `data/db.json` dan backup terakhir disimpan sebagai `data/db.json.bak`. Fail database, muzik, dan credential tidak disimpan dalam git.

## 🔒 Nota Production

- Jangan jalankan server public tanpa `API_KEY`.
- Jangan dedahkan port Node terus ke internet; gunakan Cloudflare Tunnel atau reverse proxy HTTPS.
- Pastikan fail credentials Cloudflare disimpan di luar repository.
- Backup folder `music/` dan `data/db.json` secara berkala.
