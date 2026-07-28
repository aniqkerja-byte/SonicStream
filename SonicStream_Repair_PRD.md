# PRD: SonicStream Repair Plan (Fasa 1–4)

**Sumber:** Audit Ringkas SonicStream
**Tujuan:** Repair security, reliability, dan stability isu sebelum SonicStream selamat dibiarkan live di domain awam (`music.jomtek.my` via Cloudflare tunnel).
**Format:** Dipecahkan kepada 4 fasa berasingan. Setiap fasa boleh handoff berasingan kepada AI coding agent — jangan campur fasa dalam satu session supaya scope terkawal dan mudah test.

---

## Fasa 1: Keselamatan (P0 — Wajib Dahulu)

**Kenapa dahulu:** Domain ni terbuka kat internet tanpa auth. Sesiapa boleh upload/delete/padam library sekarang juga.

### Task 1.1 — Authentication
- Tambah single-user auth (API key atau login+password ringkas)
- Simpan credential via environment variable (`API_KEY` atau `AUTH_PASSWORD`), jangan hardcode
- Lindungi semua route mutasi: `/api/upload`, `/api/songs/*`, `/api/playlists/*`, `/api/favorites/*`, `/api/sync`
- Route baca (list songs, stream) — tentukan sama ada perlu auth juga atau public read-only

### Task 1.2 — Restrict CORS
- Ganti `app.use(cors())` dengan whitelist domain sendiri + localhost
- Kalau frontend sentiasa dihidang dari server sama, pertimbangkan buang CORS terus

### Task 1.3 — Upload hardening
- Tambah `limits.fileSize` (cadangan 500MB–1GB per file)
- Hadkan jumlah request/upload dalam tempoh masa (boleh gabung dengan Task 1.6 rate limit)
- Validate actual file content (guna `file-type` check header, bukan extension sahaja)
- Padam file separa jika upload gagal
- Sanitize filename (elak clash / terlalu panjang)

### Task 1.4 — Hide internal server info
- `/api/status` jangan expose `musicDir`, `platform`, `hostname`, local IP
- Return minimal info sahaja (contoh: status "ok", version)

