import { useMemo, type ReactNode } from 'react';
import { CalendarPlus, Copy, Pencil, Printer, Trash2, Wrench } from 'lucide-react';
import type { Aset, DataAplikasi, StatusAset } from '../../domain/types';
import { selKetersediaanHarian } from '../../domain/ketersediaan';
import { jendelaAset } from '../../domain/selektor';
import { formatTanggal, formatTanggalPendek } from '../../domain/tanggal';
import { formatPersen, formatRupiah, formatUnit } from '../../domain/uang';
import { ringkasSewa } from '../../domain/sewa';
import { Dialog } from '../../ui/form';
import { DetailItem, Info, Kosong, LencanaAset, Meter, Tombol } from '../../ui/primitif';

export interface PropsDetailAset {
  aset: Aset | null;
  data: DataAplikasi;
  hariIni: string;
  jeda: number;
  onTutup: () => void;
  onUbah: (aset: Aset) => void;
  onHapus: (aset: Aset) => void;
  onStatus: (aset: Aset, status: StatusAset) => void;
  onBuatReservasi: (preset: { asetId: string; tanggalMulai: string }) => void;
  onBukaReservasi: (id: string) => void;
}

export function DetailAset({
  aset,
  data,
  hariIni,
  jeda,
  onTutup,
  onUbah,
  onHapus,
  onStatus,
  onBuatReservasi,
  onBukaReservasi,
}: PropsDetailAset): ReactNode {
  const jendela = useMemo(
    () => (aset ? jendelaAset(aset, data.reservasi, hariIni, 14, jeda, hariIni) : []),
    [aset, data.reservasi, hariIni, jeda],
  );

  const relevan = useMemo(
    () =>
      aset
        ? data.reservasi
            .filter((item) => item.asetId === aset.id && item.status !== 'Dibatalkan')
            .sort((a, b) => b.tanggalMulai.localeCompare(a.tanggalMulai))
        : [],
    [aset, data.reservasi],
  );

  if (!aset) return null;

  const harian = selKetersediaanHarian(aset, data.reservasi, hariIni, jeda);
  const diServis = aset.statusPemeliharaan !== 'Aktif';
  const pendapatan = relevan
    .filter((item) => item.tanggalMulai <= hariIni)
    .reduce((n, item) => n + ringkasSewa(item, aset.hargaPerHari).subtotal, 0);
  const terpakaiPersen = aset.jumlahTersedia > 0 ? (harian.terpakai / aset.jumlahTersedia) * 100 : 0;

  return (
    <Dialog
      buka
      lebar="lebar"
      judul={aset.nama}
      sub={`${aset.kode} · ${aset.kategori} · ${formatUnit(aset.jumlahTersedia)} unit`}
      onTutup={onTutup}
      kaki={
        <>
          <Tombol varian="bahaya" ukuran="kecil" ikon={<Trash2 size={14} />} onClick={() => onHapus(aset)}>
            Hapus
          </Tombol>
          <span className="geser" />
          <Tombol varian="garis" ikon={<Printer size={15} />} onClick={() => window.print()}>
            Cetak
          </Tombol>
          <Tombol varian="garis" ikon={<Pencil size={15} />} onClick={() => onUbah(aset)}>
            Ubah
          </Tombol>
          <Tombol
            varian="utama"
            ikon={<Wrench size={15} />}
            disabled={diServis}
            onClick={() => onBuatReservasi({ asetId: aset.id, tanggalMulai: hariIni })}
          >
            Sewakan
          </Tombol>
        </>
      }
    >
      <div className="tumpuk" style={{ gap: 'var(--s-5)' }}>
        <div className="baris-bungkus" style={{ gap: 8 }}>
          <LencanaAset status={aset.statusPemeliharaan} />
          <span className="lencana lencana--tanpa-titik">
            {formatRupiah(aset.hargaPerHari)} / hari
          </span>
          {aset.jarakServisHari ? (
            <span className="lencana lencana--tanpa-titik lencana--info">
              servis tiap {aset.jarakServisHari} hari
            </span>
          ) : null}
        </div>

        {diServis ? (
          <Info nada="peringatan" judul="Aset sedang pemeliharaan">
            Unit aset ini tidak ditawarkan ke pelanggan sampai statusnya kembali Aktif. Kembalikannya kapan
            pun lewat tombol di bawah.
          </Info>
        ) : null}

        <div className="detail">
          <DetailItem label="Unit dipesan hari ini" nilai={formatUnit(harian.terpakai)} />
          <DetailItem
            label="Unit bebas hari ini"
            nilai={diServis ? '—' : formatUnit(harian.tersedia)}
            catatan={jeda > 0 ? `Sudah memperhitungkan jeda ${jeda} hari.` : undefined}
          />
          <DetailItem
            label="Pendapatan tercatat"
            nilai={formatRupiah(pendapatan)}
            catatan="Akumulasi semua reservasi yang sudah mulai."
          />
          <DetailItem label="Jumlah pemesanan" nilai={formatUnit(relevan.length)} />
        </div>

        <div>
          <div className="baris" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="label">Pemakaian 14 hari ke depan</span>
            <span style={{ fontSize: 12.5, color: 'var(--teks-3)' }}>
              {formatPersen(terpakaiPersen)} terpakai hari ini
            </span>
          </div>
          <Meter persentase={terpakaiPersen} label={`${Math.round(terpakaiPersen)}% terpakai hari ini`} />
          <div className="garis-waktu" style={{ marginTop: 8 }}>
            {jendela.map((sel) => (
              <div key={sel.tanggal} className="baris-bungkus" style={{ gap: 6, padding: '3px 0' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--teks-4)', minWidth: 46 }}>
                  {formatTanggalPendek(sel.tanggal)}
                </span>
                <div className="meter" style={{ flex: 1 }}>
                  <div
                    className={`meter__isi${sel.terpakai >= aset.jumlahTersedia ? ' meter__isi--penuh' : ''}`}
                    style={{ width: `${Math.min(100, sel.utilisasi)}%` }}
                  />
                </div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--teks-3)', minWidth: 52, textAlign: 'right' }}>
                  {sel.maintenance ? 'servis' : `${sel.terpakai}/${aset.jumlahTersedia}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {aset.catatan ? <Info nada="info" judul="Catatan">{aset.catatan}</Info> : null}

        <div>
          <span className="label">Reservasi terbaru</span>
          {relevan.length === 0 ? (
            <div style={{ marginTop: 8 }}>
              <Kosong
                judul="Belum ada pemesanan"
                teks="Aset ini belum pernah disewa. Buat reservasi pertama untuk mulai mencatat."
              />
            </div>
          ) : (
            <div className="daftar" style={{ marginTop: 8 }}>
              {relevan.slice(0, 6).map((item) => {
                const ringkasan = ringkasSewa(item, aset.hargaPerHari);
                return (
                  <div key={item.id} className="daftar__item">
                    <div className="daftar__isi">
                      <p className="daftar__judul">
                        <span className="mono">{item.kode}</span> · {item.pelanggan}
                      </p>
                      <p className="daftar__sub">
                        {formatTanggal(item.tanggalMulai)} – {formatTanggal(item.tanggalSelesai)} ·{' '}
                        {formatUnit(item.jumlah)} unit · {formatRupiah(ringkasan.subtotal)}
                      </p>
                    </div>
                    <div className="baris">
                      <span className="lencana lencana--tanpa-titik">{item.status}</span>
                      <Tombol
                        varian="halus"
                        ukuran="kecil"
                        hanyaIkon
                        aria-label={`Buka ${item.kode}`}
                        ikon={<CalendarPlus size={14} />}
                        onClick={() => onBukaReservasi(item.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="baris-bungkus">
          <Tombol
            varian={diServis ? 'utama' : 'garis'}
            ikon={<Wrench size={15} />}
            onClick={() => onStatus(aset, diServis ? 'Aktif' : 'Pemeliharaan')}
          >
            {diServis ? 'Kembalikan ke aktif' : 'Tandai pemeliharaan'}
          </Tombol>
          <Tombol varian="halus" ikon={<Copy size={15} />} onClick={() => onUbah({ ...aset, kode: `${aset.kode}-SALIN` })}>
            Duplikat
          </Tombol>
        </div>
      </div>
    </Dialog>
  );
}