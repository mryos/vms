# Panduan Deploy — Penilaian Vendor PT Ethos Kreatif Indonesia

Website ini 100% statis (HTML + CSS + JS), jadi deploy-nya sangat mudah.

---

## Opsi 1: Netlify (Paling Mudah)

### Cara Cepat (Drag & Drop)
1. Buka [app.netlify.com](https://app.netlify.com)
2. Login / buat akun (gratis)
3. Di halaman dashboard, **drag & drop folder `vendor-assessment`** ke area deploy
4. Selesai! Anda langsung dapat URL seperti `https://nama-random.netlify.app`

### Cara via GitHub
1. Push folder `vendor-assessment` ke repository GitHub
2. Di Netlify → **Add new site** → **Import an existing project**
3. Pilih repo GitHub Anda
4. Publish directory: `.` (atau kosongkan)
5. Klik **Deploy site**
6. Setiap push ke GitHub, website otomatis ter-update

---

## Opsi 2: Vercel

### Cara via GitHub
1. Push folder `vendor-assessment` ke repository GitHub
2. Buka [vercel.com](https://vercel.com), login dengan GitHub
3. Klik **Add New** → **Project**
4. Pilih repo Anda
5. Framework Preset: pilih **Other**
6. Klik **Deploy**
7. Selesai! URL seperti `https://nama-project.vercel.app`

### Cara via CLI
```bash
npm i -g vercel
cd vendor-assessment
vercel
```

---

## ⚠️ Langkah Penting Setelah Deploy

### Hubungkan ke Google Spreadsheet
1. Buka spreadsheet Anda:  
   https://docs.google.com/spreadsheets/d/1GqsrZeTHhEpyCu5iGWk5OxoT8XPnXKk8usJUWSs27sw/

2. Buat sheet bernama **`Daftar Vendor`**, isi kolom A (mulai baris 2) dengan nama-nama vendor

3. Buka **Extensions → Apps Script**

4. Hapus semua kode default, paste isi dari file `appscript_code.gs`

5. Klik **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**

6. Klik **Deploy**, salin URL yang muncul

7. Buka file `script.js`, ganti baris:
   ```js
   const SCRIPT_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';
   ```
   dengan URL yang sudah Anda salin, contoh:
   ```js
   const SCRIPT_URL = 'https://script.google.com/macros/s/AKfyc.../exec';
   ```

8. Commit & push ulang ke GitHub (Netlify/Vercel akan otomatis redeploy)

---

## Struktur File
```
vendor-assessment/
├── index.html          ← Halaman utama
├── style.css           ← Styling
├── script.js           ← Logika aplikasi
├── appscript_code.gs   ← Kode untuk Google Apps Script (salin manual)
├── netlify.toml        ← Konfigurasi Netlify
├── vercel.json         ← Konfigurasi Vercel
└── DEPLOY.md           ← Panduan ini
```
