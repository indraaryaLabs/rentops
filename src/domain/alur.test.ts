import { describe, expect, it } from 'vitest';
import { TRANSISI, statusBerikut, statusDitutup, transisiBerikut } from './alur';
import type { StatusReservasi } from './types';
import { STATUS_RESERVASI, URUTAN_ALUR } from './types';

describe('alur status', () => {
  it('mendefinisikan transisi maju untuk setiap status', () => {
    expect(transisiBerikut('Permintaan')).toEqual(['Dipesan', 'Dibatalkan']);
    expect(transisiBerikut('Dipesan')).toEqual(['Dipinjam', 'Dibatalkan']);
    expect(transisiBerikut('Dipinjam')).toEqual(['Dikembalikan']);
    expect(transisiBerikut('Dikembalikan')).toEqual([]);
    expect(transisiBerikut('Dibatalkan')).toEqual([]);
  });

  it('tidak pernah memungkinkan lompat langkah', () => {
    for (const status of STATUS_RESERVASI) {
      for (const tujuan of TRANSISI[status]) {
        const dari = URUTAN_ALUR.indexOf(status);
        const ke = URUTAN_ALUR.indexOf(tujuan);
        if (status === 'Dibatalkan' || tujuan === 'Dibatalkan') continue;
        expect(ke - dari).toBe(1);
      }
    }
  });

  it('menandai status terminal', () => {
    expect(statusDitutup('Dikembalikan')).toBe(true);
    expect(statusDitutup('Dibatalkan')).toBe(true);
    expect(statusDitutup('Dipinjam')).toBe(false);
  });

  it('mengambil langkah berikutnya seorang saja', () => {
    const status: StatusReservasi = 'Dipesan';
    expect(statusBerikut(status)).toBe('Dipinjam');
    expect(statusBerikut('Dipinjam')).toBe('Dikembalikan');
    expect(statusBerikut('Dibatalkan')).toBeNull();
  });
});
