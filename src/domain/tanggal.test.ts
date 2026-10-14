import { describe, expect, it } from 'vitest';
import {
  awalBulan,
  deretTanggal,
  hariDalamBulan,
  hitungHariSewa,
  keTanggalISO,
  selisihHari,
  tambahHari,
} from './tanggal';

describe('tanggal', () => {
  it('menambah dan mengurangi hari melewati batas bulan', () => {
    expect(tambahHari('2026-10-14', 1)).toBe('2026-10-15');
    expect(tambahHari('2026-10-31', 1)).toBe('2026-11-01');
    expect(tambahHari('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('melewati batas tahun kabisat', () => {
    expect(tambahHari('2024-02-28', 1)).toBe('2024-02-29');
    expect(tambahHari('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('menghitung hari sewa inklusif', () => {
    expect(hitungHariSewa('2026-10-14', '2026-10-14')).toBe(1);
    expect(hitungHariSewa('2026-10-14', '2026-10-16')).toBe(3);
    expect(hitungHariSewa('2026-10-31', '2026-11-01')).toBe(2);
  });

  it('menghitung selisih hari bertanda', () => {
    expect(selisihHari('2026-10-14', '2026-10-20')).toBe(6);
    expect(selisihHari('2026-10-20', '2026-10-14')).toBe(-6);
  });

  it('menghasilkan deret tanggal berurutan', () => {
    expect(deretTanggal('2026-10-14', 3)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
  });

  it('mengambil hari ke berapa dalam bulan', () => {
    expect(hariDalamBulan('2026-02-28')).toBe(28);
    expect(hariDalamBulan('2024-02-29')).toBe(29);
    expect(hariDalamBulan('2026-04-30')).toBe(30);
  });

  it('menentukan awal bulan', () => {
    expect(awalBulan('2026-10-14')).toBe('2026-10-01');
  });

  it('membulatkan konversi ISO ke depan di zona waktu', () => {
    const iso = keTanggalISO(new Date(2026, 9, 14, 23, 30));
    expect(iso).toBe('2026-10-14');
  });
});
