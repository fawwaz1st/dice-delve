# Ular Tangga Modern

Permainan papan Ular Tangga yang berjalan langsung di browser. Papan 10x10 diacak ulang setiap permainan, ada lawan AI, sistem kartu skill, mode cepat, dan bisa dipasang sebagai PWA (offline).

Demo: https://fawwaz1st.github.io/ulartangga/

## Konsep desain

Arah visualnya satu kalimat: papan ular tangga kayu warung yang sudah dimainkan bertahun-tahun.

Semua keputusan mengikuti itu:
- Latar: meja kayu (serat berlapis, cahaya dari atas, vignette).
- Papan: papan cat di atas meja (kertas manila, kotak cetakan tinta, jalur digambar tangan).
- Panel: papan yang dipaku (sudut paku, bayangan keras).
- Menu: kotak permainan (tutup berengsel, label kertas miring, segel stempel).
- Statistik: slip kertas (selotip di atas, tiap slip miring ke arah berbeda).
- Kartu skill: kartu remi (kertas, tepi warna kelangkaan).
- Teks: ukiran dan cat (ukir untuk papan, cat untuk label).

Konsekuensi teknis:
- Warna di ruang OKLCH agar variasi terang-gelap seragam secara persepsi.
- Bayangan dua lapis: satu offset keras (cetak) + satu sebaran halus (fisik).
- Radius sudut berbeda per komponen (4 / 7 / 10 / 11 px).
- Ikon fungsional adalah SVG garis di icons.js, bisa diwarnai lewat CSS. Tidak ada emoji.
- Gerakan punya sebab: dadu memipih saat mendarat, pion melompat antar petak, papan bergetar saat kena ular.
- Aksesibilitas sebagai fondasi: kontras WCAG AA terverifikasi, narasi pembaca layar, jebakan fokus modal, prefers-reduced-motion dihormati termasuk konfeti.

## Fitur

- Papan acak 10x10 dengan 7 tangga dan 7 ular, posisi baru tiap permainan.
- Aturan klasik: lemparan yang melewati petak 100 memantul kembali.
- Hingga 3 lawan AI yang juga memainkan kartu skill.
- 10 kartu skill (Dadu Ganda, Pacu Tangga, Perisai Ular, Teleportasi, Tukar Posisi, dan lainnya) dengan cooldown.
- Mode Cepat mempersingkat animasi dan jeda berpikir AI.
- Simpanan otomatis: bila tab tertutup, tawaran lanjut muncul saat dibuka lagi.
- Suara dan musik disintesis dengan Web Audio API, tanpa berkas audio.
- Getaran haptic berbeda per peristiwa (lempar, tangga, ular, menang), bisa dimatikan.
- Wake Lock: layar tetap menyala selama bermain.
- Konfeti kemenangan di canvas, dilewati bila pengguna memilih gerakan minimal.
- Tombol Bagikan: Web Share API dengan fallback salin ke clipboard.
- PWA: bisa dipasang ke layar utama dan dimainkan offline (service worker + manifest).
- Transisi halaman lewat View Transitions API (Chromium 126+).
- Statistik: total main, pemenang terakhir, kemenanganmu, kemenangan AI, rasio menangmu, rekor giliran.
- Responsif: tiga zona asimetris di desktop, bertumpuk di layar sempit, papan selalu utuh tanpa scroll.
- Aksesibilitas: narasi peristiwa lewat live region, jebakan fokus di modal, navigasi Spasi/Escape, kontras WCAG AA.

## Menjalankan

Buka index.html di browser. Tidak ada langkah build.

Karena font diambil dari CDN, disarankan memakai server statis lokal:

    python -m http.server 8000
    # lalu buka http://localhost:8000

PWA: kunjungi lewat https (GitHub Pages) atau localhost, lalu pasang dari menu browser. Setelah satu sesi online, seluruh aset tercache dan permainan tetap jalan tanpa koneksi.

Regenerasi ikon (favicon + PNG manifest) setelah mengubah palet:

    python scripts/make-favicon.py

## Cara bermain

1. Pilih Mulai Permainan, atur jumlah pemain dan mode di Pengaturan.
2. Klik dadu atau tekan Spasi saat giliranmu.
3. Petak tangga menaikkan pion, petak ular menurunkannya.
4. Mainkan kartu skill saat giliranmu. Satu efek aktif per waktu.
5. Pemain pertama yang mencapai petak 100 menang. Tekan Bagikan di kartu kemenangan untuk membagikan hasil.

## Struktur proyek

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

Urutan pemuatan: core.js -> icons.js -> audio.js -> (confetti.js, skills.js) -> game.js atau menu.js.
Semua modul berbagi satu namespace window.UT; tidak ada variabel global yang bocor.

## Teknologi

- Vanilla JavaScript (ES2020) dengan pola IIFE, tanpa dependensi runtime.
- OKLCH untuk seluruh token warna.
- CSS Grid dengan area bernama + container query (cqw) untuk tata letak papan.
- Web Audio API untuk seluruh suara.
- SVG inline untuk ikon dan jalur ular/tangga.
- Service Worker + Web App Manifest untuk PWA yang bisa dipasang dan offline.
- View Transitions API (cross-document), Wake Lock, Vibration, Web Share, Clipboard — semuanya peningkatan progresif.
- Google Fonts: Fraunces (judul), Karla (teks), Space Mono (label).

## Roadmap

- Multiplayer online lewat WebSocket atau WebRTC
- Tema papan dan pion yang bisa dipilih
- Tingkat kesulitan AI
- PWA agar bisa dimainkan offline (selesai)
- Mode turnamen dengan bagan pertandingan

## Kontribusi

1. Fork repositori ini.
2. Buat branch baru: git checkout -b feat/nama-fitur.
3. Commit: git commit -m 'feat: menambahkan fitur X'.
4. Push dan buka Pull Request.

Buka Issue untuk melaporkan bug atau mengusulkan fitur.

## Lisensi

Dirilis di bawah MIT License. Lihat berkas LICENSE.
