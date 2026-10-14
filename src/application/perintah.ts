/**
 * Commands — the only way state changes.
 *
 * Every mutation the UI can perform is a serialisable command with a stable
 * shape and an Indonesian label. That single discipline buys us:
 *  · undo/redo for free (snapshots are taken around command execution),
 *  · an activity log that reads like a diary of the business,
 *  · automation suggestions that can hand us a ready-made command,
 *  · a command palette that can invoke anything the product can do.
 */

import type { Aset, DataAplikasi, Preferensi, ProfilUsaha, Reservasi, StatusAset, StatusReservasi } from '../domain/types';
import { normalisasiDP, perpanjangRentang, hitungSubtotal } from '../domain/sewa';
import { terapkanStatus, bisaTransisi } from '../domain/alur';
import { periksaKetersediaan } from '../domain/ketersediaan';
import { sekarangISO } from '../domain/tanggal';
import { buatId } from '../domain/id';
import { buatDataDemo } from '../domain/seed';
import type { TindakanOtomasi } from '../domain/otomasi';

export type Perintah =
  | { jenis: 'aset/tambah'; aset: Aset }
  | { jenis: 'aset/ubah'; aset: Aset }
  | { jenis: 'aset/hapus'; id: string }
  | { jenis: 'aset/status'; id: string; status: StatusAset }
  | { jenis: 'reservasi/tambah'; reservasi: Reservasi }
  | { jenis: 'reservasi/ubah'; reservasi: Reservasi }
  | { jenis: 'reservasi/hapus'; id: string }
  | { jenis: 'reservasi/status'; id: string; status: StatusReservasi }
  | { jenis: 'reservasi/perpanjang'; id: string; hari: number }
  | { jenis: 'reservasi/lunasi'; id: string }
  | { jenis: 'reservasi/duplikat'; sumberId: string; id: string; kode: string }
  | { jenis: 'profil/ubah'; profil: ProfilUsaha }
  | { jenis: 'data/impor'; data: DataAplikasi }
  | { jenis: 'data/demo' };

/** Commands worth remembering in the undo stack (bulk imports are their own reset point). */
const DAPAT_DIBATALKAN: ReadonlySet<Perintah['jenis']> = new Set([
  'aset/tambah',
  'aset/ubah',
  'aset/hapus',
  'aset/status',
  'reservasi/tambah',
  'reservasi/ubah',
  'reservasi/hapus',
  'reservasi/status',
  'reservasi/perpanjang',
  'reservasi/lunasi',
  'reservasi/duplikat',
  'profil/ubah',
]);

export function dapatDibatalkan(perintah: Perintah): boolean {
  return DAPAT_DIBATALKAN.has(perintah.jenis);
}

/** Short, human label used in toasts, the activity log and the palette. */
export function labelPerintah(perintah: Perintah, data: DataAplikasi): string {
  switch (perintah.jenis) {
    case 'aset/tambah':
      return `Aset ${perintah.aset.kode} ditambahkan`;
    case 'aset/ubah':
      return `Aset ${perintah.aset.kode} diperbarui`;
    case 'aset/hapus':
      return `Aset ${namaAset(data, perintah.id)} dihapus`;
    case 'aset/status':
      return `Aset ${namaAset(data, perintah.id)} → ${perintah.status}`;
    case 'reservasi/tambah':
      return `Reservasi ${perintah.reservasi.kode} dibuat`;
    case 'reservasi/ubah':
      return `Reservasi ${perintah.reservasi.kode} diperbarui`;
    case 'reservasi/hapus':
      return `Reservasi ${namaReservasi(data, perintah.id)} dihapus`;
    case 'reservasi/status':
      return `Reservasi ${namaReservasi(data, perintah.id)} → ${perintah.status}`;
    case 'reservasi/perpanjang':
      return `Reservasi ${namaReservasi(data, perintah.id)} diperpanjang ${perintah.hari} hari`;
    case 'reservasi/lunasi':
      return `Reservasi ${namaReservasi(data, perintah.id)} ditandai lunas`;
    case 'reservasi/duplikat':
      return `Reservasi ${perintah.kode} dibuat dari ${namaReservasi(data, perintah.sumberId)}`;
    case 'profil/ubah':
      return 'Profil usaha diperbarui';
    case 'data/impor':
      return 'Data diimpor dari berkas';
    case 'data/demo':
      return 'Data demo dipulihkan';
    default:
      return 'Perubahan disimpan';
  }
}

function namaAset(data: DataAplikasi, id: string): string {
  return data.aset.find((item) => item.id === id)?.kode ?? id;
}

function namaReservasi(data: DataAplikasi, id: string): string {
  return data.reservasi.find((item) => item.id === id)?.kode ?? id;
}

