# RentOps — Ruang Kendali Rental & Ketersediaan Aset

Aplikasi front-end **local-first** untuk usaha kecil rental di Indonesia: mengelola
aset, menjadwalkan reservasi, dan mencegah double-booking berdasarkan ketersediaan
unit — semuanya berjalan di peramban, tanpa akun, tanpa server, tanpa biaya.

RentOps adalah **demo portofolio**, bukan produk SaaS multi-pengguna. Seluruh data
tinggal di penyimpanan lokal peramban.

---

## 1. Menjalankan aplikasi

Prasyarat: **Node.js 20.19+ atau 22.12+** (diuji pada Node 24.19) dan npm 10+.

```bash
npm install        # pasang dependensi
npm run dev        # jalankan server pengembangan → http://localhost:5173
npm run build      # type-check + build produksi ke folder dist/
npm run preview    # jalankan hasil build → http://localhost:4173
```

Perintah pendukung:

| Perintah             | Kegunaan                                           |
| -------------------- | -------------------------------------------------- |
| `npm run typecheck`  | Pemeriksaan tipe (`tsc -b`, strict, termasuk test) |
| `npm run lint`       | ESLint + typescript-eslint (flat config)           |
| `npm test`           | Unit test aturan bisnis (vitest, 139 test)        |
| `npm run test:watch` | Mode watch untuk test                              |

Tidak ada variabel lingkungan, API key, atau berkas konfigurasi tambahan. Tidak ada
panggilan jaringan saat aplikasi berjalan.

---

## 2. Yang membedakan versi ini

### Papan Jadwal — permukaan khas

Baris adalah aset, kolom adalah hari, setiap sel menampilkan *batang stok*: berapa
unit yang sudah tertahan pada hari itu. Jendela 7/14/28 hari, geser maju/mundur,
saring per kondisi. **Menekan sel langsung membuka formulir reservasi yang sudah
terisi aset dan tanggalnya** — mengubah pertanyaan "apakah unit ini kosong?"
menjadi aksi dua detik.

Referensi yang ditiru: timeline ketersediaan Booqable, papan sumber daya Rentman
(kode warna + jumlah), dan heatmap utilisasi Resource Guru.

### Ruang kendali, bukan dasbor generik

- Palet perintah **Ctrl+K** yang bisa mencari aset/reservasi, membuka halaman,
  menjalankan setiap aksi yang ada di produk, dan menyalakan tema/kepadatan/rail.
- **Undo 25 langkah** (Ctrl+Z) dan redo (Ctrl+Shift+Z). Setiap perubahan menulis
  satu baris di riwayat aktivitas beserta waktu dan apakah bisa dibatalkan.
- Tema terang/gelap, mode kepadatan, rail yang bisa ditipiskan — semuanya
  tersimpan otomatis di perangkat.
- Tipografi rapat: Inter Variable + IBM Plex Mono **dibundel lokal** (161 kB,
  tanpa permintaan jaringan), satu aksen petrol `#0d6b5e`, rail gelap di kiri,
  tabel padat — bukan kumpulan kartu statistik berwarna.

Referensi yang ditiru: kalem krom Linear/Vercel/Stripe, palet perintah, dan
pola Bahasa Indonesia Majoo/Kasir Pintar/POST.

### Otomasi yang menjelaskan dirinya

Aturan berjalan lokal dan **tidak pernah mengubah data tanpa persetujuan**.
Setiap saran menyebut barang mana, kenapa penting, dan tindakan apa yang akan
dijalankan kalau tombolnya ditekan:

