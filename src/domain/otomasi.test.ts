import { describe, expect, it } from 'vitest';
import type { Aset, DataAplikasi, Preferensi, Reservasi } from './types';
import { PREFERENSI_AWAL } from './types';
import {
  agendaMendatang,
  antreanHariIni,
  asetMenganggur,
  jalankanOtomasi,
  ringkasanOtomasi,
  urutkanSaran,
} from './otomasi';

const aset: Aset[] = [
  {
    id: 'a1',
    kode: 'AST-01',
    nama: 'Tenda Dome',
    kategori: 'Perlengkapan Acara',
    jumlahTersedia: 2,
    hargaPerHari: 100_000,
    statusPemeliharaan: 'Aktif',
    jarakServisHari: 2,
    catatan: '',
    dibuatPada: '2026-01-01T00:00:00.000Z',
    diperbaruiPada: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'a2',
    kode: 'AST-02',
    nama: 'Kursi Tiffany',
    kategori: 'Perlengkapan Acara',
    jumlahTersedia: 10,
    hargaPerHari: 2_000,
    statusPemeliharaan: 'Aktif',
    jarakServisHari: null,
    catatan: '',
    dibuatPada: '2026-01-01T00:00:00.000Z',
    diperbaruiPada: '2026-01-01T00:00:00.000Z',
  },
];

function rsv(ubah: Partial<Reservasi>): Reservasi {
  return {
    id: 'r1',
    kode: 'RSV-1001',
    asetId: 'a1',
    pelanggan: 'Bapak Agus',
    kontak: '',
    jumlah: 1,
    tanggalMulai: '2026-10-14',
    tanggalSelesai: '2026-10-12',
    dp: 0,
    status: 'Dipinjam',
    catatan: '',
    dibuatPada: '2026-10-01T00:00:00.000Z',
    diperbaruiPada: '2026-10-01T00:00:00.000Z',
    diserahkanPada: null,
    dikembalikanPada: null,
    ...ubah,
  };
}

function data(daftar: Reservasi[]): DataAplikasi {
  return {
    skema: 2,
    profil: { nama: 'Usaha Uji', alamat: '', telepon: '', catatan: '' },
    aset,
    reservasi: daftar,
  };
}

const HARI_INI = '2026-10-14';
const pref: Preferensi = { ...PREFERENSI_AWAL };

describe('antrean hari ini', () => {
  it('memisahkan yang terlambat, perlu diserahkan, dan perlu diterima', () => {
    const alur = antreanHariIni(
      data([
        rsv({ id: 'r1', kode: 'RSV-1001', status: 'Dipinjam', tanggalSelesai: '2026-10-12' }),
        rsv({ id: 'r2', kode: 'RSV-1002', status: 'Dipesan', tanggalMulai: '2026-10-14', tanggalSelesai: '2026-10-16' }),
        rsv({ id: 'r3', kode: 'RSV-1003', status: 'Dipinjam', tanggalMulai: '2026-10-10', tanggalSelesai: '2026-10-14' }),
        rsv({ id: 'r4', kode: 'RSV-1004', status: 'Dikembalikan', tanggalSelesai: HARI_INI }),
      ]),
      HARI_INI,
    );
    expect(alur.terlambat.map((r) => r.kode)).toEqual(['RSV-1001']);
    expect(alur.ambil.map((r) => r.kode)).toEqual(['RSV-1002']);
    expect(alur.kembali.map((r) => r.kode)).toEqual(['RSV-1003']);
  });
});

