/**
 * Demo dataset.
 *
 * Generated relative to "today" so the product always opens on a live-looking
 * operation: hand-overs due today, a return due today, one overdue booking, an
 * ageing soft-hold request, and an asset in maintenance. Every row respects the
 * availability rules — no seeded booking ever exceeds its asset's stock.
 */

import type { Aset, DataAplikasi, Reservasi, StatusAset } from './types';
import { PROFIL_AWAL } from './types';
import { hariIni, sekarangISO, tambahHari } from './tanggal';
import { hitungSubtotal, normalisasiDP } from './sewa';
import { idDemo } from './id';

interface BibitAset {
  kode: string;
  nama: string;
  kategori: Aset['kategori'];
  unit: number;
  harga: number;
  status?: StatusAset;
  servis?: number;
  catatan: string;
}

const BIBIT_ASET: BibitAset[] = [
  {
    kode: 'KND-01',
    nama: 'Toyota Avanza 2021',
    kategori: 'Kendaraan',
    unit: 3,
    harga: 350_000,
    servis: 45,
    catatan: 'Unit silver, kapasitas 7 penumpang. STNK dan kunci cadangan ikut disewa.',
  },
  {
    kode: 'KND-02',
    nama: 'Honda Beat 2022',
    kategori: 'Kendaraan',
    unit: 4,
    harga: 90_000,
    catatan: 'Motor matic. Dua helm dan kunci cadangan selalu disertakan.',
  },
  {
    kode: 'KND-03',
    nama: 'Mitsubishi L300 Box',
    kategori: 'Kendaraan',
    unit: 1,
    harga: 500_000,
    catatan: 'Mobil barang 2 ton. Penyewa wajib menyertakan SIM B1.',
  },
  {
    kode: 'PRL-01',
    nama: 'Vibrator Beton PD-40',
    kategori: 'Peralatan',
    unit: 3,
    harga: 150_000,
    catatan: 'Selang 6 meter dan kepala getar 35 mm.',
  },
  {
    kode: 'PRL-02',
    nama: 'Genset Yanmar 5 kVA',
    kategori: 'Peralatan',
    unit: 2,
    harga: 275_000,
    status: 'Pemeliharaan',
    catatan: 'Servis berkala 250 jam operasi, diperkirakan aktif lagi pekan depan.',
  },
  {
    kode: 'PRL-03',
    nama: 'Bor Beton Bosch GBH 2-26',
    kategori: 'Peralatan',
    unit: 2,
    harga: 175_000,
    catatan: 'Mata bor 8 mm dan 10 mm tersedia terpisah.',
  },
  {
    kode: 'ELK-01',
    nama: 'Proyektor Epson EB-X51',
    kategori: 'Elektronik',
    unit: 4,
    harga: 125_000,
    catatan: '3.600 lumen, termasuk kabel HDMI dan layar tripod.',
  },
  {
    kode: 'ELK-02',
    nama: 'Sound System 8.000 Watt',
    kategori: 'Elektronik',
    unit: 2,
    harga: 450_000,
    catatan: 'Dua speaker, mixer, dan dua mikrofon wireless.',
  },
  {
    kode: 'PA-01',
    nama: 'Tenda Kerucut 5 x 5 m',
    kategori: 'Perlengkapan Acara',
    unit: 6,
    harga: 75_000,
    catatan: 'Kain tebal, termasuk pasak dan palu.',
  },
  {
    kode: 'PA-02',
    nama: 'Kursi Tiffany + Sarung',
    kategori: 'Perlengkapan Acara',
    unit: 120,
    harga: 5_000,
    catatan: 'Stok besar, tersedia warna putih dan gold.',
  },
  {
    kode: 'AKS-01',
    nama: 'Scaffolding Frame 1,7 m',
    kategori: 'Alat Konstruksi',
    unit: 20,
    harga: 35_000,
    catatan: 'Satuan 10 frame, termasuk pin dan mur.',
  },
  {
    kode: 'AKS-02',
    nama: 'Jack Hydraulic 5 Ton',
    kategori: 'Alat Konstruksi',
    unit: 2,
    harga: 95_000,
    catatan: 'Pompa tangan. Cek kebocoran oli sebelum disewa.',
  },
];

interface BibitReservasi {
  kode: string;
  pelanggan: string;
  kontak: string;
  aset: string;
  unit: number;
  mulai: number;
  selesai: number;
  dp: number;
  status: Reservasi['status'];
  catatan: string;
  umurHari: number;
}

