import { describe, expect, it } from 'vitest';
import { migrasiData, SKEMA_TERBARU } from './migrasi';
import { backupJSON, imporJSON, ringkasData } from './backup';
import { buatDataDemo } from '../domain/seed';
import type { DataAplikasi } from '../domain/types';

describe('migrasiData', () => {
  it('menolak nilai yang bukan objek', () => {
    expect(migrasiData(null).ok).toBe(false);
    expect(migrasiData(42).ok).toBe(false);
    expect(migrasiData('teks').ok).toBe(false);
    expect(migrasiData([]).ok).toBe(false);
  });

  it('menolak amplop tanpa data', () => {
    const hasil = migrasiData({ skema: 2 });
    expect(hasil.ok).toBe(false);
  });

  it('menerima data skema terbaru', () => {
    const demo = buatDataDemo(new Date(2026, 9, 14));
    const hasil = migrasiData({ skema: SKEMA_TERBARU, disimpanPada: 'x', data: demo });
    expect(hasil.ok).toBe(true);
    if (hasil.ok) {
      expect(hasil.data.aset.length).toBe(demo.aset.length);
      expect(hasil.data.reservasi.length).toBe(demo.reservasi.length);
    }
  });

  it('mengisi profil dan preferensi bawaan bila kosong', () => {
    const demo = buatDataDemo(new Date(2026, 9, 14));
    const hasil = migrasiData({ skema: SKEMA_TERBARU, data: { ...demo, profil: undefined } });
    expect(hasil.ok).toBe(true);
    if (hasil.ok) expect(hasil.data.profil.nama).toBeTruthy();
  });

  it('menolak berkas yang memuat baris reservasi rusak dan menjelaskan letaknya', () => {
    const demo = buatDataDemo(new Date(2026, 9, 14));
    const rusak = {
      skema: SKEMA_TERBARU,
      data: { ...demo, reservasi: [...demo.reservasi, { kode: 'RSV-9999' }] },
    };
    const hasil = migrasiData(rusak);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) {
      expect(hasil.galat.join(' ')).toContain('Reservasi');
    }
  });

  it('membiarkan kontak berformat bebas karena nomor dirapikan saat dipakai', () => {
    const demo = buatDataDemo(new Date(2026, 9, 14));
    const hasil = migrasiData({
      skema: SKEMA_TERBARU,
      data: {
        ...demo,
        reservasi: demo.reservasi.map((r) => ({ ...r, kontak: '+62 (812) 3456-7890' })),
      },
    });
    expect(hasil.ok).toBe(true);
    if (hasil.ok) {
      expect(hasil.data.reservasi[0]?.kontak).toBe('+62 (812) 3456-7890');
    }
  });

  it('menolak berkas dengan tanggal kembali sebelum tanggal mulai', () => {
    const demo = buatDataDemo(new Date(2026, 9, 14));
    const hasil = migrasiData({
      skema: SKEMA_TERBARU,
      data: {
        ...demo,
        reservasi: demo.reservasi.map((r) => ({ ...r, tanggalSelesai: '2020-01-01' })),
      },
    });
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) {
      expect(hasil.galat.join(' ')).toMatch(/tanggal|periode|rentang/i);
    }
  });
});

describe('backup JSON', () => {
  const demo = buatDataDemo(new Date(2026, 9, 14));

  it('ekspor lalu impor kembali tanpa kehilangan data', () => {
    const hasil = imporJSON(backupJSON(demo));
    expect(hasil.ok).toBe(true);
    if (hasil.ok) {
      expect(hasil.data.reservasi.length).toBe(demo.reservasi.length);
      expect(hasil.data.aset.length).toBe(demo.aset.length);
    }
  });

  it('memberi pesan jelas untuk berkas kosong atau bukan JSON', () => {
    const kosong = imporJSON('   ');
    expect(kosong.ok).toBe(false);
    if (!kosong.ok) expect(kosong.galat[0]).toContain('kosong');

    const salah = imporJSON('{ bukan json');
    expect(salah.ok).toBe(false);
    if (!salah.ok) expect(salah.galat[0]).toContain('JSON');
  });

  it('menolak berkas yang lolos parser tapi bukan data RentOps', () => {
    const hasil = imporJSON(JSON.stringify({ halo: 'dunia' }));
    expect(hasil.ok).toBe(false);
  });

  it('meringkas data untuk panel pengaturan', () => {
    const ringkas = ringkasData(demo);
    expect(ringkas.aset).toBe(demo.aset.length);
    expect(ringkas.reservasi).toBe(demo.reservasi.length);
    expect(ringkas.unit).toBeGreaterThan(0);
  });
});

