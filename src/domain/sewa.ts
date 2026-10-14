/**
 * Rental period rules: inclusive day counts, pricing and balance.
 */

import type { Reservasi, RingkasanSewa } from './types';
import { hitungHariSewa } from './tanggal';
import { rupiah } from './uang';

export { hitungHariSewa };

export interface RentangSewa {
  mulai: string;
  selesai: string;
}

/** A period is valid when both ends are real dates and the end is not before the start. */
export function rentangValid(rentang: RentangSewa): boolean {
  return rentang.mulai <= rentang.selesai && rentang.mulai.length === 10 && rentang.selesai.length === 10;
}

/** amount × days × rate, floored to a single day so a period never costs zero. */
export function hitungSubtotal(jumlah: number, hargaPerHari: number, rentang: RentangSewa): number {
  if (!rentangValid(rentang)) return 0;
  const hari = hitungHariSewa(rentang.mulai, rentang.selesai);
  return rupiah(jumlah * hargaPerHari * hari);
}

/** Deposit clamping keeps the stored number sane regardless of caller. */
export function normalisasiDP(dp: number, subtotal: number): number {
  if (!Number.isFinite(dp) || dp < 0) return 0;
  return rupiah(Math.min(dp, Math.max(0, subtotal)));
}

export function ringkasSewa(
  reservasi: Reservasi,
  hargaPerHari: number,
): RingkasanSewa {
  const hariSewa = hitungHariSewa(reservasi.tanggalMulai, reservasi.tanggalSelesai);
  const subtotal = hitungSubtotal(reservasi.jumlah, hargaPerHari, {
    mulai: reservasi.tanggalMulai,
    selesai: reservasi.tanggalSelesai,
  });
  const dp = normalisasiDP(reservasi.dp, subtotal);
  return {
    hariSewa,
    hargaPerHari,
    subtotal,
    dp,
    sisa: rupiah(subtotal - dp),
  };
}

/** Extending a rental keeps the original start date and only pushes the end out. */
export function perpanjangRentang(rentang: RentangSewa, hari: number): RentangSewa {
  if (hari <= 0) return rentang;
  const dasar = rentang.selesai >= rentang.mulai ? rentang.selesai : rentang.mulai;
  const d = new Date(`${dasar}T00:00:00`);
  d.setDate(d.getDate() + hari);
  const selesai = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  return { mulai: rentang.mulai, selesai };
}

/** Days a booking is past its end date; 0 when not overdue. */
export function hariTerlambat(reservasi: Reservasi, hariIni: string): number {
  const lewat = Math.floor(
    (Date.parse(`${hariIni}T00:00:00Z`) - Date.parse(`${reservasi.tanggalSelesai}T00:00:00Z`)) /
      86_400_000,
  );
  return lewat > 0 ? lewat : 0;
}