| Aturan | Contoh saran | Tindakan |
| --- | --- | --- |
| Pengembalian lewat tanggal | "RSV-1044 terlambat 2 hari" | Terima kembali / Perpanjang 1 hari |
| Pengambilan terjadwal hari ini | "Serahkan RSV-1042 hari ini" | Ubah status ke Dipinjam |
| Permintaan menunggu lebih dari 2 hari | "RSV-1048 menunggu 4 hari" | ACC / Batalkan |
| Sisa pembayaran setelah periode | "RSV-1050 masih punya sisa Rp 900.000" | Tandai lunas |
| Aset mendekati jadwal servis | "AST-01 waktunya servis berkala" | Tandai Pemeliharaan |

Setiap hasil selalu bisa dibatalkan dengan Ctrl+Z.

---

## 3. Fitur

### Dasbor

- Ringkasan salam per jam + tanggal panjang, dan kalimat yang menyebut tugas
  konkret hari ini (terlambat, perlu diserahkan, perlu diterima).
- Empat KPI dari state nyata: reservasi aktif, unit bebas hari ini, pendapatan
  berjalan (dengan sparkline 14 hari), dan piutang berjalan.
- **Lembar kerja** berurutan tindakan: terlambat, perlu diserahkan, perlu
  diterima, dengan tombol aksi langsung di setiap baris, plus tombol cetak.
- Agenda tujuh hari ke depan dan daftar aset paling tersewa.

### Reservasi

- Nomor otomatis (`RSV-1001`), pelanggan, kontak, aset, jumlah unit, rentang
  tanggal, DP, status, catatan.
- **Ketersediaan dan harga dihitung langsung** saat mengetik: lama sewa, estimasi,
  DP, sisa bayar, dan balk "ketersediaan cukup / tidak cukup" yang menyebut
  penyebabnya.
- Alur status: **Permintaan, Dipesan, Dipinjam, Dikembalikan**, dengan pembatalan
  dari Permintaan/Dipesan. Tombol di tabel hanya menampilkan langkah yang valid.
- Dialog detail berisi riwayat serah-terima, perpanjang 1/7 hari, tandai lunas,
  duplikat (status kembali ke Permintaan dan DP ke nol), cetak nota, salin pesan
  WhatsApp, dan unduh `.ics` untuk kalender.

### Aset

- Kartu berisi unit, unit bebas, harga per hari, meter pemakaian hari ini, dan
  catatan. Urutkan menurut nama, kode, harga, atau paling sering disewa.
- Status **Pemeliharaan** menahan pemesanan dan tidak menambah unit bebas.
- Detail aset menampilkan pemakaian 14 hari ke depan dan reservasi terbaru.

### Data & Cadangan

- Profil usaha (ikut tercetak di nota, lembar kerja, dan pesan WhatsApp).
- Preferensi: tema, kepadatan, **jeda antar sewa**, ambang servis.
- Ekspor/impor JSON, ekspor kalender `.ics`, cetak lembar kerja dan jadwal 28 hari.
- **Snapshot otomatis** 12 slot; setiap perubahan data menyimpan satu, dan
  snapshot bisa diunduh atau dipulihkan.
- Riwayat aktivitas 40 entri terakhir.

---

## 4. Aturan bisnis (dan di mana diuji)

| Aturan | Implementasi | Test |
| --- | --- | --- |
| Rentang sewa inklusif, jendela tertutup | `domain/tanggal.ts`, `domain/ketersediaan.ts` | `tanggal.test.ts`, `ketersediaan.test.ts` |
| Permintaan/Dipesan/Dipinjam menahan stok; Dikembalikan melepas | `STATUS_MENAHAN_STOK` | `ketersediaan.test.ts` |
| Aset Pemeliharaan tidak bisa dipesan | `periksaKetersediaan()` | `ketersediaan.test.ts` |
| Overbooking ditolak di formulir **dan** di perintah | `validasiFormReservasi()`, `terapkanPerintah()` | `validasi.test.ts`, `perintah.test.ts` |
| Jeda antar sewa memperluas jendela tiap reservasi | `jendelaTerpakai()` | `ketersediaan.test.ts`, `perintah.test.ts` |
| Estimasi = jumlah x harga/hari x hari sewa | `domain/sewa.ts` | `sewa.test.ts` |
| DP tidak melebihi estimasi; sisa tidak negatif | `normalisasiDP()` | `sewa.test.ts`, `validasi.test.ts` |
| Tidak boleh lompati langkah status | `bisaTransisi()` di `terapkanPerintah()` | `alur.test.ts`, `perintah.test.ts` |
| Stok aset tidak boleh turun di bawah unit tersewa | `validasiFormAset()` | `validasi.test.ts` |
| Data lokal rusak tidak menghapus pengguna | `muatData()` jatuh ke demo | `backup.test.ts` |
| Impor melewati satu gerbang validasi yang sama | `migrasiData()` | `backup.test.ts` |
| Nota meloloskan HTML dari masukan pengguna | `escapeHTML()` di `cetak.ts` | `cetak.test.ts` |