describe('penyimpanan lokal', () => {
  it('menyimpan dan memuat lewat penyimpanan tiruan', async () => {
    const { muatData, simpanData, KUNCI_DATA } = await import('./db');
    const peta = new Map<string, string>();
    const tiruan = {
      baca: (kunci: string) => peta.get(kunci) ?? null,
      tulis: (kunci: string, nilai: string) => {
        peta.set(kunci, nilai);
        return true;
      },
      hapus: (kunci: string) => {
        peta.delete(kunci);
      },
    };

    const demo = buatDataDemo(new Date(2026, 9, 14));
    expect(simpanData(demo, tiruan)).toBe(true);
    expect(peta.has(KUNCI_DATA)).toBe(true);

    const muat = muatData(tiruan, new Date(2026, 9, 14));
    expect(muat.sumber).toBe('penyimpanan');
    expect(muat.data.reservasi.length).toBe(demo.reservasi.length);
  });

  it('jatuh ke data demo bila berisi sampah', async () => {
    const { muatData } = await import('./db');
    const tiruan = {
      baca: () => '{{{ bukan json',
      tulis: () => true,
      hapus: () => undefined,
    };
    const muat = muatData(tiruan, new Date(2026, 9, 14));
    expect(muat.sumber).toBe('demo');
    expect(muat.data.aset.length).toBeGreaterThan(0);
  });

  it('laporkan segala usaha tulis ketika penyimpanan diblokir', async () => {
    const { simpanData } = await import('./db');
    const terblokir = { baca: () => null, tulis: () => false, hapus: () => undefined };
    expect(simpanData(buatDataDemo(), terblokir)).toBe(false);
  });
});

describe('snapshot', () => {
  it('menyimpan maksimal batas slot dan pulih yang terbaru', async () => {
    const { tambahSnapshot, muatSnapshot, BATAS_SNAPSHOT } = await import('./db');
    const peta = new Map<string, string>();
    const tiruan = {
      baca: (kunci: string) => peta.get(kunci) ?? null,
      tulis: (kunci: string, nilai: string) => {
        peta.set(kunci, nilai);
        return true;
      },
      hapus: (kunci: string) => {
        peta.delete(kunci);
      },
    };

    const demo = buatDataDemo(new Date(2026, 9, 14));
    for (let i = 0; i < BATAS_SNAPSHOT + 4; i += 1) {
      tambahSnapshot(tiruan, demo, `v${i}`);
    }
    const daftar = muatSnapshot(tiruan);
    expect(daftar.length).toBe(BATAS_SNAPSHOT);
    expect(daftar[0].label).toBe(`v${BATAS_SNAPSHOT + 3}`);
  });
});

describe('ekspor data demo utuh', () => {
  it('data demo berbasis rentang tanggal nyata', () => {
    const demo: DataAplikasi = buatDataDemo(new Date(2026, 9, 14));
    const hariIni = '2026-10-14';
    const benar = demo.reservasi.every(
      (r) => r.tanggalMulai >= '2026-08-01' && r.tanggalSelesai <= '2026-12-31',
    );
    expect(benar).toBe(true);
    const hariIniAda = demo.reservasi.some(
      (r) => r.tanggalMulai <= hariIni && r.tanggalSelesai >= hariIni,
    );
    expect(hariIniAda).toBe(true);
  });
});