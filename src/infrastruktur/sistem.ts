/**
 * Thin adapters over browser capabilities.
 *
 * Everything that can fail (clipboard, notifications, focus) returns a result
 * instead of throwing, and each one degrades to something the operator can still
 * use manually — a premium product never leaves the user stuck.
 */

import type { Aset, Reservasi } from '../domain/types';
import { formatTanggal } from '../domain/tanggal';
import { formatRupiah } from '../domain/uang';
import { ringkasSewa } from '../domain/sewa';
import { DESKRIPSI_STATUS } from '../domain/alur';

export type HasilSalin = { ok: true } | { ok: false; pesan: string };

export async function salinTeks(teks: string): Promise<HasilSalin> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(teks);
      return { ok: true };
    }
  } catch {
    /* jatuh ke fallback di bawah */
  }
  try {
    const area = document.createElement('textarea');
    area.value = teks;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const berhasil = document.execCommand('copy');
    area.remove();
    return berhasil ? { ok: true } : { ok: false, pesan: 'Peramban menolak penyalinan otomatis.' };
  } catch {
    return { ok: false, pesan: 'Peramban menolak penyalinan otomatis.' };
  }
}

/** Strips formatting so a phone number becomes a valid wa.me target. */
export function nomorWa(kontak: string): string | null {
  const angka = kontak.replace(/[^0-9]/g, '');
  if (angka.length < 9) return null;
  if (angka.startsWith('62')) return angka;
  if (angka.startsWith('0')) return `62${angka.slice(1)}`;
  if (angka.startsWith('8')) return `62${angka}`;
  return angka;
}

export interface PesanSewa {
  ringkasan: string;
  tautan: string | null;
  alasan?: string;
}

export function pesanReservasi(reservasi: Reservasi, aset: Aset | undefined): string {
  const ringkasan = ringkasSewa(reservasi, aset?.hargaPerHari ?? 0);
  const baris = [
    `Halo ${reservasi.pelanggan},`,
    '',
    `Ringkasan sewa dari ${reservasi.kode}:`,
    `• Aset: ${aset ? `${aset.kode} ${aset.nama}` : 'aset Anda'}`,
    `• Jumlah: ${reservasi.jumlah} unit`,
    `• Periode: ${formatTanggal(reservasi.tanggalMulai)} s/d ${formatTanggal(
      reservasi.tanggalSelesai,
    )} (${ringkasan.hariSewa} hari)`,
    `• Estimasi: ${formatRupiah(ringkasan.subtotal)}`,
    `• DP: ${formatRupiah(ringkasan.dp)}`,
    `• Sisa: ${formatRupiah(ringkasan.sisa)}`,
    `• Status: ${reservasi.status} — ${DESKRIPSI_STATUS[reservasi.status]}`,
  ];
  if (reservasi.catatan) baris.push('', `Catatan: ${reservasi.catatan}`);
  baris.push('', 'Pesan ini disiapkan otomatis oleh petugas dan belum terkirim.');
  return baris.join('\n');
}

/** Builds (but never sends) a wa.me deep link. */
export function tautanWa(kontak: string, pesan: string): PesanSewa | null {
  const nomor = nomorWa(kontak);
  if (!nomor) return null;
  return {
    ringkasan: pesan,
    tautan: `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`,
  };
}

export interface RingkasanHarian {
  teks: string;
  baris: string[];
}

export function ringkasanHarian(params: {
  tanggal: string;
  ambil: Reservasi[];
  kembali: Reservasi[];
  terlambat: Reservasi[];
  namaAset: (r: Reservasi) => string;
}): RingkasanHarian {
  const { tanggal, ambil, kembali, terlambat, namaAset } = params;
  const baris = [
    `📅 ${formatTanggal(tanggal)}`,
    ambil.length > 0
      ? `Dikirim hari ini: ${ambil.map((r) => `${r.kode} (${namaAset(r)} ×${r.jumlah})`).join(', ')}`
      : 'Tidak ada pengambilan hari ini.',
    kembali.length > 0
      ? `Diterima hari ini: ${kembali.map((r) => `${r.kode} (${namaAset(r)} ×${r.jumlah})`).join(', ')}`
      : 'Tidak ada pengembalian hari ini.',
    terlambat.length > 0
      ? `⚠️ Terlambat: ${terlambat.map((r) => `${r.kode} (${namaAset(r)})`).join(', ')}`
      : 'Tidak ada keterlambatan.',
  ];
  return { teks: baris.join('\n'), baris };
}

export type HasilTema = 'terang' | 'gelap';

export function temaSistem(): HasilTema {
  if (typeof window === 'undefined' || !window.matchMedia) return 'terang';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'gelap' : 'terang';
}

export function terapkanTema(tema: HasilTema): void {
  const akar = document.documentElement;
  akar.dataset.tema = tema;
  akar.style.colorScheme = tema;
}

export function dengarkanPerubahanTemaSistem(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const kueri = window.matchMedia('(prefers-color-scheme: dark)');
  const ganti = () => terapkanTema(kueri.matches ? 'gelap' : 'terang');
  kueri.addEventListener('change', ganti);
  return () => kueri.removeEventListener('change', ganti);
}

/** Requests OS-level focus without permission prompts (progressive enhancement). */
export function mintaFokus(): void {
  try {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      void (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<unknown> } }).wakeLock
        .request('screen')
        .catch(() => undefined);
    }
  } catch {
    /* tidak didukung — abaikan */
  }
}