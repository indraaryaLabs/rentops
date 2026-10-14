import { describe, expect, it } from 'vitest';
import type { Aset, Reservasi } from './types';
import {
  filterKosong,
  saringAset,
  saringReservasi,
  urutkanReservasi,
  type FilterReservasi,
} from './filter';

const aset: Aset[] = [
  {
    id: 'a1',
    kode: 'AST-01',
    nama: 'Tenda Dome',
    kategori: 'Perlengkapan Acara',
    jumlahTersedia: 3,
    hargaPerHari: 100_000,
    statusPemeliharaan: 'Aktif',
    jarakServisHari: null,
    catatan: 'kapasitas 6 orang',
    dibuatPada: '2026-01-01T00:00:00.000Z',
    diperbaruiPada: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'a2',
    kode: 'AST-02',
    nama: 'Kursi Tiffany',
    kategori: 'Perlengkapan Acara',
    jumlahTersedia: 50,
    hargaPerHari: 2_000,
    statusPemeliharaan: 'Pemeliharaan',
    jarakServisHari: 90,
    catatan: 'warna putih',
    dibuatPada: '2026-01-01T00:00:00.000Z',
    diperbaruiPada: '2026-01-01T00:00:00.000Z',
  },
];

const reservasi: Reservasi[] = [
  {
    id: 'r1',
    kode: 'RSV-1001',
    asetId: 'a1',
    pelanggan: 'Bapak Agus',
    kontak: '0812 1111 2222',
    jumlah: 2,
    tanggalMulai: '2026-10-10',
    tanggalSelesai: '2026-10-12',
    dp: 0,
    status: 'Dipinjam',
    catatan: 'diantar sore',
    dibuatPada: '2026-01-01T00:00:00.000Z',
    diperbaruiPada: '2026-01-01T00:00:00.000Z',
    diserahkanPada: null,
    dikembalikanPada: null,
  },
  {
    id: 'r2',
    kode: 'RSV-1002',
    asetId: 'a2',
    pelanggan: 'Ibu Ratna',
    kontak: '',
    jumlah: 10,
    tanggalMulai: '2026-11-02',
    tanggalSelesai: '2026-11-03',
    dp: 500_000,
    status: 'Permintaan',
    catatan: '',
    dibuatPada: '2026-01-01T00:00:00.000Z',
    diperbaruiPada: '2026-01-01T00:00:00.000Z',
    diserahkanPada: null,
    dikembalikanPada: null,
  },
  {
    id: 'r3',
    kode: 'RSV-1003',
    asetId: 'a1',
    pelanggan: 'Bengkel Sumber Rejek',
    kontak: '0813 7777 1122',
    jumlah: 1,
    tanggalMulai: '2026-09-01',
    tanggalSelesai: '2026-09-02',
    dp: 0,
    status: 'Dikembalikan',
    catatan: '',
    dibuatPada: '2026-01-01T00:00:00.000Z',
    diperbaruiPada: '2026-01-01T00:00:00.000Z',
    diserahkanPada: null,
    dikembalikanPada: '2026-09-02T10:00:00.000Z',
  },
];

const peta = new Map(aset.map((item) => [item.id, item]));
const HARI_INI = '2026-10-14';

