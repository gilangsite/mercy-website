# Deployment Guide - Mercy 2026

Panduan lengkap untuk men-deploy website ini hingga live performance.

## 1. Persiapan Backend (Google Ecosystem)

Sebelum deploy frontend, pastikan backend sudah siap karena frontend membutuhkan URL API.

### A. Setup Google Sheets
Buat Spreadsheet baru dengan struktur kolom persis seperti ini (Case Sensitive di header):

**Sheet 1: `Registrations`**
| Timestamp | Nama | Email | Institusi | WhatsApp |
|-----------|------|-------|-----------|----------|

**Sheet 2: `QuizSubmissions`**
| Timestamp | Email | Answers | Score |
|-----------|-------|---------|-------|

**Sheet 3: `Leaderboard`**
| Nama | Score | Time |
|------|-------|------|

### B. Deploy Apps Script
1. Pastikan kode `Code.gs` sudah di-paste di Apps Script editor sheet tersebut.
2. **PENTING**: Saat deploy sebagai Web App, set "Who has access" ke **"Anyone"**. Jika tidak, frontend akan gagal mengirim data (CORS error).
3. Copy URL Web App (akhiran `/exec`).

---

## 2. Persiapan Frontend

### Update URL Backend
Buka file-file berikut di Code Editor:
- `js/registration.js`
- `js/quiz.js`
- `js/leaderboard.js`

Ganti variable:
```javascript
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE'; 
```
Menjadi URL Web App Anda, misal:
```javascript
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx.../exec';
```

### Aktifkan Koneksi Real
Di file-file JS tersebut, cari bagian yang di-comment (biasanya ditandai `/* ... */` di sekitar `fetch`).
Hapus tanda komentar tersebut dan hapus/comment bagian "SIMULATION" agar website menggunakan data real, bukan data dummy local.

---

## 3. Deploy Frontend (Vercel/Netlify/GitHub Pages)

Karena ini adalah Static HTML Website, Anda bisa host di mana saja gratis.

### Opsi A: Vercel (Rekomendasi)
1. Install Vercel CLI `npm i -g vercel` atau pakai dashboard web.
2. Di folder project, jalankan:
   ```bash
   vercel
   ```
3. Ikuti prompt setup (Set defaults: Yes).
4. Vercel akan memberikan URL production (https://mercy-2026.vercel.app).

### Opsi B: GitHub Pages
1. Push kode ke repository GitHub.
2. Pergi ke Settings -> Pages.
3. Set Source ke `main` branch.
4. Save.

---

## 4. Post-Deployment Checklist

- [ ] Coba daftar dengan email baru -> Pastikan masuk ke Google Sheet `Registrations`.
- [ ] Cek inbox email pendaftar -> Pastikan email konfirmasi masuk.
- [ ] Coba login quiz dengan email terdaftar -> Pastikan berhasil masuk.
- [ ] Coba login quiz dengan email asal -> Pastikan ditolak.
- [ ] Kerjakan quiz dan submit -> Pastikan data masuk `QuizSubmissions`.
- [ ] Cek halaman Leaderboard -> Pastikan nama muncul.
- [ ] Cek responsive di HP (akses URL deploy via HP).
