import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useToko } from '../application/toko';
import { idBaruReservasi, type Perintah } from '../application/perintah';
import type { Aset, Reservasi, StatusAset, StatusReservasi } from '../domain/types';
import { kodeBerikut } from '../domain/validasi';
import { PapanPintasan, bangunPerintah, type KonteksPalet } from '../ui/palet';
import { ProviderNotifikasi, useNotif } from '../ui/notifikasi';
import { terapkanTema } from '../infrastruktur/sistem';
import { Dasbor } from '../features/dasbor/Dasbor';
import { PapanJadwal } from '../features/jadwal/PapanJadwal';
import { TabelReservasi } from '../features/reservasi/TabelReservasi';
import { FormReservasi } from '../features/reservasi/FormReservasi';
import { DetailReservasi } from '../features/reservasi/DetailReservasi';
import { DaftarAset } from '../features/aset/DaftarAset';
import { FormAset } from '../features/aset/FormAset';
import { DetailAset } from '../features/aset/DetailAset';
import { PanelOtomasi } from '../features/otomasi/PanelOtomasi';
import { PanelData } from '../features/data/PanelData';
import { Shell } from './Shell';
import { backupJSON, namaBerkasCadangan, unduhTeks } from '../infrastruktur/backup';
import { bersihkanSemua } from '../infrastruktur/db';
import { cetakHTML, lembarKerja } from '../infrastruktur/cetak';
import { antreanHariIni } from '../domain/otomasi';

const HALAMAN = ['dasbor', 'reservasi', 'jadwal', 'aset', 'otomasi', 'data'] as const;
type Halaman = (typeof HALAMAN)[number];

const JUDUL: Record<Halaman, { judul: string; konteks: string }> = {
  dasbor: { judul: 'Dasbor', konteks: 'Lembar kerja hari ini' },
  reservasi: { judul: 'Reservasi', konteks: 'Permintaan, pemesanan, dan pengembalian' },
  jadwal: { judul: 'Papan Jadwal', konteks: 'Okupansi aset per hari' },
  aset: { judul: 'Aset', konteks: 'Inventaris dan harga harian' },
  otomasi: { judul: 'Otomasi', konteks: 'Saran satu klik dari aturan lokal' },
  data: { judul: 'Data & Cadangan', konteks: 'Profil, preferensi, ekspor, snapshot' },
};

/** Chords like "g then d" need a small buffer between the two keys. */
const JEDA_CHORD_MS = 1200;

export function App(): ReactNode {
  return (
    <ProviderNotifikasi>
      <RuangKendali />
    </ProviderNotifikasi>
  );
}

