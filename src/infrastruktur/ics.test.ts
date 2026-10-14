import { describe, expect, it } from 'vitest';
import type { DataAplikasi } from '../domain/types';
import { buatDataDemo } from '../domain/seed';
import { keTanggalICS, uidReservasi, buatICS } from './ics';
import { namaBerkasCadangan, POLA_NAMA_BERKAS } from './backup';

function contoh(): DataAplikasi {
  return buatDataDemo(new Date(2026, 9, 14));
}

describe('nama berkas cadangan', () => {
  it('mengikuti pola yang bisa dikenali ulang', () => {
    const nama = namaBerkasCadangan(new Date(2026, 9, 14, 9, 5));
    expect(nama).toMatch(POLA_NAMA_BERKAS);
    expect(nama).toContain('2026-10-14');
  });
});

describe('ekspor kalender', () => {
  const data = contoh();

  it('mengubah ISO ke tanggal ICS tanpa pemisah', () => {
    expect(keTanggalICS('2026-10-14')).toBe('20261014');
  });

  it('membersihkan karakter ilegal pada baris ringkasan', () => {
    const ics = buatICS(
      { ...data, profil: { ...data.profil, alamat: 'A; B\nC' } },
      { hanyaAktif: false },
    );
    expect(ics).not.toContain('A; B');
    expect(ics).not.toContain('X-WR-CALNAME:' + data.profil.nama + ';');
  });

  it('memuat bendera VCALENDAR yang valid', () => {
    const ics = buatICS(data, { hanyaAktif: false });
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBeGreaterThan(0);
    expect((ics.match(/END:VEVENT/g) ?? []).length).toBe(
      (ics.match(/BEGIN:VEVENT/g) ?? []).length,
    );
  });

  it('hanya mengekspor reservasi aktif saat diminta', () => {
    const aktif = buatICS(data, { hanyaAktif: true });
    const semua = buatICS(data, { hanyaAktif: false });
    const cari = (teks: string, kode: string) =>
      (teks.match(new RegExp(`SUMMARY:.*${kode}`, 'g')) ?? []).length;
    const rDibatalkan = data.reservasi.find((r) => r.status === 'Dibatalkan');
    if (rDibatalkan) {
      expect(cari(semua, rDibatalkan.kode)).toBe(1);
      expect(cari(aktif, rDibatalkan.kode)).toBe(0);
    }
  });

  it('membatasi ekspor ke satu aset', () => {
    const aset = data.aset[0];
    const satu = buatICS(data, { asetId: aset.id });
    expect(satu).toContain(aset.kode.toUpperCase());
    const dfilter = buatICS(data, { asetId: data.aset[1].id });
    expect(dfilter).not.toContain(`SUMMARY:.*${aset.kode}`);
  });

  it('uid stabil per reservasi', () => {
    const r = data.reservasi[0];
    expect(uidReservasi(r)).toBe(uidReservasi(r));
  });

  it('DTEND adalah hari setelah kembali', () => {
    const r = data.reservasi[0];
    const ics = buatICS(
      { ...data, reservasi: [r] },
      { hanyaAktif: false },
    );
    const kemarin = new Date(`${r.tanggalSelesai}T00:00:00Z`);
    kemarin.setUTCDate(kemarin.getUTCDate() + 1);
    const iso = kemarin.toISOString().slice(0, 10).replace(/-/g, '');
    expect(ics).toContain(`DTEND;VALUE=DATE:${iso}`);
  });
});