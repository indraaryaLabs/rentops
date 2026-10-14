/**
 * Automation engine (v2).
 *
 * A pure rule scanner: it reads state and returns ranked, explainable, one-click
 * suggestions. Nothing executes on its own — every suggestion carries the exact
 * command the UI should dispatch, so the operator keeps control while the system
 * still does the noticing. Every rule answers three questions: what happened,
 * why it matters, and what to do next.
 */

import type { Aset, DataAplikasi, Preferensi, Reservasi, StatusAset, StatusReservasi } from './types';
import { formatTanggal, hariIni as hariSekarang, labelRelatif, selisihHari, tambahHari } from './tanggal';
import { hariTerlambat, ringkasSewa } from './sewa';
import { totalHariDisewa } from './ketersediaan';
import { formatRupiah } from './uang';

/** What "Jalankan" should dispatch. Mirrors the command union in application/perintah. */
export type TindakanOtomasi =
  | { jenis: 'reservasi/status'; id: string; status: StatusReservasi }
  | { jenis: 'reservasi/perpanjang'; id: string; hari: number }
  | { jenis: 'reservasi/lunasi'; id: string }
  | { jenis: 'aset/status'; id: string; status: StatusAset };

export type PrioritasOtomasi = 'tinggi' | 'sedang' | 'rendah';

export interface Saran {
  /** Stable identity for React keys and de-duplication. */
  id: string;
  aturan: string;
  prioritas: PrioritasOtomasi;
  judul: string;
  detail: string;
  tindakan: TindakanOtomasi;
  /** Optional secondary action shown beside the primary one. */
  tindakanAlternatif?: TindakanOtomasi;
  labelAlternatif?: string;
  reservasiId?: string;
  asetId?: string;
}

export interface KonteksOtomasi {
  data: DataAplikasi;
  hariIni?: string;
  preferensi: Preferensi;
}

const PRIORITAS_NILAI: Record<PrioritasOtomasi, number> = { tinggi: 0, sedang: 1, rendah: 2 };

export function urutkanSaran(daftar: Saran[]): Saran[] {
  return [...daftar].sort((a, b) => {
    const selisih = PRIORITAS_NILAI[a.prioritas] - PRIORITAS_NILAI[b.prioritas];
    if (selisih !== 0) return selisih;
    return a.judul.localeCompare(b.judul, 'id');
  });
}

