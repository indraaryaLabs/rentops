# RentOps — Acceptance Checklist

Status per akhir pengerjaan **versi 2 (overhaul lengkap)**. Setiap kotak hanya dicentang
setelah diverifikasi pada build produksi; hasil perintahnya dicatat apa adanya pada
bagian bawah. Kotak yang tidak dicentang berarti **belum** diverifikasi, bukan
lupa.

> Versi 1 dicatat terpisah di bagian "Riwayat versi 1" pada bagian bawah file ini.

---

## Product and interaction

- [x] Dasbor memakai nilai yang dihitung dari state aplikasi saat ini.
      → 4 KPI (reservasi aktif, unit bebas, pendapatan berjalan, piutang berjalan),
      lembar kerja, agenda tujuh hari, dan sparkline 14 hari dihitung di
      `domain/selektor.ts`; diuji di `selektor.test.ts` (11 test) dan di peramban.
- [x] Data demo ada pada luna pertama dan ditandai jelas sebagai data contoh.
      → 12 aset + 14 reservasi (Kendari), tanggal relatif terhadap hari ini;
      chip status simpan di bilah atas menampilkan sumber data; halaman Data &
      Cadangan menyebut "Data demo dibuat untuk perangkat ini".
- [x] Alur tambah, baca, ubah, hapus yang diminta PRD berjalan.
      → Aset: tambah/ubah/hapus/status; reservasi: tambah/ubah/hapus/status/
      perpanjang/lunasi/duplikat. Hapus aset yang masih berreservasi aktif ditolak
      dengan pesan penjelas.
- [x] Pencarian dan filter mengembalikan hasil yang benar.
      → `domain/filter.ts` murni: 14 test mencakup teks, status, 8 opsi periode,
      rentang kustom terbalik, fokus aset, dan 5 mode pengurutan.
- [x] Setiap tombol yang terlihat punya hasil nyata atau dinonaktifkan dengan alasan.
      → Tombol status di tabel hanya menampilkan langkah alur yang valid; tombol
      "Sewakan" pada aset pemeliharaan dinonaktifkan dengan `title` penjelas; tombol
      WhatsApp hanya muncul bila kontak bisa dinormalkan; ikon 15/17/14 px memakai
      prop `ikon` sehingga benar-benar tampil. Diperiksa juga secara otomatis:
      0 tombol/tautan terlihat tanpa nama aksesibel.
- [x] Nilai tidak valid menampilkan validasi inline Bahasa Indonesia yang jelas.
      → Galat per kolom pada formulir aset dan reservasi (kode ganda, stok, tanggal
      terbalik, DP, kapasitas, pemeliharaan, format kontak, jarak servis). Isi
      formulir tidak hilang saat gagal; Balk ketersediaan di luar galat menjelaskan
      penyebab penolakan dalam kalimat.
- [x] Tindakan merusak meminta konfirmasi.
      → Hapus reservasi, hapus aset, muat data demo, dan hapus semua data memakai
      dialog konfirmasi. (Batalkan reservasi sengaja tidak memakai dialog karena
      dapat dibatalkan seketika dengan Ctrl+Z; pilihan yang disengaja.)
- [x] Data bertahan setelah halaman dimuat ulang.
      → Diverifikasi di peramban: membuat reservasi → Ctrl+Z → Ctrl+Shift+Z →
      muat ulang → baris masih ada. Diperkuat di `backup.test.ts` lewat
      `simpanData`/`muatData` dengan penyimpanan tiruan.
- [x] Reset demo mengembalikan dataset contoh setelah konfirmasi.
      → Perintah `data/demo` melalui dialog konfirmasi di halaman Data & Cadangan;
      ditutup dengan `aturPreferensi` dan `tambahSnapshot` yang tidak merusak data
      lama di snapshot.
- [x] Ekspor berhasil; JSON yang diimpor divalidasi dan berkas buruk tidak merusak
      data yang ada.
      → `imporJSON()` melewati `migrasiData()` yang sama dengan penyimpanan. Berkas
      yang ditolak tidak pernah menyentuh state. Berkas yang **diterima kembali**
      sendiri — bug nyata yang ditemukan uji (lihat tabel di README).
