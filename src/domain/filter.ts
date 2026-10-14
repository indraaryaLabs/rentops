/**
 * Table search, filters and sorting.
 *
 * Kept as pure functions so the "does search return the right rows?" question can
 * be answered by a test rather than by clicking.
 */

import type { Aset, Reservasi, StatusReservasi } from './types';
import { tambahHari } from './tanggal';
import { menahanStok } from './ketersediaan';

export const OPSI_PERIODE = [
  { nilai: 'semua', label: 'Semua periode' },
  { nilai: 'berjalan', label: 'Sedang berjalan' },
  { nilai: 'hari-ini', label: 'Aktif hari ini' },
  { nilai: '7-hari', label: '7 hari ke depan' },
  { nilai: '30-hari', label: '30 hari ke depan' },
  { nilai: 'bulan-ini', label: 'Bulan ini' },
  { nilai: 'kustom', label: 'Rentang kustom' },
  { nilai: 'riwayat', label: 'Riwayat (selesai/batal)' },
] as const;

export type NilaiPeriode = (typeof OPSI_PERIODE)[number]['nilai'];

export interface FilterReservasi {
  cari: string;
  status: StatusReservasi | 'semua';
  periode: NilaiPeriode;
  dari: string;
  sampai: string;
  /** Optional asset focus, used when jumping from the schedule board. */
  asetId: string | null;
}

export function filterKosong(): FilterReservasi {
  return { cari: '', status: 'semua', periode: 'semua', dari: '', sampai: '', asetId: null };
}

export function normalisasi(teks: string): string {
  return teks.trim().toLowerCase().replace(/\s+/g, ' ');
}

function rentangEfektif(
  periode: NilaiPeriode,
  hariIni: string,
  dari: string,
  sampai: string,
): [string, string] | null {
  switch (periode) {
    case 'hari-ini':
      return [hariIni, hariIni];
    case '7-hari':
      return [hariIni, tambahHari(hariIni, 6)];
    case '30-hari':
      return [hariIni, tambahHari(hariIni, 29)];
    case 'bulan-ini': {
      const awal = `${hariIni.slice(0, 7)}-01`;
      const d = new Date(`${awal}T00:00:00`);
      d.setMonth(d.getMonth() + 1);
      d.setDate(0);
      const akhir = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`;
      return [awal, akhir];
    }
    case 'kustom': {
      if (!dari || !sampai) return null;
      return dari <= sampai ? [dari, sampai] : [sampai, dari];
    }
    default:
      return null;
  }
}

export function saringReservasi(
  daftar: readonly Reservasi[],
  filter: FilterReservasi,
  aset: Map<string, Aset>,
  hariIni: string,
): Reservasi[] {
  const kunci = normalisasi(filter.cari);
  const rentang = rentangEfektif(filter.periode, hariIni, filter.dari, filter.sampai);

  return daftar.filter((item) => {
    if (filter.status !== 'semua' && item.status !== filter.status) return false;
    if (filter.asetId && item.asetId !== filter.asetId) return false;

    if (filter.periode === 'berjalan') {
      if (!menahanStok(item.status)) return false;
    } else if (filter.periode === 'riwayat') {
      if (menahanStok(item.status)) return false;
    } else if (rentang) {
      const [dari, sampai] = rentang;
      if (!(item.tanggalMulai <= sampai && item.tanggalSelesai >= dari)) return false;
    }

    if (!kunci) return true;
    const barang = aset.get(item.asetId);
    const gabung = normalisasi(
      [
        item.kode,
        item.pelanggan,
        item.kontak,
        item.catatan,
        barang?.nama ?? '',
        barang?.kode ?? '',
      ].join(' '),
    );
    return gabung.includes(kunci);
  });
}

export type Urutan = 'tanggal-asc' | 'tanggal-desc' | 'nilai-desc' | 'nilai-asc' | 'kode-asc';

export function urutkanReservasi(
  daftar: readonly Reservasi[],
  urutan: Urutan = 'tanggal-asc',
  aset?: Map<string, Aset>,
): Reservasi[] {
  const salinan = [...daftar];
  const nilai = (item: Reservasi) => {
    const barang = aset?.get(item.asetId);
    const hari = Math.max(
      1,
      Math.round(
        (Date.parse(`${item.tanggalSelesai}T00:00:00Z`) - Date.parse(`${item.tanggalMulai}T00:00:00Z`)) /
          86_400_000,
      ) + 1,
    );
    return (barang?.hargaPerHari ?? 0) * item.jumlah * hari;
  };

  salinan.sort((a, b) => {
    switch (urutan) {
      case 'tanggal-desc':
        return b.tanggalMulai.localeCompare(a.tanggalMulai) || a.kode.localeCompare(b.kode);
      case 'nilai-desc':
        return nilai(b) - nilai(a) || a.kode.localeCompare(b.kode);
      case 'nilai-asc':
        return nilai(a) - nilai(b) || a.kode.localeCompare(b.kode);
      case 'kode-asc':
        return a.kode.localeCompare(b.kode);
      case 'tanggal-asc':
      default:
        return a.tanggalMulai.localeCompare(b.tanggalMulai) || a.kode.localeCompare(b.kode);
    }
  });
  return salinan;
}

export function saringAset(
  daftar: readonly Aset[],
  filter: { cari: string; kategori: string; status: string },
): Aset[] {
  const kunci = normalisasi(filter.cari);
  return daftar.filter((item) => {
    if (filter.kategori && filter.kategori !== 'semua' && item.kategori !== filter.kategori) return false;
    if (filter.status && filter.status !== 'semua' && item.statusPemeliharaan !== filter.status) return false;
    if (!kunci) return true;
    return normalisasi(`${item.nama} ${item.kode} ${item.catatan}`).includes(kunci);
  });
}

export function adaFilterAktif(filter: FilterReservasi): boolean {
  return (
    filter.cari !== '' ||
    filter.status !== 'semua' ||
    filter.periode !== 'semua' ||
    filter.asetId !== null
  );
}