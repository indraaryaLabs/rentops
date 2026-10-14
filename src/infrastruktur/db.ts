/**
 * Local persistence — the only module that talks to localStorage.
 *
 * Design notes:
 *  · A versioned envelope with an explicit migration chain, so old backups keep
 *    opening after a schema change instead of silently resetting.
 *  · Automatic snapshots: the last N states are kept in a separate key, which is
 *    what makes "undo across sessions" possible without a server.
 *  · Every read is defensive. A corrupt or hostile value can never crash boot;
 *    the worst case is falling back to a fresh demo dataset.
 */

import type { Aset, DataAplikasi, Preferensi, Reservasi } from '../domain/types';
import { PREFERENSI_AWAL, PROFIL_AWAL } from '../domain/types';
import { buatDataDemo } from '../domain/seed';
import { migrasiData, SKEMA_TERBARU } from './migrasi';

export const KUNCI_DATA = 'rentops.data.v2';
export const KUNCI_SNAPSHOT = 'rentops.snapshot.v1';
export const KUNCI_PREFERENSI = 'rentops.preferensi.v1';
export const BATAS_SNAPSHOT = 12;

export interface Amplop<T> {
  versi: number;
  disimpanPada: string;
  data: T;
}

export interface Snapshot {
  id: string;
  waktu: string;
  label: string;
  data: DataAplikasi;
}

export interface AntarmukaPenyimpanan {
  baca(kunci: string): string | null;
  tulis(kunci: string, nilai: string): boolean;
  hapus(kunci: string): void;
}

export class PenyimpananTidakTersedia implements AntarmukaPenyimpanan {
  baca(): string | null {
    return null;
  }

  tulis(): boolean {
    return false;
  }

  hapus(): void {
    /* tidak ada yang dilakukan */
  }
}

export function penyimpananPeramban(): AntarmukaPenyimpanan {
  try {
    if (typeof localStorage === 'undefined') return new PenyimpananTidakTersedia();
    const uji = '__rentops_uji__';
    localStorage.setItem(uji, '1');
    localStorage.removeItem(uji);
    return {
      baca: (kunci: string) => window.localStorage.getItem(kunci),
      tulis: (kunci: string, nilai: string) => {
        window.localStorage.setItem(kunci, nilai);
        return true;
      },
      hapus: (kunci: string) => window.localStorage.removeItem(kunci),
    };
  } catch {
    return new PenyimpananTidakTersedia();
  }
}

export type SumberMuat = 'penyimpanan' | 'demo' | 'pulih';

export interface HasilMuat {
  data: DataAplikasi;
  sumber: SumberMuat;
  pesan: string;
}

