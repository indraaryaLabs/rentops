/**
 * Primitive domain types — no behaviour, no framework, no I/O.
 * Everything monetary is an integer amount of rupiah; everything calendar
 * related is a local calendar date serialised as "YYYY-MM-DD".
 */

export const KATEGORI_ASET = [
  'Kendaraan',
  'Peralatan',
  'Elektronik',
  'Alat Konstruksi',
  'Perlengkapan Acara',
] as const;

export type KategoriAset = (typeof KATEGORI_ASET)[number];

export const STATUS_ASET = ['Aktif', 'Pemeliharaan'] as const;
export type StatusAset = (typeof STATUS_ASET)[number];

export const STATUS_RESERVASI = [
  'Permintaan',
  'Dipesan',
  'Dipinjam',
  'Dikembalikan',
  'Dibatalkan',
] as const;

export type StatusReservasi = (typeof STATUS_RESERVASI)[number];

/** Reservation status values, ordered along the happy path. */
export const URUTAN_ALUR: readonly StatusReservasi[] = [
  'Permintaan',
  'Dipesan',
  'Dipinjam',
  'Dikembalikan',
];

export interface Aset {
  id: string;
  /** Human code, unique and stable, e.g. "KND-01". */
  kode: string;
  nama: string;
  kategori: KategoriAset;
  /** Physical units owned. */
  jumlahTersedia: number;
  /** Rupiah per unit per day. */
  hargaPerHari: number;
  statusPemeliharaan: StatusAset;
  catatan: string;
  /** Optional: day after which maintenance is advised (rolling service). */
  jarakServisHari: number | null;
  dibuatPada: string;
  diperbaruiPada: string;
}

export interface Reservasi {
  id: string;
  kode: string;
  pelanggan: string;
  kontak: string;
  asetId: string;
  /** Number of units held for this booking. */
  jumlah: number;
  /** Inclusive first day of the rental. */
  tanggalMulai: string;
  /** Inclusive last day of the rental. */
  tanggalSelesai: string;
  /** Rupiah received as deposit. */
  dp: number;
  status: StatusReservasi;
  catatan: string;
  dibuatPada: string;
  diperbaruiPada: string;
  /** ISO timestamp of the physical hand-over, when it happened. */
  diserahkanPada: string | null;
  /** ISO timestamp of the physical return, when it happened. */
  dikembalikanPada: string | null;
}

/** Everything the app persists. Bump `skema` when the shape changes. */
export interface DataAplikasi {
  skema: number;
  profil: ProfilUsaha;
  aset: Aset[];
  reservasi: Reservasi[];
}

export interface ProfilUsaha {
  nama: string;
  /** Free-form business identity printed on documents. */
  catatan: string;
  telepon: string;
  alamat: string;
}

/** Operator preferences — UI state that is still worth surviving a reload. */
export interface Preferensi {
  tema: 'terang' | 'gelap' | 'sistem';
  kepadatan: 'nyaman' | 'rapat';
  sidebar: 'lebar' | 'tipis';
  /** Days of buffer the operator wants between two rentals of the same unit. */
  jedaAntarSewaHari: number;
  /** Suggest maintenance when an asset has been rented this many days. */
  ambangSisaHariServis: number;
}

export const PREFERENSI_AWAL: Preferensi = {
  tema: 'sistem',
  kepadatan: 'nyaman',
  sidebar: 'lebar',
  jedaAntarSewaHari: 0,
  ambangSisaHariServis: 20,
};

export const PROFIL_AWAL: ProfilUsaha = {
  nama: 'Rental Operasional',
  catatan: '',
  telepon: '',
  alamat: '',
};

/** Derived money summary for a booking (never stored). */
export interface RingkasanSewa {
  hariSewa: number;
  hargaPerHari: number;
  subtotal: number;
  dp: number;
  sisa: number;
}