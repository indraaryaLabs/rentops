/**
 * Calendar primitives.
 *
 * RentOps models a rental period as a closed interval of local calendar dates:
 * the start day and the end day are both counted. All arithmetic goes through
 * a UTC-midnight day number so daylight-saving transitions can never shift a
 * result by one.
 */

export const MS_PER_HARI = 86_400_000;

const POLA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export const NAMA_HARI = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

export const NAMA_HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;

export const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export const NAMA_BULAN_PENDEK = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

export function adalahTanggalISO(nilai: string): boolean {
  const cocok = POLA_ISO.exec(nilai);
  if (!cocok) return false;
  const tahun = Number(cocok[1]);
  const bulan = Number(cocok[2]);
  const hari = Number(cocok[3]);
  if (bulan < 1 || bulan > 12 || hari < 1) return false;
  return hari <= new Date(tahun, bulan, 0).getDate();
}

export function keTanggalISO(tanggal: Date): string {
  const tahun = String(tanggal.getFullYear()).padStart(4, '0');
  const bulan = String(tanggal.getMonth() + 1).padStart(2, '0');
  const hari = String(tanggal.getDate()).padStart(2, '0');
  return `${tahun}-${bulan}-${hari}`;
}

export function dariTanggalISO(iso: string): Date {
  const cocok = POLA_ISO.exec(iso);
  if (!cocok) throw new Error(`Tanggal tidak valid: ${iso}`);
  return new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]));
}

/** Days since epoch at UTC midnight — a DST-proof integer day number. */
export function nomorHari(iso: string): number {
  const d = dariTanggalISO(iso);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_HARI;
}

export function dariNomorHari(nomor: number): string {
  const d = new Date(nomor * MS_PER_HARI);
  const tahun = d.getUTCFullYear();
  const bulan = String(d.getUTCMonth() + 1).padStart(2, '0');
  const hari = String(d.getUTCDate()).padStart(2, '0');
  return `${tahun}-${bulan}-${hari}`;
}

export function hariIni(sekarang: Date = new Date()): string {
  return keTanggalISO(sekarang);
}

export function tambahHari(iso: string, jumlah: number): string {
  return dariNomorHari(nomorHari(iso) + jumlah);
}

export function selisihHari(dari: string, sampai: string): number {
  return nomorHari(sampai) - nomorHari(dari);
}

/** Day of month (1–31) for the given ISO date — used for calendar column headings. */
export function hariDalamBulan(iso: string): number {
  return dariTanggalISO(iso).getDate();
}

export function hariDalamMinggu(iso: string): number {
  return dariTanggalISO(iso).getDay();
}

/** First day of the calendar month containing `iso`. */
export function awalBulan(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Inclusive day count of a rental, floored at 1 for reversed input. */
export function hitungHariSewa(mulai: string, selesai: string): number {
  const hari = selisihHari(mulai, selesai) + 1;
  return hari < 1 ? 1 : hari;
}

/** Closed-interval overlap test: startA <= endB && endA >= startB. */
export function rentangTumpangTindih(
  mulaiA: string,
  selesaiA: string,
  mulaiB: string,
  selesaiB: string,
): boolean {
  return mulaiA <= selesaiB && selesaiA >= mulaiB;
}

/** Inclusive list of ISO dates between two endpoints (inclusive both ends). */
export function rentangTanggal(mulai: string, selesai: string): string[] {
  const hasil: string[] = [];
  const mulaiNomor = nomorHari(mulai);
  const selesaiNomor = nomorHari(selesai);
  if (selesaiNomor < mulaiNomor) return hasil;
  for (let n = mulaiNomor; n <= selesaiNomor; n += 1) {
    hasil.push(dariNomorHari(n));
  }
  return hasil;
}

/** Chronological list of dates starting at `mulai`, `jumlah` entries long. */
export function deretTanggal(mulai: string, jumlah: number): string[] {
  const hasil: string[] = [];
  for (let i = 0; i < jumlah; i += 1) hasil.push(tambahHari(mulai, i));
  return hasil;
}

export function formatTanggal(iso: string): string {
  if (!adalahTanggalISO(iso)) return '—';
  const d = dariTanggalISO(iso);
  return `${d.getDate()} ${NAMA_BULAN_PENDEK[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTanggalPendek(iso: string): string {
  if (!adalahTanggalISO(iso)) return '—';
  const d = dariTanggalISO(iso);
  return `${d.getDate()} ${NAMA_BULAN_PENDEK[d.getMonth()]}`;
}

export function formatTanggalPanjang(iso: string): string {
  if (!adalahTanggalISO(iso)) return '—';
  const d = dariTanggalISO(iso);
  return `${NAMA_HARI[d.getDay()]}, ${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTanggalPendekBulan(iso: string): string {
  if (!adalahTanggalISO(iso)) return '—';
  const d = dariTanggalISO(iso);
  return `${NAMA_BULAN_PENDEK[d.getMonth()]} ${d.getFullYear()}`;
}

/** "12 Okt" — the label used inside dense timeline headers. */
export function formatTanggalRingkas(iso: string): string {
  if (!adalahTanggalISO(iso)) return '—';
  const d = dariTanggalISO(iso);
  return `${d.getDate()} ${NAMA_BULAN_PENDEK[d.getMonth()]}`;
}

/** "Sen" — weekday letter used inside timeline headers. */
export function formatHariMinggu(iso: string): string {
  if (!adalahTanggalISO(iso)) return '—';
  return NAMA_HARI_PENDEK[dariTanggalISO(iso).getDay()] ?? '';
}

export function labelRelatif(iso: string, acuan: string): string {
  const beda = selisihHari(acuan, iso);
  if (beda === 0) return 'hari ini';
  if (beda === 1) return 'besok';
  if (beda === 2) return 'lusa';
  if (beda === -1) return 'kemarin';
  if (beda < 0) return `${Math.abs(beda)} hari lalu`;
  return `${beda} hari lagi`;
}

/** Local-time ISO timestamp, used for audit fields. */
export function sekarangISO(waktu: Date = new Date()): string {
  return waktu.toISOString();
}

/** True when `iso` is the same local calendar day as `acuan`. */
export function tanggalSama(a: string, b: string): boolean {
  return a === b;
}