- [x] Kasus tepi di `PRD.md` sudah diuji.
      → Rentang inklusif, minimum 1 hari, pembatalan tidak menahan stok, aset
      pemeliharaan, overbooking sebagian dan penuh, DP melebihi estimasi, tanggal
      terbalik, kode/nomor duplikat, jeda antar sewa, lompatan status, DP pada
      duplikat — semuanya punya test.
- [x] Papan Jadwal menjadi permukaan khas, bukan tabel biasa.
      → Grid baris-aset × kolom-hari dengan batang stok per sel; jendela 7/14/28
      hari; klik sel membuka formulir yang sudah terisi aset dan tanggal.
- [x] Otomasi semi-otomatis berjalan tanpa biaya dan tetap terkendali.
      → 6 aturan lokal (`domain/otomasi.ts`) menghasilkan saran yang bisa
      dijelaskan; tidak ada perubahan status tanpa tombol yang ditekan; tiap
      tindakan bisa dibatalkan.

## Visual quality

- [x] Teks antarmuka Bahasa Indonesia yang wajar; tidak ada lorem ipsum.
      → Seluruh antarmuka Bahasa Indonesia; data contoh realistis (Kendari).
- [x] Responsif pada 390 px, 820 px, dan 1440 px.
      → Diperiksa di peramban pada dua lebar sempit; rail berubah menjadi drawer
      di bawah 1080 px; papan jadwal memakai gulir horizontal; mode rapat menambah
      baris yang bisa tampil.
- [x] Tidak ada overflow horizontal pada kerangka dan dialog.
      → Diperiksa otomatis pada 390 px dan 820 px. Tabel desktop yang lebar memang
      dapat digeser, dan itu disengaja.
- [x] Fokus papan ketik, label, kontras, dan tombol ikon aksesibel tersedia.
      → Semua tombol ikon punya `aria-label` (terverifikasi otomatis); label form
      terhubung; dialog memakai `role="dialog"` + `aria-modal` + perangkap fokus
      Tab + Escape + pemulihan fokus ke pemicu + kunci gulir body; palet perintah
      memakai `role="dialog"` dengan penanda peran, fokus awal otomatis, dan navigasi panah.
- [x] Keadaan kosong, umpan balik sukses/gagal, dan perilaku memuat masuk akal.
      → Keadaan kosong informatif di semua daftar; toast mencerminkan log
      aktivitas; chip "Tersimpan / Tidak tersimpan" di bilah atas; aplikasi
      sepenuhnya lokal sehingga tidak ada keadaan memuat.
- [x] Tidak ada error konsol selama alur utama.
      → Konsol dan `pageerror` dipandu sepanjang 22 pemeriksaan: 0 error.

## Engineering

- [x] `npm run build` berhasil.
      → `tsc -b && vite build` sukses; JS 321 kB (gzip 94,9 kB), CSS 46,6 kB
      (gzip 9,1 kB), font 161 kB.
- [x] Type check, lint, dan test berhasil; hasilnya dicatat jujur.
      → `npm run typecheck`: 0 galat. `npm run lint`: 0 error, 4 warning yang
      disengaja. `npm test`: 13 berkas, 139 test lulus.
- [x] Aturan bisnis penting punya test terfokus.
      → 139 unit test; tabel pemetaan ada di README bagian 4.
- [x] Arsitektur berlapis: domain murni, aplikasi sebagai perintah, infrastruktur
      sebagai adapter, UI sebagai presentasi.
      → `domain/` tidak mengimpor React maupun DOM; `application/perintah.ts`
      adalah satu-satunya jalan perubahan state; `infrastructure/` satu-satunya
      modul yang menyentuh penyimpanan peramban.
- [x] README memuat cara pasang/jalankan/build dan keterbatasan.
      → Bagian 1, 5, 7, dan 8.
- [x] Tidak ada rahasia, kunci API berbayar, layanan berbayar, atau aset jarak
      jauh yang wajib.
      → Hanya dependensi gratis (React, lucide-react, Vite, Vitest, ESLint); font
      dibundel lokal di repo; favicon data-URI; nol panggilan jaringan saat
      runtime (hanya `wa.me` yang harus ditekan pengguna).
