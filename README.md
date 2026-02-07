# Medtools Ramadhan Kompetisi (Mercy 2026)

Website resmi untuk event Mercy 2026, mencakup pendaftaran, kompetisi quiz online (INC), dan leaderboard real-time.

## Fitur Utama

- **Pendaftaran Peserta**: Form pendaftaran terintegrasi dengan Google Sheets & Email Notifikasi.
- **Quiz System**: 
  - Login via email terdaftar
  - 50 Soal Pilihan Ganda
  - Timer 60 menit dengan auto-submit
  - Navigasi soal responsive & interaktif
- **Leaderboard Real-time**: Menampilkan peringkat peserta berdasarkan nilai dan waktu pengerjaan.
- **Service Center**: FAQ & Chat WhatsApp otomatis.
- **Design Modern**: Clean, minimalist, elegant dengan tema Navy Blue.

## Cara Menggunakan (Local Development)

1. **Clone/Download** repository ini.
2. Buka folder di terminal.
3. Jalankan local server (jika perlu, atau langsung buka file HTML).
   ```bash
   python3 -m http.server 8000
   ```
4. Buka di browser: `http://localhost:8000`

> **Catatan**: Saat ini website berjalan dengan **Mode Simulasi**. Data pendaftaran dan quiz tersimpan di LocalStorage browser agar Anda bisa mencoba alur tanpa setup backend terlebih dahulu.

## Setup Backend (Wajib untuk Production)

Website ini menggunakan Google Apps Script sebagai backend (database & API).

### Langkah 1: Google Sheets
Buat Spreadsheet baru di Google Sheets dengan 3 sheet (tab):
1. **Registrations** (Header Row 1: Timestamp, Nama, Email, Institusi, WhatsApp)
2. **QuizSubmissions** (Header Row 1: Timestamp, Email, Answers, Score)
3. **Leaderboard** (Header Row 1: Nama, Score, Time)

### Langkah 2: Google Apps Script
1. Buka Spreadsheet -> Extensions -> Apps Script.
2. Copy semua kode dari file `appscript/Code.gs` di project ini.
3. Paste ke editor Apps Script.
4. Ubah variabel `adminEmail` di fungsi `sendAdminNotification` ke email Anda.

### Langkah 3: Deploy
1. Klik tombol **Deploy** -> **New Deployment**.
2. Select type: **Web App**.
3. Description: "Mercy 2026 Backend".
4. Execute as: **Me**.
5. Who has access: **Anyone** (Penting agar frontend bisa akses).
6. Copy **Web App URL** yang muncul setelah deploy.

### Langkah 4: Connect Frontend
1. Buka file `js/registration.js`, `js/quiz.js`, dan `js/leaderboard.js`.
2. Cari variabel `const APPS_SCRIPT_URL`.
3. Ganti nilainya dengan Web App URL yang Anda copy tadi.
4. Uncomment bagian `fetch()` yang ada di dalam komentar kode untuk mengaktifkan koneksi ke backend sesungguhnya.

## Deploy ke Vercel

1. Push kode ini ke GitHub.
2. Buka dashboard Vercel -> Add New Project.
3. Import repository GitHub tadi.
4. Klik **Deploy**.
5. Website siap digunakan!
