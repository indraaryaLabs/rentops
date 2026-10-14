import { describe, expect, it } from 'vitest';
import type { Aset, Reservasi } from './types';
import {
  formAsetDari,
  formAsetKosong,
  formReservasiDari,
  formReservasiKosong,
  kodeBerikut,
  reservasiDariForm,
  validasiFormAset,
  validasiFormReservasi,
} from './validasi';
import { POLA_KODE, POLA_KONTAK } from './validasi';

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

function rsv(ubah: Partial<Reservasi>): Reservasi {
  return {
    id: 'r1',
    kode: 'RSV-1001',
    asetId: 'a1',
    pelanggan: 'Bapak Agus',
    kontak: '0812 1111 2222',
    jumlah: 1,
    tanggalMulai: '2026-10-14',
    tanggalSelesai: '2026-10-16',
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

describe('validasi form aset', () => {
  const data = { aset: [aset], reservasi: [] as Reservasi[] };

  it('meloloskan form kosong yang valid', () => {
    const galat = validasiFormAset(
      { ...formAsetKosong(), nama: 'Kursi', kode: 'KRS-01', kategori: 'Perlengkapan Acara', jumlahUnit: '10', hargaPerHari: 'Rp 5.000' },
      data,
    );
    expect(galat).toEqual({});
  });

  it('menolak nama terlalu pendek dan kode duplikat', () => {
    const galat = validasiFormAset(
      { ...formAsetKosong(), nama: 'ab', kode: 'AST-01', kategori: 'Peralatan', jumlahUnit: '1', hargaPerHari: '10000' },
      data,
    );
    expect(galat.nama).toBeTruthy();
    expect(galat.kode).toBeTruthy();
  });

  it('menolak kode dengan karakter ilegal', () => {
    const galat = validasiFormAset(
      { ...formAsetKosong(), nama: 'Tenda', kode: 'tenda 01', kategori: 'Peralatan', jumlahUnit: '1', hargaPerHari: '10000' },
      data,
    );
    expect(galat.kode).toBeTruthy();
    expect(POLA_KODE.test('AST-01')).toBe(true);
    expect(POLA_KODE.test('AST 01')).toBe(false);
  });

  it('menolak stok di bawah unit yang sedang tersewa', () => {
    const galat = validasiFormAset(
      { ...formAsetDari(aset), jumlahUnit: '1' },
      { aset: [aset], reservasi: [rsv({ jumlah: 2 })] },
      'a1',
    );
    expect(galat.jumlahUnit).toContain('2 unit');
  });

  it('membolehkan stok sama persis dengan unit tersewa', () => {
    const galat = validasiFormAset(
      { ...formAsetDari(aset), jumlahUnit: '2' },
      { aset: [aset], reservasi: [rsv({ jumlah: 2 })] },
      'a1',
    );
    expect(galat.jumlahUnit).toBeUndefined();
  });

  it('menolak harga kosong atau nol', () => {
    const galat = validasiFormAset(
      { ...formAsetDari(aset), hargaPerHari: '' },
      data,
      'a1',
    );
    expect(galat.hargaPerHari).toBeTruthy();
  });
});

describe('validasi form reservasi', () => {
  const dasar = {
    ...formReservasiKosong('2026-10-14'),
    kode: 'RSV-2001',
    asetId: 'a1',
    pelanggan: 'Ibu Ratna',
    kontak: '0812 1111 2222',
    jumlah: '1',
    tanggalMulai: '2026-10-14',
    tanggalSelesai: '2026-10-16',
  };

  const konteks = {
    aset,
    reservasi: [] as Reservasi[],
    preferensi: { jedaAntarSewaHari: 0 },
    hariIni: '2026-10-14',
  };

  it('meloloskan form yang lengkap', () => {
    const { galat, catatan } = validasiFormReservasi(dasar, konteks);
    expect(galat).toEqual({});
    expect(catatan).toBeNull();
  });

  it('menolak pelanggan kosong dan aset belum dipilih', () => {
    const { galat } = validasiFormReservasi(
      { ...dasar, pelanggan: '', asetId: '' },
      konteks,
    );
    expect(galat.pelanggan).toBeTruthy();
    expect(galat.asetId).toBeTruthy();
  });

  it('menolak tanggal selesai lebih awal', () => {
    const { galat } = validasiFormReservasi(
      { ...dasar, tanggalMulai: '2026-10-16', tanggalSelesai: '2026-10-14' },
      konteks,
    );
    expect(galat.tanggalSelesai).toBeTruthy();
  });

  it('menolak kontak dengan format salah', () => {
    const { galat } = validasiFormReservasi({ ...dasar, kontak: 'abc' }, konteks);
    expect(galat.kontak).toBeTruthy();
    expect(POLA_KONTAK.test('0812 1111 2222')).toBe(true);
  });

  it('menolak jumlah melebihi stok aset', () => {
    const { galat } = validasiFormReservasi({ ...dasar, jumlah: '4' }, konteks);
    expect(galat.jumlah).toBeTruthy();
  });

  it('menolak nomor reservasi kembar', () => {
    const { galat } = validasiFormReservasi(
      { ...dasar, kode: 'RSV-1001' },
      { ...konteks, reservasi: [rsv({})] },
    );
    expect(galat.kode).toContain('RSV-1001');
  });

  it('memberi peringatan lunas bila DP kurang dari subtotal tanpa mengunci simpan', () => {
    const ringkas = formReservasiDari(rsv({ dp: 50_000 }));
    const hasil = validasiFormReservasi(
      { ...dasar, dp: '50000', tanggalMulai: '2026-10-14', tanggalSelesai: '2026-10-16' },
      konteks,
    );
    expect(Object.keys(hasil.galat)).toHaveLength(0);
    expect(ringkas.dp).toBe('50000');
  });

  it('membulatkan dan memformat kembali dari form ke objek', () => {
    const bentuk = validasiFormReservasi(dasar, konteks);
    expect(bentuk.galat).toEqual({});
    const jadi = reservasiDariForm({ ...dasar, jumlah: '2', dp: '250000' }, 'baru', '2026-10-14T09:00:00.000Z');
    expect(jadi.jumlah).toBe(2);
    expect(jadi.dp).toBe(250_000);
    expect(jadi.id).toBe('baru');
    expect(jadi.status).toBe('Permintaan');
  });
});

describe('kode berikut', () => {
  it('naik satu dari kode tertinggi dengan awalan sama', () => {
    expect(kodeBerikut([{ kode: 'RSV-1001' }, { kode: 'RSV-1004' }], 'RSV')).toBe('RSV-1005');
    expect(kodeBerikut([{ kode: 'AST-7' }], 'AST')).toBe('AST-1001');
    expect(kodeBerikut([], 'RSV')).toBe('RSV-1001');
  });

  it('mengabaikan kode dengan awalan lain', () => {
    expect(kodeBerikut([{ kode: 'ABC-0009' }], 'RSV')).toBe('RSV-1001');
  });
});