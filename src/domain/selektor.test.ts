import { describe, expect, it } from 'vitest';
import type { Aset, DataAplikasi, Reservasi } from './types';
import { buatDataDemo } from './seed';
import {
  barisAgenda,
  jendelaAset,
  ketersediaanHarian,
  metrikDasbor,
  papanJadwal,
  petaAset,
} from './selektor';

const aset: Aset[] = [
  {
    id: 'a1',
    kode: 'AST-01',
    nama: 'Tenda Dome',
    kategori: 'Perlengkapan Acara',
    jumlahTersedia: 2,
    hargaPerHari: 100_000,
    statusPemeliharaan: 'Aktif',
    jarakServisHari: null,
    catatan: '',
    dibuatPada: '2026-01-01T00:00:00.000Z',
    diperbaruiPada: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'a2',
    kode: 'AST-02',
    nama: 'Kursi Tiffany',
    kategori: 'Perlengkapan Acara',
    jumlahTersedia: 4,
    hargaPerHari: 2_000,
    statusPemeliharaan: 'Pemeliharaan',
    jarakServisHari: 90,
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
    tanggalSelesai: '2026-10-16',
    dp: 200_000,
    status: 'Dipinjam',
    catatan: '',
    dibuatPada: '2026-10-01T00:00:00.000Z',
    diperbaruiPada: '2026-10-01T00:00:00.000Z',
    diserahkanPada: '2026-10-14T09:00:00.000Z',
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

describe('metrik dasbor', () => {
  it('merangkum status, unit bebas, pendapatan, dan piutang', () => {
    const daftar = [
      rsv({ jumlah: 1 }),
      rsv({ id: 'r2', kode: 'RSV-1002', status: 'Dipesan', tanggalMulai: '2026-10-18', tanggalSelesai: '2026-10-19', diserahkanPada: null }),
      rsv({ id: 'r3', kode: 'RSV-1003', status: 'Permintaan', tanggalMulai: '2026-10-20', tanggalSelesai: '2026-10-21', diserahkanPada: null }),
      rsv({ id: 'r4', kode: 'RSV-1004', status: 'Dipinjam', dp: 50_000, tanggalMulai: '2026-10-10', tanggalSelesai: '2026-10-11', diserahkanPada: null }),
    ];
    const m = metrikDasbor(data(daftar), HARI_INI);
    expect(m.reservasiAktif).toBe(4);
    expect(m.permintaan).toBe(1);
    expect(m.dipesan).toBe(1);
    expect(m.dipinjam).toBe(2);
    expect(m.terlambat).toBe(1);
    expect(m.totalUnit).toBe(6);
    // Satu unit a1 tersewa, aset a2 pemeliharaan sehingga tidak menambah unit bebas.
    expect(m.unitBebasHariIni).toBe(1);
    expect(m.pendapatanBulanIni).toBe(900_000);
    expect(m.piutangTertunda).toBeGreaterThan(0);
  });

  it('menghitung utilisasi terhadap seluruh unit', () => {
    const m = metrikDasbor(data([rsv({ jumlah: 2 })]), HARI_INI);
    expect(m.utilisasi).toBe(100);
  });
});

describe('papan jadwal', () => {
  it('menghasilkan satu baris per aset dan satu sel per hari', () => {
    const baris = papanJadwal(data([rsv({})]), HARI_INI, { mulai: HARI_INI, jumlahHari: 7 });
    expect(baris).toHaveLength(2);
    expect(baris[0].sel).toHaveLength(7);
  });

  it('menandai posisi hari ini, lalu, dan akan datang', () => {
    const baris = papanJadwal(data([rsv({})]), HARI_INI, {
      mulai: '2026-10-12',
      jumlahHari: 3,
    });
    expect(baris[0].sel.map((s) => s.posisi)).toEqual(['lewat', 'lewat', 'hari-ini']);
  });

  it('menampilkan reservasi yang menyentuh hari itu pada sel', () => {
    const baris = papanJadwal(data([rsv({})]), HARI_INI, {
      mulai: '2026-10-15',
      jumlahHari: 1,
    });
    expect(baris[0].sel[0].reservasi.map((r) => r.kode)).toEqual(['RSV-1001']);
    expect(baris[0].sel[0].tersedia).toBe(1);
  });

  it('membatasi baris ke satu aset bila diminta', () => {
    const baris = papanJadwal(data([rsv({})]), HARI_INI, {
      mulai: HARI_INI,
      jumlahHari: 3,
      asetId: 'a2',
    });
    expect(baris).toHaveLength(1);
    expect(baris[0].aset.id).toBe('a2');
  });

  it('menandai aset pemeliharaan di setiap sel', () => {
    const baris = papanJadwal(data([]), HARI_INI, { mulai: HARI_INI, jumlahHari: 1, asetId: 'a2' });
    expect(baris[0].sel[0].maintenance).toBe(true);
  });

  it('memperhitungkan jeda antar sewa pada sela', () => {
    const tanpaJeda = jendelaAset(aset[0], [rsv({})], '2026-10-13', 1, 0, HARI_INI);
    const denganJeda = jendelaAset(aset[0], [rsv({})], '2026-10-13', 1, 1, HARI_INI);
    expect(tanpaJeda[0].terpakai).toBe(0);
    expect(denganJeda[0].terpakai).toBe(1);
  });
});

describe('agenda harian', () => {
  it('menjumlahkan unit terpakai, bebas, dan pemeliharaan per hari', () => {
    const baris = barisAgenda(data([rsv({})]), { mulai: HARI_INI, jumlahHari: 2 });
    expect(baris[0].totalUnit).toBe(6);
    expect(baris[0].held).toBe(1);
    expect(baris[0].maintenance).toBe(4);
    expect(baris[0].tersedia).toBe(1);
  });
});

describe('ketersediaanHarian', () => {
  it('menjelaskan setiap aset pada hari itu', () => {
    const harian = ketersediaanHarian(data([rsv({})]), HARI_INI);
    expect(harian.map((b) => b.aset.id)).toEqual(['a1', 'a2']);
    expect(harian[0].terpakaiHariIni).toBe(1);
    expect(harian[0].tersediaHariIni).toBe(1);
    expect(harian[1].maintenance).toBe(true);
  });
});

describe('seed', () => {
  it('menghasilkan data demo utuh dan konsisten', () => {
    const demo = buatDataDemo(new Date(2026, 9, 14));
    expect(demo.aset.length).toBeGreaterThan(8);
    expect(demo.reservasi.length).toBeGreaterThan(10);
    expect(petaAset(demo).size).toBe(demo.aset.length);
    for (const r of demo.reservasi) {
      expect(petaAset(demo).has(r.asetId)).toBe(true);
      expect(r.tanggalSelesai >= r.tanggalMulai).toBe(true);
    }
  });
});