describe('otomasi', () => {
  it('menyarankan pengembalian untuk reservasi terlambat', () => {
    const saran = jalankanOtomasi({
      data: data([rsv({ status: 'Dipinjam', tanggalSelesai: '2026-10-12' })]),
      hariIni: HARI_INI,
      preferensi: pref,
    });
    const saranStatus = saran.filter((s) => s.aturan === 'reservasi-terlambat');
    expect(saranStatus.length).toBeGreaterThan(0);
    expect(saranStatus[0].tindakan).toEqual({
      jenis: 'reservasi/status',
      id: 'r1',
      status: 'Dikembalikan',
    });
    expect(saranStatus[0].prioritas).toBe('tinggi');
    expect(saranStatus[0].judul).toContain('terlambat');
  });

  it('menyarankan ACC permintaan tanpa coset status kosong', () => {
    const saran = jalankanOtomasi({
      data: data([rsv({ status: 'Permintaan', tanggalMulai: '2026-10-01', tanggalSelesai: '2026-10-02' })]),
      hariIni: HARI_INI,
      preferensi: pref,
    });
    const permintaan = saran.filter((s) => s.aturan === 'permintaan-menunggu');
    expect(permintaan).toHaveLength(1);
    expect(permintaan[0].tindakan).toEqual({
      jenis: 'reservasi/status',
      id: 'r1',
      status: 'Dipesan',
    });
    expect(permintaan[0].detail).toContain('Bapak Agus');
  });

  it('menyarankan penagihan sisa pembayaran', () => {
    const saran = jalankanOtomasi({
      data: data([
        rsv({ status: 'Dipinjam', dp: 50_000, tanggalMulai: '2026-10-10', tanggalSelesai: '2026-10-11' }),
      ]),
      hariIni: HARI_INI,
      preferensi: pref,
    });
    const lunas = saran.filter((s) => s.tindakan.jenis === 'reservasi/lunasi');
    expect(lunas).toHaveLength(1);
    expect(lunas[0].tindakan).toEqual({ jenis: 'reservasi/lunasi', id: 'r1' });
  });

  it('memberi saran servis untuk aset dengan jarak servis', () => {
    const saran = jalankanOtomasi({
      data: data([
        rsv({
          status: 'Dikembalikan',
          dp: 0,
          tanggalMulai: '2026-10-01',
          tanggalSelesai: '2026-10-03',
          dikembalikanPada: '2026-10-03T10:00:00.000Z',
        }),
      ]),
      hariIni: HARI_INI,
      preferensi: { ...pref, ambangSisaHariServis: 5 },
    });
    const servis = saran.filter((s) => s.aturan === 'servis-jatuh-tempo');
    expect(servis.length).toBeGreaterThan(0);
    expect(servis[0].tindakan).toEqual({ jenis: 'aset/status', id: 'a1', status: 'Pemeliharaan' });
    expect(servis[0].judul).toContain('servis');
  });

  it('tidak menyarankan apa pun pada kosong yang bersih', () => {
    const saran = jalankanOtomasi({
      data: data([rsv({ status: 'Dikembalikan', tanggalMulai: HARI_INI, tanggalSelesai: HARI_INI, dp: 100_000 })]),
      hariIni: HARI_INI,
      preferensi: { ...pref, ambangSisaHariServis: 30 },
    });
    expect(saran.filter((s) => s.aturan !== 'servis-jatuh-tempo')).toHaveLength(0);
    expect(ringkasanOtomasi(saran)).toContain('Tidak ada hal');
  });

  it('mengurutkan saran dari prioritas tinggi ke rendah', () => {
    const daftar = [
      rsv({ id: 'r1', kode: 'RSV-1001', status: 'Dipinjam', dp: 0, tanggalSelesai: '2026-10-01' }),
      rsv({ id: 'r2', kode: 'RSV-1002', status: 'Permintaan', tanggalMulai: '2026-09-01', tanggalSelesai: '2026-09-02' }),
    ];
    const saran = jalankanOtomasi({ data: data(daftar), hariIni: HARI_INI, preferensi: pref });
    const terurut = urutkanSaran(saran);
    expect(terurut[0].prioritas).toBe('tinggi');
    expect(terurut.at(-1)!.prioritas).toBe('rendah');
    expect(ringkasanOtomasi(saran)).toBeTruthy();
  });
});

describe('agenda dan asset menganggur', () => {
  it('hanya mendaftarkan yang belum tutup pada tujuh hari ke depan', () => {
    const agenda = agendaMendatang(
      data([
        rsv({ id: 'r1', kode: 'RSV-1001', status: 'Dipinjam', tanggalMulai: '2026-10-01', tanggalSelesai: '2026-10-16' }),
        rsv({ id: 'r2', kode: 'RSV-1002', status: 'Dipesan', tanggalMulai: '2026-10-20', tanggalSelesai: '2026-10-21' }),
        rsv({ id: 'r3', kode: 'RSV-1003', status: 'Dibatalkan', tanggalMulai: '2026-10-15', tanggalSelesai: '2026-10-16' }),
        rsv({ id: 'r4', kode: 'RSV-1004', status: 'Dipesan', tanggalMulai: '2026-11-30', tanggalSelesai: '2026-12-01' }),
      ]),
      HARI_INI,
      7,
    );
    expect(agenda.map((r) => r.kode)).toEqual(['RSV-1001', 'RSV-1002']);
  });

  it('mendaftar reservasi yang melewati ambang menganggur', () => {
    const hasil = asetMenganggur(
      data([rsv({ id: 'r1', kode: 'RSV-1001', status: 'Dikembalikan', tanggalSelesai: '2026-06-01', dp: 0 })]),
      HARI_INI,
      30,
    );
    expect(hasil.map((a) => a.id)).toEqual(['a1', 'a2']);
  });
});