const BIBIT_RESERVASI: BibitReservasi[] = [
  {
    kode: 'RSV-1041',
    pelanggan: 'Bapak Agus Setiawan',
    kontak: '0812 3456 7890',
    aset: 'KND-01',
    unit: 1,
    mulai: -4,
    selesai: 1,
    dp: 500_000,
    status: 'Dipinjam',
    catatan: 'Keperluan keluarga ke luar kota. STNK dan kunci cadangan ikut dibawa.',
    umurHari: 6,
  },
  {
    kode: 'RSV-1042',
    pelanggan: 'Ibu Ratna Kusumawardani',
    kontak: '0813 2211 9087',
    aset: 'KND-02',
    unit: 2,
    mulai: 0,
    selesai: 2,
    dp: 200_000,
    status: 'Dipesan',
    catatan: 'Pengambilan siang ini, dibutuhkan dua helm tambahan.',
    umurHari: 3,
  },
  {
    kode: 'RSV-1043',
    pelanggan: 'CV. Bina Sakti Mandiri',
    kontak: '0821 8890 1234',
    aset: 'ELK-01',
    unit: 3,
    mulai: -1,
    selesai: 3,
    dp: 600_000,
    status: 'Dipinjam',
    catatan: 'Presentasi klien di hotel. Unit sudah diuji sebelum dikirim.',
    umurHari: 4,
  },
  {
    kode: 'RSV-1044',
    pelanggan: 'Bapak Hendra Wijaya',
    kontak: '0852 4410 7766',
    aset: 'KND-03',
    unit: 1,
    mulai: -6,
    selesai: -2,
    dp: 1_000_000,
    status: 'Dipinjam',
    catatan: 'Belum ada kabar pengembalian, sudah dihubungi dua kali.',
    umurHari: 8,
  },
  {
    kode: 'RSV-1045',
    pelanggan: 'Komunitas Roda Kendari',
    kontak: '0811 5520 3311',
    aset: 'AKS-01',
    unit: 10,
    mulai: 1,
    selesai: 9,
    dp: 700_000,
    status: 'Dipesan',
    catatan: 'Perbaikan atap musala. Perlu panduan pemasangan saat orientasi.',
    umurHari: 2,
  },
  {
    kode: 'RSV-1046',
    pelanggan: 'SMP Negeri 5 Kendari',
    kontak: '0404 123456',
    aset: 'PA-02',
    unit: 40,
    mulai: 3,
    selesai: 5,
    dp: 600_000,
    status: 'Dipesan',
    catatan: 'Acara perpisahan kelas 9. Sudah DP penuh.',
    umurHari: 5,
  },
  {
    kode: 'RSV-1047',
    pelanggan: 'SMP Negeri 5 Kendari',
    kontak: '0404 123456',
    aset: 'PA-01',
    unit: 4,
    mulai: 3,
    selesai: 5,
    dp: 450_000,
    status: 'Dipesan',
    catatan: 'Area park sekolah, akses jalan bisa dilalui mobil.',
    umurHari: 5,
  },
  {
    kode: 'RSV-1048',
    pelanggan: 'Bapak La Ode Rahman',
    kontak: '0878 6654 2210',
    aset: 'KND-01',
    unit: 1,
    mulai: 6,
    selesai: 8,
    dp: 250_000,
    status: 'Permintaan',
    catatan: 'Menunggu konfirmasi ketersediaan sopir opsional.',
    umurHari: 4,
  },
  {
    kode: 'RSV-1049',
    pelanggan: 'Hotel Oebufu',
    kontak: '0812 9988 4455',
    aset: 'PA-01',
    unit: 2,
    mulai: -9,
    selesai: -6,
    dp: 300_000,
    status: 'Dibatalkan',
    catatan: 'Acara klien mundur, DP dikembalikan utuh.',
    umurHari: 12,
  },
  {
    kode: 'RSV-1050',
    pelanggan: 'Bapak Yusuf Mando',
    kontak: '0812 5566 7788',
    aset: 'ELK-02',
    unit: 1,
    mulai: -12,
    selesai: -9,
    dp: 900_000,
    status: 'Dikembalikan',
    catatan: 'Dikembalikan tepat waktu, semua peralatan lengkap.',
    umurHari: 15,
  },
  {
    kode: 'RSV-1051',
    pelanggan: 'Ibu Sinar Wati',
    kontak: '0822 3344 5566',
    aset: 'PRL-01',
    unit: 2,
    mulai: -4,
    selesai: -1,
    dp: 600_000,
    status: 'Dikembalikan',
    catatan: 'Proyek kecil di Jalan Ahmad Yani.',
    umurHari: 6,
  },
  {
    kode: 'RSV-1052',
    pelanggan: 'Bapak Rendra Saputra',
    kontak: '0857 9001 2233',
    aset: 'KND-01',
    unit: 1,
    mulai: -1,
    selesai: 1,
    dp: 350_000,
    status: 'Dipesan',
    catatan: 'Berangkat bersamaan pak Agus; dua unit Avanza terpakai.',
    umurHari: 2,
  },
  {
    kode: 'RSV-1053',
    pelanggan: 'Bengkel Sumber Rejek',
    kontak: '0813 7777 1122',
    aset: 'PRL-03',
    unit: 2,
    mulai: 0,
    selesai: 2,
    dp: 350_000,
    status: 'Dipesan',
    catatan: 'Pengecoran lantai workshop, diambil pagi sebelum jam 10.',
    umurHari: 1,
  },
  {
    kode: 'RSV-1054',
    pelanggan: 'Kelurahan Abeli',
    kontak: '0821 4545 6767',
    aset: 'AKS-02',
    unit: 2,
    mulai: 0,
    selesai: 3,
    dp: 300_000,
    status: 'Dipinjam',
    catatan: 'Pengerjaan drainase sisi jalan. Pengembalian sebelum Jumat.',
    umurHari: 3,
  },
];

