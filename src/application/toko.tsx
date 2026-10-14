/**
 * Application store.
 *
 * A small command-driven store rather than a framework: commands in, immutable
 * state out, snapshots for undo, an activity log for accountability, and an
 * effect that mirrors every settled change to localStorage. All domain work is
 * delegated to pure functions, which keeps this file boring.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type { Aset, DataAplikasi, Preferensi, Reservasi } from '../domain/types';
import { PREFERENSI_AWAL } from '../domain/types';
import { hariIni as hariIniFungsi, sekarangISO } from '../domain/tanggal';
import { buatDataDemo } from '../domain/seed';
import { jalankanOtomasi, type Saran } from '../domain/otomasi';
import { dapatDibatalkan, terapkanPerintah, type Perintah } from './perintah';
import {
  muatData,
  muatPreferensi,
  simpanData,
  simpanPreferensi,
  tambahSnapshot,
  type AntarmukaPenyimpanan,
  type SumberMuat,
} from '../infrastruktur/db';

const BATAS_LOG = 60;
const BATAS_UNDO = 25;

export interface CatatanLog {
  id: number;
  waktu: string;
  pesan: string;
  rincian?: string;
  nada: 'sukses' | 'info' | 'peringatan';
  dapatDibatalkan: boolean;
}

export interface KonteksToko {
  data: DataAplikasi;
  aset: Aset[];
  reservasi: Reservasi[];
  preferensi: Preferensi;
  sumber: SumberMuat;
  pesanSistem: string;
  /** Increments whenever persisted state changes; drives the "tersimpan" chip. */
  versiSimpan: number;
  gagalSimpan: boolean;
  hariIni: string;
  saran: Saran[];
  log: CatatanLog[];
  bisaUrungkan: boolean;
  bisaUlangi: boolean;
  jalankan: (perintah: Perintah) => void;
  urungkan: () => void;
  ulangi: () => void;
  aturPreferensi: (perubahan: Partial<Preferensi>) => void;
  /** Overrides "today" — used by the demo/test harness only. */
  tetapkanHariIni: (tanggal: string) => void;
}

const TokoContext = createContext<KonteksToko | null>(null);

interface Riwayat {
  lalu: DataAplikasi[];
  akan: DataAplikasi[];
}

interface KeadaanInternal {
  data: DataAplikasi;
  preferensi: Preferensi;
  sumber: SumberMuat;
  pesanSistem: string;
  versiSimpan: number;
  gagalSimpan: boolean;
  riwayat: Riwayat;
  log: CatatanLog[];
  hariIni: string;
}

type AksiInternal =
  | { jenis: 'ubah'; data: DataAplikasi; catatan: Omit<CatatanLog, 'id'>; undo: boolean }
  | { jenis: 'urungkan' }
  | { jenis: 'ulangi' }
  | { jenis: 'preferensi'; preferensi: Preferensi }
  | { jenis: 'hari'; tanggal: string }
  | { jenis: 'simpan'; berhasil: boolean }
  | { jenis: 'log'; catatan: Omit<CatatanLog, 'id'> };

let penghitungLog = 0;
const catatanBaru = (catatan: Omit<CatatanLog, 'id'>): CatatanLog => ({
  ...catatan,
  id: (penghitungLog += 1),
});

function reducer(state: KeadaanInternal, aksi: AksiInternal): KeadaanInternal {
  switch (aksi.jenis) {
    case 'ubah': {
      if (aksi.data === state.data) return state;
      return {
        ...state,
        data: aksi.data,
        riwayat: aksi.undo
          ? { lalu: [...state.riwayat.lalu, state.data].slice(-BATAS_UNDO), akan: [] }
          : { lalu: [], akan: [] },
        log: [catatanBaru(aksi.catatan), ...state.log].slice(0, BATAS_LOG),
      };
    }

    case 'urungkan': {
      const sebelumnya = state.riwayat.lalu.at(-1);
      if (!sebelumnya) return state;
      return {
        ...state,
        data: sebelumnya,
        riwayat: {
          lalu: state.riwayat.lalu.slice(0, -1),
          akan: [state.data, ...state.riwayat.akan].slice(0, BATAS_UNDO),
        },
        log: [
          catatanBaru({ waktu: sekarangISO(), pesan: 'Perubahan terakhir dibatalkan.', nada: 'info', dapatDibatalkan: false }),
          ...state.log,
        ].slice(0, BATAS_LOG),
      };
    }

    case 'ulangi': {
      const berikutnya = state.riwayat.akan[0];
      if (!berikutnya) return state;
      return {
        ...state,
        data: berikutnya,
        riwayat: {
          lalu: [...state.riwayat.lalu, state.data].slice(-BATAS_UNDO),
          akan: state.riwayat.akan.slice(1),
        },
        log: [
          catatanBaru({ waktu: sekarangISO(), pesan: 'Perubahan dijalankan ulang.', nada: 'info', dapatDibatalkan: false }),
          ...state.log,
        ].slice(0, BATAS_LOG),
      };
    }

    case 'preferensi':
      return { ...state, preferensi: aksi.preferensi };

    case 'hari':
      return state.hariIni === aksi.tanggal ? state : { ...state, hariIni: aksi.tanggal };

    case 'simpan':
      return {
        ...state,
        versiSimpan: state.versiSimpan + 1,
        gagalSimpan: !aksi.berhasil,
        pesanSistem: aksi.berhasil ? state.pesanSistem : 'Penyimpanan lokal tidak tersedia.',
      };

    case 'log':
      return { ...state, log: [catatanBaru(aksi.catatan), ...state.log].slice(0, BATAS_LOG) };

    default:
      return state;
  }
}