function RuangKendali(): ReactNode {
  const toko = useToko();
  const { tampil } = useNotif();
  const {
    data,
    preferensi,
    hariIni,
    saran,
    log,
    jalankan,
    urungkan,
    ulangi,
    aturPreferensi,
    bisaUrungkan,
    bisaUlangi,
    gagalSimpan,
    versiSimpan,
    sumber,
    pesanSistem,
  } = toko;

  const [halaman, setHalaman] = useState<Halaman>('dasbor');
  const [palet, setPalet] = useState(false);
  const [pintasan, setPintasan] = useState(false);
  const [fokusAset, setFokusAset] = useState('');

  const [formReservasi, setFormReservasi] = useState<{
    buka: boolean;
    id: string | null;
    asetId?: string;
    tanggalMulai?: string;
  }>({ buka: false, id: null });
  const [formAset, setFormAset] = useState<{ buka: boolean; id: string | null }>({
    buka: false,
    id: null,
  });
  const [detailReservasiId, setDetailReservasiId] = useState<string | null>(null);
  const [detailAsetId, setDetailAsetId] = useState<string | null>(null);

  const petaAset = useMemo(() => new Map(data.aset.map((a) => [a.id, a])), [data.aset]);
  const petaReservasi = useMemo(() => new Map(data.reservasi.map((r) => [r.id, r])), [data.reservasi]);
  const jeda = preferensi.jedaAntarSewaHari;
  const saranTinggi = saran.filter((s) => s.prioritas === 'tinggi').length;

  const goto = useCallback((tujuan: string) => {
    setHalaman((sebelumnya) =>
      (HALAMAN as readonly string[]).includes(tujuan) ? (tujuan as Halaman) : sebelumnya,
    );
  }, []);

  /* ---------------------------------------------------------------- */
  /* Tampilan                                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    document.documentElement.dataset.tema = preferensi.tema;
    document.documentElement.dataset.kepadatan = preferensi.kepadatan;
    if (preferensi.tema !== 'sistem') terapkanTema(preferensi.tema);
  }, [preferensi.tema, preferensi.kepadatan]);

  /* ---------------------------------------------------------------- */
  /* Aksi                                                              */
  /* ---------------------------------------------------------------- */

  const buatReservasi = useCallback((preset?: { asetId?: string; tanggalMulai?: string }) => {
    setFormReservasi({
      buka: true,
      id: null,
      asetId: preset?.asetId,
      tanggalMulai: preset?.tanggalMulai,
    });
  }, []);

  const buatAset = useCallback(() => setFormAset({ buka: true, id: null }), []);
  const ubahReservasi = useCallback((r: Reservasi) => setFormReservasi({ buka: true, id: r.id }), []);
  const ubahAset = useCallback((a: Aset) => setFormAset({ buka: true, id: a.id }), []);

  const statusReservasi = useCallback(
    (r: Reservasi, status: StatusReservasi) => jalankan({ jenis: 'reservasi/status', id: r.id, status }),
    [jalankan],
  );

  const statusAset = useCallback(
    (a: Aset, status: StatusAset) => jalankan({ jenis: 'aset/status', id: a.id, status }),
    [jalankan],
  );

  const simpanReservasi = useCallback(
    (r: Reservasi) => {
      jalankan(
        formReservasi.id ? { jenis: 'reservasi/ubah', reservasi: r } : { jenis: 'reservasi/tambah', reservasi: r },
      );
      setFormReservasi({ buka: false, id: null });
    },
    [jalankan, formReservasi.id],
  );

  const simpanAset = useCallback(
    (a: Aset) => {
      jalankan(formAset.id ? { jenis: 'aset/ubah', aset: a } : { jenis: 'aset/tambah', aset: a });
      setFormAset({ buka: false, id: null });
    },
    [jalankan, formAset.id],
  );

  const hapusReservasi = useCallback(
    (r: Reservasi) => {
      jalankan({ jenis: 'reservasi/hapus', id: r.id });
      setDetailReservasiId(null);
      setFormReservasi({ buka: false, id: null });
    },
    [jalankan],
  );

  const hapusAset = useCallback(
    (a: Aset) => {
      jalankan({ jenis: 'aset/hapus', id: a.id });
      setDetailAsetId(null);
      setFormAset({ buka: false, id: null });
    },
    [jalankan],
  );

  const cetakLembarKerja = useCallback(() => {
    const antrean = antreanHariIni(data, hariIni);
    cetakHTML(lembarKerja(data, hariIni, antrean.ambil, antrean.kembali, antrean.terlambat));
  }, [data, hariIni]);

  const bukaReservasi = useCallback((r: Reservasi) => {
    setHalaman('reservasi');
    setDetailReservasiId(r.id);
  }, []);

  const bukaAset = useCallback((a: Aset) => {
    setHalaman('aset');
    setDetailAsetId(a.id);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Palet perintah                                                    */
  /* ---------------------------------------------------------------- */

  const konteksPalet: KonteksPalet = useMemo(
    () => ({
    goto,
    baruReservasi: buatReservasi,
    baruAset: buatAset,
    bukaReservasi,
    bukaAset,
    ubahStatusReservasi: statusReservasi,
    ubahStatusAset: statusAset,
    hapusReservasi,
    ekspor: () => {
      unduhTeks(namaBerkasCadangan(), backupJSON(data));
      tampil('Cadangan diunduh.', { nada: 'sukses' });
    },
    impor: () => goto('data'),
    resetDemo: () => jalankan({ jenis: 'data/demo' }),
    urungkan,
    ulangi,
    toggleTema: () =>
      aturPreferensi({ tema: preferensi.tema === 'gelap' ? 'terang' : 'gelap' }),
    toggleKepadatan: () =>
      aturPreferensi({ kepadatan: preferensi.kepadatan === 'rapat' ? 'nyaman' : 'rapat' }),
    toggleRail: () =>
      aturPreferensi({ sidebar: preferensi.sidebar === 'tipis' ? 'lebar' : 'tipis' }),
    bukaPintasan: () => setPintasan(true),
    }),
    [
      goto,
      buatReservasi,
      buatAset,
      bukaReservasi,
      bukaAset,
      statusReservasi,
      statusAset,
      hapusReservasi,
      data,
      jalankan,
      urungkan,
      ulangi,
      preferensi.tema,
      preferensi.kepadatan,
      preferensi.sidebar,
      aturPreferensi,
      tampil,
    ],
  );

  const perintah = useMemo(
    () => bangunPerintah(konteksPalet, data.aset, data.reservasi),
    [konteksPalet, data.aset, data.reservasi],
  );

  /* ---------------------------------------------------------------- */
  /* Papan ketik                                                        */
  /* ---------------------------------------------------------------- */

  const chordRef = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const mengetik =
        target instanceof HTMLElement &&
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) &&
        !(target instanceof HTMLButtonElement);
      const ctrl = event.ctrlKey || event.metaKey;

      if (ctrl && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalet(true);
        return;
      }
      if (ctrl && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        urungkan();
        return;
      }
      if (ctrl && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) {
        event.preventDefault();
        ulangi();
        return;
      }
      if (ctrl && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        aturPreferensi({ sidebar: preferensi.sidebar === 'tipis' ? 'lebar' : 'tipis' });
        return;
      }
      if (ctrl) return;
      if (mengetik) return;

      const kunci = event.key.toLowerCase();

      if (chordRef.current !== null && Date.now() - chordRef.current < JEDA_CHORD_MS) {
        const petakan: Record<string, Halaman> = {
          d: 'dasbor',
          r: 'reservasi',
          j: 'jadwal',
          a: 'aset',
          o: 'otomasi',
          b: 'data',
        };
        const tujuan = petakan[kunci];
        chordRef.current = null;
        if (tujuan) {
          event.preventDefault();
          goto(tujuan);
        }
        return;
      }

      if (kunci === 'g') {
        chordRef.current = Date.now();
        return;
      }
      if (event.key === '?') {
        event.preventDefault();
        setPintasan((v) => !v);
        return;
      }
      if (kunci === 'n') {
        event.preventDefault();
        buatReservasi();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goto, urungkan, ulangi, aturPreferensi, preferensi.sidebar, buatReservasi]);

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  const detailRes: Reservasi | null = detailReservasiId
    ? (petaReservasi.get(detailReservasiId) ?? null)
    : null;
  const detailAs: Aset | null = detailAsetId ? (petaAset.get(detailAsetId) ?? null) : null;

  const isi = ((): ReactNode => {
    switch (halaman) {
      case 'dasbor':
        return (
          <Dasbor
            data={data}
            hariIni={hariIni}
            saranTinggi={saranTinggi}
            goto={goto}
            ubahStatus={statusReservasi}
            bukaReservasi={bukaReservasi}
            cetakLembarKerja={cetakLembarKerja}
          />
        );

      case 'reservasi':
        return (
          <>
            <div className="kepala">
              <div className="kepala__judul">
                <h1>Daftar reservasi</h1>
                <p className="kepala__sub">
                  Semua permintaan, pemesanan, peminjaman, dan pengembalian dalam satu tabel. Tekan
                  <kbd className="kunci">N</kbd> untuk reservasi baru atau <kbd className="kunci">Ctrl</kbd>
                  <kbd className="kunci">K</kbd> untuk mencari cepat.
                </p>
              </div>
            </div>
            <TabelReservasi
              data={data}
              hariIni={hariIni}
              onBuat={() => buatReservasi()}
              onUbah={ubahReservasi}
              onHapus={hapusReservasi}
              onStatus={statusReservasi}
              onDetail={(r) => setDetailReservasiId(r.id)}
              onCetak={cetakLembarKerja}
              onJalankanSemua={() => goto('otomasi')}
            />
          </>
        );

      case 'jadwal':
        return (
          <>
            <div className="kepala">
              <div className="kepala__judul">
                <h1>Papan jadwal</h1>
                <p className="kepala__sub">
                  Baris adalah aset, kolom adalah hari. Klik sel mana pun untuk langsung membuat
                  reservasi yang sudah terisi aset dan tanggalnya.
                </p>
              </div>
            </div>
            <PapanJadwal
              data={data}
              hariIni={hariIni}
              preferensi={preferensi}
              onBuat={(preset) => {
                setHalaman('reservasi');
                buatReservasi({ asetId: preset.asetId, tanggalMulai: preset.tanggalMulai });
              }}
              onBukaAset={bukaAset}
            />
          </>
        );

      case 'aset':
        return (
          <>
            <div className="kepala">
              <div className="kepala__judul">
                <h1>Inventaris aset</h1>
                <p className="kepala__sub">
                  Harga harian di sini menjadi dasar semua estimasi biaya di tabel reservasi dan di nota
                  cetak.
                </p>
              </div>
            </div>
            <DaftarAset
              data={data}
              hariIni={hariIni}
              jeda={jeda}
              fokusAsetId={fokusAset}
              onFokus={setFokusAset}
              onBuat={buatAset}
              onUbah={ubahAset}
              onDetail={(a) => setDetailAsetId(a.id)}
              onStatus={statusAset}
              onBuatReservasi={(preset) => {
                setHalaman('reservasi');
                buatReservasi(preset);
              }}
            />
          </>
        );

      case 'otomasi':
        return (
          <>
            <div className="kepala">
              <div className="kepala__judul">
                <h1>Otomasi</h1>
                <p className="kepala__sub">
                  Semua aturan berjalan di perangkat ini dan tidak pernah mengubah data tanpa
                  persetujuanmu.
                </p>
              </div>
            </div>
            <PanelOtomasi
              data={data}
              hariIni={hariIni}
              preferensi={preferensi}
              saran={saran}
              jalankan={(perintah: Perintah) => jalankan(perintah)}
              goto={goto}
            />
          </>
        );

      case 'data':
        return (
          <>
            <div className="kepala">
              <div className="kepala__judul">
                <h1>Data &amp; cadangan</h1>
                <p className="kepala__sub">
                  Tidak ada server. Semua yang kamu lihat tersimpan di peramban perangkat ini — jadi
                  mengunduh cadangan berkala itu penting.
                </p>
              </div>
            </div>
            <PanelData
              data={data}
              preferensi={preferensi}
              hariIni={hariIni}
              log={log}
              sumber={sumber === 'penyimpanan' ? 'penyimpanan perangkat' : sumber}
              pesanSistem={pesanSistem}
              gagalSimpan={gagalSimpan}
              onAturPreferensi={aturPreferensi}
              onProfil={(profil) => jalankan({ jenis: 'profil/ubah', profil })}
              onImpor={(d) => jalankan({ jenis: 'data/impor', data: d })}
              onResetDemo={() => jalankan({ jenis: 'data/demo' })}
              onBersihkan={() => {
                bersihkanSemua();
                jalankan({ jenis: 'data/demo' });
              }}
            />
          </>
        );

      default:
        return null;
    }
  })();

  return (
    <>
      <Shell
        halaman={halaman}
        goto={goto}
        judul={JUDUL[halaman].judul}
        konteks={JUDUL[halaman].konteks}
        preferensi={preferensi}
        hariIni={hariIni}
        versiSimpan={versiSimpan}
        gagalSimpan={gagalSimpan}
        jumlahSaran={saranTinggi}
        bisaUrungkan={bisaUrungkan}
        bisaUlangi={bisaUlangi}
        namaUsaha={data.profil.nama}
        avatar={(data.profil.nama || 'RO').slice(0, 2).toUpperCase()}
        perintah={perintah}
        palet={palet}
        onPalet={setPalet}
        onUrungkan={urungkan}
        onUlangi={ulangi}
        onAturPreferensi={aturPreferensi}
      >
        {isi}
      </Shell>

      <FormReservasi
        buka={formReservasi.buka}
        aset={data.aset}
        reservasi={data.reservasi}
        sedangDiubah={formReservasi.id ? (petaReservasi.get(formReservasi.id) ?? null) : null}
        presetAsetId={formReservasi.asetId}
        presetMulai={formReservasi.tanggalMulai}
        jeda={jeda}
        hariIni={hariIni}
        onTutup={() => setFormReservasi({ buka: false, id: null })}
        onSimpan={simpanReservasi}
        onHapus={hapusReservasi}
      />

      <FormAset
        buka={formAset.buka}
        data={data}
        sedangDiubah={formAset.id ? (petaAset.get(formAset.id) ?? null) : null}
        onTutup={() => setFormAset({ buka: false, id: null })}
        onSimpan={simpanAset}
        onHapus={hapusAset}
      />

      <DetailReservasi
        reservasi={detailRes}
        data={data}
        hariIni={hariIni}
        jeda={jeda}
        onTutup={() => setDetailReservasiId(null)}
        onUbah={ubahReservasi}
        onHapus={hapusReservasi}
        onStatus={statusReservasi}
        onPerpanjang={(r, hari) => jalankan({ jenis: 'reservasi/perpanjang', id: r.id, hari })}
        onLunasi={(r) => jalankan({ jenis: 'reservasi/lunasi', id: r.id })}
        onDuplikat={(r) =>
          jalankan({
            jenis: 'reservasi/duplikat',
            sumberId: r.id,
            id: idBaruReservasi(),
            kode: kodeBerikut(data.reservasi, 'RSV'),
          })
        }
      />

      <DetailAset
        aset={detailAs}
        data={data}
        hariIni={hariIni}
        jeda={jeda}
        onTutup={() => setDetailAsetId(null)}
        onUbah={ubahAset}
        onHapus={hapusAset}
        onStatus={statusAset}
        onBuatReservasi={(preset) => {
          setDetailAsetId(null);
          setHalaman('reservasi');
          buatReservasi(preset);
        }}
        onBukaReservasi={(id) => {
          setDetailAsetId(null);
          setDetailReservasiId(id);
        }}
      />

      <PapanPintasan buka={pintasan} onTutup={() => setPintasan(false)} />
    </>
  );
}

