# SkinCheck - Smart Skin Health Analysis & Care Assistant
> **Tugas Besar UAS Rekayasa Perangkat Lunak (RPL)**  
> Repository: [https://github.com/ubaidatulhamida11-cloud/SkinCheck.git](https://github.com/ubaidatulhamida11-cloud/SkinCheck.git)

---

## 1. Identitas Anggota Kelompok

| No | Nama Lengkap | NIM | Peran / Kontribusi |
|:--:|:-------------|:---:|:-------------------|
| 1  | [Nama Lengkap Anggota 1] | [NIM Anggota 1] | [Project Lead / Fullstack Developer] |
| 2  | [Nama Lengkap Anggota 2] | [NIM Anggota 2] | [Frontend Developer / UI/UX] |
| 3  | [Nama Lengkap Anggota 3] | [NIM Anggota 3] | [Backend & AI Developer] |
| 4  | [Nama Lengkap Anggota 4] | [NIM Anggota 4] | [QA / Technical Documentation] |

- **Nomor Kelompok** : [Nomor Kelompok]
- **Kelas / Program Studi** : [Nama Kelas / Program Studi]
- **Mata Kuliah** : Rekayasa Perangkat Lunak (RPL)
- **Dosen Pengampu** : [Nama Dosen Pengampu]
- **Tahun Akademik** : 2026/2027

---

## 2. Tema atau Topik Kelompok

**Tema Project:**  
> **"Penerapan Kecerdasan Buatan (Computer Vision & Retrieval-Augmented Generation LLM) pada Sistem Cerdas Analisis Kesehatan Kulit Wajah dan Rekomendasi Perawatan Skincare Personal"**

---

## 3. Deskripsi Aplikasi

### 3.1 Penjelasan Aplikasi
**SkinCheck** adalah platform berbasis web modern yang dirancang sebagai asisten pintar perawatan kulit (*Smart Skincare Companion*). Aplikasi ini memanfaatkan kombinasi teknologi **Computer Vision (CV)** dan **Large Language Models (LLM)** dengan arsitektur **Retrieval-Augmented Generation (RAG)** untuk memberikan analisis kesehatan kulit wajah, pemeriksaan kerataan tabir surya (*sunscreen*), konsultasi interaktif seputar masalah kulit, serta rekomendasi produk perawatan yang aman dan terpersonalisasi.

Aplikasi juga dilengkapi dengan sistem keamanan modern berupa autentikasi multi-faktor berbasis **WhatsApp OTP** (*One-Time Password*) dan notifikasi aktivitas login ke perangkat pengguna.

### 3.2 Tujuan Pembuatan Aplikasi
1. Memberikan kemudahan bagi pengguna dalam mengenali dan memantau kondisi kesehatan kulit wajah secara mandiri tanpa memerlukan perangkat medis khusus.
2. Meningkatkan kepatuhan dan efektivitas penggunaan tabir surya (*sunscreen*) dengan visualisasi cakupan area wajah yang terlindungi.
3. Menyediakan media edukasi dan konsultasi perawatan kulit berbasis kecerdasan buatan yang aman, responsif, serta terlindungi dari halusinasi dan bahaya malpraktik medis melalui *medical guardrails*.
4. Membantu pengguna memilih produk perawatan kulit yang sesuai dengan kondisi, sensitivitas, dan anggaran pribadi secara objektif.

### 3.3 Permasalahan yang Ingin Diselesaikan
- **Rendahnya Literasi Kesehatan Kulit**: Banyak masyarakat yang kesulitan mengidentifikasi permasalahan kulit wajah mereka (seperti tipe jerawat, hiperpigmentasi, atau iritasi) sehingga kerap salah memilih produk perawatan.
- **Aplikasi Sunscreen yang Tidak Efektif**: Sebagian besar pengguna mengabaikan area wajah krusial (seperti lipatan hidung, bawah mata, atau dahi) saat memakai sunscreen, meningkatkan risiko paparan sinar radiasi ultraviolet (UV).
- **Misinformasi Skincare & Keterbatasan Akses Konsultasi**: Konsultasi profesional ke dokter spesialis kulit memerlukan biaya dan waktu yang tidak sedikit, sementara informasi di media sosial kerap bias dan tidak terkurasi.
- **Ketiadaan Alat Monitoring Berkala**: Pengguna kesulitan memantau perkembangan efektivitas produk skincare yang sedang digunakan dari waktu ke waktu secara kuantitatif.

---

## 4. Fitur Aplikasi

Aplikasi SkinCheck memiliki 8 modul fitur utama:

### 4.1 Autentikasi & Verifikasi WhatsApp OTP (2FA)
- Pendaftaran akun baru (*Register*) dengan verifikasi nomor WhatsApp via kode 6-digit OTP.
- Dukungan multi-gateway WhatsApp: **Fonnte Gateway API**, **Meta WhatsApp Business Cloud API**, dan **Mock Provider** (untuk pengujian lokal offline).
- Fitur *Rate Limiting*, masa kedaluwarsa OTP (*expiration* 300 detik), dan batas jeda permintaan ulang (*resend cooldown* 60 detik).
- Notifikasi keamanan otomatis dikirimkan ke WhatsApp saat pengguna berhasil login (mencakup informasi waktu, browser, perangkat, dan lokasi).

### 4.2 Onboarding & Personalisasi Profil
- Kuesioner terpadu setelah registrasi untuk mendata target perawatan kulit (*skin goals*), riwayat sensitivitas, preferensi bahan aktif (*ingredients*), dan anggaran belanja pengguna.

### 4.3 Pemindaian Kondisi Kulit (Skin Scan)
- Modul kamera interaktif berbasis **WebRTC** yang mengakses kamera smartphone/laptop secara *real-time* atau opsi unggah berkas foto JPEG.
- Analisis metrik kuantitatif berbasis skala 0–100 untuk:
  - Skor Jerawat (*Acne Score*)
  - Skor Kemerahan (*Redness Score*)
  - Skor Tekstur (*Texture Score*)
  - Skor Hiperpigmentasi (*Hyperpigmentation Score*)
  - Skor Kesehatan Keseluruhan (*Overall Skin Score*)

### 4.4 Pemindaian Kerataan Tabir Surya (Sunscreen Coverage Scan)
- Pemeriksaan visual terhadap kerataan lapisan tabir surya pada wajah.
- Penilaian persentase cakupan (*coverage score*), indikator status (*Relatif Merata*, *Cukup Merata*, *Perlu Perhatian*), serta penandaan spesifik area wajah yang kurang terlindungi (dahi, hidung, pipi, dagu, area mata).

### 4.5 Asisten Edukasi & Chatbot AI (SkinCheck AI Assistant)
- Antarmuka obrolan pintar interaktif berupa halaman penuh (*dedicated page*) maupun *floating widget* yang dapat diakses dari halaman mana saja.
- Kemampuan menjawab pertanyaan dermatologi harian, panduan bahan aktif skincare, serta rincian data aplikasi sesuai hak akses pengguna.

### 4.6 Katalog & Rekomendasi Produk Skincare
- Katalog produk skincare terstruktur berdasarkan kategori (*Cleanser*, *Toner*, *Moisturizer*, *Sunscreen*, *Serum*, *Treatment*).
- Informasi detail produk mencakup komposisi bahan aktif (*ingredients*), manfaat utama, label tipe kulit yang cocok, dan rentang harga.
- Rekomendasi kontekstual yang disesuaikan dengan hasil pemindaian kulit pengguna.

### 4.7 Riwayat Pemindaian & Pelacakan (History & Monitoring)
- Pencatatan seluruh hasil pemindaian kulit dan tabir surya terdahulu.
- Menampilkan grafik dan perbandingan skor kondisi kulit untuk melihat perkembangan efektivitas perawatan dari waktu ke waktu.

### 4.8 Dashboard & Panel Administrasi (Admin Panel)
- **User Management**: Mengelola data pengguna, status akun, nomor telepon, dan hak akses (*role: admin / customer*).
- **Product Management**: Menambah, memperbarui, dan menghapus katalog produk skincare.
- **Login Activity Monitoring**: Memantau sesi pengguna aktif, alamat IP, agen pengguna (*user agent*), dan status notifikasi keamanan.
- **Audit Logs**: Pencatatan riwayat perubahan konfigurasi dan aksi penting administrator.
- **AI Chat History**: Pemantauan percakapan AI untuk keperluan penjaminan mutu (*quality assurance*).
- **System Configuration Engine**: Pengaturan dinamis konfigurasi API AI provider dan WhatsApp gateway langsung melalui antarmuka web tanpa perlu me-restart server.

---

## 5. Fitur AI (Kecerdasan Buatan)

Aplikasi SkinCheck mengintegrasikan dua pilar teknologi Artificial Intelligence:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ARSITEKTUR KECERDASAN BUATAN                    │
└────────────────────────────────────────────────────────────────────────┘

 [1. COMPUTER VISION ENGINE]              [2. GENERATIVE AI & RAG ENGINE]
 ┌──────────────────────────┐             ┌─────────────────────────────┐
 │ Citra Wajah (Kamera/RGB) │             │  Pertanyaan / Pesan User    │
 └────────────┬─────────────┘             └──────────────┬──────────────┘
              ▼                                          ▼
 ┌──────────────────────────┐             ┌─────────────────────────────┐
 │ TensorFlow.js MobileNetV2│             │ Input Safety & Guardrails   │
 │ (Pre-processing 224x224) │             │ (Blokir diagnosis berbahaya │
 └────────────┬─────────────┘             │  & pertanyaan pemrograman)  │
              ▼                                          ▼
 ┌──────────────────────────┐             ┌─────────────────────────────┐
 │ Klasifikasi 7 Kondisi    │             │ Retrieval-Augmented Gen     │
 │ & Kalkulasi Skor Matriks │             │ (RAG: Knowledge Base +      │
 └──────────────────────────┘             │  User Context + Produk)     │
                                                         ▼
                                          ┌─────────────────────────────┐
                                          │ Multi-Provider LLM Gateway  │
                                          │ (Gemini / OpenAI / Groq)    │
                                          └──────────────┬──────────────┘
                                                         ▼
                                          ┌─────────────────────────────┐
                                          │ Output Safety Validation    │
                                          └──────────────┬──────────────┘
                                                         ▼
                                          ┌─────────────────────────────┐
                                          │ Respon Edukatif & Objektif  │
                                          └─────────────────────────────┘
```

### 5.1 Computer Vision: Analisis Kondisi Kulit & Tabir Surya
- **Teknologi**: TensorFlow.js (`@tensorflow/tfjs`) dan `jpeg-js`.
- **Model Arsitektur**: **MobileNetV2** yang dioptimalkan untuk inferensi cepat pada lingkungan JavaScript/Node.js.
- **Klasifikasi Kondisi Kulit**: Mampu mengidentifikasi 7 kelas kondisi kulit wajah:
  1. `berjerawat` (*Acne*)
  2. `berminyak` (*Oily skin*)
  3. `dermatitis_perioral` (*Perioral dermatitis*)
  4. `kering` (*Dry skin*)
  5. `normal` (*Normal healthy skin*)
  6. `penuaan` (*Aging/Fine lines*)
  7. `vitiligo`
- **Mekanisme Kerja**: Citra wajah dari kamera didekodekan menjadi tensor 3D RGB, diubah ukurannya (*resize*) ke dimensi $224 \times 224$ piksel, dinormalisasi ke rentang $[0, 1]$, dan diproses melalui jaringan konvolusi untuk menghasilkan distribusi probabilitas kelas dan skor kesehatan kuantitatif.
- **Graceful Fallback**: Apabila berkas model belum terpasang di direktori sistem, sistem secara otomatis beralih ke simulasi heuristik (*mock CV engine*) agar alur pengujian aplikasi tetap berjalan lancar.

### 5.2 Conversational AI: Large Language Model (LLM) & RAG
- **Fungsi**: Bertindak sebagai konsultan perawatan kulit yang menjawab pertanyaan pengguna secara komprehensif, santun, dan berdasarkan data faktual.
- **Multi-Provider LLM Support**:
  - **Google Gemini API** (`@google/generative-ai`): Model default `gemini-3.5-flash-lite`, `gemini-3.5-flash`, dan `gemini-2.5-flash`.
  - **OpenAI API**: Model `gpt-4o-mini` dan `gpt-4o`.
  - **Custom / OpenAI-Compatible Endpoint**: Model inferensi kecepatan tinggi LPU seperti `llama-3.3-70b-versatile` via Groq.
  - **Anthropic Claude**: Model `claude-3-5-haiku`.
  - **Local Knowledge Engine**: Mode *offline-first* yang mampu menjawab pertanyaan mendasar mengenai katalog produk dan basis data tanpa kuota API eksternal.
- **Integrasi Retrieval-Augmented Generation (RAG)**:
  - Mengambil dokumen dermatologi tervalidasi dari basis pengetahuan internal (`knowledge_base.json`).
  - Menyuntikkan konteks personal pengguna (*skin concerns*, preferensi bahan aktif, riwayat scan).
  - Menyaring rekomendasi produk hanya dari daftar katalog produk yang telah disetujui (*Approved Product Candidates*), mencegah halusinasi produk fiktif.
- **Medical Guardrails & Safety Policy (`safetyService.js`)**:
  - **Filter Pertanyaan Kritis**: Mendeteksi keluhan medis darurat/kanker/infeksi berat dan segera mengarahkan pengguna ke dokter spesialis kulit.
  - **Larangan Klaim Medis**: Mencegah model memberikan diagnosis klinis pasti atau meresepkan obat keras.
  - **Filter Non-Topik**: Memblokir pertanyaan seputar pemrograman/coding agar percakapan tetap fokus pada konteks kesehatan kulit dan aplikasi.

---

## 6. Link Video YouTube

Demonstrasi alur kerja, pengujian fitur, dan arsitektur aplikasi SkinCheck dapat dilihat melalui tautan video berikut:

> 📺 **Link Video Demonstrasi Aplikasi:**  
> **[TEMPAT_LINK_YOUTUBE_DEMO_APLIKASI]** *(Silakan ganti dengan tautan YouTube yang telah diunggah)*

---

## 7. Panduan Instalasi & Penggunaan Aplikasi

### 7.1 Persyaratan Sistem & Perangkat Lunak
Sebelum menjalankan aplikasi, pastikan sistem Anda telah memenuhi persyaratan berikut:
- **Node.js**: Versi LTS 18.x atau yang lebih baru ([Unduh Node.js](https://nodejs.org/)).
- **NPM**: Versi 9.x atau yang lebih baru (termasuk saat instalasi Node.js).
- **Git**: Versi 2.30+ untuk manajemen repository.
- **Web Browser**: Google Chrome, Microsoft Edge, atau Mozilla Firefox dengan dukungan WebRTC (akses kamera).
- **Web Server (Opsional)**: Apache / XAMPP (jika ingin menggunakan pengalihan berkas `index.php`).

### 7.2 Struktur Direktori Project
```text
Project Skin Chek/
├── data/                          # Basis data NoSQL lokal (JSON Flat-File)
│   ├── knowledge_base.json        # Data dokumen artikel untuk RAG
│   ├── products.json              # Katalog produk skincare
│   └── uploads/                   # Penyimpanan sementara berkas unggahan
├── public/                        # Aset statis frontend
│   ├── css/style.css              # Berkas styling antarmuka
│   ├── js/theme.js                # Skrip tema dan antarmuka
│   └── images/                    # Aset grafis aplikasi
├── src/                           # Source code inti aplikasi (MVC)
│   ├── config/env.js              # Pemuatan environment variable
│   ├── controllers/               # Logika penanganan rute & request
│   ├── database/migrate.js        # Skrip inisialisasi & migrasi berkas data
│   ├── middleware/                # Auth verification & rate limiter
│   ├── models/                    # Model abstraksi data JSON
│   ├── routes/                    # Rute navigasi aplikasi
│   ├── services/                  # Logika bisnis (AI, OTP, WhatsApp)
│   │   ├── ai/                    # Orchestrator, LLM provider, RAG, Safety
│   │   └── whatsapp/              # Multi-provider gateway WhatsApp
│   ├── utils/                     # Normalisasi telepon & deteksi perangkat
│   └── views/                     # Template tampilan EJS (View Engine)
├── tests/                         # Berkas automated unit & integration tests
├── .env.example                   # Contoh konfigurasi environment variable
├── package.json                   # Definisi dependencies & scripts Node.js
├── server.js                      # Entry point utama aplikasi Express
└── README.md                      # Dokumentasi resmi project
```

### 7.3 Langkah Instalasi Dependencies
1. Buka terminal atau Command Prompt pada direktori project:
   ```bash
   cd "c:\xampp\htdocs\Project Skin Chek"
   ```
2. Pasang seluruh dependencies yang dibutuhkan:
   ```bash
   npm install
   ```

### 7.4 Konfigurasi Environment Variable
1. Salin berkas `.env.example` menjadi `.env`:
   ```bash
   copy .env.example .env
   ```
2. Buka berkas `.env` menggunakan teks editor (misalnya VS Code atau Notepad).
3. Sesuaikan konfigurasi sesuai kebutuhan:
   ```env
   # Server Port
   PORT=3000
   NODE_ENV=development
   SESSION_SECRET=skincheck-mvp-super-secret-key

   # WhatsApp Gateway Provider (Pilihan: 'meta', 'fonnte', atau 'mock')
   # Gunakan 'mock' untuk pengujian lokal tanpa memerlukan token API WhatsApp
   WHATSAPP_PROVIDER=mock

   # Jika menggunakan provider 'fonnte':
   WHATSAPP_ACCESS_TOKEN=token_fonnte_anda_disini

   # Kunci Rahasia OTP HMAC-SHA256
   OTP_SECRET_KEY=skincheck-otp-hmac-secret-key-change-in-prod
   OTP_EXPIRATION_SECONDS=300
   OTP_RESEND_COOLDOWN_SECONDS=60
   ```

> [!NOTE]
> Jika `WHATSAPP_PROVIDER=mock` dipilih, kode OTP yang dikirimkan akan disimulasikan dan ditampilkan langsung pada log terminal console sehingga mempermudah proses evaluasi dan pengujian tanpa kuota pesan WhatsApp.

### 7.5 Konfigurasi Basis Data
Aplikasi SkinCheck menggunakan arsitektur **JSON Document Store** yang tersimpan di dalam folder `data/`.
- Tidak memerlukan instalasi MySQL, MongoDB, atau DBMS eksternal lainnya.
- Data katalog produk (`products.json`) dan artikel basis pengetahuan RAG (`knowledge_base.json`) sudah disertakan langsung di repository.
- Untuk mengaktifkan akun bawaan (Administrator & Demo User), salin berkas template data pengguna:
  ```bash
  copy data\users.example.json data\users.json
  ```
- Salin juga konfigurasi awal sistem AI dan WhatsApp:
  ```bash
  copy data\system_config.example.json data\system_config.json
  ```
- Skrip migrasi otomatis (`src/database/migrate.js`) akan secara cerdas memastikan seluruh berkas penyimpanan data siap digunakan setiap kali aplikasi dijalankan.

### 7.6 Menjalankan Aplikasi
Terdapat dua cara untuk menjalankan server aplikasi:

**Cara 1: Menggunakan NPM Script**
```bash
npm start
```
*(Atau `node server.js`)*

**Cara 2: Menggunakan Batch Script (Windows)**
- Klik dua kali berkas `Buka_SkinCheck.bat` yang berada di root direktori project. Skrip ini akan menyalakan server Node.js dan membuka browser secara otomatis.
- Untuk menghentikan server, klik dua kali berkas `Hentikan_SkinCheck.bat`.

### 7.7 Menjalankan Pengujian Otomatis (*Automated Tests*)
Aplikasi telah dilengkapi dengan *test suite* menyeluruh (mencakup unit test phone normalizer, OTP security, WhatsApp providers, login notifications, dan integrasi rute):
```bash
npm test
```
*(Atau `node tests/runAllTests.js`)*

### 7.8 Cara Mengakses Aplikasi
Setelah server aktif di terminal:
1. Buka browser dan kunjungi alamat:
   ```text
   http://localhost:3000
   ```
2. *(Alternatif jika menggunakan Apache XAMPP)*: Kunjungi alamat:
   ```text
   http://localhost/Project Skin Chek/
   ```
   *(Akan dialihkan secara otomatis ke port 3000 melalui `index.php`)*

---

## 8. Panduan Hak Akses Pengujian (*Testing Credentials*)

Untuk memudahkan pengujian dan penilaian, penguji dapat menggunakan akun demo bawaan (tersedia setelah menyalin `data/users.example.json` ke `data/users.json`) atau mendaftar akun baru:

- **Akun Administrator**:
  - Email: `admin@skincheck.local`
  - Kata Sandi: `admin123`
  - Hak Akses: Manajemen pengguna, katalog produk skincare, pemantauan log aktivitas login, audit log sistem, riwayat percakapan AI, dan konfigurasi API sistem.

- **Akun Pengguna Demo (Customer)**:
  - Email: `user@skincheck.local`
  - Kata Sandi: `admin123`
  - Hak Akses: Pemindaian kulit wajah (*Skin Scan*), pemindaian tabir surya (*Sunscreen Scan*), riwayat evaluasi, dan konsultasi asisten pintar SkinCheck AI.

- **Pendaftaran Akun Baru**:
  - Halaman Registrasi: `http://localhost:3000/auth/register`
  - Masukkan nama, email, kata sandi, dan nomor WhatsApp.
  - Masukkan kode OTP 6 digit yang diterima (jika mode `WHATSAPP_PROVIDER=mock`, periksa output terminal server).
  - Selesaikan sesi onboarding untuk mengisi preferensi kulit pengguna.

---

## 9. Lisensi & Hak Cipta
Project ini dikembangkan sebagai karya akademis untuk memenuhi persyaratan evaluasi akhir semester (UAS) mata kuliah **Rekayasa Perangkat Lunak (RPL)**.  
Hak Cipta &copy; 2026 Tim Pengembang SkinCheck. Seluruh hak cipta dilindungi.