/** Runs every rule, highest priority first. */
export function jalankanOtomasi({ data, hariIni = hariSekarang(), preferensi }: KonteksOtomasi): Saran[] {
  const aset = new Map(data.aset.map((item) => [item.id, item]));
  const saran: Saran[] = [];

  for (const reservasi of data.reservasi) {
    const barang = aset.get(reservasi.asetId);
    const namaAset = barang?.nama ?? 'aset yang tidak ditemukan';
    const lewat = hariTerlambat(reservasi, hariIni);
    const ringkasan = ringkasSewa(reservasi, barang?.hargaPerHari ?? 0);

    // 1 · Overdue — stock is physically out past the agreed end date.
    if (reservasi.status === 'Dipinjam' && lewat > 0) {
      saran.push({
        id: `terlambat:${reservasi.id}`,
        aturan: 'reservasi-terlambat',
        prioritas: 'tinggi',
        judul: `${reservasi.kode} terlambat ${lewat} hari`,
        detail: `${namaAset} seharusnya kembali ${formatTanggal(
          reservasi.tanggalSelesai,
        )} (${labelRelatif(reservasi.tanggalSelesai, hariIni)}). Satu unit masih tertahan sampai aset dicatat kembali.`,
        tindakan: { jenis: 'reservasi/status', id: reservasi.id, status: 'Dikembalikan' },
        tindakanAlternatif: { jenis: 'reservasi/perpanjang', id: reservasi.id, hari: 1 },
        labelAlternatif: 'Perpanjang 1 hari',
        reservasiId: reservasi.id,
        asetId: reservasi.asetId,
      });
    }

    // 2 · Hand-over scheduled for today.
    if (reservasi.status === 'Dipesan' && reservasi.tanggalMulai === hariIni) {
      saran.push({
        id: `serahkan:${reservasi.id}`,
        aturan: 'pengambilan-hari-ini',
        prioritas: 'sedang',
        judul: `Serahkan ${reservasi.kode} hari ini`,
        detail: `${reservasi.pelanggan} dijadwalkan mengambil ${reservasi.jumlah} unit ${namaAset} hari ini. Serahkan lebih awal supaya status dan ketersediaan tetap akurat.`,
        tindakan: { jenis: 'reservasi/status', id: reservasi.id, status: 'Dipinjam' },
        reservasiId: reservasi.id,
        asetId: reservasi.asetId,
      });
    }

    // 3 · Return scheduled for today.
    if (reservasi.status === 'Dipinjam' && reservasi.tanggalSelesai === hariIni) {
      saran.push({
        id: `terima:${reservasi.id}`,
        aturan: 'pengembalian-hari-ini',
        prioritas: 'sedang',
        judul: `Terima kembali ${reservasi.kode}`,
        detail: `${reservasi.jumlah} unit ${namaAset} dijadwalkan kembali hari ini. Setelah ditandai dikembalikan, unit langsung bisa disewa lagi.`,
        tindakan: { jenis: 'reservasi/status', id: reservasi.id, status: 'Dikembalikan' },
        reservasiId: reservasi.id,
        asetId: reservasi.asetId,
      });
    }

    // 4 · Requests ageing in the soft-hold state.
    if (reservasi.status === 'Permintaan') {
      const umur = Math.max(0, Math.floor((Date.now() - Date.parse(reservasi.dibuatPada)) / 86_400_000));
      if (umur >= 2) {
        saran.push({
          id: `permintaan-menunggu:${reservasi.id}`,
          aturan: 'permintaan-menunggu',
          prioritas: 'rendah',
          judul: `${reservasi.kode} menunggu ${umur} hari`,
          detail: `Permintaan dari ${reservasi.pelanggan} belum diputuskan. Unit masih ditahan sementara — konfirmasi atau batalkan agar stok tidak tertahan sia-sia.`,
          tindakan: { jenis: 'reservasi/status', id: reservasi.id, status: 'Dipesan' },
          tindakanAlternatif: { jenis: 'reservasi/status', id: reservasi.id, status: 'Dibatalkan' },
          labelAlternatif: 'Batalkan',
          reservasiId: reservasi.id,
          asetId: reservasi.asetId,
        });
      }
    }

    // 5 · Outstanding balance after the rental period has ended.
    if (
      (reservasi.status === 'Dipinjam' || reservasi.status === 'Dikembalikan') &&
      ringkasan.sisa > 0 &&
      reservasi.tanggalSelesai <= hariIni
    ) {
      saran.push({
        id: `tagih:${reservasi.id}`,
        aturan: 'sisa-pembayaran',
        prioritas: lewat > 0 ? 'tinggi' : 'sedang',
        judul: `${reservasi.kode} masih punya sisa ${formatRupiah(ringkasan.sisa)}`,
        detail: `DP ${formatRupiah(ringkasan.dp)} dari estimasi ${formatRupiah(
          ringkasan.subtotal,
        )}. Tandai lunas setelah pembayaran diterima agar angka tidak menggantung.`,
        tindakan: { jenis: 'reservasi/lunasi', id: reservasi.id },
        reservasiId: reservasi.id,
        asetId: reservasi.asetId,
      });
    }
  }

  // 6 · Assets approaching their service threshold.
  const ambang = preferensi.ambangSisaHariServis;
  if (ambang > 0) {
    for (const barang of data.aset) {
      if (barang.statusPemeliharaan !== 'Aktif') continue;
      const terpakaiHari = totalHariDisewa(data.reservasi, barang.id);
      const batas = barang.jarakServisHari ?? ambang;
      if (terpakaiHari >= batas) {
        saran.push({
          id: `servis:${barang.id}`,
          aturan: 'servis-jatuh-tempo',
          prioritas: 'rendah',
          judul: `${barang.kode} waktunya servis berkala`,
          detail: `Unit ${barang.nama} sudah disewa ${terpakaiHari} hari sejak penandaan terakhir. Tandai Pemeliharaan agar tidak dipesan selama perbaikan.`,
          tindakan: { jenis: 'aset/status', id: barang.id, status: 'Pemeliharaan' },
          asetId: barang.id,
        });
      }
    }
  }

  return urutkanSaran(saran);
}

