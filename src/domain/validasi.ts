/**
 * Form contracts and validation.
 *
 * Forms keep their numbers as strings (better typing UX); parsing happens here
 * and every failure returns copy that can be shown verbatim to the operator.
 */

import type {
  Aset,
  KategoriAset,
  Preferensi,
  Reservasi,
  StatusAset,
  StatusReservasi,
} from './types';
import { KATEGORI_ASET, STATUS_ASET } from './types';
import { adalahTanggalISO } from './tanggal';
import { normalisasiDP, hitungSubtotal } from './sewa';
import { periksaKetersediaan, menahanStok, totalHariDisewa } from './ketersediaan';
import { parseRupiah } from './uang';

export type GalatForm = Partial<Record<string, string>>;

export interface FormAset {
  nama: string;
  kode: string;
  kategori: KategoriAset | '';
  jumlahUnit: string;
  hargaPerHari: string;
  status: StatusAset;
  jarakServisHari: string;
  catatan: string;
}

export interface FormReservasi {
  kode: string;
  pelanggan: string;
  kontak: string;
  asetId: string;
  jumlah: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  dp: string;
  status: StatusReservasi;
  catatan: string;
}

export const POLA_KONTAK = /^[0-9+\-\s()]{8,24}$/;
export const POLA_KODE = /^[A-Z0-9][A-Z0-9-]{1,15}$/;

export function formAsetKosong(): FormAset {
  return {
    nama: '',
    kode: '',
    kategori: '',
    jumlahUnit: '1',
    hargaPerHari: '',
    status: 'Aktif',
    jarakServisHari: '',
    catatan: '',
  };
}

export function formAsetDari(aset: Aset): FormAset {
  return {
    nama: aset.nama,
    kode: aset.kode,
    kategori: aset.kategori,
    jumlahUnit: String(aset.jumlahTersedia),
    hargaPerHari: String(aset.hargaPerHari),
    status: aset.statusPemeliharaan,
    jarakServisHari: aset.jarakServisHari === null ? '' : String(aset.jarakServisHari),
    catatan: aset.catatan,
  };
}

export function asetDariForm(form: FormAset, id: string, waktu: string): Aset {
  return {
    id,
    kode: form.kode.trim().toUpperCase(),
    nama: form.nama.trim(),
    kategori: form.kategori as KategoriAset,
    jumlahTersedia: Number(form.jumlahUnit),
    hargaPerHari: Number(form.hargaPerHari),
    statusPemeliharaan: form.status,
    jarakServisHari: form.jarakServisHari.trim() === '' ? null : Number(form.jarakServisHari),
    catatan: form.catatan.trim(),
    dibuatPada: waktu,
    diperbaruiPada: waktu,
  };
}

export function formReservasiKosong(hariIni: string): FormReservasi {
  return {
    kode: '',
    pelanggan: '',
    kontak: '',
    asetId: '',
    jumlah: '1',
    tanggalMulai: hariIni,
    tanggalSelesai: hariIni,
    dp: '0',
    status: 'Permintaan',
    catatan: '',
  };
}

export function formReservasiDari(reservasi: Reservasi): FormReservasi {
  return {
    kode: reservasi.kode,
    pelanggan: reservasi.pelanggan,
    kontak: reservasi.kontak,
    asetId: reservasi.asetId,
    jumlah: String(reservasi.jumlah),
    tanggalMulai: reservasi.tanggalMulai,
    tanggalSelesai: reservasi.tanggalSelesai,
    dp: String(reservasi.dp),
    status: reservasi.status,
    catatan: reservasi.catatan,
  };
}

export function reservasiDariForm(form: FormReservasi, id: string, waktu: string): Reservasi {
  return {
    id,
    kode: form.kode.trim().toUpperCase(),
    pelanggan: form.pelanggan.trim(),
    kontak: form.kontak.trim(),
    asetId: form.asetId,
    jumlah: Number(form.jumlah),
    tanggalMulai: form.tanggalMulai,
    tanggalSelesai: form.tanggalSelesai,
    dp: Number(form.dp) || 0,
    status: form.status,
    catatan: form.catatan.trim(),
    dibuatPada: waktu,
    diperbaruiPada: waktu,
    diserahkanPada: null,
    dikembalikanPada: null,
  };
}

