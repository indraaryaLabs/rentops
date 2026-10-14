import { useMemo, type ReactNode } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  Copy,
  Download,
  MessageCircle,
  Pencil,
  Printer,
  Trash2,
} from 'lucide-react';
import type { DataAplikasi, Reservasi, StatusReservasi } from '../../domain/types';
import { DESKRIPSI_STATUS, transisiBerikut, tindakanUntuk } from '../../domain/alur';
import { ringkasSewa } from '../../domain/sewa';
import { periksaKetersediaan, selKetersediaanHarian } from '../../domain/ketersediaan';
import { formatTanggal, formatTanggalPanjang, labelRelatif } from '../../domain/tanggal';
import { formatRupiah, formatUnit } from '../../domain/uang';
import { buatICS, namaBerkasICS } from '../../infrastruktur/ics';
import { notaReservasi, cetakHTML } from '../../infrastruktur/cetak';
import { pesanReservasi, salinTeks, tautanWa } from '../../infrastruktur/sistem';
import { Dialog } from '../../ui/form';
import { DetailItem, Info, LencanaReservasi, Tombol } from '../../ui/primitif';
import { unduhTeks } from '../../infrastruktur/backup';
import { useNotif } from '../../ui/notifikasi';

export interface PropsDetailReservasi {
  reservasi: Reservasi | null;
  data: DataAplikasi;
  hariIni: string;
  jeda: number;
  onTutup: () => void;
  onUbah: (reservasi: Reservasi) => void;
  onHapus: (reservasi: Reservasi) => void;
  onStatus: (reservasi: Reservasi, status: StatusReservasi) => void;
  onPerpanjang: (reservasi: Reservasi, hari: number) => void;
  onLunasi: (reservasi: Reservasi) => void;
  onDuplikat: (reservasi: Reservasi) => void;
}