/** One-line briefing for the dashboard header and the clipboard digest. */
export function ringkasanOtomasi(saran: Saran[]): string {
  if (saran.length === 0) return 'Tidak ada hal yang perlu diperhatikan saat ini.';
  const tinggi = saran.filter((item) => item.prioritas === 'tinggi').length;
  const sedang = saran.filter((item) => item.prioritas === 'sedang').length;
  const bagian = [
    tinggi > 0 ? `${tinggi} perlu tindakan segera` : null,
    sedang > 0 ? `${sedang} untuk hari ini` : null,
  ].filter(Boolean);
  return bagian.length > 0
    ? `${bagian.join(' · ')}. Buka Otomasi untuk menjalankan satu klik.`
    : `${saran.length} saran menunggu di halaman Otomasi.`;
}

/** Reservations that must be actioned today, ordered by urgency. */
export function antreanHariIni(
  data: DataAplikasi,
  hariIni: string = hariSekarang(),
): { ambil: Reservasi[]; kembali: Reservasi[]; terlambat: Reservasi[] } {
  const ambil = data.reservasi
    .filter((item) => item.status === 'Dipesan' && item.tanggalMulai === hariIni)
    .sort((a, b) => a.kode.localeCompare(b.kode));
  const kembali = data.reservasi
    .filter((item) => item.status === 'Dipinjam' && item.tanggalSelesai === hariIni)
    .sort((a, b) => a.kode.localeCompare(b.kode));
  const terlambat = data.reservasi
    .filter((item) => item.status === 'Dipinjam' && item.tanggalSelesai < hariIni)
    .sort((a, b) => a.tanggalSelesai.localeCompare(b.tanggalSelesai));
  return { ambil, kembali, terlambat };
}

/** Reservations arriving in the next `hari` days — used by the schedule strip. */
export function agendaMendatang(
  data: DataAplikasi,
  hariIni: string = hariSekarang(),
  hari = 7,
): Reservasi[] {
  const batas = tambahHari(hariIni, hari);
  return data.reservasi
    .filter((item) => {
      if (item.status === 'Dibatalkan' || item.status === 'Dikembalikan') return false;
      if (item.status === 'Dipinjam') return item.tanggalSelesai >= hariIni && item.tanggalSelesai <= batas;
      return item.tanggalMulai >= hariIni && item.tanggalMulai <= batas;
    })
    .sort((a, b) => {
      const kunci = (item: Reservasi) => (item.status === 'Dipinjam' ? item.tanggalSelesai : item.tanggalMulai);
      return kunci(a).localeCompare(kunci(b));
    });
}

/** Days since the asset last moved in or out — "cold" assets worth repricing. */
export function asetMenganggur(
  data: DataAplikasi,
  hariIni: string = hariSekarang(),
  ambangHari = 30,
): Aset[] {
  return data.aset.filter((barang) => {
    const riwayat = data.reservasi.filter(
      (item) => item.asetId === barang.id && item.status !== 'Dibatalkan',
    );
    const terakhir = riwayat.reduce((maks, item) => {
      const kandidat = item.dikembalikanPada
        ? item.dikembalikanPada.slice(0, 10)
        : item.tanggalSelesai;
      return kandidat > maks ? kandidat : maks;
    }, '');
    if (!terakhir) return true;
    return selisihHari(terakhir, hariIni) >= ambangHari;
  });
}