/** Next sequential code, tolerant of gaps and of non-numeric legacy codes. */
export function kodeBerikut(daftar: readonly { kode: string }[], awalan: string): string {
  let tertinggi = 1000;
  for (const item of daftar) {
    const cocok = new RegExp(`^${awalan}-(\\d+)$`, 'i').exec(item.kode.trim());
    if (cocok) {
      const angka = Number(cocok[1]);
      if (Number.isFinite(angka) && angka > tertinggi) tertinggi = angka;
    }
  }
  return `${awalan}-${tertinggi + 1}`;
}

export function validasiFormAset(
  form: FormAset,
  data: { aset: Aset[]; reservasi: Reservasi[] },
  idSaatIni?: string,
): GalatForm {
  const galat: GalatForm = {};

  const nama = form.nama.trim();
  if (!nama) galat.nama = 'Nama aset wajib diisi.';
  else if (nama.length < 3) galat.nama = 'Nama aset minimal 3 karakter.';
  else if (nama.length > 70) galat.nama = 'Nama aset maksimal 70 karakter.';

  const kode = form.kode.trim().toUpperCase();
  if (!kode) galat.kode = 'Kode aset wajib diisi.';
  else if (!POLA_KODE.test(kode)) {
    galat.kode = 'Kode hanya boleh huruf kapital, angka, dan tanda hubung (2–16 karakter).';
  } else if (data.aset.some((item) => item.id !== idSaatIni && item.kode.toUpperCase() === kode)) {
    galat.kode = `Kode "${kode}" sudah dipakai aset lain.`;
  }

  if (!KATEGORI_ASET.includes(form.kategori as KategoriAset)) {
    galat.kategori = 'Pilih kategori aset.';
  }

  const unit = Number(form.jumlahUnit);
  if (form.jumlahUnit.trim() === '') galat.jumlahUnit = 'Jumlah unit wajib diisi.';
  else if (!Number.isInteger(unit) || unit < 1) {
    galat.jumlahUnit = 'Jumlah unit harus bilangan bulat minimal 1.';
  } else if (unit > 100_000) {
    galat.jumlahUnit = 'Jumlah unit terlalu besar (maksimal 100.000).';
  } else {
    const terpakai = data.reservasi
      .filter((item) => item.asetId === idSaatIni && menahanStok(item.status))
      .reduce((total, item) => total + item.jumlah, 0);
    if (terpakai > 0 && unit < terpakai) {
      galat.jumlahUnit = `Stok tidak bisa kurang dari ${terpakai} unit yang sedang disewa atau dipesan.`;
    }
  }

  const harga = parseRupiah(form.hargaPerHari);
  if (form.hargaPerHari.trim() === '') galat.hargaPerHari = 'Harga per hari wajib diisi.';
  else if (harga === null || harga < 1) {
    galat.hargaPerHari = 'Harga per hari harus lebih besar dari nol.';
  } else if (harga > 1_000_000_000) {
    galat.hargaPerHari = 'Harga per hari terlalu besar.';
  }

  if (!STATUS_ASET.includes(form.status)) galat.status = 'Pilih status pemeliharaan.';

  if (form.jarakServisHari.trim() !== '') {
    const servicing = Number(form.jarakServisHari);
    if (!Number.isInteger(servicing) || servicing < 1 || servicing > 3650) {
      galat.jarakServisHari = 'Jarak servis harus bilangan bulat 1–3.650 hari.';
    }
  }

  if (form.catatan.length > 280) galat.catatan = 'Catatan maksimal 280 karakter.';

  return galat;
}

export interface HasilValidasiReservasi {
  galat: GalatForm;
  /** Non-blocking remark shown inline; saving is still allowed. */
  catatan: string | null;
}

