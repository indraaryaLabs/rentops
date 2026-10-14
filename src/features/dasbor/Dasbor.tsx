import { useMemo, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCopy,
  PackageCheck,
  Printer,
  Sparkles,
} from 'lucide-react';
import type { DataAplikasi, Reservasi, StatusReservasi } from '../../domain/types';
import { agendaMendatang, antreanHariIni } from '../../domain/otomasi';
import { metrikDasbor, pendapatanHarian, petaAset, asetTerlaris } from '../../domain/selektor';
import { formatTanggal, formatTanggalPanjang, labelRelatif } from '../../domain/tanggal';
import { formatRupiahRingkas, formatUnit } from '../../domain/uang';
import { Lencana, Metrik, Panel, Sparkline, Tombol } from '../../ui/primitif';
import { Info, Kosong } from '../../ui/primitif';
import { useNotif } from '../../ui/notifikasi';
import { salinTeks, ringkasanHarian } from '../../infrastruktur/sistem';

export interface PropsDasbor {
  data: DataAplikasi;
  hariIni: string;
  saranTinggi: number;
  goto: (halaman: string) => void;
  ubahStatus: (reservasi: Reservasi, status: StatusReservasi) => void;
  bukaReservasi: (reservasi: Reservasi) => void;
  cetakLembarKerja: () => void;
}