### Keputusan interpretasi (dinyatakan eksplisit)

- **Status yang menahan stok: `Permintaan`, `Dipesan`, `Dipinjam`.** Reservasi
  `Dikembalikan` dianggap unit sudah kembali sehingga tidak lagi memakan kapasitas.
- **`Dikembalikan` melepas stok meski periode belum lewat.** Ini membuat alur
  "kembalikan lebih awal" benar-benar tersedia; konsekuensinya, piutang dihitung
  dari DP yang tercatat, bukan dari tanggal pengembalian.
- **Jeda antar sewa, default 0 hari**, sehingga perilaku bawaan sama persis dengan
  PRD. Saat diisi, jendela setiap reservasi yang menahan stok melebar +/- N hari —
  termasuk di pratinjau formulir dan di gerbang perintah.
- **DP maksimal sama dengan estimasi sewa.**
- **Impor menolak berkas yang berisi satu baris rusak** — lebih baik gagal terang
  daripada mengimpor data setengah jadi. Berkas yang ditolak tidak mengubah apa pun.
- **Halaman aktif tidak disimpan di URL**; muat ulang selalu kembali ke Dasbor
  (data tetap tersimpan).

---

## 5. Arsitektur

```
src/
+- main.tsx                 StrictMode -> AppStore -> App
+- app/
|  +- App.tsx               perakitan: rute, dialog, pintasan papan ketik
|  +- Shell.tsx             rail, bilah atas, pemicu palet
+- domain/                  murni, tanpa React, tanpa DOM
|  +- types.ts              Aset, Reservasi, Preferensi, enum
|  +- tanggal.ts            aritmetika tanggal lokal + format id-ID
|  +- uang.ts               rupiah, angka, persen, parser input manusia
|  +- sewa.ts               subtotal, DP, perpanjangan, keterlambatan
|  +- ketersediaan.ts       jendela terpakai, buffer, gerbang overbooking
|  +- alur.ts               transisi status + tanda waktu serah-terima
|  +- filter.ts             pencarian, filter, pengurutan (fungsi murni)
|  +- selektor.ts           metrik dasbor, papan jadwal, agenda harian
|  +- otomasi.ts            mesin aturan -> Saran[] yang bisa dijelaskan
|  +- validasi.ts           validasi form aset & reservasi
|  +- seed.ts               data demo relatif terhadap hari ini
+- application/
|  +- perintah.ts           union perintah + terapkanPerintah() (murni)
|  +- toko.tsx              store: undo/redo, snapshot, log, saran
+- infrastructure/
|  +- db.ts                 amplop berversi, snapshot, adapter localStorage
|  +- migrasi.ts            satu gerbang validasi untuk semua data masuk
|  +- backup.ts             ekspor/impor JSON
|  +- ics.ts                ekspor kalender
|  +- cetak.ts              nota, lembar kerja, laporan jadwal
|  +- sistem.ts             papan klip, WhatsApp, tema, fokus
+- ui/
|  +- primitif.tsx          Tombol, Panel, Metrik, Meter, Lencana, Kosong
|  +- form.tsx              Kolom, Dialog, Konfirmasi
|  +- notifikasi.tsx        toast yang mencerminkan log aktivitas
|  +- palet.tsx             palet perintah + papan pintasan
|  +- gaya/                 token.css, dasar, tata, komponen, halaman
+- features/                satu folder per halaman: dasbor, jadwal, reservasi,
                            aset, otomasi, data
```