describe('filter reservasi', () => {
  const buat = (ubah: Partial<FilterReservasi>): FilterReservasi => ({
    ...filterKosong(),
    ...ubah,
  });

  it('mengembalikan semua tanpa filter', () => {
    expect(saringReservasi(reservasi, filterKosong(), peta, HARI_INI)).toHaveLength(3);
  });

  it('menyaring periode berjalan hanya menahan stok', () => {
    const hasil = saringReservasi(reservasi, buat({ periode: 'berjalan' }), peta, HARI_INI);
    expect(hasil.map((item) => item.kode)).toEqual(['RSV-1001', 'RSV-1002']);
  });

  it('menyaring riwayat hanya status selesai', () => {
    const hasil = saringReservasi(reservasi, buat({ periode: 'riwayat' }), peta, HARI_INI);
    expect(hasil.map((item) => item.kode)).toEqual(['RSV-1003']);
  });

  it('menyaring rentang 7 hari mendekati dan memotong perbatasan', () => {
    const hasil = saringReservasi(reservasi, buat({ periode: '7-hari' }), peta, HARI_INI);
    expect(hasil.map((item) => item.kode)).toEqual([]);

    const besok = saringReservasi(
      [...reservasi],
      buat({ periode: '7-hari' }),
      peta,
      '2026-11-01',
    );
    expect(besok.map((item) => item.kode)).toEqual(['RSV-1002']);
  });

  it('menyaring rentang kustom dan menukar bila terbalik', () => {
    const terbalik = saringReservasi(
      reservasi,
      buat({ periode: 'kustom', dari: '2026-09-10', sampai: '2026-09-01' }),
      peta,
      HARI_INI,
    );
    expect(terbalik.map((item) => item.kode)).toEqual(['RSV-1003']);

    const kosong = saringReservasi(
      reservasi,
      buat({ periode: 'kustom', dari: '2026-01-01', sampai: '2026-01-02' }),
      peta,
      HARI_INI,
    );
    expect(kosong).toHaveLength(0);
  });

  it('menyaring status spesifik', () => {
    const hasil = saringReservasi(reservasi, buat({ status: 'Permintaan' }), peta, HARI_INI);
    expect(hasil.map((item) => item.kode)).toEqual(['RSV-1002']);
  });

  it('menyaring fokus aset', () => {
    const hasil = saringReservasi(reservasi, buat({ asetId: 'a1' }), peta, HARI_INI);
    expect(hasil).toHaveLength(2);
  });

  it('mencari lewat nama aset, kode, dan catatan', () => {
    expect(saringReservasi(reservasi, buat({ cari: 'ratna' }), peta, HARI_INI)).toHaveLength(1);
    expect(saringReservasi(reservasi, buat({ cari: 'RSV-1003' }), peta, HARI_INI)).toHaveLength(1);
    expect(saringReservasi(reservasi, buat({ cari: 'kursi' }), peta, HARI_INI)).toHaveLength(1);
    expect(saringReservasi(reservasi, buat({ cari: 'antar sore' }), peta, HARI_INI)).toHaveLength(1);
    expect(saringReservasi(reservasi, buat({ cari: 'tidak ada' }), peta, HARI_INI)).toHaveLength(0);
  });
});

describe('urutan reservasi', () => {
  it('mengurutkan berdasarkan tanggal terdekat', () => {
    const hasil = urutkanReservasi(reservasi, 'tanggal-asc', peta);
    expect(hasil.map((item) => item.kode)).toEqual(['RSV-1003', 'RSV-1001', 'RSV-1002']);
  });

  it('mengurutkan berdasarkan tanggal terlama', () => {
    const hasil = urutkanReservasi(reservasi, 'tanggal-desc', peta);
    expect(hasil[0].kode).toBe('RSV-1002');
  });

  it('mengurutkan berdasarkan nilai sewa', () => {
    const naik = urutkanReservasi(reservasi, 'nilai-asc', peta).map((item) => item.kode);
    const turun = urutkanReservasi(reservasi, 'nilai-desc', peta).map((item) => item.kode);
    expect(naik).toEqual(['RSV-1002', 'RSV-1003', 'RSV-1001']);
    expect(turun).toEqual(['RSV-1001', 'RSV-1003', 'RSV-1002']);
  });

  it('mengurutkan berdasarkan kode', () => {
    expect(urutkanReservasi(reservasi, 'kode-asc', peta).map((item) => item.kode)).toEqual([
      'RSV-1001',
      'RSV-1002',
      'RSV-1003',
    ]);
  });
});

describe('filter aset', () => {
  it('menyaring kategori dan status', () => {
    expect(saringAset(aset, { cari: '', kategori: 'semua', status: 'semua' })).toHaveLength(2);
    expect(
      saringAset(aset, { cari: '', kategori: 'semua', status: 'Pemeliharaan' }).map((a) => a.kode),
    ).toEqual(['AST-02']);
  });

  it('mencari lewat nama dan catatan', () => {
    expect(saringAset(aset, { cari: 'Tiffany', kategori: '', status: '' })).toHaveLength(1);
    expect(saringAset(aset, { cari: 'putih', kategori: '', status: '' })).toHaveLength(1);
    expect(saringAset(aset, { cari: 'xyz', kategori: '', status: '' })).toHaveLength(0);
  });
});