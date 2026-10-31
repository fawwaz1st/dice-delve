# 🎲 Ular Tangga Modern

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla%20ES2020-f7df1e?logo=javascript&logoColor=black)](#-teknologi)
[![No Build](https://img.shields.io/badge/build-tanpa%20bundler-brightgreen)](#-menjalankan)
[![PWA](https://img.shields.io/badge/PWA-bisa%20dipasang%20%26%20offline-5a0fc8?logo=pwa&logoColor=white)](#-menjalankan)

Permainan papan Ular Tangga yang berjalan langsung di browser. Papan 10×10 diacak ulang setiap permainan, ada lawan AI, sistem kartu skill, dan mode cepat. Tanpa framework, tanpa bundler, tanpa instalasi.

**[Mainkan sekarang](https://fawwaz1st.github.io/ulartangga/)** (GitHub Pages).

---

## 🪵 Konsep desain

Projek ini tidak memakai gaya "SaaS ungu" yang seragam. Arah visualnya satu kalimat:

> **Papan ular tangga kayu warung yang sudah dimainkan bertahun-tahun.**

Semua keputusan mengikuti itu:

| Bagian | Metafora | Wujud |
| --- | --- | --- |
| Latar | Meja kayu | Serat kayu berlapis, cahaya dari atas, vignette di tepi |
| Papan | Papan cat di atas meja | Kertas manila, kotak cetakan tinta, jalur digambar tangan |
| Panel | Papan yang dipaku | Sudut paku, bayangan keras ke kanan bawah |
| Menu | Kotak permainan | Tutup berengsel, label kertas miring, segel stempel |
| Statistik | Slip kertas | Selotip di atas, tiap slip miring ke arah berbeda |
| Kartu skill | Kartu remi | Kertas, tepi warna kelangkaan, kartu miring sedikit |
| Teks | Ukiran & cat | Teks ukir untuk papan, teks cat untuk label |

Konsekuensi teknis:
- Warna didefinisikan di ruang **OKLCH** supaya variasi terang-gelap tetap seragam secara persepsi.
- Bayangan selalu **dua lapis**: satu offset keras (kesan cetak) + satu sebaran halus (kesan fisik).
- **Radius sudut berbeda per komponen** (4 / 7 / 10 / 11 px), bukan satu nilai seragam.
- **Tanpa emoji sebagai ikon fungsional.** Semua ikon adalah SVG garis di `icons.js`, bisa diwarnai lewat CSS.
- Gerakan selalu punya sebab: dadu memipih saat mendarat, pion melompat antar petak, papan bergetar saat kena ular.
- **Aksesibilitas sebagai fondasi, bukan hiasan**: kontras WCAG AA, narasi pembaca layar, jebakan fokus modal, dan `prefers-reduced-motion` dihormati di seluruh animasi termasuk konfeti.

---

## ✨ Fitur

| Fitur | Keterangan |
| --- | --- |
| 🎲 Papan acak | 10×10 dengan 7 tangga dan 7 ular, posisi baru tiap permainan |
| 🐍 Aturan klasik | Lemparan yang melewati petak 100 memantul kembali |
| 🤖 Lawan AI | Hingga 3 AI yang memainkan kartu skill **sesuai situasi** (bukan acak murni): makin tertinggal, makin agresif |
| 🃏 10 kartu skill | Dadu Ganda, Pacu Tangga, Perisai Ular, Teleportasi, Tukar Posisi, dan lainnya, dengan cooldown |
| ⚡ Mode Cepat | Seluruh animasi dipersingkat kurang lebih dua kali |
| 💾 Lanjutkan permainan | Permainan tersimpan otomatis; bila tab tertutup, tawaran lanjut muncul saat dibuka lagi |
| 🔊 Suara & musik | Disintesis dengan Web Audio API, tanpa berkas audio |
| 📳 Getaran (haptic) | Pola getar berbeda untuk lemparan, tangga, ular, dan kemenangan — bisa dimatikan di Pengaturan |
| 🔆 Layar tetap menyala | Wake Lock API menjaga layar saat bermain, otomatis lepas saat tab ditidurkan |
| 🎉 Konfeti kemenangan | Keping kertas manila & cat poster; dilewati bila pengguna memilih gerakan minimal |
| 📤 Bagikan hasil | Web Share API di kartu kemenangan, dengan fallback salin ke clipboard |
| 📲 PWA | Bisa dipasang ke layar utama dan **dimainkan offline** (service worker + manifest) |
| 🎞️ Transisi halaman | View Transitions API: menu ↔ permainan berpadu halus di Chromium 126+, browser lain melompat biasa |
| 📊 Statistik | Total main, pemenang terakhir, kemenanganmu, kemenangan AI, rasio menangmu, rekor giliran terpanjang |
| 📱 Responsif | Tiga zona asimetris di desktop, bertumpuk di layar sempit, papan selalu utuh tanpa scroll |
| ♿ Aksesibilitas | Narasi peristiwa lewat live region, jebakan fokus di modal, navigasi Spasi/Escape, kontras WCAG AA |

---

## 🚀 Menjalankan

Buka `index.html` di browser. Tidak ada langkah build.

Karena font diambil dari CDN, disarankan memakai server statis lokal:

```bash
python -m http.server 8000
# lalu buka http://localhost:8000
```

**PWA:** kunjungi lewat `https` (GitHub Pages) atau `localhost`, lalu pasang dari menu browser ("Install app" / "Tambahkan ke layar utama"). Setelah satu sesi online, seluruh aset tercache dan permainan tetap jalan tanpa koneksi.

**Regenerasi ikon** (favicon + PNG manifest) setelah mengubah palet:

```bash
python scripts/make-favicon.py
```

---

## 🎮 Cara Bermain

1. Pilih **Mulai Permainan**, atur jumlah pemain dan mode di **Pengaturan**.
2. Klik dadu atau tekan **Spasi** saat giliranmu.
3. Petak **tangga** menaikkan pion, petak **ular** menurunkannya.
4. Mainkan **kartu skill** saat giliranmu. Satu efek aktif per waktu.
5. Pemain pertama yang mencapai **petak 100** menang. Tekan **Bagikan** di kartu kemenangan untuk pamer hasil.

---

## 📂 Struktur Proyek

```
.
├── index.html              # Perantara, mengalihkan ke menu
├── manifest.webmanifest    # Identitas PWA (nama, ikon, warna)
├── sw.js                   # Service worker: precache, offline, SWR font
├── views/
│   ├── menu.html           # Kotak permainan: mulai, tutorial, pengaturan, statistik
│   └── game.html           # Meja permainan
├── assets/
│   ├── css/
│   │   ├── base.css        # Token OKLCH, tekstur kayu & kertas, tombol, modal, toast, view transitions
│   │   ├── menu.css        # Kotak kayu, label kertas, slip statistik
│   │   └── game.css        # Meja, papan, dadu, kartu skill, papan skor
│   ├── js/
│   │   ├── core.js         # Utilitas, penyimpanan, toast, haptic, narasi a11y, fokus modal, pendaftaran SW
│   │   ├── icons.js        # Sprite ikon SVG, tanpa emoji fungsional
│   │   ├── audio.js        # Suara kayu & kertas disintesis (Web Audio API)
│   │   ├── confetti.js     # Perayaan kemenangan di canvas
│   │   ├── skills.js       # Katalog skill, cooldown, efek, heuristik AI. Logika murni tanpa DOM
│   │   ├── game.js         # Mesin permainan: papan, giliran, animasi, AI, wake lock, bagikan, simpanan
│   │   └── menu.js         # Logika halaman menu
│   └── images/
│       ├── favicon.ico     # Dibuat oleh scripts/make-favicon.py
│       ├── favicon.svg
│       ├── icon-192.png    # Ikon manifest PWA + apple-touch-icon
│       ├── icon-512.png
│       └── icon-maskable-512.png
├── scripts/
│   └── make-favicon.py     # Gambar ulang favicon + ikon PWA (PIL)
├── LICENSE
└── README.md
```

Urutan pemuatan: `core.js` → `icons.js` → `audio.js` → (`confetti.js`, `skills.js`) → `game.js` atau `menu.js`.
Semua modul berbagi satu namespace `window.UT`; tidak ada variabel global yang bocor.

---

## 🛠️ Teknologi

- **Vanilla JavaScript (ES2020)** dengan pola IIFE, tanpa dependensi runtime.
- **OKLCH** untuk seluruh token warna (Baseline, didukung semua browser modern).
- **CSS Grid** dengan area bernama + **container query** (`cqw`) untuk tata letak papan.
- **Web Audio API** untuk seluruh suara.
- **SVG inline** untuk ikon dan jalur ular/tangga.
- **Service Worker + Web App Manifest** untuk PWA yang bisa dipasang dan offline.
- **View Transitions API** (cross-document), **Wake Lock**, **Vibration**, **Web Share**, **Clipboard** — semuanya peningkatan progresif: browser tanpa dukungan tetap berjalan penuh.
- **Google Fonts**: Fraunces (judul), Karla (teks), Space Mono (label).

---

## 🗺️ Roadmap

- [ ] Multiplayer online lewat WebSocket atau WebRTC
- [ ] Tema papan dan pion yang bisa dipilih
- [ ] Tingkat kesulitan AI
- [x] Dukungan PWA agar bisa dimainkan offline ✅
- [ ] Mode turnamen dengan bagan pertandingan

---

## 🤝 Kontribusi

1. Fork repositori ini.
2. Buat branch baru: `git checkout -b feat/nama-fitur`.
3. Commit: `git commit -m 'feat: menambahkan fitur X'`.
4. Push dan buka Pull Request.

Buka **Issue** untuk melaporkan bug atau mengusulkan fitur.

---

## 📜 Lisensi

Dirilis di bawah **MIT License**. Lihat berkas [`LICENSE`](LICENSE).