### Task 1.5 — Security headers
- Pasang `helmet` (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- Aktifkan HSTS jika deployment HTTPS

### Task 1.6 — Rate limiting
- Pasang `express-rate-limit`
- Rate limit lebih ketat untuk: upload, delete, sync, cover metadata, stream

**Acceptance Criteria Fasa 1:**
- [ ] Request tanpa auth ke route mutasi return 401/403
- [ ] CORS hanya benarkan origin yang disenaraikan
- [ ] Upload file >limit ditolak dengan error jelas
- [ ] Upload file bukan audio (renamed extension) ditolak
- [ ] `/api/status` tak expose path/IP/hostname
- [ ] Security headers hadir dalam response (check via curl -I)
- [ ] Rate limit trigger bila request berulang cepat

---

## Fasa 2: Backend Reliability (P1)

**Kenapa lepas Fasa 1:** Backend perlu stabil dan tak corrupt data sebelum tambah apa-apa feature baru.

### Task 2.1 — Atomic database write
- Tukar `fs.writeFileSync` kepada async write
- Tulis ke temp file dahulu, then rename ke `db.json` (atomic rename)
- Tambah basic recovery kalau JSON corrupt (fallback ke backup terakhir)
- Guna simple queue untuk elak concurrent write overwrite each other

### Task 2.2 — Global error handler
- Tambah Express error middleware di hujung stack
- Handle `MulterError` secara khusus
- Standard format error JSON (contoh `{ error: { code, message } }`)
- Jangan leak stack trace / internal path dalam response

### Task 2.3 — Validate songId & playlist input
- Validate `songId` wujud dalam `db.songs` sebelum simpan ke favorite/playlist
- Reject dengan 400/404 kalau tak wujud
- Cleanup orphan IDs semasa scan
- Playlist name: validate `typeof === 'string'`, trim, hadkan panjang di server, tetapkan polisi duplicate name

### Task 2.4 — Range request handling
- Handle suffix range (`bytes=-500`)
- Validate range songsang / end negatif → return `416`
- Tambah support `ETag` / `If-None-Match` → `304 Not Modified`
- Pertimbangkan guna middleware streaming yang lebih tested (contoh `send` atau `range-parser`)

### Task 2.5 — Scan lock & metadata cache
- Elak dua scan berjalan serentak (simple lock/flag)
- Cache metadata based on `size + mtime`, skip file yang tak berubah
- Hadkan concurrency parsing metadata (batch, bukan sequential penuh)
- Handle file yang sedang disalin (belum lengkap) — skip dulu sampai stable

### Task 2.6 — Graceful shutdown
- Simpan reference `app.listen()`
- Handle `SIGINT`/`SIGTERM`: tutup chokidar watcher, tunggu upload/scan aktif selesai, flush DB, then exit

**Acceptance Criteria Fasa 2:**
- [ ] Kill process time write tak corrupt `db.json`
- [ ] Upload invalid return JSON error konsisten (bukan HTML/stack trace)
- [ ] Playlist/favorite dengan songId palsu ditolak
- [ ] Range request `bytes=-500` berfungsi betul (test kat browser/curl)
- [ ] Scan dua kali serentak tak duplicate/conflict
- [ ] Ctrl+C shutdown server dengan bersih, tiada dangling process

---

## Fasa 3: Frontend Stability (P1)

**Kenapa lepas backend:** Frontend fix ni bergantung pada backend response yang dah predictable (error format dari Fasa 2).

### Task 3.1 — Fix active audio reference
- Buang direct mutation `elements.audio = preparedAudio`
- Tambah `getActiveAudio()` helper
- Semua fungsi playback (`togglePlayPause`, `updateProgress`, `handleSeek`, MediaSession, volume) rujuk `state.activeAudio` sahaja

### Task 3.2 — Central API error handling
- Buat helper `apiFetch()` yang check `res.ok` secara central
- Semua call (`fetchPlaylists`, `addSongToPlaylist`, `removeSongFromPlaylist`, delete playlist, dsb) guna helper ni
- Paparkan error sebenar kat user (toast/notification), handle offline & timeout

### Task 3.3 — Buang inline event handler
- Tukar `onclick="playSongIndex(${index})"` dan sejenis kepada event delegation
- Simpan ID dalam `data-song-id` attribute, bukan inject terus dalam string JS
- Escape attribute dengan utility yang betul

### Task 3.4 — Persist playback state
- Simpan volume, mute state (`lastVolume` berasingan dari `state.volume`), shuffle, repeat, tab aktif dalam `localStorage`
- Restore lagu terakhir + posisi bila reasonable
- Simpan queue playback

### Task 3.5 — Service worker update strategy
- Network-first untuk `index.html`
- Cache-first untuk asset immutable sahaja
- Tambah `registration.update()` call
- Elak cache response opaque secara tak terkawal
- Pastikan cache install gagal tak rosakkan registration

### Task 3.6 — Clipboard fallback
- Check `navigator.clipboard` availability dahulu
- Fallback ke temporary textarea kalau tak available
- Papar status gagal kat user

**Acceptance Criteria Fasa 3:**
- [ ] Play/pause/seek konsisten selepas audio pool switch (test dengan rapid song change)
- [ ] Mute → unmute kembalikan volume asal, bukan 0
- [ ] API error (contoh network down) papar mesej jelas, bukan silent fail
- [ ] Refresh page: volume, shuffle, repeat, last song restore semula
- [ ] Deploy baru: user dapat asset terkini tanpa perlu hard refresh
- [ ] Copy link berfungsi walaupun kat HTTP LAN (guna fallback)

---

## Fasa 4: Quality & Features (P2)

**Kenapa last:** Ni "nice to have" — tak block usage harian, tapi penting untuk long-term maintainability.

### Task 4.1 — Upgrade vulnerable dependency
- Upgrade `music-metadata` ke `11.14.0` (fix `file-type` infinite loop vuln)
- Test semula metadata extraction lepas upgrade (breaking changes mungkin ada)
- Jangan guna `npm audit fix --force` buta-buta

### Task 4.2 — Automated tests
- Unit test: `getFileId`, filename sanitization, metadata fallback, range parser, playlist validation
- Integration test: upload, stream, range response, favorite, playlist, delete
- Browser smoke test: play/pause, search, upload, mobile player, playlist

### Task 4.3 — Lint & format
- Setup ESLint + Prettier
- Tambah script `lint`, `test`, `check` dalam `package.json`

### Task 4.4 — Dokumentasi
- Update README — buang path Linux lama, guna path Windows semasa
- Dokumentasikan: env vars (`MUSIC_DIR`, `PORT`, `API_KEY`), auth setup, upload limits, backup DB, troubleshooting, production deployment

### Task 4.5 — Hardening tambahan (dari P2 audit)
- Cloudflare credentials path — pastikan tak masuk git, guna env var/template
- Delete endpoint → soft delete/trash folder + restore function
- `/api/status` — pastikan minimal (dah cover sebahagian di Fasa 1)
- Domain hardcode (`music.jomtek.my`) → derive dari `window.location.origin` atau config endpoint

### Task 4.6 — Feature enhancement (pilih ikut priority sendiri)
1. Login multi-user / PIN
2. Queue playback + reorder
3. Recently played
4. Continue listening dari posisi terakhir
5. Album/artist browsing, genre/tahun filter
6. Trash/restore untuk lagu dipadam
7. Backup & restore database
8. Health check endpoint
9. Pagination untuk library besar

**Acceptance Criteria Fasa 4:**
- [ ] `npm audit` bersih atau documented accepted risk
- [ ] `npm test` jalan dan pass
- [ ] `npm run lint` jalan tanpa error
- [ ] README reflect setup Windows semasa + ada env var docs
- [ ] Delete lagu boleh di-restore dalam tempoh tertentu

---

## Nota Handoff

- Setiap fasa self-contained — boleh test dan deploy berasingan sebelum sambung fasa seterusnya.
- Fasa 1 **wajib** siap dahulu sebelum domain terus dibiarkan public — kalau tak sempat buat semua, minimum: Task 1.1 (auth) + Task 1.2 (CORS) je pun dah reduce risiko besar.
- Bila handoff kat AI coding agent, copy satu fasa je per session supaya scope tak melebar dan senang review diff.
