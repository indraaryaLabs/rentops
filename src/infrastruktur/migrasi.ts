/**
 * Schema migrations and validation.
 *
 * `migrasiData` is the single gate every inbound payload passes through: stored
 * state, imported backups and demo reset alike. It upgrades older envelopes,
 * rejects malformed shapes with operator-readable errors, and never mutates its
 * input.
 */

import type { Aset, DataAplikasi, ProfilUsaha, Reservasi } from '../domain/types';
import {
  KATEGORI_ASET,
  PREFERENSI_AWAL,
  PROFIL_AWAL,
  STATUS_ASET,
  STATUS_RESERVASI,
} from '../domain/types';
import { adalahTanggalISO } from '../domain/tanggal';
import { hitungSubtotal, normalisasiDP } from '../domain/sewa';
import { POLA_KONTAK, POLA_KODE } from '../domain/validasi';

export const SKEMA_TERBARU = 2;
const BATAS_GALAT = 10;

export type HasilMigrasi =
  | { ok: true; data: DataAplikasi; catatan: string[] }
  | { ok: false; galat: string[] };

interface Kolektor {
  galat: string[];
  catatan: string[];
}

function objek(nilai: unknown): nilai is Record<string, unknown> {
  return typeof nilai === 'object' && nilai !== null && !Array.isArray(nilai);
}

function teks(
  sumber: Record<string, unknown>,
  field: string,
  label: string,
  k: Kolektor,
  opsi: { wajib?: boolean; minimal?: number; maks?: number } = {},
): string {
  const { wajib = true, minimal = 0, maks = 200 } = opsi;
  const mentah = sumber[field];
  if (mentah === undefined || mentah === null || (typeof mentah === 'string' && mentah.trim() === '')) {
    if (wajib) k.galat.push(`${label}: kolom "${field}" wajib diisi.`);
    return '';
  }
  if (typeof mentah !== 'string') {
    k.galat.push(`${label}: kolom "${field}" harus berupa teks.`);
    return '';
  }
  const bersih = mentah.trim();
  if (bersih.length < minimal) {
    k.galat.push(`${label}: kolom "${field}" minimal ${minimal} karakter.`);
  } else if (bersih.length > maks) {
    k.galat.push(`${label}: kolom "${field}" maksimal ${maks} karakter.`);
  }
  return bersih;
}

function bilangan(
  sumber: Record<string, unknown>,
  field: string,
  label: string,
  k: Kolektor,
  opsi: { wajib?: boolean; min?: number; maks?: number } = {},
): number {
  const { wajib = true, min = Number.NEGATIVE_INFINITY, maks = Number.POSITIVE_INFINITY } = opsi;
  const mentah = sumber[field];
  if (mentah === undefined || mentah === null || mentah === '') {
    if (wajib) k.galat.push(`${label}: kolom "${field}" wajib diisi.`);
    return 0;
  }
  const angka = typeof mentah === 'number' ? mentah : Number(mentah);
  if (!Number.isFinite(angka)) {
    k.galat.push(`${label}: kolom "${field}" harus berupa angka.`);
    return 0;
  }
  if (!Number.isInteger(angka)) {
    k.galat.push(`${label}: kolom "${field}" harus bilangan bulat.`);
    return 0;
  }
  if (angka < min || angka > maks) {
    k.galat.push(`${label}: kolom "${field}" harus di antara ${min} dan ${maks}.`);
    return 0;
  }
  return angka;
}

function pilihan<T extends string>(
  sumber: Record<string, unknown>,
  field: string,
  label: string,
  k: Kolektor,
  daftar: readonly T[],
  bawaan: T,
): T {
  const mentah = sumber[field];
  if (mentah === undefined || mentah === null || mentah === '') {
    k.galat.push(`${label}: kolom "${field}" wajib diisi.`);
    return bawaan;
  }
  if (typeof mentah !== 'string' || !daftar.includes(mentah as T)) {
    k.galat.push(`${label}: kolom "${field}" harus salah satu dari ${daftar.join(', ')}.`);
    return bawaan;
  }
  return mentah as T;
}

function idUnik(
  sumber: Record<string, unknown>,
  field: string,
  label: string,
  k: Kolektor,
  dipakai: Set<string>,
  cadangan: string,
): string {
  const mentah = sumber[field];
  if (typeof mentah === 'string' && mentah.trim() !== '') {
    const id = mentah.trim();
    if (dipakai.has(id)) {
      k.galat.push(`${label}: id "${id}" dipakai lebih dari sekali.`);
      return cadangan;
    }
    dipakai.add(id);
    return id;
  }
  if (mentah !== undefined && mentah !== null && typeof mentah !== 'string') {
    k.galat.push(`${label}: kolom "${field}" harus berupa teks.`);
  }
  dipakai.add(cadangan);
  return cadangan;
}

