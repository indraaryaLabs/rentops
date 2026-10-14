/**
 * Booking lifecycle.
 *
 * Permintaan → Dipesan → Dipinjam → Dikembalikan, with a cancellation exit from
 * the first two states. Each transition records *when* the physical event
 * happened, which is what turns a status column into an audit trail.
 */

import type { Reservasi, StatusReservasi } from './types';
import { sekarangISO } from './tanggal';

export const TRANSISI: Record<StatusReservasi, readonly StatusReservasi[]> = {
  Permintaan: ['Dipesan', 'Dibatalkan'],
  Dipesan: ['Dipinjam', 'Dibatalkan'],
  Dipinjam: ['Dikembalikan'],
  Dikembalikan: [],
  Dibatalkan: [],
};

export type NadaTindakan = 'positif' | 'netral' | 'peringatan' | 'merah';

export interface Tindakan {
  ke: StatusReservasi;
  /** Verb used on buttons: "Konfirmasi", "Serahkan", "Terima", "Batalkan". */
  label: string;
  /** Full sentence used in the confirmation dialog. */
  penjelasan: string;
  nada: NadaTindakan;
  /** Whether the action must be confirmed before it runs. */
  konfirmasi: boolean;
  /** Optional custom confirmation copy. */
  pesanKonfirmasi?: string;
}

const TINDAKAN: Record<StatusReservasi, Tindakan> = {
  Permintaan: {
    ke: 'Permintaan',
    label: 'Permintaan',
    penjelasan: 'Pelanggan mengirim permintaan; stok baru ditahan sementara.',
    nada: 'netral',
    konfirmasi: false,
  },
  Dipesan: {
    ke: 'Dipesan',
    label: 'Konfirmasi',
    penjelasan: 'Permintaan disetujui dan stok ditahan pasti sampai jadwal pengambilan.',
    nada: 'positif',
    konfirmasi: false,
  },
  Dipinjam: {
    ke: 'Dipinjam',
    label: 'Serahkan',
    penjelasan: 'Aset diserahkan ke pelanggan dan tercatat sebagai keluar dari gudang.',
    nada: 'netral',
    konfirmasi: false,
  },
  Dikembalikan: {
    ke: 'Dikembalikan',
    label: 'Diterima',
    penjelasan: 'Aset kembali ke gudang dan unit langsung bisa disewa ulang.',
    nada: 'positif',
    konfirmasi: false,
  },
  Dibatalkan: {
    ke: 'Dibatalkan',
    label: 'Batalkan',
    penjelasan: 'Reservasi dibatalkan; stok yang ditahan langsung dilepas.',
    nada: 'merah',
    konfirmasi: true,
    pesanKonfirmasi:
      'Batalkan reservasi ini? Unit yang ditahan akan langsung dilepas, dan DP tidak dihitung lagi pada ketersediaan aset.',
  },
};

export function tindakanUntuk(status: StatusReservasi): Tindakan {
  return TINDAKAN[status];
}

/** Allowed next states, used by both the UI and the automation engine. */
export function transisiBerikut(status: StatusReservasi): StatusReservasi[] {
  return [...TRANSISI[status]];
}

export function statusBerikut(status: StatusReservasi): StatusReservasi | null {
  return TRANSISI[status][0] ?? null;
}

export function statusDitutup(status: StatusReservasi): boolean {
  return TRANSISI[status].length === 0;
}

export function bisaTransisi(dari: StatusReservasi, ke: StatusReservasi): boolean {
  return TRANSISI[dari].includes(ke);
}

/** Applies a status change and stamps the matching audit timestamps. */
export function terapkanStatus(
  reservasi: Reservasi,
  ke: StatusReservasi,
  waktu: string = sekarangISO(),
): Reservasi {
  const dasar: Reservasi = {
    ...reservasi,
    status: ke,
    diperbaruiPada: waktu,
  };
  if (ke === 'Dipinjam') return { ...dasar, diserahkanPada: waktu };
  if (ke === 'Dikembalikan') {
    return {
      ...dasar,
      dikembalikanPada: waktu,
      // A return without a hand-over stamp still deserves one.
      diserahkanPada: dasar.diserahkanPada ?? waktu,
    };
  }
  return dasar;
}

/** Human label for a status, used in prose and in the print document. */
export const LABEL_STATUS: Record<StatusReservasi, string> = {
  Permintaan: 'Permintaan',
  Dipesan: 'Dipesan',
  Dipinjam: 'Dipinjam',
  Dikembalikan: 'Dikembalikan',
  Dibatalkan: 'Dibatalkan',
};

export const DESKRIPSI_STATUS: Record<StatusReservasi, string> = {
  Permintaan: 'Menunggu persetujuan · stok ditahan sementara',
  Dipesan: 'Stok dijamin · menunggu pengambilan',
  Dipinjam: 'Aset sedang di pelanggan',
  Dikembalikan: 'Aset sudah kembali ke gudang',
  Dibatalkan: 'Dibatalkan · stok dilepas',
};