/** Reads, migrates and validates. Never throws. */
export function muatData(
  penyimpanan: AntarmukaPenyimpanan = penyimpananPeramban(),
  sekarang: Date = new Date(),
): HasilMuat {
  const mentah = aman(() => penyimpanan.baca(KUNCI_DATA), null);
  if (mentah === null) {
    return {
      data: buatDataDemo(sekarang),
      sumber: 'demo',
      pesan: 'Data demo dibuat untuk perangkat ini.',
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(mentah);
  } catch {
    return {
      data: buatDataDemo(sekarang),
      sumber: 'demo',
      pesan: 'Data lokal rusak, data demo dimuat ulang.',
    };
  }

  const hasil = migrasiData(json);
  if (!hasil.ok) {
    return {
      data: buatDataDemo(sekarang),
      sumber: 'demo',
      pesan: 'Data lokal tidak valid, data demo dimuat ulang.',
    };
  }

  return { data: hasil.data, sumber: 'penyimpanan', pesan: 'Data lokal dimuat.' };
}

function aman<T>(fn: () => T, bawaan: T): T {
  try {
    return fn();
  } catch {
    return bawaan;
  }
}

/** Writes the versioned envelope. Returns false when storage is unavailable. */
export function simpanData(
  data: DataAplikasi,
  penyimpanan: AntarmukaPenyimpanan = penyimpananPeramban(),
  waktu: Date = new Date(),
): boolean {
  const amplop: Amplop<DataAplikasi> = {
    versi: SKEMA_TERBARU,
    disimpanPada: waktu.toISOString(),
    data,
  };
  return aman(() => {
    const ok = penyimpanan.tulis(KUNCI_DATA, JSON.stringify(amplop));
    return ok;
  }, false);
}

/* ------------------------------------------------------------------ */
/* Preferences — UI state that should survive a reload                  */
/* ------------------------------------------------------------------ */

export function muatPreferensi(
  penyimpanan: AntarmukaPenyimpanan = penyimpananPeramban(),
): Preferensi {
  const mentah = aman(() => penyimpanan.baca(KUNCI_PREFERENSI), null);
  if (!mentah) return { ...PREFERENSI_AWAL };
  try {
    const json = JSON.parse(mentah) as Partial<Preferensi>;
    return {
      tema: bacaTema(json.tema),
      kepadatan: json.kepadatan === 'rapat' ? 'rapat' : 'nyaman',
      sidebar: json.sidebar === 'tipis' ? 'tipis' : 'lebar',
      jedaAntarSewaHari: clampInt(json.jedaAntarSewaHari, 0, 7),
      ambangSisaHariServis: clampInt(json.ambangSisaHariServis, 0, 365),
    };
  } catch {
    return { ...PREFERENSI_AWAL };
  }
}

export function simpanPreferensi(
  preferensi: Preferensi,
  penyimpanan: AntarmukaPenyimpanan = penyimpananPeramban(),
): boolean {
  return aman(() => {
    penyimpanan.tulis(KUNCI_PREFERENSI, JSON.stringify(preferensi));
    return true;
  }, false);
}

function bacaTema(nilai: unknown): Preferensi['tema'] {
  return nilai === 'terang' || nilai === 'gelap' ? nilai : 'sistem';
}

function clampInt(nilai: unknown, min: number, max: number): number {
  const angka = typeof nilai === 'number' && Number.isFinite(nilai) ? Math.round(nilai) : min;
  return Math.min(max, Math.max(min, angka));
}

/* ------------------------------------------------------------------ */
/* Snapshots — free local undo history                                  */
/* ------------------------------------------------------------------ */

export function muatSnapshot(
  penyimpanan: AntarmukaPenyimpanan = penyimpananPeramban(),
): Snapshot[] {
  const mentah = aman(() => penyimpanan.baca(KUNCI_SNAPSHOT), null);
  if (!mentah) return [];
  try {
    const json = JSON.parse(mentah) as Snapshot[];
    if (!Array.isArray(json)) return [];
    return json.filter((item) => typeof item?.id === 'string' && typeof item?.data === 'object');
  } catch {
    return [];
  }
}

export function simpanSnapshot(
  daftar: Snapshot[],
  penyimpanan: AntarmukaPenyimpanan = penyimpananPeramban(),
): boolean {
  return aman(() => {
    penyimpanan.tulis(KUNCI_SNAPSHOT, JSON.stringify(daftar.slice(0, BATAS_SNAPSHOT)));
    return true;
  }, false);
}

export function tambahSnapshot(
  storage: AntarmukaPenyimpanan = penyimpananPeramban(),
  data: DataAplikasi,
  label: string,
  waktu: Date = new Date(),
): Snapshot[] {
  const daftar = [
    { id: `${waktu.getTime()}`, waktu: waktu.toISOString(), label, data },
    ...muatSnapshot(storage),
  ].slice(0, BATAS_SNAPSHOT);
  simpanSnapshot(daftar, storage);
  return daftar;
}

export function bersihkanSemua(penyimpanan: AntarmukaPenyimpanan = penyimpananPeramban()): void {
  aman(() => {
    penyimpanan.hapus(KUNCI_DATA);
    penyimpanan.hapus(KUNCI_SNAPSHOT);
    return true;
  }, false);
}

export type { Aset, Reservasi };
export { PROFIL_AWAL };