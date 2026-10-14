/**
 * Read-side queries: everything the screens need, derived on demand.
 * Selectors are memo-friendly (pure, keyed by the arrays they receive) and are
 * the only place that turns raw records into UI-ready shapes.
 */

import type { Aset, DataAplikasi, Reservasi } from './types';
import { formatTanggal, hariIni as hariSekarang, tambahHari, deretTanggal } from './tanggal';
import { hariTerlambat, ringkasSewa } from './sewa';
import { menahanStok, selKetersediaanHarian, unitTersedia } from './ketersediaan';
import { rupiah } from './uang';

export function petaAset(data: DataAplikasi): Map<string, Aset> {
  return new Map(data.aset.map((item) => [item.id, item]));
}

export function asetDari(data: DataAplikasi, id: string): Aset | undefined {
  return data.aset.find((item) => item.id === id);
}

export function reservasiDari(data: DataAplikasi, id: string): Reservasi | undefined {
  return data.reservasi.find((item) => item.id === id);
}

export interface MetrikDasbor {
  reservasiAktif: number;
  permintaan: number;
  dipesan: number;
  dipinjam: number;
  terlambat: number;
  diambilHariIni: number;
  dikembalikanHariIni: number;
  asetAktif: number;
  asetMaintenance: number;
  totalUnit: number;
  unitBebasHariIni: number;
  pendapatanBulanIni: number;
  pendapatanHariIni: number;
  piutangTertunda: number;
  utilisasi: number;
}

export function metrikDasbor(
  data: DataAplikasi,
  hariIni: string = hariSekarang(),
): MetrikDasbor {
  const aset = petaAset(data);
  const bulan = hariIni.slice(0, 7);

  const permintaan = data.reservasi.filter((item) => item.status === 'Permintaan').length;
  const dipesan = data.reservasi.filter((item) => item.status === 'Dipesan').length;
  const dipinjam = data.reservasi.filter((item) => item.status === 'Dipinjam').length;
  const terlambat = data.reservasi.filter(
    (item) => item.status === 'Dipinjam' && item.tanggalSelesai < hariIni,
  ).length;
  const diambilHariIni = data.reservasi.filter(
    (item) => item.status === 'Dipesan' && item.tanggalMulai === hariIni,
  ).length;
  const dikembalikanHariIni = data.reservasi.filter(
    (item) => item.status === 'Dipinjam' && item.tanggalSelesai === hariIni,
  ).length;

  const asetAktif = data.aset.filter((item) => item.statusPemeliharaan === 'Aktif');
  const asetMaintenance = data.aset.length - asetAktif.length;
  const totalUnit = data.aset.reduce((total, item) => total + item.jumlahTersedia, 0);

  let unitBebas = 0;
  for (const item of data.aset) {
    if (item.statusPemeliharaan !== 'Aktif') continue;
    unitBebas += unitTersedia(item, data.reservasi, hariIni, hariIni);
  }

  let pendapatanBulanIni = 0;
  let pendapatanHariIni = 0;
  let piutangTertunda = 0;
  for (const item of data.reservasi) {
    const barang = aset.get(item.asetId);
    const ringkasan = ringkasSewa(item, barang?.hargaPerHari ?? 0);
    if (item.tanggalMulai.startsWith(bulan)) pendapatanBulanIni += ringkasan.subtotal;
    if (item.tanggalMulai === hariIni) pendapatanHariIni += ringkasan.subtotal;
    if (
      (item.status === 'Dipinjam' || item.status === 'Dikembalikan') &&
      ringkasan.sisa > 0 &&
      item.tanggalSelesai <= hariIni
    ) {
      piutangTertunda += ringkasan.sisa;
    }
  }

  return {
    reservasiAktif: permintaan + dipesan + dipinjam,
    permintaan,
    dipesan,
    dipinjam,
    terlambat,
    diambilHariIni,
    dikembalikanHariIni,
    asetAktif: asetAktif.length,
    asetMaintenance,
    totalUnit,
    unitBebasHariIni: unitBebas,
    pendapatanBulanIni: rupiah(pendapatanBulanIni),
    pendapatanHariIni: rupiah(pendapatanHariIni),
    piutangTertunda: rupiah(piutangTertunda),
    utilisasi: totalUnit === 0 ? 0 : Math.round(((totalUnit - unitBebas) / totalUnit) * 100),
  };
}

