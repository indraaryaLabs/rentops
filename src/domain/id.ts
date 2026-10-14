/**
 * Deterministic identifiers and clock.
 *
 * Ids are prefixed and sortable by creation time, which keeps exported backups
 * readable and makes debugging ("which record is this?") trivial.
 */

let penghitung = 0;

function acak(): string {
  const globalCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (globalCrypto && typeof globalCrypto.getRandomValues === 'function') {
    const arr = new Uint8Array(4);
    globalCrypto.getRandomValues(arr);
    return Array.from(arr, (n) => n.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(16).slice(2, 10);
}

export function buatId(prefix: string): string {
  penghitung += 1;
  const waktu = Date.now().toString(36);
  return `${prefix}_${waktu}_${penghitung.toString(36)}${acak().slice(0, 4)}`;
}

/** Injectable clock so tests and the automation engine stay deterministic. */
export interface Jam {
  sekarang(): Date;
  iso(): string;
  hariIni(): string;
}

export const jamSistem: Jam = {
  sekarang: () => new Date(),
  iso: () => new Date().toISOString(),
  hariIni: () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  },
};

/** Stable id generator used by the seeder so demo data is byte-stable. */
export function idDemo(index: number, prefix: string): string {
  return `${prefix}_demo${String(index + 1).padStart(2, '0')}`;
}