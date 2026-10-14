import { describe, expect, it } from 'vitest';
import type { Aset, DataAplikasi, Reservasi } from '../domain/types';
import { dapatDibatalkan, labelPerintah, perintahDariTindakan, terapkanPerintah } from './perintah';
import { ketersediaanHarian } from '../domain/selektor';

function dasar(stok = 3): DataAplikasi {
  return {
    skema: 2,
    profil: { nama: 'Usaha Uji', alamat: '', telepon: '', catatan: '' },
    aset: [
      {
        id: 'a1',
        kode: 'AST-01',
        nama: 'Tenda Dome',
        kategori: 'Perlengkapan Acara',
        jumlahTersedia: stok,
        hargaPerHari: 100_000,
        statusPemeliharaan: 'Aktif',
        jarakServisHari: null,
        catatan: '',
        dibuatPada: '2026-01-01T00:00:00.000Z',
        diperbaruiPada: '2026-01-01T00:00:00.000Z',
      },
    ],
    reservasi: [
      {
        id: 'r1',
        kode: 'RSV-1001',
        asetId: 'a1',
        pelanggan: 'Bapak Agus',
        kontak: '0812 1111 2222',
        jumlah: 1,
        tanggalMulai: '2026-10-14',
        tanggalSelesai: '2026-10-16',
        dp: 100_000,
        status: 'Dipesan',
        catatan: '',
        dibuatPada: '2026-10-01T00:00:00.000Z',
        diperbaruiPada: '2026-10-01T00:00:00.000Z',
        diserahkanPada: null,
        dikembalikanPada: null,
      },
    ],
  };
}

const WAKTU = '2026-10-14T09:00:00.000Z';

describe('perintah aset', () => {
  it('menambah aset baru di akhir daftar', () => {
    const aset = {
      id: 'a2',
      kode: 'AST-02',
      nama: 'Kursi',
      kategori: 'Perlengkapan Acara',
      jumlahTersedia: 10,
      hargaPerHari: 2_000,
      statusPemeliharaan: 'Aktif',
      jarakServisHari: null,
      catatan: '',
      dibuatPada: WAKTU,
      diperbaruiPada: WAKTU,
    } satisfies Aset;
    const hasil = terapkanPerintah({ jenis: 'aset/tambah', aset }, dasar(1));
    expect(hasil.gagal).toBeFalsy();
    expect(hasil.data.aset).toHaveLength(2);
    expect(labelPerintah({ jenis: 'aset/tambah', aset }, dasar(1))).toContain('AST-02');
  });

  it('mengubah dan menormalkan kode aset yang tersimpan', () => {
    const hasil = terapkanPerintah(
      { jenis: 'aset/ubah', aset: { ...dasar().aset[0], kode: 'ast-09' } },
      dasar(),
    );
    expect(hasil.data.aset[0].kode).toBe('AST-09');
  });

  it('menolak menghapus aset yang masih punya reservasi aktif', () => {
    const hasil = terapkanPerintah({ jenis: 'aset/hapus', id: 'a1' }, dasar());
    expect(hasil.gagal).toBe(true);
    expect(hasil.data.aset).toHaveLength(1);
    expect(hasil.pesan).toContain('masih');
  });

  it('menghapus aset bila reservasi sudah ditutup', () => {
    const madya = dasar();
    madya.reservasi[0].status = 'Dikembalikan';
    const hasil = terapkanPerintah({ jenis: 'aset/hapus', id: 'a1' }, madya);
    expect(hasil.gagal).toBeFalsy();
    expect(hasil.data.aset).toHaveLength(0);
    expect(hasil.data.reservasi).toHaveLength(0);
  });
});

