/**
 * Money: rupiah is an integer, always. No floats touch a currency value.
 */

const formatterRupiah = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

const formatterAngka = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export type Rupiah = number;

export function rupiah(nilai: number): Rupiah {
  if (!Number.isFinite(nilai)) return 0;
  return Math.round(nilai);
}

/** "Rp 1.500.000" — hand-assembled so the space character is stable everywhere. */
export function formatRupiah(nilai: number): string {
  return `Rp ${formatterRupiah.format(rupiah(nilai))}`;
}

/** Compact form for dense contexts: "Rp 1,5 jt" / "Rp 850 rb". */
export function formatRupiahRingkas(nilai: number): string {
  const n = rupiah(nilai);
  const absolut = Math.abs(n);
  const tanda = n < 0 ? '-' : '';
  if (absolut >= 1_000_000_000) return `${tanda}Rp ${desimal(absolut / 1_000_000_000)} M`;
  if (absolut >= 1_000_000) return `${tanda}Rp ${desimal(absolut / 1_000_000)} jt`;
  if (absolut >= 10_000) return `${tanda}Rp ${formatterAngka.format(Math.round(absolut / 1000))} rb`;
  return formatRupiah(n);
}

function desimal(nilai: number): string {
  const dibulatkan = Math.round(nilai * 10) / 10;
  const teks = dibulatkan.toFixed(1);
  return teks.endsWith('.0') ? teks.slice(0, -2) : teks.replace('.', ',');
}

export function formatAngka(nilai: number): string {
  return formatterAngka.format(Math.round(Number.isFinite(nilai) ? nilai : 0));
}

export function formatPersen(nilai: number): string {
  return `${formatAngka(nilai)}%`;
}

/**
 * Parses user input into rupiah.
 *
 * Accepts the forms people actually type in a price field: "125000",
 * "125.000", "125,000", and the shorthand "150rb" / "3jt" / "2,5 jt".
 * Dots and commas are treated as digit-group separators, not decimals,
 * because nobody quotes a daily rental price with cents.
 */
export function parseRupiah(teks: string): number | null {
  const bersih = teks.trim().toLowerCase();
  if (bersih === '') return null;
  const pengali =
    /(jt|juta)\s*$/.test(bersih) ? 1_000_000 : /(rb|ribu|k)\s*$/.test(bersih) ? 1000 : 1;
  const angkaMentah = bersih.replace(/[^\d.,]/g, '').replace(/[.,](?=\d{3}\b)/g, '');
  const angka = Number(angkaMentah.replace(',', '.'));
  if (!Number.isFinite(angka)) return null;
  return rupiah(angka * pengali);
}

export function formatUnit(nilai: number): string {
  return `${formatAngka(nilai)} unit`;
}

/** Plural helper that keeps Indonesian copy readable. */
export function jamak(nilai: number, tunggal: string, banyak: string): string {
  return nilai === 1 ? tunggal : banyak;
}