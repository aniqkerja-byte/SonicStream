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
```bash
cd /home/lenovo/.gemini/antigravity/scratch/music-stream-app
npm start
```
> Server akan berjalan di pautan tempatan: `http://localhost:3000`

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
/home/lenovo/.gemini/antigravity/scratch/music-stream-app/music
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