export interface OpsiToko {
  /** Inject a fake storage in tests; defaults to localStorage. */
  penyimpanan?: AntarmukaPenyimpanan;
  waktuAwal?: Date;
  /** Turn off persistence entirely (unit tests). */
  tanpaSimpan?: boolean;
}

export function AppStore({
  children,
  penyimpanan,
  waktuAwal,
  tanpaSimpan = false,
}: {
  children: ReactNode;
} & OpsiToko): React.JSX.Element {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const muat = tanpaSimpan
      ? { data: buatDataDemo(waktuAwal), sumber: 'demo' as const, pesan: 'Data demo dibuat.' }
      : muatData(penyimpanan, waktuAwal);
    return {
      data: muat.data,
      preferensi: tanpaSimpan ? { ...PREFERENSI_AWAL } : muatPreferensi(penyimpanan),
      sumber: muat.sumber,
      pesanSistem: muat.pesan,
      versiSimpan: 0,
      gagalSimpan: false,
      riwayat: { lalu: [], akan: [] },
      log: [],
      hariIni: hariIniFungsi(waktuAwal),
    };
  });

  const dataTerakhir = useRef<DataAplikasi>(state.data);
  const versi = useRef(0);

  // Keep "today" fresh when the app stays open across midnight.
  useEffect(() => {
    const pewaktu = window.setInterval(() => {
      const sekarang = hariIniFungsi();
      if (sekarang !== state.hariIni) dispatch({ jenis: 'hari', tanggal: sekarang });
    }, 30_000);
    return () => window.clearInterval(pewaktu);
  }, [state.hariIni]);

  // Mirror every settled change to storage plus a rolling snapshot.
  useEffect(() => {
    if (tanpaSimpan) return;
    if (dataTerakhir.current === state.data) return;
    dataTerakhir.current = state.data;
    versi.current += 1;
    const berhasil = simpanData(state.data, penyimpanan);
    if (state.data.aset.length > 0) {
      tambahSnapshot(
        penyimpanan,
        state.data,
        `v${versi.current} · ${state.data.aset.length} aset`,
      );
    }
    dispatch({ jenis: 'simpan', berhasil });
  }, [state.data, penyimpanan, tanpaSimpan]);

  useEffect(() => {
    if (tanpaSimpan) return;
    simpanPreferensi(state.preferensi, penyimpanan);
  }, [state.preferensi, penyimpanan, tanpaSimpan]);

  const jalankan = useCallback(
    (perintah: Perintah) => {
      const hasil = terapkanPerintah(perintah, state.data, sekarangISO(), {
        jeda: state.preferensi.jedaAntarSewaHari,
      });
      if (hasil.gagal) {
        dispatch({
          jenis: 'log',
          catatan: {
            waktu: sekarangISO(),
            pesan: hasil.pesan,
            rincian: hasil.rincian,
            nada: 'peringatan',
            dapatDibatalkan: false,
          },
        });
        return;
      }
      dispatch({
        jenis: 'ubah',
        data: hasil.data,
        undo: dapatDibatalkan(perintah),
        catatan: {
          waktu: sekarangISO(),
          pesan: hasil.pesan,
          rincian: hasil.rincian,
          nada: hasil.pesan.startsWith('Data demo') ? 'info' : 'sukses',
          dapatDibatalkan: dapatDibatalkan(perintah),
        },
      });
    },
    [state.data, state.preferensi.jedaAntarSewaHari],
  );

  const urungkan = useCallback(() => dispatch({ jenis: 'urungkan' }), []);
  const ulangi = useCallback(() => dispatch({ jenis: 'ulangi' }), []);
  const tetapkanHariIni = useCallback((tanggal: string) => dispatch({ jenis: 'hari', tanggal }), []);

  const aturPreferensi = useCallback(
    (perubahan: Partial<Preferensi>) => {
      dispatch({ jenis: 'preferensi', preferensi: { ...state.preferensi, ...perubahan } });
    },
    [state.preferensi],
  );

  const saran = useMemo(
    () => jalankanOtomasi({ data: state.data, hariIni: state.hariIni, preferensi: state.preferensi }),
    [state.data, state.hariIni, state.preferensi],
  );

  const nilai = useMemo<KonteksToko>(
    () => ({
      data: state.data,
      aset: state.data.aset,
      reservasi: state.data.reservasi,
      preferensi: state.preferensi,
      sumber: state.sumber,
      pesanSistem: state.pesanSistem,
      versiSimpan: state.versiSimpan,
      gagalSimpan: state.gagalSimpan,
      hariIni: state.hariIni,
      saran,
      log: state.log,
      bisaUrungkan: state.riwayat.lalu.length > 0,
      bisaUlangi: state.riwayat.akan.length > 0,
      jalankan,
      urungkan,
      ulangi,
      aturPreferensi,
      tetapkanHariIni,
    }),
    [state, saran, jalankan, urungkan, ulangi, aturPreferensi, tetapkanHariIni],
  );

  return <TokoContext.Provider value={nilai}>{children}</TokoContext.Provider>;
}

export function useToko(): KonteksToko {
  const nilai = useContext(TokoContext);
  if (!nilai) throw new Error('useToko harus dipakai di dalam <AppStore>.');
  return nilai;
}