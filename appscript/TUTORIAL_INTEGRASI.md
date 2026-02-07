# Panduan Integrasi Google Sheets & Apps Script - Mercy 2026

Dokumen ini menjelaskan langkah-langkah teknis untuk menghubungkan Website Mercy 2026 dengan Google Sheets sebagai database pendaftaran, hasil kompetisi, dan leaderboard.

## Langkah 1: Menyiapkan Google Spreadsheet
1. Buat Spreadsheet baru di Google Sheets.
2. Buat 3 Sheet (Tab) dengan nama persis sebagai berikut:
   - **`Registrations`**: Untuk menampung data pendaftar.
   - **`QuizSubmissions`**: Untuk menampung hasil jawaban peserta.
   - **`Leaderboard`**: Untuk data peringkat yang akan ditampilkan di website.
3. Masukkan Header (Baris 1) untuk masing-masing sheet:
   - **Registrations**: `Timestamp`, `Nama`, `Email`, `Nama Universitas`, `Instagram`, `Semester`, `WhatsApp`
   - **QuizSubmissions**: `Timestamp`, `Email`, `Answers`, `Score`
   - **Leaderboard**: `Nama`, `Score`, `Time`

## Langkah 2: Memasukkan Kode ke Apps Script
1. Di Spreadsheet Anda, buka menu **Extensions** > **Apps Script**.
2. Hapus semua kode yang ada di `Code.gs`.
3. Buka file `Code.gs` yang ada di folder project website Anda, copy seluruh kodenya, dan paste ke editor Apps Script tersebut.
4. Sesuaikan variabel `adminEmail` di fungsi `sendAdminNotification` dengan email admin Medtools agar notifikasi pendaftaran masuk.
5. Klik ikon **Save** (Disket).

## Langkah 3: Deploy sebagai Web App
1. Klik tombol **Deploy** di pojok kanan atas > **New Deployment**.
2. Pilih jenis (type): **Web App**.
3. Isi kolom deskripsi (bebas), misal: "Mercy 2026 Live".
4. Bagian **Execute as**: Pilih **Me**.
5. Bagian **Who has access**: Pilih **Anyone**. (Wajib agar website bisa mengirim data tanpa login).
6. Klik **Deploy**.
7. Anda akan diminta memberikan izin (Authorize Access). Klik **Allow** pada semua permintaan izin Google.
8. Setelah berhasil, copy **Web App URL** yang muncul (berakhir dengan `/exec`).

## Langkah 4: Menghubungkan Website ke Backend
Buka folder project website Anda di komputer, lalu lakukan update pada 3 file JavaScript berikut:
1. **`js/registration.js`**
2. **`js/quiz.js`**
3. **`js/leaderboard.js`**

Pada masing-masing file tersebut, cari baris berikut:
```javascript
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
```
Ganti `'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE'` dengan URL yang Anda copy dari Langkah 3.

## Langkah 5: Mengaktifkan Mode Produksi (Real-time)
Secara default, website ini berjalan dalam mode simulasi. Untuk mengaktifkan integrasi asli:
1. Di file **`js/registration.js`**, cari bagian komentar `/* fetch(...) */` dan hapus tanda komentarnya agar fungsi pendaftaran mengirim data ke Google Sheets.
2. Lakukan hal yang sama pada **`js/quiz.js`** dan **`js/leaderboard.js`**.
3. Pastikan bagian "SIMULATION" di-comment atau dihapus jika Anda sudah siap menggunakan database asli.

## Cara Update Data Leaderboard
Sistem akan otomatis mengupdate leaderboard setiap kali ada peserta yang menyelesaikan **Iseng Ngetest Competition**. Apps Script akan:
1. Menghitung skor peserta.
2. Memasukkan data ke sheet `QuizSubmissions`.
3. Menambahkan baris baru di sheet `Leaderboard`.
4. Website akan melakukan *fetch* data dari sheet `Leaderboard` setiap 10 detik secara otomatis.

---
*Jika ada kendala terkait izin (Permission Denied), pastikan Anda telah men-set "Who has access" ke "Anyone" saat Deployment.*
