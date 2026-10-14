import { describe, expect, it } from 'vitest';
import type { Aset, Reservasi } from './types';
import {
  hitungUnitTerpakai,
  jendelaTerpakai,
  menahanStok,
  periksaKetersediaan,
  selKetersediaanHarian,
  totalHariDisewa,
  unitTersedia,
} from './ketersediaan';

const aset: Aset = {
  id: 'a1',
  kode: 'AST-01',
  nama: 'Tenda Dome',
  kategori: 'Perlengkapan Acara',
  jumlahTersedia: 3,
  hargaPerHari: 100_000,
  statusPemeliharaan: 'Aktif',
  jarakServisHari: null,
  catatan: '',
  dibuatPada: '2026-01-01T00:00:00.000Z',
  diperbaruiPada: '2026-01-01T00:00:00.000Z',
};

const asetServis: Aset = { ...aset, id: 'a2', kode: 'AST-02', statusPemeliharaan: 'Pemeliharaan' };

function reservasi(ubah: Partial<Reservasi>): Reservasi {
  return {
    id: 'r1',
    kode: 'RSV-1001',
    asetId: 'a1',
    pelanggan: 'Bapak Uji',
    kontak: '0812 1111 2222',
    jumlah: 1,
    tanggalMulai: '2026-10-10',
    tanggalSelesai: '2026-10-12',
    dp: 0,
    status: 'Dipesan',
    catatan: '',
    dibuatPada: '2026-01-01T00:00:00.000Z',
    diperbaruiPada: '2026-01-01T00:00:00.000Z',
    diserahkanPada: null,
    dikembalikanPada: null,
    ...ubah,
  };
}

describe('ketersediaan', () => {
  it('menahan stok untuk Permintaan, Dipesan, dan Dipinjam', () => {
    expect(menahanStok('Permintaan')).toBe(true);
    expect(menahanStok('Dipesan')).toBe(true);
    expect(menahanStok('Dipinjam')).toBe(true);
  });

  it('melepas stok untuk Dikembalikan dan Dibatalkan', () => {
    expect(menahanStok('Dikembalikan')).toBe(false);
    expect(menahanStok('Dibatalkan')).toBe(false);
  });

  it('menghitung unit terpakai dengan jendela tertutup', () => {
    const daftar = [reservasi({ jumlah: 2 })];
    expect(hitungUnitTerpakai(daftar, 'a1', '2026-10-10', '2026-10-12')).toBe(2);
    expect(hitungUnitTerpakai(daftar, 'a1', '2026-10-09', '2026-10-09')).toBe(0);
    expect(hitungUnitTerpakai(daftar, 'a1', '2026-10-12', '2026-10-12')).toBe(2);
  });

  it('mengabaikan reservasi asset lain dan status yang tidak menahan stok', () => {
    const daftar = [
      reservasi({ id: 'r2', asetId: 'lain', jumlah: 9 }),
      reservasi({ id: 'r3', status: 'Dikembalikan', jumlah: 9 }),
      reservasi({ id: 'r4', status: 'Dibatalkan', jumlah: 9 }),
    ];
    expect(hitungUnitTerpakai(daftar, 'a1', '2026-10-10', '2026-10-12')).toBe(0);
  });

  it('menerima jeda antar sewa yang memperluas jendela', () => {
    const daftar = [reservasi({ tanggalMulai: '2026-10-10', tanggalSelesai: '2026-10-12' })];
    expect(jendelaTerpakai(daftar[0], 2)).toEqual({
      mulai: '2026-10-08',
      selesai: '2026-10-14',
    });
    expect(hitungUnitTerpakai(daftar, 'a1', '2026-10-14', '2026-10-14', { jeda: 2 })).toBe(1);
    expect(hitungUnitTerpakai(daftar, 'a1', '2026-10-14', '2026-10-14')).toBe(0);
  });

  it('mengesampingkan reservasi yang sedang diubah', () => {
    const daftar = [reservasi({ jumlah: 2, id: 'rX' })];
    expect(hitungUnitTerpakai(daftar, 'a1', '2026-10-10', '2026-10-12', { kecualiId: 'rX' })).toBe(0);
  });

  it('menghitung unit tersedia sebagai stok dikurangi unit terpakai', () => {
    expect(unitTersedia(aset, [reservasi({ jumlah: 2 })], '2026-10-11', '2026-10-11')).toBe(1);
    expect(unitTersedia(aset, [], '2026-10-11', '2026-10-11')).toBe(3);
  });

  it('menolak ketika stok tidak cukup dan menyebut sisanya', () => {
    const daftar = [reservasi({ jumlah: 2 })];
    const hasil = periksaKetersediaan({
      aset,
      reservasi: daftar,
      mulai: '2026-10-11',
      selesai: '2026-10-11',
      jumlah: 2,
    });
    expect(hasil.boleh).toBe(false);
    expect(hasil.tersedia).toBe(1);
    expect(hasil.alasan).toContain('1 unit');
  });

  it('mengizinkan tepat pada batas stok', () => {
    const daftar = [reservasi({ jumlah: 2 })];
    expect(
      periksaKetersediaan({
        aset,
        reservasi: daftar,
        mulai: '2026-10-11',
        selesai: '2026-10-11',
        jumlah: 1,
      }).boleh,
    ).toBe(true);
  });

  it('selalu menolak aset pemeliharaan', () => {
    const hasil = periksaKetersediaan({
      aset: asetServis,
      reservasi: [],
      mulai: '2026-10-11',
      selesai: '2026-10-11',
      jumlah: 1,
    });
    expect(hasil.boleh).toBe(false);
    expect(hasil.maintenance).toBe(true);
  });

  it('menolak jumlah nol atau kurang', () => {
    expect(
      periksaKetersediaan({ aset, reservasi: [], mulai: '2026-10-11', selesai: '2026-10-11', jumlah: 0 })
        .boleh,
    ).toBe(false);
  });

  it('menandai sel pemeliharaan pada harian', () => {
    const sel = selKetersediaanHarian(asetServis, [], '2026-10-11');
    expect(sel.maintenance).toBe(true);
    expect(sel.tersedia).toBe(0);
  });

  it('menghitung total hari disewa dari semua reservasi aset', () => {
    const daftar = [
      reservasi({ tanggalMulai: '2026-10-01', tanggalSelesai: '2026-10-02', status: 'Dikembalikan' }),
      reservasi({ id: 'r2', kode: 'RSV-1002', tanggalMulai: '2026-10-05', tanggalSelesai: '2026-10-07' }),
    ];
    expect(totalHariDisewa(daftar, 'a1')).toBe(5);
  });
});
