/**
 * Calendar integration — RFC 5545 (.ics).
 *
 * One free, standard escape hatch: the operator can drop the whole schedule into
 * Google Calendar, Apple Calendar or Outlook without any account, key or vendor.
 * All-day events (VALUE=DATE) match the way RentOps models rentals.
 */

import type { Aset, DataAplikasi, Reservasi } from '../domain/types';
import { formatTanggal } from '../domain/tanggal';
import { menahanStok } from '../domain/ketersediaan';
import { petaAset } from '../domain/selektor';

const CAP = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'UTC',
});

export function keTanggalICS(iso: string): string {
  return CAP.format(new Date(`${iso}T00:00:00Z`)).replace(/-/g, '');
}

/** DTEND is exclusive in iCalendar, so the inclusive rental end gets +1 day. */
function tambahHariUTC(iso: string, hari: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + hari);
  return CAP.format(d).replace(/-/g, '');
}

function escapeICS(teks: string): string {
  return teks
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function stempelWaktu(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Deterministic UID so re-importing a booking updates rather than duplicates. */
export function uidReservasi(r: Reservasi): string {
  return `${r.kode.toLowerCase()}@rentops.local`;
}

function barisReservasi(r: Reservasi, aset: Aset | undefined, profilNama: string): string[] {
  const namaAset = aset ? `${aset.kode} ${aset.nama}` : 'Aset tidak ditemukan';
  const ringkasan = [
    `Rental ${r.kode} — ${namaAset}`,
    `${r.jumlah} unit · ${formatTanggal(r.tanggalMulai)} s/d ${formatTanggal(r.tanggalSelesai)}`,
    `Pelanggan: ${r.pelanggan}`,
    r.kontak ? `Kontak: ${r.kontak}` : '',
    `Status: ${r.status}`,
    r.catatan ? `Catatan: ${r.catatan}` : '',
    `Dicatat oleh ${profilNama} — RentOps`,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    'BEGIN:VEVENT',
    `UID:${uidReservasi(r)}`,
    `DTSTAMP:${stempelWaktu()}`,
    `DTSTART;VALUE=DATE:${keTanggalICS(r.tanggalMulai)}`,
    `DTEND;VALUE=DATE:${tambahHariUTC(r.tanggalSelesai, 1)}`,
    `SUMMARY:${escapeICS(`${r.kode} · ${namaAset}`)}`,
    `DESCRIPTION:${escapeICS(ringkasan)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ];
}

/** Full calendar for every booking that still holds or has held stock. */
export function buatICS(
  data: DataAplikasi,
  opsi: { hanyaAktif?: boolean; asetId?: string } = {},
): string {
  const { hanyaAktif = true, asetId } = opsi;
  const peta = petaAset(data);
  const baris: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RentOps//Jadwal Rental//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(data.profil.nama || 'Jadwal Rental RentOps')}`,
    'X-WR-TIMEZONE:Asia/Makassar',
  ];

  for (const r of data.reservasi) {
    if (hanyaAktif && !menahanStok(r.status)) continue;
    if (asetId && r.asetId !== asetId) continue;
    baris.push(...barisReservasi(r, peta.get(r.asetId), data.profil.nama));
  }

  baris.push('END:VCALENDAR');
  return `${baris.join('\r\n')}\r\n`;
}

export function namaBerkasICS(aset?: Aset): string {
  const dasar = 'rentops-jadwal';
  return aset ? `${dasar}-${aset.kode.toLowerCase()}.ics` : `${dasar}.ics`;
}