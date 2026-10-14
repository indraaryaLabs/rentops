/**
 * Availability engine — the heart of the product.
 *
 * Three ideas, all local and deterministic:
 *
 * 1. A booking *holds stock* while it is Permintaan (soft hold), Dipesan (hard
 *    hold) or Dipinjam (physically out). Dibatalkan and Dikembalikan release it.
 * 2. Windows are closed intervals: startA <= endB && endA >= startB. Two rentals
 *    that merely touch on a single day do overlap, which is the whole point.
 * 3. Optional *buffer* — each held booking blocks `jeda` extra days on both
 *    sides for cleaning, transport and inspection. With jeda = 0 this collapses
 *    to the plain overlap rule, so the default keeps the strict PRD behaviour.
 */

import type { Aset, Reservasi, StatusReservasi } from './types';
import { rentangTumpangTindih, tambahHari } from './tanggal';

export const STATUS_MENAHAN_STOK: readonly StatusReservasi[] = [
  'Permintaan',
  'Dipesan',
  'Dipinjam',
];

export function menahanStok(status: StatusReservasi): boolean {
  return STATUS_MENAHAN_STOK.includes(status);
}

export interface OpsiKetersediaan {
  /** Days of buffer blocked on each side of an existing booking. */
  jeda?: number;
  /** Booking id being edited — excluded from its own calculation. */
  kecualiId?: string;
}

/** The window a held booking actually blocks, after buffer expansion. */
export function jendelaTerpakai(
  reservasi: Reservasi,
  jeda = 0,
): { mulai: string; selesai: string } {
  return {
    mulai: jeda > 0 ? tambahHari(reservasi.tanggalMulai, -jeda) : reservasi.tanggalMulai,
    selesai: jeda > 0 ? tambahHari(reservasi.tanggalSelesai, jeda) : reservasi.tanggalSelesai,
  };
}

/** Units already committed on a given closed interval for one asset. */
export function hitungUnitTerpakai(
  reservasi: Reservasi[],
  asetId: string,
  mulai: string,
  selesai: string,
  opsi: OpsiKetersediaan = {},
): number {
  const { jeda = 0, kecualiId } = opsi;
  let total = 0;
  for (const item of reservasi) {
    if (item.asetId !== asetId) continue;
    if (item.id === kecualiId) continue;
    if (!menahanStok(item.status)) continue;
    const jendela = jendelaTerpakai(item, jeda);
    if (rentangTumpangTindih(mulai, selesai, jendela.mulai, jendela.selesai)) {
      total += item.jumlah;
    }
  }
  return total;
}

export function unitTersedia(
  aset: Aset,
  reservasi: Reservasi[],
  mulai: string,
  selesai: string,
  opsi: OpsiKetersediaan = {},
): number {
  const terpakai = hitungUnitTerpakai(reservasi, aset.id, mulai, selesai, opsi);
  return Math.max(0, aset.jumlahTersedia - terpakai);
}

export interface HasilKetersediaan {
  boleh: boolean;
  alasan: string;
  diminta: number;
  terpakai: number;
  tersedia: number;
  maintenance: boolean;
}

export function periksaKetersediaan(params: {
  aset: Aset | undefined;
  reservasi: Reservasi[];
  mulai: string;
  selesai: string;
  jumlah: number;
  jeda?: number;
  kecualiId?: string;
}): HasilKetersediaan {
  const { aset, reservasi, mulai, selesai, jumlah, jeda = 0, kecualiId } = params;
  const maintenance = aset?.statusPemeliharaan !== 'Aktif';

  if (!aset) {
    return {
      boleh: false,
      alasan: 'Aset yang dipilih tidak ditemukan.',
      diminta: jumlah,
      terpakai: 0,
      tersedia: 0,
      maintenance: false,
    };
  }

  const terpakai = hitungUnitTerpakai(reservasi, aset.id, mulai, selesai, { jeda, kecualiId });
  const tersedia = Math.max(0, aset.jumlahTersedia - terpakai);

  if (maintenance) {
    return {
      boleh: false,
      alasan: `${aset.nama} sedang dalam pemeliharaan sehingga tidak bisa dipesan.`,
      diminta: jumlah,
      terpakai,
      tersedia,
      maintenance: true,
    };
  }

  if (jumlah <= 0) {
    return {
      boleh: false,
      alasan: 'Jumlah unit harus minimal 1.',
      diminta: jumlah,
      terpakai,
      tersedia,
      maintenance,
    };
  }

  if (terpakai === 0) {
    return {
      boleh: true,
      alasan: '',
      diminta: jumlah,
      terpakai,
      tersedia,
      maintenance,
    };
  }

  if (jumlah <= tersedia) {
    return {
      boleh: true,
      alasan: '',
      diminta: jumlah,
      terpakai,
      tersedia,
      maintenance,
    };
  }

  if (terpakai >= aset.jumlahTersedia) {
    return {
      boleh: false,
      alasan: `Semua ${aset.jumlahTersedia} unit ${aset.nama} sudah terpakai pada rentang tersebut.`,
      diminta: jumlah,
      terpakai,
      tersedia,
      maintenance,
    };
  }

  return {
    boleh: false,
    alasan: `Sisa unit ${aset.nama} pada rentang tersebut hanya ${tersedia} unit (diminta ${jumlah}, sudah terpakai ${terpakai}).`,
    diminta: jumlah,
    terpakai,
    tersedia,
    maintenance,
  };
}

/** Per-day occupancy for one asset — drives the timeline and availability table. */
export interface SelKetersediaan {
  tanggal: string;
  terpakai: number;
  tersedia: number;
  /** Over capacity is impossible to create through the UI, but imported data may contain it. */
  kelebihan: number;
  maintenance: boolean;
}

export function selKetersediaanHarian(
  aset: Aset,
  reservasi: Reservasi[],
  tanggal: string,
  jeda = 0,
): SelKetersediaan {
  const terpakai = hitungUnitTerpakai(reservasi, aset.id, tanggal, tanggal, { jeda });
  const maintenance = aset.statusPemeliharaan !== 'Aktif';
  return {
    tanggal,
    terpakai: maintenance ? 0 : terpakai,
    tersedia: maintenance ? 0 : Math.max(0, aset.jumlahTersedia - terpakai),
    kelebihan: maintenance ? 0 : Math.max(0, terpakai - aset.jumlahTersedia),
    maintenance,
  };
}

/** Total rented days per asset across its whole history — feeds service advice. */
export function totalHariDisewa(reservasi: Reservasi[], asetId: string): number {
  return reservasi
    .filter((item) => item.asetId === asetId && item.status !== 'Dibatalkan')
    .reduce((total, item) => {
      const mulai = Date.parse(`${item.tanggalMulai}T00:00:00Z`);
      const selesai = Date.parse(`${item.tanggalSelesai}T00:00:00Z`);
      return total + Math.max(1, Math.round((selesai - mulai) / 86_400_000) + 1);
    }, 0);
}

export function asetBisaDipesan(aset: Aset): boolean {
  return aset.statusPemeliharaan === 'Aktif';
}