/** Row-per-asset occupancy grid — the signature schedule view. */
export interface SelJadwal {
  tanggal: string;
  terpakai: number;
  tersedia: number;
  maintenance: boolean;
  /** Percentage 0–100 of the asset's stock committed on this day. */
  utilisasi: number;
  /** Reservations touching this day, for the popover. */
  reservasi: Reservasi[];
  /** True when the day is before today, after today, or today itself. */
  posisi: 'lewat' | 'hari-ini' | 'akan-datang';
}

export interface BarisJadwal {
  aset: Aset;
  sel: SelJadwal[];
  /** Average utilisation across the visible window, 0–100. */
  utilisasi: number;
  /** Worst (highest) utilisation on any single day. */
  puncak: number;
  hariPenuh: number;
}

export interface OpsiJadwal {
  mulai: string;
  jumlahHari: number;
  asetId?: string;
  jeda?: number;
}

export function papanJadwal(
  data: DataAplikasi,
  hariIni: string = hariSekarang(),
  opsi: OpsiJadwal,
): BarisJadwal[] {
  const { mulai, jumlahHari, asetId, jeda = 0 } = opsi;
  const tanggal = deretTanggal(mulai, jumlahHari);
  const daftar = asetId ? data.aset.filter((item) => item.id === asetId) : data.aset;

  return daftar.map((barang) => {
    const sel = tanggal.map((tanggalItem) => {
      const harian = selKetersediaanHarian(barang, data.reservasi, tanggalItem, jeda);
      const relevan = data.reservasi.filter(
        (item) =>
          item.asetId === barang.id &&
          menahanStok(item.status) &&
          item.tanggalMulai <= tanggalItem &&
          item.tanggalSelesai >= tanggalItem,
      );
      return {
        tanggal: tanggalItem,
        terpakai: harian.terpakai,
        tersedia: harian.tersedia,
        maintenance: harian.maintenance,
        utilisasi:
          barang.jumlahTersedia === 0
            ? 0
            : Math.min(100, Math.round((harian.terpakai / barang.jumlahTersedia) * 100)),
        reservasi: relevan,
        posisi:
          tanggalItem < hariIni ? 'lewat' : tanggalItem === hariIni ? 'hari-ini' : 'akan-datang',
      } satisfies SelJadwal;
    });
    const totalUtil = sel.reduce((total, item) => total + item.utilisasi, 0);
    return {
      aset: barang,
      sel,
      utilisasi: sel.length === 0 ? 0 : Math.round(totalUtil / sel.length),
      puncak: sel.reduce((maks, item) => Math.max(maks, item.utilisasi), 0),
      hariPenuh: sel.filter((item) => item.utilisasi >= 100).length,
    } satisfies BarisJadwal;
  });
}

export interface OpsiAgenda {
  mulai: string;
  jumlahHari: number;
  jeda?: number;
}

/** Daily availability rollup — drives the weekly strip and the print sheet. */
/** Availability for every asset on a single day. */
export function ketersediaanHarian(
  data: DataAplikasi,
  hariIni: string = hariSekarang(),
  jeda = 0,
): Array<{ aset: Aset; terpakaiHariIni: number; tersediaHariIni: number; maintenance: boolean }> {
  return data.aset.map((item) => {
    const harian = selKetersediaanHarian(item, data.reservasi, hariIni, jeda);
    return {
      aset: item,
      terpakaiHariIni: harian.terpakai,
      tersediaHariIni: harian.tersedia,
      maintenance: harian.maintenance,
    };
  });
}

export interface BarisAgenda {
  tanggal: string;
  label: string;
  held: number;
  tersedia: number;
  maintenance: number;
  totalUnit: number;
}