export function buatDataDemo(sekarang: Date = new Date()): DataAplikasi {
  const acuan = hariIni(sekarang);
  const waktu = sekarangISO(sekarang);

  const aset: Aset[] = BIBIT_ASET.map((bibit, index) => ({
    id: idDemo(index, 'ast'),
    kode: bibit.kode,
    nama: bibit.nama,
    kategori: bibit.kategori,
    jumlahTersedia: bibit.unit,
    hargaPerHari: bibit.harga,
    statusPemeliharaan: (bibit.status ?? 'Aktif'),
    catatan: bibit.catatan,
    jarakServisHari: (bibit.servis ?? null),
    dibuatPada: waktu,
    diperbaruiPada: waktu,
  }));

  const petaKode = new Map(aset.map((item) => [item.kode, item]));

  const reservasi: Reservasi[] = BIBIT_RESERVASI.map((bibit, index) => {
    const barang = petaKode.get(bibit.aset);
    if (!barang) throw new Error(`Data demo merujuk aset yang tidak ada: ${bibit.aset}`);
    const tanggalMulai = tambahHari(acuan, bibit.mulai);
    const tanggalSelesai = tambahHari(acuan, bibit.selesai);
    const subtotal = hitungSubtotal(bibit.unit, barang.hargaPerHari, {
      mulai: tanggalMulai,
      selesai: tanggalSelesai,
    });
    return {
      id: idDemo(index, 'rsv'),
      kode: bibit.kode,
      pelanggan: bibit.pelanggan,
      kontak: bibit.kontak,
      asetId: barang.id,
      jumlah: bibit.unit,
      tanggalMulai,
      tanggalSelesai,
      dp: normalisasiDP(bibit.dp, subtotal),
      status: bibit.status,
      catatan: bibit.catatan,
      dibuatPada: new Date(sekarang.getTime() - bibit.umurHari * 86_400_000).toISOString(),
      diperbaruiPada: waktu,
      diserahkanPada:
        bibit.status === 'Dipinjam' || bibit.status === 'Dikembalikan'
          ? new Date(sekarang.getTime() - (bibit.umurHari - 1) * 86_400_000).toISOString()
          : null,
      dikembalikanPada:
        bibit.status === 'Dikembalikan'
          ? new Date(sekarang.getTime() - 2 * 86_400_000).toISOString()
          : null,
    };
  });

  return {
    skema: 2,
    profil: {
      ...PROFIL_AWAL,
      nama: 'Rental Kendari Jaya',
      telepon: '0812 4000 1234',
      alamat: 'Jl. Sultan Hasanuddin No. 45, Kendari, Sulawesi Tenggara',
      catatan: 'Kontrak standar satu halaman. DP minimal 25% saat konfirmasi.',
    },
    aset,
    reservasi,
  };
}