export interface OpsiPerintah {
  /**
   * Buffer days that widen every stock-holding booking. The store passes the
   * operator's preference so the guard here matches the preview in the form.
   */
  jeda?: number;
}

export interface HasilPerintah {
  data: DataAplikasi;
  /** Short confirmation shown in the toast. */
  pesan: string;
  /** Extra detail line when the operator benefits from it. */
  rincian?: string;
  /** Records that should be focused after the command (e.g. open detail). */
  sorot?: string;
  /** Set when the command could not be applied; state is unchanged. */
  gagal?: boolean;
}

function tanpaPerubahan(data: DataAplikasi, pesan: string): HasilPerintah {
  return { data, pesan, gagal: true };
}

/** Applies a command. Pure: same input, same output, no side effects. */
export function terapkanPerintah(
  perintah: Perintah,
  data: DataAplikasi,
  waktu: string = sekarangISO(),
  opsi: OpsiPerintah = {},
): HasilPerintah {
  switch (perintah.jenis) {
    case 'aset/tambah': {
      if (data.aset.some((item) => item.kode.toUpperCase() === perintah.aset.kode.toUpperCase())) {
        return tanpaPerubahan(data, `Kode ${perintah.aset.kode} sudah dipakai.`);
      }
      return {
        data: { ...data, aset: [...data.aset, perintah.aset] },
        pesan: `Aset ${perintah.aset.nama} ditambahkan.`,
        rincian: `${perintah.aset.jumlahTersedia} unit · ${perintah.aset.kode}`,
        sorot: perintah.aset.id,
      };
    }

    case 'aset/ubah': {
      const ada = data.aset.some((item) => item.id === perintah.aset.id);
      if (!ada) return tanpaPerubahan(data, 'Aset tidak ditemukan.');
      if (
        data.aset.some(
          (item) => item.id !== perintah.aset.id && item.kode.toUpperCase() === perintah.aset.kode.toUpperCase(),
        )
      ) {
        return tanpaPerubahan(data, `Kode ${perintah.aset.kode} sudah dipakai aset lain.`);
      }
      return {
        data: {
          ...data,
          aset: data.aset.map((item) =>
            item.id === perintah.aset.id
              ? { ...perintah.aset, kode: perintah.aset.kode.toUpperCase(), diperbaruiPada: waktu }
              : item,
          ),
        },
        pesan: `Aset ${perintah.aset.nama} diperbarui.`,
        sorot: perintah.aset.id,
      };
    }

    case 'aset/hapus': {
      const target = data.aset.find((item) => item.id === perintah.id);
      if (!target) return tanpaPerubahan(data, 'Aset tidak ditemukan.');
      const aktif = data.reservasi.filter(
        (item) => item.asetId === perintah.id && item.status !== 'Dibatalkan' && item.status !== 'Dikembalikan',
      );
      if (aktif.length > 0) {
        return {
          data,
          pesan: `${target.nama} masih dipakai ${aktif.length} reservasi.`,
          rincian: 'Selesaikan atau batalkan reservasinya lebih dulu.',
          gagal: true,
        };
      }
      const jumlah = data.reservasi.filter((item) => item.asetId === perintah.id).length;
      return {
        data: {
          ...data,
          aset: data.aset.filter((item) => item.id !== perintah.id),
          reservasi: data.reservasi.filter((item) => item.asetId !== perintah.id),
        },
        pesan: `Aset ${target.nama} dihapus.`,
        rincian: jumlah > 0 ? `${jumlah} reservasi ikut terhapus.` : undefined,
      };
    }

    case 'aset/status': {
      const target = data.aset.find((item) => item.id === perintah.id);
      if (!target) return tanpaPerubahan(data, 'Aset tidak ditemukan.');
      if (target.statusPemeliharaan === perintah.status) {
        return tanpaPerubahan(data, `${target.nama} sudah berstatus ${perintah.status}.`);
      }
      return {
        data: {
          ...data,
          aset: data.aset.map((item) =>
            item.id === perintah.id
              ? { ...item, statusPemeliharaan: perintah.status, diperbaruiPada: waktu }
              : item,
          ),
        },
        pesan:
          perintah.status === 'Pemeliharaan'
            ? `${target.nama} masuk pemeliharaan dan tidak bisa dipesan.`
            : `${target.nama} aktif kembali dan bisa dipesan.`,
        sorot: perintah.id,
      };
    }

    case 'reservasi/tambah': {
      if (data.reservasi.some((item) => item.kode.toUpperCase() === perintah.reservasi.kode.toUpperCase())) {
        return tanpaPerubahan(data, `Nomor ${perintah.reservasi.kode} sudah dipakai.`);
      }
      const ketersediaan = periksaKetersediaan({
        aset: data.aset.find((item) => item.id === perintah.reservasi.asetId),
        reservasi: data.reservasi,
        mulai: perintah.reservasi.tanggalMulai,
        selesai: perintah.reservasi.tanggalSelesai,
        jumlah: perintah.reservasi.jumlah,
        jeda: opsi.jeda ?? 0,
      });
      if (!ketersediaan.boleh) {
        return {
          data,
          pesan: 'Reservasi ditolak: stok tidak cukup pada rentang tersebut.',
          rincian: ketersediaan.alasan,
          gagal: true,
        };
      }
      return {
        data: { ...data, reservasi: [...data.reservasi, perintah.reservasi] },
        pesan: `Reservasi ${perintah.reservasi.kode} dibuat.`,
        rincian: `${perintah.reservasi.pelanggan} · ${perintah.reservasi.jumlah} unit`,
        sorot: perintah.reservasi.id,
      };
    }

    case 'reservasi/ubah': {
      const ada = data.reservasi.some((item) => item.id === perintah.reservasi.id);
      if (!ada) return tanpaPerubahan(data, 'Reservasi tidak ditemukan.');
      if (
        data.reservasi.some(
          (item) =>
            item.id !== perintah.reservasi.id &&
            item.kode.toUpperCase() === perintah.reservasi.kode.toUpperCase(),
        )
      ) {
        return tanpaPerubahan(data, `Nomor ${perintah.reservasi.kode} sudah dipakai.`);
      }
      const ketersediaan = periksaKetersediaan({
        aset: data.aset.find((item) => item.id === perintah.reservasi.asetId),
        reservasi: data.reservasi,
        mulai: perintah.reservasi.tanggalMulai,
        selesai: perintah.reservasi.tanggalSelesai,
        jumlah: perintah.reservasi.jumlah,
        jeda: opsi.jeda ?? 0,
        kecualiId: perintah.reservasi.id,
      });
      if (!ketersediaan.boleh) {
        return {
          data,
          pesan: 'Perubahan ditolak: stok tidak cukup pada rentang tersebut.',
          rincian: ketersediaan.alasan,
          gagal: true,
        };
      }
      return {
        data: {
          ...data,
          reservasi: data.reservasi.map((item) =>
            item.id === perintah.reservasi.id
              ? { ...perintah.reservasi, diperbaruiPada: waktu }
              : item,
          ),
        },
        pesan: `Reservasi ${perintah.reservasi.kode} diperbarui.`,
        sorot: perintah.reservasi.id,
      };
    }

    case 'reservasi/hapus': {
      const target = data.reservasi.find((item) => item.id === perintah.id);
      if (!target) return tanpaPerubahan(data, 'Reservasi tidak ditemukan.');
      return {
        data: { ...data, reservasi: data.reservasi.filter((item) => item.id !== perintah.id) },
        pesan: `Reservasi ${target.kode} dihapus.`,
        rincian: 'Unit yang ditahan langsung bisa disewa lagi.',
      };
    }

    case 'reservasi/status': {
      const target = data.reservasi.find((item) => item.id === perintah.id);
      if (!target) return tanpaPerubahan(data, 'Reservasi tidak ditemukan.');
      if (target.status === perintah.status) {
        return tanpaPerubahan(data, `${target.kode} sudah berstatus ${perintah.status}.`);
      }
      const aset = data.aset.find((item) => item.id === target.asetId);
      if (!bisaTransisi(target.status, perintah.status)) {
        return tanpaPerubahan(
          data,
          `Tidak bisa pindah dari ${target.status} ke ${perintah.status}.`,
        );
      }
      const diperbarui = terapkanStatus(target, perintah.status, waktu);
      const pesan =
        perintah.status === 'Dipesan'
          ? `${target.kode} dikonfirmasi. Stok dijamin sampai jadwal pengambilan.`
          : perintah.status === 'Dipinjam'
            ? `${target.kode} diserahkan ke pelanggan.`
            : perintah.status === 'Dikembalikan'
              ? `${target.kode} selesai. ${aset?.jumlahTersedia ?? 0} unit ${aset?.nama ?? 'aset'} kembali bebas.`
              : `${target.kode} dibatalkan. Stok dilepas.`;
      return {
        data: {
          ...data,
          reservasi: data.reservasi.map((item) => (item.id === target.id ? diperbarui : item)),
        },
        pesan,
        sorot: target.id,
      };
    }

    case 'reservasi/perpanjang': {
      const target = data.reservasi.find((item) => item.id === perintah.id);
      if (!target) return tanpaPerubahan(data, 'Reservasi tidak ditemukan.');
      const aset = data.aset.find((item) => item.id === target.asetId);
      if (!aset) return tanpaPerubahan(data, 'Aset tidak ditemukan.');
      const rentang = perpanjangRentang({ mulai: target.tanggalMulai, selesai: target.tanggalSelesai }, perintah.hari);
      const bentrok = data.reservasi.some((item) => {
        if (item.id === target.id || item.asetId !== target.asetId) return false;
        if (item.status === 'Dibatalkan' || item.status === 'Dikembalikan') return false;
        return item.tanggalMulai <= rentang.selesai && item.tanggalSelesai >= rentang.mulai;
      });
      if (bentrok) {
        return {
          data,
          pesan: 'Perpanjangan ditolak: ada reservasi lain pada rentang tersebut.',
          gagal: true,
        };
      }
      const diperbarui = {
        ...target,
        tanggalMulai: rentang.mulai,
        tanggalSelesai: rentang.selesai,
        diperbaruiPada: waktu,
      };
      const subtotalBaru = hitungSubtotal(diperbarui.jumlah, aset.hargaPerHari, rentang);
      return {
        data: {
          ...data,
          reservasi: data.reservasi.map((item) => (item.id === target.id ? diperbarui : item)),
        },
        pesan: `${target.kode} diperpanjang ${perintah.hari} hari.`,
        rincian: `Estimasi baru ${subtotalBaru.toLocaleString('id-ID')} rupiah.`,
        sorot: target.id,
      };
    }

    case 'reservasi/lunasi': {
      const target = data.reservasi.find((item) => item.id === perintah.id);
      if (!target) return tanpaPerubahan(data, 'Reservasi tidak ditemukan.');
      const aset = data.aset.find((item) => item.id === target.asetId);
      const subtotal = hitungSubtotal(target.jumlah, aset?.hargaPerHari ?? 0, { mulai: target.tanggalMulai, selesai: target.tanggalSelesai });
      return {
        data: {
          ...data,
          reservasi: data.reservasi.map((item) =>
            item.id === target.id ? { ...item, dp: normalisasiDP(subtotal, subtotal), diperbaruiPada: waktu } : item,
          ),
        },
        pesan: `${target.kode} ditandai lunas.`,
        rincian: `DP ${subtotal.toLocaleString('id-ID')} rupiah.`,
        sorot: target.id,
      };
    }

    case 'reservasi/duplikat': {
      const sumber = data.reservasi.find((item) => item.id === perintah.sumberId);
      if (!sumber) return tanpaPerubahan(data, 'Reservasi sumber tidak ditemukan.');
      if (data.reservasi.some((item) => item.kode.toUpperCase() === perintah.kode.toUpperCase())) {
        return tanpaPerubahan(data, `Nomor ${perintah.kode} sudah dipakai.`);
      }
      const salinan: Reservasi = {
        ...sumber,
        id: perintah.id,
        kode: perintah.kode,
        status: 'Permintaan',
        dp: 0,
        dibuatPada: waktu,
        diperbaruiPada: waktu,
        diserahkanPada: null,
        dikembalikanPada: null,
      };
      return {
        data: { ...data, reservasi: [...data.reservasi, salinan] },
        pesan: `${perintah.kode} dibuat dari ${sumber.kode}.`,
        rincian: 'Status kembali ke Permintaan. Periksa tanggal sebelum mengonfirmasi.',
        sorot: perintah.id,
      };
    }

    case 'profil/ubah':
      return {
        data: { ...data, profil: perintah.profil },
        pesan: 'Profil usaha diperbarui.',
      };

    case 'data/impor':
      return {
        data: perintah.data,
        pesan: `Data diimpor: ${perintah.data.aset.length} aset, ${perintah.data.reservasi.length} reservasi.`,
      };

    case 'data/demo':
      return {
        data: buatDataDemo(),
        pesan: 'Data demo dipulihkan.',
        rincian: 'Seluruh perubahan lokal diganti contoh awal.',
      };

    default:
      return tanpaPerubahan(data, 'Perintah tidak dikenal.');
  }
}

/** Maps an automation suggestion onto a command. */
export function perintahDariTindakan(tindakan: TindakanOtomasi): Perintah {
  switch (tindakan.jenis) {
    case 'reservasi/status':
      return { jenis: 'reservasi/status', id: tindakan.id, status: tindakan.status };
    case 'reservasi/perpanjang':
      return { jenis: 'reservasi/perpanjang', id: tindakan.id, hari: tindakan.hari };
    case 'reservasi/lunasi':
      return { jenis: 'reservasi/lunasi', id: tindakan.id };
    case 'aset/status':
      return { jenis: 'aset/status', id: tindakan.id, status: tindakan.status };
    default:
      return { jenis: 'data/demo' };
  }
}

export function idBaruAset(): string {
  return buatId('ast');
}

export function idBaruReservasi(): string {
  return buatId('rsv');
}

export type { Preferensi };