Prinsip yang dijaga:

- **Logika bisnis tidak pernah di dalam komponen.** Semuanya berada di `domain/`
  dan `application/`, sehingga dapat diuji tanpa browser.
- **Satu jalan untuk setiap perubahan.** UI tidak pernah mengubah state langsung;
  ia mengirim `Perintah`, dan `terapkanPerintah()` yang memutuskan berhasil atau
  gagal. Itulah yang membuat undo/redo, log aktivitas, palet perintah, dan
  otomasi semuanya gratis dari satu disiplin.
- **Pemeriksaan availability berlapis.** Form menampilkan pratinjau,
  `terapkanPerintah()` menegakkan ulang. Ini yang menutup celah double-booking saat
  jeda antar sewa aktif.
- **Tidak ada `any`.** Tipe didefinisikan di `domain/types.ts` dengan `strict`,
  `noUnusedLocals`, dan `verbatimModuleSyntax` aktif.
- **Tanpa aset eksternal saat runtime**: ikon `lucide-react`, font dibundel lokal,
  favicon berupa SVG data-URI.
- **Tanpa layanan berbayar**: tidak ada API key, backend, font berbayar, atau
  panggilan jaringan apa pun.

---

## 6. Bukti pengujian

Semua perintah di bawah dijalankan di folder ini; hasilnya dicatat apa adanya.

| Perintah            | Hasil                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| `npm test`          | 13 berkas, **139 test lulus**, 0 gagal (sekitar 2 detik)                    |
| `npm run typecheck` | `tsc -b` tanpa galat (strict + `noUnusedLocals` + `verbatimModuleSyntax`)   |
| `npm run lint`      | 0 error; 4 warning `react-refresh` yang disengaja (konteks dan komponen di satu berkas) |
| `npm run build`     | `tsc -b && vite build` -> `dist/` (JS 321 kB / gzip 94,9 kB, CSS 46,6 kB / gzip 9,1 kB, font 161 kB) |

Cakupan unit test: aritmetika dan format tanggal, inklusivitas rentang, format dan
parser rupiah, perhitungan sewa dan DP, ketersediaan dengan buffer, alur status,
validasi form aset dan reservasi, filter/pencarian/pengurutan, metrik dasbor dan
papan jadwal, mesin otomasi, seluruh perintah aplikasi (termasuk gerbang
overbooking dan transisi), migrasi + ekspor/impor + penyimpanan tiruan, ekspor
kalender, dan dokumen siap cetak.

### Verifikasi manual di peramban (Playwright)

`cek-browser.py` berisi **22 pemeriksaan otomatis** terhadap build produksi:

```bash
npm run build
npx vite preview --port 5211 --strictPort
$env:RENTOPS_PORT="5211"; python cek-browser.py
```

Hasil terakhir: **22/22 pemeriksaan lulus, 0 error konsol**, mencakup:

- dasbor termuat, 4 KPI terisi, lembar kerja berisi tugas;
- keenam halaman termuat lewat rail;
- palet perintah terbuka dengan Ctrl+K dan bisa disaring;
- dialog reservasi baru dan dialog detail reservasi terbuka, Escape menutup dialog;
- tema gelap benar-benar berganti (latar `#0d0e11`);
- membuat reservasi baru, muncul di tabel, Ctrl+Z menghapus, Ctrl+Shift+Z
  mengulang, lalu **data tetap ada setelah muat ulang** (uji persistensi nyata);