export function validasiFormReservasi(
  form: FormReservasi,
  konteks: {
    aset: Aset | undefined;
    reservasi: Reservasi[];
    preferensi?: Pick<Preferensi, 'jedaAntarSewaHari'>;
    idSaatIni?: string;
    hariIni: string;
  },
): HasilValidasiReservasi {
  const galat: GalatForm = {};
  const { aset, reservasi, idSaatIni, hariIni } = konteks;
  const jeda = konteks.preferensi?.jedaAntarSewaHari ?? 0;

  const kode = form.kode.trim().toUpperCase();
  if (!kode) galat.kode = 'Nomor reservasi wajib diisi.';
  else if (!POLA_KODE.test(kode)) {
    galat.kode = 'Nomor hanya boleh huruf kapital, angka, dan tanda hubung.';
  } else if (reservasi.some((item) => item.id !== idSaatIni && item.kode.toUpperCase() === kode)) {
    galat.kode = `Nomor reservasi "${kode}" sudah dipakai.`;
  }

  const pelanggan = form.pelanggan.trim();
  if (!pelanggan) galat.pelanggan = 'Nama pelanggan wajib diisi.';
  else if (pelanggan.length < 3) galat.pelanggan = 'Nama pelanggan minimal 3 karakter.';
  else if (pelanggan.length > 70) galat.pelanggan = 'Nama pelanggan maksimal 70 karakter.';

  const kontak = form.kontak.trim();
  if (kontak && !POLA_KONTAK.test(kontak)) {
    galat.kontak = 'Nomor kontak hanya boleh angka, spasi, dan tanda + - ( ) — 8 sampai 24 karakter.';
  }

  if (!form.asetId) galat.asetId = 'Pilih aset yang akan disewa.';
  else if (!aset) galat.asetId = 'Aset yang dipilih tidak ditemukan.';

  const jumlah = Number(form.jumlah);
  if (form.jumlah.trim() === '') galat.jumlah = 'Jumlah unit wajib diisi.';
  else if (!Number.isInteger(jumlah) || jumlah < 1) {
    galat.jumlah = 'Jumlah unit harus bilangan bulat minimal 1.';
  } else if (aset && jumlah > aset.jumlahTersedia) {
    galat.jumlah = `Jumlah melebihi stok aset (${aset.jumlahTersedia} unit).`;
  }

  if (!form.tanggalMulai) galat.tanggalMulai = 'Tanggal mulai wajib diisi.';
  else if (!adalahTanggalISO(form.tanggalMulai)) {
    galat.tanggalMulai = 'Tanggal mulai tidak valid.';
  }

  if (!form.tanggalSelesai) galat.tanggalSelesai = 'Tanggal selesai wajib diisi.';
  else if (!adalahTanggalISO(form.tanggalSelesai)) {
    galat.tanggalSelesai = 'Tanggal selesai tidak valid.';
  }

  if (!galat.tanggalMulai && !galat.tanggalSelesai && form.tanggalSelesai < form.tanggalMulai) {
    galat.tanggalSelesai = 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.';
  }

  let subtotal = 0;
  if (aset && !galat.jumlah && !galat.tanggalMulai && !galat.tanggalSelesai) {
    subtotal = hitungSubtotal(jumlah, aset.hargaPerHari, {
      mulai: form.tanggalMulai,
      selesai: form.tanggalSelesai,
    });
  }

  const dp = form.dp.trim() === '' ? 0 : parseRupiah(form.dp);
  if (form.dp.trim() !== '' && (dp === null || dp < 0)) {
    galat.dp = 'DP harus berupa angka nol atau lebih.';
  } else if (dp !== null && subtotal > 0 && normalisasiDP(dp, subtotal) !== dp) {
    galat.dp = `DP tidak boleh melebihi estimasi sewa (${subtotal} rupiah).`;
  }

  if (form.catatan.length > 280) galat.catatan = 'Catatan maksimal 280 karakter.';

  if (
    aset &&
    !galat.jumlah &&
    !galat.tanggalMulai &&
    !galat.tanggalSelesai &&
    menahanStok(form.status)
  ) {
    const hasil = periksaKetersediaan({
      aset,
      reservasi,
      mulai: form.tanggalMulai,
      selesai: form.tanggalSelesai,
      jumlah,
      jeda,
      kecualiId: idSaatIni,
    });
    if (!hasil.boleh) {
      if (hasil.maintenance) galat.asetId = hasil.alasan;
      else galat.jumlah = hasil.alasan;
    }
  }

  let catatan: string | null = null;
  if (menahanStok(form.status) && !galat.tanggalMulai) {
    if (form.tanggalMulai < hariIni) {
      catatan = 'Tanggal mulai sudah lewat dari hari ini.';
    } else if (!galat.tanggalSelesai && form.tanggalSelesai < hariIni) {
      catatan = 'Rentang tanggal sewa sudah berakhir.';
    } else if (jeda > 0 && form.tanggalMulai === hariIni) {
      catatan = `Ada jeda antar sewa ${jeda} hari yang ikut dihitung pada pemeriksaan ketersediaan.`;
    }
  }

  return { galat, catatan };
}

/** Total days an asset has been out — used by the asset drawer and service hints. */
export function hariDipakai(asetId: string, reservasi: Reservasi[]): number {
  return totalHariDisewa(reservasi, asetId);
}