export function DetailReservasi({
  reservasi,
  data,
  hariIni,
  jeda,
  onTutup,
  onUbah,
  onHapus,
  onStatus,
  onPerpanjang,
  onLunasi,
  onDuplikat,
}: PropsDetailReservasi): ReactNode {
  const { tampil } = useNotif();
  const aset = useMemo(
    () => (reservasi ? data.aset.find((item) => item.id === reservasi.asetId) : undefined),
    [reservasi, data.aset],
  );

  if (!reservasi) return null;

  const ringkasan = ringkasSewa(reservasi, aset?.hargaPerHari ?? 0);
  const terlambat =
    reservasi.status === 'Dipinjam' && reservasi.tanggalSelesai < hariIni;
  const hariTelat = terlambat
    ? Math.round(
        (new Date(`${hariIni}T00:00:00`).getTime() -
          new Date(`${reservasi.tanggalSelesai}T00:00:00`).getTime()) /
          86_400_000,
      )
    : 0;
  const belumLunas = ringkasan.sisa > 0;
  const ketersediaan = aset
    ? periksaKetersediaan({
        aset,
        reservasi: data.reservasi,
        mulai: reservasi.tanggalMulai,
        selesai: reservasi.tanggalSelesai,
        jumlah: reservasi.jumlah,
        jeda,
        kecualiId: reservasi.id,
      })
    : null;

  const harian = aset ? selKetersediaanHarian(aset, data.reservasi, hariIni, jeda) : null;

  const salinPesan = async () => {
    const hasil = await salinTeks(pesanReservasi(reservasi, aset));
    tampil(hasil.ok ? 'Pesan WhatsApp disalin.' : hasil.pesan, {
      nada: hasil.ok ? 'sukses' : 'galat',
    });
  };

  return (
    <Dialog
      buka
      lebar="lebar"
      judul={`${reservasi.kode} · ${reservasi.pelanggan}`}
      sub={formatTanggalPanjang(reservasi.tanggalMulai)}
      onTutup={onTutup}
      kaki={
        <>
          <Tombol varian="bahaya" ukuran="kecil" ikon={<Trash2 size={14} />} onClick={() => onHapus(reservasi)}>
            Hapus
          </Tombol>
          <span className="geser" />
          <Tombol varian="garis" ikon={<Printer size={15} />} onClick={() => cetakHTML(notaReservasi(data, reservasi))}>
            Cetak nota
          </Tombol>
          <Tombol varian="garis" ikon={<Pencil size={15} />} onClick={() => onUbah(reservasi)}>
            Ubah
          </Tombol>
          <Tombol varian="utama" ikon={<CheckCircle2 size={15} />} onClick={() => onStatus(reservasi, transisiBerikut(reservasi.status)[0] ?? reservasi.status)}>
            {(() => {
              const berikut = transisiBerikut(reservasi.status)[0];
              return berikut ? tindakanUntuk(berikut).label : 'Selesai';
            })()}
          </Tombol>
        </>
      }
    >
      <div className="tumpuk" style={{ gap: 'var(--s-5)' }}>
        <div className="baris-bungkus" style={{ gap: 8 }}>
          <LencanaReservasi status={reservasi.status} />
          <span className="lencana lencana--tanpa-titik">{DESKRIPSI_STATUS[reservasi.status]}</span>
          {terlambat ? (
            <span className="lencana lencana--bahaya">terlambat {hariTelat} hari</span>
          ) : null}
        </div>

        {terlambat ? (
          <Info nada="bahaya" judul={`Kembalian lewat ${hariTelat} hari`}>
            Aset masih tercatat dipinjam sejak {formatTanggal(reservasi.tanggalSelesai)}. Perpanjang atau
            catat pengembalian supaya papan jadwal dan piutang ikut benar.
          </Info>
        ) : null}

        {belumLunas ? (
          <Info nada="peringatan" judul={`Sisa tagihan ${formatRupiah(ringkasan.sisa)}`}>
            DP tercatat {formatRupiah(ringkasan.dp)}. Tombol “Tandai lunas” akan mengisi DP menjadi nilai
            penuh tanpa mengubah harga atau periode.
          </Info>
        ) : null}

        <div className="detail">
          <DetailItem
            label="Aset"
            nilai={aset ? `${aset.nama}` : '—'}
            catatan={aset ? <span className="mono">{aset.kode}</span> : 'Aset sudah dihapus'}
          />
          <DetailItem label="Jumlah" nilai={`${formatUnit(reservasi.jumlah)} unit`} />
          <DetailItem
            label="Periode"
            nilai={`${formatTanggal(reservasi.tanggalMulai)} – ${formatTanggal(reservasi.tanggalSelesai)}`}
            catatan={`${ringkasan.hariSewa} hari · ${labelRelatif(reservasi.tanggalMulai, hariIni)}`}
          />
          <DetailItem label="Kontak" nilai={reservasi.kontak || '—'} />
          <DetailItem label="Harga harian" nilai={formatRupiah(ringkasan.hargaPerHari)} />
          <DetailItem label="Estimasi biaya" nilai={formatRupiah(ringkasan.subtotal)} />
          <DetailItem label="DP tercatat" nilai={formatRupiah(ringkasan.dp)} />
          <DetailItem label="Sisa bayar" nilai={formatRupiah(ringkasan.sisa)} />
        </div>

        {harian ? (
          <Info nada="info" judul="Ketersediaan aset saat ini">
            Pada {formatTanggal(hariIni)}, {harian.terpakai} dari {aset?.jumlahTersedia ?? 0} unit{' '}
            {aset?.nama} sedang terpakai
            {ketersediaan && !ketersediaan.boleh ? ` — ${ketersediaan.alasan}.` : '.'}
          </Info>
        ) : null}

        {reservasi.catatan ? <Info nada="netral" judul="Catatan">{reservasi.catatan}</Info> : null}

        <div>
          <span className="label">Riwayat status</span>
          <div className="daftar" style={{ marginTop: 8 }}>
            <RiwayatItem
              label="Dibuat"
              waktu={reservasi.dibuatPada}
              detail={`Dicatat ${labelRelatif(reservasi.dibuatPada.slice(0, 10), hariIni)}`}
            />
            {reservasi.diserahkanPada ? (
              <RiwayatItem label="Diserahkan" waktu={reservasi.diserahkanPada} />
            ) : null}
            {reservasi.dikembalikanPada ? (
              <RiwayatItem label="Dikembalikan" waktu={reservasi.dikembalikanPada} />
            ) : null}
            <RiwayatItem label="Terakhir diubah" waktu={reservasi.diperbaruiPada} />
          </div>
        </div>

        <div>
          <span className="label">Tindakan</span>
          <div className="baris-bungkus" style={{ marginTop: 8 }}>
            <Tombol varian="garis" ikon={<CalendarPlus size={15} />} onClick={() => onPerpanjang(reservasi, 1)}>
              Perpanjang 1 hari
            </Tombol>
            <Tombol varian="garis" ikon={<CalendarPlus size={15} />} onClick={() => onPerpanjang(reservasi, 7)}>
              Perpanjang 7 hari
            </Tombol>
            {belumLunas ? (
              <Tombol varian="garis" ikon={<CheckCircle2 size={15} />} onClick={() => onLunasi(reservasi)}>
                Tandai lunas
              </Tombol>
            ) : null}
            <Tombol varian="garis" ikon={<Copy size={15} />} onClick={() => onDuplikat(reservasi)}>
              Duplikat
            </Tombol>
          </div>
        </div>

        <div>
          <span className="label">Bagikan</span>
          <div className="baris-bungkus" style={{ marginTop: 8 }}>
            <Tombol varian="halus" ikon={<MessageCircle size={15} />} onClick={() => void salinPesan()}>
              Salin pesan WhatsApp
            </Tombol>
            {tautanWa(reservasi.kontak, pesanReservasi(reservasi, aset)) ? (
              <a
                className="tbl tbl--garis"
                href={tautanWa(reservasi.kontak, pesanReservasi(reservasi, aset))!.tautan!}
                target="_blank"
                rel="noreferrer noopener"
              >
                <MessageCircle size={15} aria-hidden="true" />
                Buka di WhatsApp
              </a>
            ) : null}
            <Tombol
              varian="halus"
              ikon={<Download size={15} />}
              onClick={() => unduhTeks(namaBerkasICS(aset), buatICS(data, reservasi), 'text/calendar')}
            >
              Unduh kalender (.ics)
            </Tombol>
          </div>
        </div>

        <div>
          <span className="label">Status berikutnya</span>
          <div className="baris-bungkus" style={{ marginTop: 8 }}>
            {transisiBerikut(reservasi.status).map((status) => (
              <Tombol
                key={status}
                varian={status === 'Dibatalkan' ? 'bahaya' : 'garis'}
                ukuran="kecil"
                title={tindakanUntuk(status).penjelasan}
                onClick={() => onStatus(reservasi, status)}
              >
                {tindakanUntuk(status).label}
              </Tombol>
            ))}
            {transisiBerikut(reservasi.status).length === 0 ? (
              <span style={{ fontSize: 12.5, color: 'var(--teks-3)' }}>
                Status ini sudah terminal — tidak ada langkah lanjutan.
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function RiwayatItem({ label, waktu, detail }: { label: string; waktu: string; detail?: string }): ReactNode {
  const tanggal = new Date(waktu);
  const jam = `${String(tanggal.getHours()).padStart(2, '0')}:${String(tanggal.getMinutes()).padStart(2, '0')}`;
  return (
    <div className="riwayat__item">
      <span className="riwayat__waktu">{jam}</span>
      <div className="riwayat__teks">
        <strong>{label}</strong>
        {detail ? <p className="riwayat__rinci">{detail}</p> : null}
      </div>
    </div>
  );
}