function waktu(
  sumber: Record<string, unknown>,
  field: string,
  label: string,
  k: Kolektor,
  bawaan: string,
): string {
  const mentah = sumber[field];
  if (typeof mentah !== 'string' || Number.isNaN(Date.parse(mentah))) {
    if (mentah !== undefined && mentah !== null) {
      k.catatan.push(`${label}: kolom "${field}" tidak valid, memakai waktu saat ini.`);
    }
    return bawaan;
  }
  return mentah;
}

/** Entry point for every untrusted payload. */
export function migrasiData(nilai: unknown): HasilMigrasi {
  const k: Kolektor = { galat: [], catatan: [] };

  // Older envelopes wrapped the payload; unwrap them first.
  let muatan: unknown = nilai;
  if (
    objek(muatan) &&
    'data' in muatan &&
    ('versi' in muatan || 'skema' in muatan || 'dibuatPada' in muatan)
  ) {
    muatan = (muatan as { data: unknown }).data;
  }

  if (!objek(muatan)) {
    return { ok: false, galat: ['Berkas harus berupa objek JSON dengan kolom aset dan reservasi.'] };
  }
  if (!Array.isArray(muatan.aset)) {
    return { ok: false, galat: ['Kolom "aset" harus berupa array.'] };
  }
  if (!Array.isArray(muatan.reservasi)) {
    return { ok: false, galat: ['Kolom "reservasi" harus berupa array.'] };
  }

  const sekarang = new Date().toISOString();

  /* ------------------------------ aset ------------------------------ */
  const aset: Aset[] = [];
  const idAset = new Set<string>();
  const kodeAset = new Set<string>();
  const asetMentah = muatan.aset as unknown[];

  asetMentah.forEach((item, index) => {
    const label = `Aset ke-${index + 1}`;
    if (!objek(item)) {
      k.galat.push(`${label}: harus berupa objek.`);
      return;
    }
    const id = idUnik(item, 'id', label, k, idAset, `ast_import_${index + 1}`);
    const kode = teks(item, 'kode', label, k, { minimal: 2, maks: 16 });
    if (kode && !POLA_KODE.test(kode.toUpperCase())) {
      k.galat.push(`${label}: kode "${kode}" tidak valid (huruf kapital, angka, tanda hubung).`);
    }
    const kunciKode = kode.toUpperCase();
    if (kode && kodeAset.has(kunciKode)) {
      k.galat.push(`${label}: kode aset "${kode}" dipakai lebih dari sekali.`);
      return;
    }
    kodeAset.add(kunciKode);

    aset.push({
      id,
      kode: kode.toUpperCase(),
      nama: teks(item, 'nama', label, k, { minimal: 3, maks: 70 }),
      kategori: pilihan(item, 'kategori', label, k, KATEGORI_ASET, 'Peralatan'),
      jumlahTersedia: bilangan(item, 'jumlahTersedia', label, k, { min: 1, maks: 100_000 }),
      hargaPerHari: bilangan(item, 'hargaPerHari', label, k, { min: 0, maks: 1_000_000_000 }),
      statusPemeliharaan: pilihan(item, 'statusPemeliharaan', label, k, STATUS_ASET, 'Aktif'),
      catatan: teks(item, 'catatan', label, k, { wajib: false, maks: 280 }),
      jarakServisHari:
        item.jarakServisHari === undefined || item.jarakServisHari === null
          ? null
          : bilangan(item, 'jarakServisHari', label, k, { min: 1, maks: 3650 }),
      dibuatPada: waktu(item, 'dibuatPada', label, k, sekarang),
      diperbaruiPada: waktu(item, 'diperbaruiPada', label, k, sekarang),
    });
  });

  /* ---------------------------- reservasi ---------------------------- */
  const petaAset = new Map(aset.map((item) => [item.id, item]));
  const idReservasi = new Set<string>();
  const kodeReservasi = new Set<string>();
  const reservasi: Reservasi[] = [];

  (muatan.reservasi as unknown[]).forEach((item, index) => {
    const label = `Reservasi ke-${index + 1}`;
    if (!objek(item)) {
      k.galat.push(`${label}: harus berupa objek.`);
      return;
    }
    const kode = teks(item, 'kode', label, k, { minimal: 2, maks: 16 }).toUpperCase();
    if (kode && !POLA_KODE.test(kode)) {
      k.galat.push(`${label}: kode "${kode}" tidak valid.`);
    }
    if (kode && kodeReservasi.has(kode)) {
      k.galat.push(`${label}: kode reservasi "${kode}" dipakai lebih dari sekali.`);
      return;
    }
    kodeReservasi.add(kode);

    const asetId = teks(item, 'asetId', label, k);
    const barang = petaAset.get(asetId);
    if (!barang) {
      k.galat.push(`${label}: asetId "${asetId}" tidak ditemukan pada daftar aset.`);
      return;
    }

    const tanggalMulai = teks(item, 'tanggalMulai', label, k);
    const tanggalSelesai = teks(item, 'tanggalSelesai', label, k);
    if (!adalahTanggalISO(tanggalMulai)) {
      k.galat.push(`${label}: tanggalMulai "${tanggalMulai}" bukan tanggal valid (YYYY-MM-DD).`);
    }
    if (!adalahTanggalISO(tanggalSelesai)) {
      k.galat.push(`${label}: tanggalSelesai "${tanggalSelesai}" bukan tanggal valid (YYYY-MM-DD).`);
    }
    if (tanggalMulai && tanggalSelesai && tanggalSelesai < tanggalMulai) {
      k.galat.push(`${label}: tanggalSelesai lebih awal dari tanggalMulai.`);
      return;
    }

    const jumlah = bilangan(item, 'jumlah', label, k, { min: 1, maks: 100_000 });
    if (jumlah > barang.jumlahTersedia) {
      k.galat.push(
        `${label}: jumlah ${jumlah} melebihi stok aset "${barang.kode}" (${barang.jumlahTersedia} unit).`,
      );
      return;
    }

    const dp = bilangan(item, 'dp', label, k, { wajib: false, min: 0, maks: 1_000_000_000 });
    const subtotal = hitungSubtotal(jumlah, barang.hargaPerHari, { mulai: tanggalMulai, selesai: tanggalSelesai });
    if (dp > subtotal) {
      k.galat.push(`${label}: DP (${dp}) melebihi estimasi sewa (${subtotal}) untuk "${kode}".`);
      return;
    }

    const kontak = teks(item, 'kontak', label, k, { wajib: false, maks: 24 });
    if (kontak && !POLA_KONTAK.test(kontak)) {
      k.galat.push(`${label}: format kontak "${kontak}" tidak valid.`);
      return;
    }

    const status = pilihan(item, 'status', label, k, STATUS_RESERVASI, 'Permintaan');
    const id = idUnik(item, 'id', label, k, idReservasi, `rsv_import_${index + 1}`);

    reservasi.push({
      id,
      kode,
      pelanggan: teks(item, 'pelanggan', label, k, { minimal: 3, maks: 70 }),
      kontak,
      asetId: barang.id,
      jumlah,
      tanggalMulai,
      tanggalSelesai,
      dp: normalisasiDP(dp, subtotal),
      status,
      catatan: teks(item, 'catatan', label, k, { wajib: false, maks: 280 }),
      dibuatPada: waktu(item, 'dibuatPada', label, k, sekarang),
      diperbaruiPada: waktu(item, 'diperbaruiPada', label, k, sekarang),
      diserahkanPada: waktuOpsional(item, 'diserahkanPada'),
      dikembalikanPada: waktuOpsional(item, 'dikembalikanPada'),
    });
  });

  const profil = muatan.profil ? bacaProfil(muatan.profil) : { ...PROFIL_AWAL };

  if (k.galat.length > 0) {
    return {
      ok: false,
      galat: k.galat.slice(0, BATAS_GALAT).concat(
        k.galat.length > BATAS_GALAT ? [`…dan ${k.galat.length - BATAS_GALAT} masalah lainnya.`] : [],
      ),
    };
  }

  return {
    ok: true,
    data: { skema: SKEMA_TERBARU, profil, aset, reservasi },
    catatan: k.catatan,
  };
}

function waktuOpsional(sumber: Record<string, unknown>, field: string): string | null {
  const mentah = sumber[field];
  if (typeof mentah !== 'string' || Number.isNaN(Date.parse(mentah))) return null;
  return mentah;
}

function bacaProfil(nilai: unknown): ProfilUsaha {
  if (!objek(nilai)) return { ...PROFIL_AWAL };
  return {
    nama: typeof nilai.nama === 'string' && nilai.nama.trim() ? nilai.nama.trim().slice(0, 60) : 'Rental Saya',
    catatan: typeof nilai.catatan === 'string' ? nilai.catatan.trim().slice(0, 280) : '',
    telepon: typeof nilai.telepon === 'string' ? nilai.telepon.trim().slice(0, 24) : '',
    alamat: typeof nilai.alamat === 'string' ? nilai.alamat.trim().slice(0, 140) : '',
  };
}

export { PREFERENSI_AWAL };