export function barisAgenda(
  data: DataAplikasi,
  opsi: OpsiAgenda,
): BarisAgenda[] {
  const { mulai, jumlahHari, jeda = 0 } = opsi;
  return deretTanggal(mulai, jumlahHari).map((tanggal) => {
    let held = 0;
    let tersedia = 0;
    let maintenance = 0;
    let totalUnit = 0;
    for (const barang of data.aset) {
      totalUnit += barang.jumlahTersedia;
      const harian = selKetersediaanHarian(barang, data.reservasi, tanggal, jeda);
      held += harian.terpakai;
      tersedia += harian.tersedia;
      if (harian.maintenance) maintenance += barang.jumlahTersedia;
    }
    return { tanggal, label: formatTanggal(tanggal), held, tersedia, maintenance, totalUnit };
  });
}

/** Revenue for the trailing N days, ordered oldest → newest, for sparklines. */
export function pendapatanHarian(
  data: DataAplikasi,
  hariIni: string = hariSekarang(),
  jumlahHari = 14,
): Array<{ tanggal: string; nilai: number }> {
  const aset = petaAset(data);
  const mulai = tambahHari(hariIni, -(jumlahHari - 1));
  return deretTanggal(mulai, jumlahHari).map((tanggal) => {
    const nilai = data.reservasi
      .filter((item) => item.tanggalMulai === tanggal && item.status !== 'Dibatalkan')
      .reduce((total, item) => total + ringkasSewa(item, aset.get(item.asetId)?.hargaPerHari ?? 0).subtotal, 0);
    return { tanggal, nilai: rupiah(nilai) };
  });
}

/** Top assets by booked revenue in a window — powers the "paling alienation" list. */
export function asetTerlaris(
  data: DataAplikasi,
  hariIni: string = hariSekarang(),
  jumlahHari = 30,
  batas = 5,
): Array<{ aset: Aset; total: number; hari: number; pemesanan: number }> {
  const mulai = tambahHari(hariIni, -(jumlahHari - 1));
  const hasil = data.aset.map((barang) => {
    const milik = data.reservasi.filter(
      (item) =>
        item.asetId === barang.id &&
        item.status !== 'Dibatalkan' &&
        item.tanggalSelesai >= mulai &&
        item.tanggalMulai <= hariIni,
    );
    const total = milik.reduce(
      (jumlah, item) => jumlah + ringkasSewa(item, barang.hargaPerHari).subtotal,
      0,
    );
    const hari = milik.reduce((jumlah, item) => jumlah + ringkasSewa(item, barang.hargaPerHari).hariSewa, 0);
    return { aset: barang, total: rupiah(total), hari, pemesanan: milik.length };
  });
  return hasil.sort((a, b) => b.total - a.total).slice(0, batas);
}

/** Availability for one asset across a window, used by the asset drawer. */
export function jendelaAset(
  aset: Aset,
  reservasi: Reservasi[],
  mulai: string,
  jumlahHari: number,
  jeda = 0,
  hariIni: string = hariSekarang(),
): SelJadwal[] {
  return deretTanggal(mulai, jumlahHari).map((tanggal) => {
    const harian = selKetersediaanHarian(aset, reservasi, tanggal, jeda);
    const relevan = reservasi.filter(
      (item) =>
        item.asetId === aset.id &&
        menahanStok(item.status) &&
        item.tanggalMulai <= tanggal &&
        item.tanggalSelesai >= tanggal,
    );
    return {
      tanggal,
      terpakai: harian.terpakai,
      tersedia: harian.tersedia,
      maintenance: harian.maintenance,
      utilisasi:
        aset.jumlahTersedia === 0
          ? 0
          : Math.min(100, Math.round((harian.terpakai / aset.jumlahTersedia) * 100)),
      reservasi: relevan,
      posisi: tanggal < hariIni ? 'lewat' : tanggal === hariIni ? 'hari-ini' : 'akan-datang',
    } satisfies SelJadwal;
  });
}

export function hariLewat(reservasi: Reservasi, hariIni: string = hariSekarang()): number {
  return hariTerlambat(reservasi, hariIni);
}