- semua tombol dan tautan punya nama aksesibel;
- tata letak 390 px dan 820 px tanpa overflow;
- nol error konsol dan nol `pageerror` sepanjang sesi.

> Tangkapan layar yang dihasilkan skrip tidak disertakan agar folder proyek tetap
> ringan.

### Bug nyata yang ditemukan oleh pengujian ini

| Temuan | Perbaikan |
| --- | --- |
| `muatData()` memvalidasi string mentah tanpa parse sehingga setiap muat ulang membuang data tersimpan | Satu gerbang `migrasiData()` untuk penyimpanan dan impor |
| `reservasi/perpanjang` tidak pernah mengubah tanggal (spread memakai `mulai`/`selesai`, bukan `tanggalMulai`/`tanggalSelesai`) | Pemetaan eksplisit plus uji yang memeriksa tanggal baru |
| Overbooking hanya dicek di formulir, bukan di perintah | `terapkanPerintah()` menjalankan `periksaKetersediaan()` dengan jeda preferensi |
| Lompatan status mungkin terjadi lewat perintah | Gerbang `bisaTransisi()` |
| `reservasi/duplikat` menyalin DP lama ke Reservasi baru | DP direset ke nol |
| Impor berkas cadangan sendiri ditolak (amplop `skema`, pemeriksa hanya membuka `versi`) | Unwrap menerima `versi`, `skema`, dan `dibuatPada` |
| Tombol `hanyaIkon` di 8 lokasi tidak menampilkan ikon | Kontrak `Tombol` diperjelas: ikon lewat prop `ikon` |
| `hitungSubtotal()` memberi harga untuk rentang terbalik | Divalidasi lewat `rentangValid()` |
| `parseRupiah('150rb')` menjadi 150 | Pendekatan rb/ribu/jt/k ditambahkan |

---

## 7. Mengembalikan data demo

1. Buka **Data & Cadangan**.
2. Tekan **Muat data demo**.
3. Konfirmasi.

Alternatif non-interaktif: hapus kunci `rentops.data.v2` dari localStorage peramban
(DevTools > Application > Local Storage).

Data demo berisi 12 aset dan 14 reservasi dengan tanggal yang selalu relatif
terhadap hari ini, sehingga Dasbor langsung menampilkan agenda hari ini, sebuah
reservasi terlambat, dan aset yang sedang pemeliharaan.

---

## 8. Keterbatasan yang diketahui

- **Satu operator, satu perangkat.** Tidak ada akun, peran, sinkronisasi antar
  perangkat, atau kolaborasi. Data hilang bila penyimpanan peramban dihapus.
- **Tidak ada penagihan maupun pelaporan keuangan.** DP hanya dicatat sebagai
  angka; tidak ada invoice, kwitansi, atau pembukuan.
- **Tidak ada pengingat.** Deteksi keterlambatan hanya muncul saat aplikasi
  dibuka; tidak ada push, email, SMS, atau WhatsApp otomatis.
- **Tombol WhatsApp hanya membuka `wa.me`.** Pesan belum terkirim sampai pengguna
  menekan tombol kirim di aplikasi WhatsApp.
- **Riwayat undo hanya satu sesi.** Snapshot bertahan lintas muat ulang, tetapi
  tumpukan undo/redo direset — itu perilaku yang diharapkan untuk undo di memori.
- **Tidak ada pengujian otomatis pada lapisan UI di dalam CI.** Repo hanya
  menjalankan unit test; pemeriksaan peramban dilakukan lewat skrip.
- **Tabel lebar memang bisa digeser horizontal** di layar sempit pada tabel
  desktop; papan jadwal memakai gulir horizontal dan mode rapat menambah baris
  yang bisa tampil.
- **Belum diuji di peramban selain Chromium** (hanya Chromium headless yang
  tersedia di lingkungan ini).
- **Fotografi produk dan logo belum ada.** Tidak ada aset eksternal saat runtime
  demi prinsip biaya nol.