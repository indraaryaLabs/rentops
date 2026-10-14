import { describe, expect, it } from 'vitest';
import { hitungSubtotal, normalisasiDP, perpanjangRentang, ringkasSewa } from './sewa';
import { hariTerlambat } from './sewa';
import type { Reservasi } from './types';

const dasar = {
  id: 'r1',
  kode: 'RSV-1001',
  asetId: 'a1',
  pelanggan: 'Bapak Uji',
  kontak: '0812 1111 2222',
  jumlah: 1,
  tanggalMulai: '2026-10-14',
  tanggalSelesai: '2026-10-16',
  dp: 0,
  status: 'Dipesan',
  catatan: '',
  dibuatPada: '2026-10-01T00:00:00.000Z',
  diperbaruiPada: '2026-10-01T00:00:00.000Z',
  diserahkanPada: null,
  dikembalikanPada: null,
} satisfies Reservasi;

describe('sewa', () => {
  it('menghitung subtotal dari hari, harga, dan jumlah', () => {
    expect(hitungSubtotal(2, 100_000, { mulai: '2026-10-14', selesai: '2026-10-16' })).toBe(600_000);
    expect(hitungSubtotal(1, 100_000, { mulai: '2026-10-14', selesai: '2026-10-14' })).toBe(100_000);
  });

  it('membulatkan subtotal ke rupiah', () => {
    expect(hitungSubtotal(3, 33_333, { mulai: '2026-10-14', selesai: '2026-10-14' })).toBe(99_999);
  });

  it('mengembalikan nol untuk rentang tidak valid', () => {
    expect(hitungSubtotal(1, 100_000, { mulai: '2026-10-16', selesai: '2026-10-14' })).toBe(0);
  });

  it('menormalkan DP agar tidak negatif dan tidak melebihi subtotal', () => {
    expect(normalisasiDP(-500, 100_000)).toBe(0);
    expect(normalisasiDP(150_000, 100_000)).toBe(100_000);
    expect(normalisasiDP(25_000, 100_000)).toBe(25_000);
  });

  it('merangkum sewa lengkap', () => {
    const ringkasan = ringkasSewa({ ...dasar, dp: 200_000 }, 100_000);
    expect(ringkasan.hariSewa).toBe(3);
    expect(ringkasan.subtotal).toBe(300_000);
    expect(ringkasan.dp).toBe(200_000);
    expect(ringkasan.sisa).toBe(100_000);
  });

  it('memperpanjang rentang dari tanggal selesai', () => {
    expect(perpanjangRentang({ mulai: '2026-10-14', selesai: '2026-10-16' }, 3)).toEqual({
      mulai: '2026-10-14',
      selesai: '2026-10-19',
    });
  });

  it('menghitung keterlambatan sejak tanggal kembali', () => {
    expect(hariTerlambat({ ...dasar, status: 'Dipinjam' }, '2026-10-16')).toBe(0);
    expect(hariTerlambat({ ...dasar, status: 'Dipinjam' }, '2026-10-18')).toBe(2);
  });
});