describe('perintah reservasi', () => {
  it('menolak membuat reservasi bila stok tidak cukup', () => {
    const hasil = terapkanPerintah(
      {
        jenis: 'reservasi/tambah',
        reservasi: {
          ...dasar().reservasi[0],
          id: 'rX',
          kode: 'RSV-2001',
          jumlah: 3,
          tanggalMulai: '2026-10-14',
          tanggalSelesai: '2026-10-15',
        },
      },
      dasar(2),
    );
    expect(hasil.gagal).toBe(true);
    expect(hasil.rincian).toContain('Tenda Dome');
  });

  it('mengizinkan reservasi pada batas stok yang tersisa', () => {
    const hasil = terapkanPerintah(
      {
        jenis: 'reservasi/tambah',
        reservasi: {
          ...dasar().reservasi[0],
          id: 'rX',
          kode: 'RSV-2001',
          jumlah: 2,
          tanggalMulai: '2026-10-14',
          tanggalSelesai: '2026-10-15',
        },
      },
      dasar(3),
    );
    expect(hasil.gagal).toBeFalsy();
    expect(hasil.data.reservasi).toHaveLength(2);
  });

  it('menolak karena jeda antar sewa yang memperluas jendela', () => {
    const madya = dasar(2);
    const pelengkap = {
      id: 'rX',
      kode: 'RSV-2001',
      asetId: 'a1',
      pelanggan: 'Ibu Ratna',
      kontak: '',
      jumlah: 2,
      tanggalMulai: '2026-10-13',
      tanggalSelesai: '2026-10-13',
      dp: 0,
      status: 'Permintaan',
      catatan: '',
      dibuatPada: WAKTU,
      diperbaruiPada: WAKTU,
      diserahkanPada: null,
      dikembalikanPada: null,
    } satisfies Reservasi;

    const tanpaJeda = terapkanPerintah(
      { jenis: 'reservasi/tambah', reservasi: pelengkap },
      madya,
      WAKTU,
    );
    expect(tanpaJeda.gagal).toBeFalsy();

    const denganJeda = terapkanPerintah(
      { jenis: 'reservasi/tambah', reservasi: pelengkap },
      madya,
      WAKTU,
      { jeda: 1 },
    );
    expect(denganJeda.gagal).toBe(true);
    expect(denganJeda.rincian).toContain('Tenda Dome');
  });

  it('menyetel tanggal serah dan kembali sesuai alur', () => {
    const diserahkan = terapkanPerintah(
      { jenis: 'reservasi/status', id: 'r1', status: 'Dipinjam' },
      dasar(),
      WAKTU,
    );
    expect(diserahkan.data.reservasi[0].diserahkanPada).toBe(WAKTU);
    expect(diserahkan.data.reservasi[0].dikembalikanPada).toBeNull();

    const kembali = terapkanPerintah(
      { jenis: 'reservasi/status', id: 'r1', status: 'Dikembalikan' },
      diserahkan.data,
      WAKTU,
    );
    expect(kembali.data.reservasi[0].dikembalikanPada).toBe(WAKTU);
    expect(kembali.gagal).toBeFalsy();
  });

  it('menolak lompati langkah pada transisi status', () => {
    const hasil = terapkanPerintah(
      { jenis: 'reservasi/status', id: 'r1', status: 'Dikembalikan' },
      dasar(),
      WAKTU,
    );
    expect(hasil.gagal).toBe(true);
  });

  it('memperpanjang tanggal selesai dan menghitung subtotal baru', () => {
    const hasil = terapkanPerintah({ jenis: 'reservasi/perpanjang', id: 'r1', hari: 2 }, dasar(), WAKTU);
    expect(hasil.data.reservasi[0].tanggalSelesai).toBe('2026-10-18');
    expect(hasil.gagal).toBeFalsy();
  });

  it('melunasi dengan menaikkan DP ke subtotal', () => {
    const hasil = terapkanPerintah({ jenis: 'reservasi/lunasi', id: 'r1' }, dasar(), WAKTU);
    expect(hasil.data.reservasi[0].dp).toBe(300_000);
  });

  it('menduplikasi reservasi menjadi Permintaan baru', () => {
    const hasil = terapkanPerintah(
      { jenis: 'reservasi/duplikat', sumberId: 'r1', id: 'rX', kode: 'RSV-2001' },
      dasar(),
      WAKTU,
    );
    const baru = hasil.data.reservasi.find((r) => r.id === 'rX');
    expect(baru?.kode).toBe('RSV-2001');
    expect(baru?.status).toBe('Permintaan');
    expect(baru?.dp).toBe(0);
    expect(hasil.data.reservasi).toHaveLength(2);
  });

  it('menghapus reservasi beserta statusnya', () => {
    const hasil = terapkanPerintah({ jenis: 'reservasi/hapus', id: 'r1' }, dasar(), WAKTU);
    expect(hasil.data.reservasi).toHaveLength(0);
  });
});

describe('ringkas perintah', () => {
  it('menandai mana yang perlu ingat di undo', () => {
    expect(dapatDibatalkan({ jenis: 'reservasi/tambah' as never, reservasi: dasar().reservasi[0] })).toBe(true);
    expect(dapatDibatalkan({ jenis: 'data/impor', data: dasar() })).toBe(false);
  });

  it('memetakan tindakan otomasi ke perintah aplikasi', () => {
    expect(perintahDariTindakan({ jenis: 'reservasi/lunasi', id: 'r1' })).toEqual({
      jenis: 'reservasi/lunasi',
      id: 'r1',
    });
    expect(perintahDariTindakan({ jenis: 'aset/status', id: 'a1', status: 'Pemeliharaan' })).toEqual({
      jenis: 'aset/status',
      id: 'a1',
      status: 'Pemeliharaan',
    });
  });
});

describe('ketersediaan setelah perubahan', () => {
  it('unit bebas turun saat aset diubah menjadi pemeliharaan', () => {
    const sebelum = ketersediaanHarian(dasar(), '2026-10-15');
    const sesudah = ketersediaanHarian(
      terapkanPerintah({ jenis: 'aset/status', id: 'a1', status: 'Pemeliharaan' }, dasar(), WAKTU).data,
      '2026-10-15',
    );
    expect(sebelum[0].terpakaiHariIni).toBe(1);
    expect(sebelum[0].tersediaHariIni).toBe(2);
    expect(sesudah[0].maintenance).toBe(true);
    expect(sesudah[0].tersediaHariIni).toBe(0);
  });
});