function jamSalam(jam: number): string {
  if (jam < 11) return 'Selamat pagi';
  if (jam < 15) return 'Selamat siang';
  if (jam < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function Dasbor({
  data,
  hariIni,
  saranTinggi,
  goto,
  ubahStatus,
  bukaReservasi,
  cetakLembarKerja,
}: PropsDasbor): ReactNode {
  const { tampil } = useNotif();
  const metrik = useMemo(() => metrikDasbor(data, hariIni), [data, hariIni]);
  const antrean = useMemo(() => antreanHariIni(data, hariIni), [data, hariIni]);
  const agenda = useMemo(() => agendaMendatang(data, hariIni, 7), [data, hariIni]);
  const grafik = useMemo(() => pendapatanHarian(data, hariIni, 14), [data, hariIni]);
  const terlaris = useMemo(() => asetTerlaris(data, hariIni, 30, 4), [data, hariIni]);
  const peta = useMemo(() => petaAset(data), [data]);

  const jam = new Date().getHours();
  const kosong = metreanKosong(metrik, antrean, saranTinggi);

  const salinRingkasan = async () => {
    const hasil = ringkasanHarian({
      tanggal: hariIni,
      ambil: antrean.ambil,
      kembali: antrean.kembali,
      terlambat: antrean.terlambat,
      namaAset: (r) => peta.get(r.asetId)?.kode ?? '—',
    });
    const salin = await salinTeks(hasil.teks);
    tampil(salin.ok ? 'Ringkasan hari ini disalin.' : salin.pesan, {
      nada: salin.ok ? 'sukses' : 'galat',
      rincian: salin.ok ? 'Tempel ke WhatsApp pelanggan atau grup tim.' : undefined,
    });
  };

  return (
    <>
      <section className="salam">
        <div className="salam__teks">
          <p className="salam__jam">{jamSalam(jam)} · {formatTanggalPanjang(hariIni)}</p>
          <h1 className="salam__judul">
            {kosong ? 'Tidak ada agenda hari ini.' : `${antrean.ambil.length + antrean.kembali.length + antrean.terlambat.length} tugas menunggu hari ini.`}
          </h1>
          <p className="salam__ringkas">
            {antrean.terlambat.length > 0 ? (
              <>
                <strong>{antrean.terlambat.length} reservasi terlambat</strong>{' '}
                {antrean.terlambat.map((r) => r.kode).join(', ')}.{' '}
              </>
            ) : null}
            {antrean.ambil.length > 0 ? (
              <>
                <strong>{antrean.ambil.length} perlu diserahkan</strong> ({antrean.ambil.map((r) => r.kode).join(', ')}).{' '}
              </>
            ) : null}
            {antrean.kembali.length > 0 ? (
              <>
                <strong>{antrean.kembali.length} perlu diterima kembali</strong> ({antrean.kembali.map((r) => r.kode).join(', ')}).{' '}
              </>
            ) : null}
            {saranTinggi > 0 ? `${saranTinggi} saran otomatisi menunggu tindakan.` : 'Semua stabil — tidak ada/anacondaan yang perluditindak.'}
          </p>
        </div>
        <div className="kepala__aksi">
          <Tombol varian="garis" ikon={<ClipboardCopy size={15} />} onClick={() => void salinRingkasan()}>
            Salin ringkasan
          </Tombol>
          <Tombol varian="garis" ikon={<Printer size={15} />} onClick={cetakLembarKerja}>
            Cetak lembar kerja
          </Tombol>
          <Tombol varian="utama" ikon={<ArrowUpRight size={15} />} onClick={() => goto('reservasi')}>
            Buka reservasi
          </Tombol>
        </div>
      </section>

      {saranTinggi > 0 ? (
        <Info nada="bahaya" ikon={<Sparkles size={16} />} judul={`${saranTinggi} hal perlu tindakan segera`}>
          <span>
            RentOps menemukan kondisi yang perlu ditangani. Buka <strong>Otomasi</strong> untuk menjalankan satu klik.
          </span>
        </Info>
      ) : null}

      <div className="grid-metrik">
        <Metrik
          label="Reservasi aktif"
          nilai={metrik.reservasiAktif}
          kaki={
            <>
              <strong>{metrik.permintaan}</strong> permintaan · <strong>{metrik.dipinjam}</strong> sedang dipinjam
            </>
          }
          nada="aksen"
          onKlik={() => goto('reservasi')}
        />
        <Metrik
          label="Unit bebas hari ini"
          nilai={metrik.unitBebasHariIni}
          satuan={`/ ${metrik.totalUnit}`}
          kaki={
            <>
              Utilisasi <strong>{metrik.utilisasi}%</strong> · {formatUnit(metrik.asetAktif)} aset aktif
            </>
          }
          onKlik={() => goto('jadwal')}
        />
        <Metrik
          label="Pendapatan berjalan"
          nilai={formatRupiahRingkas(metrik.pendapatanBulanIni)}
          grafik={<Sparkline nilai={grafik.map((item) => item.nilai)} lebar={160} tinggi={28} />}
          kaki={<>14 hari terakhir · rata-rata harian terlihat di grafik</>}
          onKlik={() => goto('data')}
        />
        <Metrik
          label="Piutang berjalan"
          nilai={formatRupiahRingkas(metrik.piutangTertunda)}
          nada={metrik.piutangTertunda > 0 ? 'waspada' : 'netral'}
          kaki={
            metrik.piutangTertunda > 0 ? (
              <>Sisa DP pada reservasi yang periodenya sudah lewat</>
            ) : (
              <>Semua DP pada periode berjalan sudah lunas</>
            )
          }
          onKlik={() => goto('reservasi')}
        />
      </div>

      <div className="grid-utama">
        <Panel
          judul="Lembar kerja hari ini"
          sub="Urutan tindakan operasional — selesai dari atas ke bawah."
          aksi={
            <Tombol varian="halus" ukuran="kecil" onClick={cetakLembarKerja} ikon={<Printer size={14} />}>
              Cetak
            </Tombol>
          }
        >
          <div className="panel__isi--rapat">
            <LembarKelompok
              judul={`Terlambat (${antrean.terlambat.length})`}
              nada="terlambat"
              kosong={antrean.terlambat.length === 0 ? 'Tidak ada keterlambatan.' : null}
              item={antrean.terlambat.map((r) => ({
                reservasi: r,
                detail: `${peta.get(r.asetId)?.kode ?? '—'} · ${r.jumlah} unit · seharusnya kembali ${formatTanggal(
                  r.tanggalSelesai,
                )}`,
                aksi: (
                  <>
                    <Tombol
                      varian="garis"
                      ukuran="kecil"
                      onClick={() => bukaReservasi(r)}
                    >
                      Detail
                    </Tombol>
                    <Tombol
                      varian="utama"
                      ukuran="kecil"
                      onClick={() => ubahStatus(r, 'Dikembalikan')}
                      ikon={<CheckCircle2 size={14} />}
                    >
                      Sudah kembali
                    </Tombol>
                  </>
                ),
              }))}
            />
            <LembarKelompok
              judul={`Perlu diserahkan (${antrean.ambil.length})`}
              nada="keluar"
              kosong={antrean.ambil.length === 0 ? 'Tidak ada pengambilan terjadwal.' : null}
              item={antrean.ambil.map((r) => ({
                reservasi: r,
                detail: `${peta.get(r.asetId)?.kode ?? '—'} · ${r.jumlah} unit · ${
                  r.kontak || 'tanpa kontak'
                }`,
                aksi: (
                  <>
                    <Tombol varian="garis" ukuran="kecil" onClick={() => bukaReservasi(r)}>
                      Detail
                    </Tombol>
                    <Tombol
                      varian="utama"
                      ukuran="kecil"
                      onClick={() => ubahStatus(r, 'Dipinjam')}
                      ikon={<PackageCheck size={14} />}
                    >
                      Serahkan
                    </Tombol>
                  </>
                ),
              }))}
            />
            <LembarKelompok
              judul={`Perlu diterima (${antrean.kembali.length})`}
              nada="kembali"
              kosong={antrean.kembali.length === 0 ? 'Tidak ada pengembalian hari ini.' : null}
              item={antrean.kembali.map((r) => ({
                reservasi: r,
                detail: `${peta.get(r.asetId)?.kode ?? '—'} · ${r.jumlah} unit · ${
                  r.kontak || 'tanpa kontak'
                }`,
                aksi: (
                  <>
                    <Tombol varian="garis" ukuran="kecil" onClick={() => bukaReservasi(r)}>
                      Detail
                    </Tombol>
                    <Tombol
                      varian="utama"
                      ukuran="kecil"
                      onClick={() => ubahStatus(r, 'Dikembalikan')}
                      ikon={<CheckCircle2 size={14} />}
                    >
                      Terima
                    </Tombol>
                  </>
                ),
              }))}
            />
          </div>
        </Panel>

        <div className="tumpuk" style={{ gap: 'var(--s-5)' }}>
          <Panel judul="Tujuh hari ke depan" sub="Pengambilan dan pengembalian berikutnya.">
            <div className="panel__isi--rapat">
              {agenda.length === 0 ? (
                <Kosong
                  ikon={<CheckCircle2 size={18} />}
                  judul="Jadwal kosong"
                  teks="Belum ada agenda tujuh hari ke depan. Buat reservasi agar jadwal tercatat."
                />
              ) : (
                <div className="daftar">
                  {agenda.slice(0, 6).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="daftar__item"
                      style={{ textAlign: 'left', width: '100%' }}
                      onClick={() => bukaReservasi(r)}
                    >
                      <div className="daftar__isi">
                        <p className="daftar__judul">
                          {r.kode} · {r.pelanggan}
                        </p>
                        <p className="daftar__sub">
                          {peta.get(r.asetId)?.kode ?? '—'} · {r.jumlah} unit ·{' '}
                          {labelRelatif(r.status === 'Dipinjam' ? r.tanggalSelesai : r.tanggalMulai, hariIni)}
                        </p>
                      </div>
                      <Lencana nada={r.status === 'Dipinjam' ? 'sukses' : 'info'}> {r.status}</Lencana>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <Panel judul="Paling tersewa" sub="30 hari terakhir, berdasarkan estimasi sewa.">
            <div className="panel__isi--rapat">
              <div className="daftar">
                {terlaris.map((item) => (
                  <div className="daftar__item" key={item.aset.id}>
                    <div className="daftar__isi">
                      <p className="daftar__judul">{item.aset.nama}</p>
                      <p className="daftar__sub">
                        <span className="mono">{item.aset.kode}</span> · {item.hari} hari terpakai ·{' '}
                        {item.pemesanan} pemesanan
                      </p>
                    </div>
                    <span className="num" style={{ fontWeight: 560, fontSize: 13 }}>
                      {formatRupiahRingkas(item.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function LembarKelompok({
  judul,
  nada,
  kosong,
  item,
}: {
  judul: string;
  nada: 'keluar' | 'kembali' | 'terlambat';
  kosong: string | null;
  item: Array<{ reservasi: Reservasi; detail: string; aksi: ReactNode }>;
}): ReactNode {
  return (
    <div className="kerja__grup">
      <div className="kerja__kepala">
        <span>{judul}</span>
      </div>
      {kosong ? (
        <div className="kerja__item">
          <span className="kerja__tanda">
            <CheckCircle2 size={14} aria-hidden="true" />
          </span>
          <p className="kerja__sub">{kosong}</p>
        </div>
      ) : (
        item.map((baris) => (
          <div className="kerja__item" key={baris.reservasi.id}>
            <span className={`kerja__tanda kerja__tanda--${nada}`}>
              {nada === 'terlambat' ? (
                <AlertTriangle size={14} aria-hidden="true" />
              ) : (
                <PackageCheck size={14} aria-hidden="true" />
              )}
            </span>
            <div className="kerja__isi">
              <p className="kerja__judul">
                <span className="mono">{baris.reservasi.kode}</span>
                {baris.reservasi.pelanggan}
              </p>
              <p className="kerja__sub">{baris.detail}</p>
            </div>
            <div className="kerja__aksi">{baris.aksi}</div>
          </div>
        ))
      )}
    </div>
  );
}

function metreanKosong(
  metrik: ReturnType<typeof metrikDasbor>,
  antrean: ReturnType<typeof antreanHariIni>,
  saranTinggi: number,
): boolean {
  return (
    antrean.ambil.length === 0 &&
    antrean.kembali.length === 0 &&
    antrean.terlambat.length === 0 &&
    saranTinggi === 0 &&
    metrik.reservasiAktif === 0
  );
}
