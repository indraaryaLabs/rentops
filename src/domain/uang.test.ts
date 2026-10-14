import { describe, expect, it } from 'vitest';
import {
  formatAngka,
  formatPersen,
  formatRupiah,
  formatRupiahRingkas,
  formatUnit,
  jamak,
  parseRupiah,
  rupiah,
} from './uang';
import { buatId } from './id';

describe('format rupiah', () => {
  it('menulis rupiah penuh dengan pemisah titik', () => {
    expect(formatRupiah(1_500_000)).toBe('Rp 1.500.000');
    expect(formatRupiah(0)).toBe('Rp 0');
    expect(formatRupiah(-5_000)).toBe('Rp -5.000');
  });

  it('meringkas nilai besar dengan satuan ribu, juta, miliar', () => {
    expect(formatRupiahRingkas(15_575_000)).toBe('Rp 15,6 jt');
    expect(formatRupiahRingkas(3_500_000_000)).toBe('Rp 3,5 M');
    expect(formatRupiahRingkas(150_000)).toBe('Rp 150 rb');
    expect(formatRupiahRingkas(4_200)).toBe('Rp 4.200');
  });

  it('membedakan unit dan pemesanan', () => {
    expect(formatUnit(1)).toBe('1 unit');
    expect(formatUnit(120)).toBe('120 unit');
    expect(jamak(1, 'pemesanan', 'pemesanan')).toBe('pemesanan');
  });

  it('membulatkan ke rupiah terdekat', () => {
    expect(rupiah(1000.4)).toBe(1000);
    expect(rupiah(1000.6)).toBe(1001);
    expect(formatAngka(1234.5)).toBe('1.235');
    expect(formatPersen(83.34)).toBe('83%');
  });

  it('membaca teks rupiah yang ditulis manusia', () => {
    expect(parseRupiah('Rp 150.000')).toBe(150_000);
    expect(parseRupiah('150000')).toBe(150_000);
    expect(parseRupiah('15jt')).toBe(15_000_000);
    expect(parseRupiah('abc')).toBe(0);
    expect(parseRupiah('')).toBeNull();
  });
});

describe('id', () => {
  it('selalu unik dan berawalan', () => {
    const kumpulan = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const id = buatId('rsv');
      expect(id.startsWith('rsv_')).toBe(true);
      kumpulan.add(id);
    }
    expect(kumpulan.size).toBe(500);
  });

  it('aman untuk ditulis di berkas tanpa titik koma', () => {
    expect(buatId('ast')).not.toContain(';');
    expect(buatId('ast')).not.toContain('\n');
  });
});