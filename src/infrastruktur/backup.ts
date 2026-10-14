/**
 * Backup: export, import and snapshot restore.
 *
 * Import is deliberately conservative — a file must pass the same migration and
 * validation gate as stored state before it is allowed anywhere near the live
 * data, and a rejected file never mutates anything.
 */

import type { DataAplikasi } from '../domain/types';
import { migrasiData, SKEMA_TERBARU, type HasilMigrasi } from './migrasi';
import {
  muatSnapshot,
  bersihkanSemua,
  type AntarmukaPenyimpanan,
  type Snapshot,
} from './db';

export const POLA_NAMA_BERKAS = /^rentops-(backup|snapshot)-\d{4}-\d{2}-\d{2}(-\d{2}-\d{2})?\.json$/;

export function namaBerkasCadangan(sekarang: Date = new Date()): string {
  const t = sekarang.getTime();
  const d = new Date(t);
  const dua = (n: number) => String(n).padStart(2, '0');
  return `rentops-backup-${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}.json`;
}

export function namaBerkasSnapshot(snapshot: Snapshot): string {
  const d = new Date(snapshot.waktu);
  const dua = (n: number) => String(n).padStart(2, '0');
  return `rentops-snapshot-${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}-${dua(
    d.getHours(),
  )}-${dua(d.getMinutes())}.json`;
}

export function backupJSON(data: DataAplikasi): string {
  return `${JSON.stringify({ skema: SKEMA_TERBARU, dibuatPada: new Date().toISOString(), data }, null, 2)}\n`;
}

export type HasilImpor =
  | { ok: true; data: DataAplikasi; catatan: string[]; ringkasan: string }
  | { ok: false; galat: string[] };

export function imporJSON(teks: string): HasilImpor {
  if (teks.trim() === '') return { ok: false, galat: ['Berkas impor kosong.'] };
  let json: unknown;
  try {
    json = JSON.parse(teks);
  } catch (error) {
    const pesan = error instanceof Error ? error.message : 'kesalahan tidak diketahui';
    return { ok: false, galat: [`Berkas bukan JSON yang valid: ${pesan}`] };
  }
  const hasil: HasilMigrasi = migrasiData(json);
  if (!hasil.ok) return { ok: false, galat: hasil.galat };
  return {
    ok: true,
    data: hasil.data,
    catatan: hasil.catatan,
    ringkasan: `${hasil.data.aset.length} aset dan ${hasil.data.reservasi.length} reservasi terbaca.`,
  };
}

export function bacaSnapshot(penyimpanan: AntarmukaPenyimpanan): Snapshot[] {
  return muatSnapshot(penyimpanan);
}

export function bersihkanPenyimpanan(penyimpanan: AntarmukaPenyimpanan): void {
  bersihkanSemua(penyimpanan);
}

/** Triggers a browser download without touching the network. */
export function unduhTeks(namaBerkas: string, isi: string, tipe = 'application/json'): void {
  const blob = new Blob([isi], { type: `${tipe};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const tautan = document.createElement('a');
  tautan.href = url;
  tautan.download = namaBerkas;
  tautan.rel = 'noopener';
  document.body.appendChild(tautan);
  tautan.click();
  document.body.removeChild(tautan);
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function bacaBerkasTeks(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const pembaca = new FileReader();
    pembaca.onload = () => {
      if (typeof pembaca.result === 'string') resolve(pembaca.result);
      else reject(new Error('Isi berkas tidak dapat dibaca sebagai teks.'));
    };
    pembaca.onerror = () => reject(new Error('Berkas gagal dibaca.'));
    pembaca.readAsText(file, 'utf-8');
  });
}

/** Human summary used by the backup panel and by the import review dialog. */
export function ringkasData(data: DataAplikasi): { aset: number; reservasi: number; unit: number } {
  return {
    aset: data.aset.length,
    reservasi: data.reservasi.length,
    unit: data.aset.reduce((total, item) => total + item.jumlahTersedia, 0),
  };
}