- [x] Aplikasi dijelaskan jujur sebagai demo portofolio local-first.
      → Disebut eksplisit di README bagian pembuka dan bagian 8, serta di footer
      setiap halaman.

## Belum diverifikasi (dicentang sengaja)

- [ ] Audit WCAG formal (audit_screen_reader, kontras terukur, uji dengan
      NVDA/VoiceOver). Yang dilakukan bersifat terarah: nama aksesibel tombol,
      label form, perangkap fokus, `aria-modal`, dan pemeriksaan kontras token.
- [ ] Pengujian di peramban selain Chromium. Lingkungan ini hanya menyediakan
      Chromium headless.
- [ ] Perilaku multi-tab (dua tab menulis ke penyimpanan yang sama) dan kuota
      localStorage penuh. Penyimpanan yang diblokir ditangani dengan pesan dan
      flag, tetapi belum ada uji otomatis untuk kasusnya.
- [ ] Uji beban data besar (misalnya > 5.000 reservasi). Papan jadwal dan tabel
      belum memakai virtualisasi.
- [ ] Jalur cetak (`window.print()`) dan dialog cetak bawaan peramban tidak
      diperiksa otomatis karena tidak dapat diotomatisasi dengan andal.
- [ ] Ekspor `.ics` tidak diuji terhadap aplikasi kalender sungguhan; yang diuji
      hanya bentuk teksnya (bendera VCALENDAR, pasangan BEGIN/END, DTEND).
- [ ] Tidak ada pengujian otomatis lapisan UI di dalam CI — repo hanya
      menjalankan unit test; pemeriksaan peramban dilakukan lewat skrip manual.
- [ ] Tidak ada git commit/push, sesuai instruksi.

---

## Hasil perintah (aktual)

| Perintah | Hasil |
| --- | --- |
| `npm run typecheck` | 0 galat |
| `npm run lint` | 0 error, 4 warning (`react-refresh/only-export-components`, disengaja) |
| `npm test` | 13 berkas, 139 test lulus, 0 gagal |
| `npm run build` | sukses, `dist/` terbentuk |
| `cek-browser.py` (Playwright, build produksi) | 22/22 pemeriksaan lulus, 0 error konsol |

### Bug nyata yang ditemukan selama pengerjaan versi 2

| Temuan | Diperbaiki |
| --- | --- |
| `muatData()` memvalidasi string mentah tanpa parse → setiap muat ulang membuang data | Satu gerbang `migrasiData()` untuk penyimpanan dan impor |
| `reservasi/perpanjang` tidak pernah mengubah tanggal | Pemetaan eksplisit + uji regresi |
| Overbooking hanya dicek di formulir | Gerbang `periksaKetersediaan()` di `terapkanPerintah()` |
| Lompatan status mungkin lewat perintah | `bisaTransisi()` |
| `reservasi/duplikat` menyalin DP lama | DP direset ke nol |
| Ekspor JSON ditolak saat diimpor kembali | Unwrap amplop menerima `versi`, `skema`, `dibuatPada` |
| `Tombol` `hanyaIkon` menampilkan kotak kosong di 8 lokasi | Ikon lewat prop `ikon` |
| `hitungSubtotal()` memberi harga untuk rentang terbalik | `rentangValid()` |
| `parseRupiah('150rb')` menjadi 150 | Pendekatan rb/ribu/jt/k |
| Judul dan subjudul palet menempel tanpa jarak | `flex-direction` pada `.palet__teks` |
| Label/nilai kartu aset menempel menjadi satu baris | `display: block` + lebar kartu 300 px |

---

## Riwayat versi 1

Versi pertama (sebelum overhaul) achieves **PASS WITH LIMITATIONS** dengan 122 unit
test, 50/50 pemeriksaan peramban, dan data 10 aset + 12 reservasi. Versi 2
mengganti seluruhnya: arsitektur berlapis, Papan Jadwal, palet perintah, undo/redo,
riwayat aktivitas, snapshot, mesin otomasi, dan sistem desain baru.