import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  CornerDownLeft,
  Download,
  FileUp,
  Keyboard,
  Moon,
  Package,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sun,
  Undo2,
} from 'lucide-react';
import type { Aset, Reservasi, StatusAset, StatusReservasi } from '../domain/types';
import { normalisasi } from '../domain/filter';
import { formatTanggal } from '../domain/tanggal';
import { formatRupiahRingkas } from '../domain/uang';

export interface PerintahPalet {
  id: string;
  judul: string;
  sub?: string;
  kelompok: string;
  ikon: ReactNode;
  pintasan?: string[];
  jalankan: () => void;
}

/**
 * Cmd/Ctrl+K palette: navigation, record lookup and every mutating action in one
 * keyboard-first surface. Fuzzy scoring is intentionally simple and predictable
 * (prefix > word-start > substring) so results never feel random.
 */
export function PaletPerintah({
  buka,
  onTutup,
  perintah,
}: {
  buka: boolean;
  onTutup: () => void;
  perintah: PerintahPalet[];
}): ReactNode {
  const [kueri, setKueri] = useState('');
  const [aktif, setAktif] = useState(0);
  const daftarRef = useRef<HTMLDivElement>(null);
  const masukanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (buka) {
      setKueri('');
      setAktif(0);
      window.setTimeout(() => masukanRef.current?.focus(), 20);
    }
  }, [buka]);

  const hasil = useMemo(() => {
    const kunci = normalisasi(kueri);
    if (!kunci) return perintah.slice(0, 40);
    const skor = (item: PerintahPalet): number => {
      const judul = normalisasi(item.judul);
      const sub = normalisasi(item.sub ?? '');
      if (judul.startsWith(kunci)) return 100 - judul.length;
      if (judul.split(' ').some((kata) => kata.startsWith(kunci))) return 80 - judul.length;
      if (judul.includes(kunci)) return 60 - judul.length;
      if (sub.includes(kunci)) return 40 - sub.length;
      return -1;
    };
    return perintah
      .map((item) => ({ item, nilai: skor(item) }))
      .filter((x) => x.nilai >= 0)
      .sort((a, b) => b.nilai - a.nilai)
      .slice(0, 40)
      .map((x) => x.item);
  }, [kueri, perintah]);

  useEffect(() => {
    setAktif(0);
  }, [kueri]);

  useEffect(() => {
    if (!buka) return;
    const pada = daftarRef.current?.querySelector<HTMLElement>('[data-aktif="true"]');
    pada?.scrollIntoView({ block: 'nearest' });
  }, [aktif, buka]);

  if (!buka) return null;

  const kelompok = [...new Set(hasil.map((item) => item.kelompok))];

  return (
    <div
      className="tirai"
      style={{ alignItems: 'flex-start', paddingTop: '12vh' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onTutup();
      }}
    >
      <div className="palet" role="dialog" aria-modal="true" aria-label="Palet perintah">
        <div className="palet__cari">
          <Search size={16} aria-hidden="true" style={{ color: 'var(--teks-4)' }} />
          <input
            ref={masukanRef}
            className="palet__masukan"
            type="text"
            value={kueri}
            placeholder="Cari atau jalankan apa saja…"
            aria-label="Cari perintah"
            onChange={(event) => setKueri(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setAktif((v) => (hasil.length === 0 ? 0 : (v + 1) % hasil.length));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setAktif((v) => (hasil.length === 0 ? 0 : (v - 1 + hasil.length) % hasil.length));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                const item = hasil[aktif];
                if (item) {
                  onTutup();
                  item.jalankan();
                }
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onTutup();
              }
            }}
          />
          <span className="kunci">Esc</span>
        </div>

        <div className="palet__daftar" ref={daftarRef}>
          {hasil.length === 0 ? (
            <p className="kosong__teks" style={{ padding: 20, textAlign: 'center' }}>
              Tidak ada yang cocok dengan “{kueri}”.
            </p>
          ) : (
            kelompok.map((nama) => (
              <div key={nama}>
                <p className="palet__grup">{nama}</p>
                {hasil
                  .filter((item) => item.kelompok === nama)
                  .map((item) => {
                    const index = hasil.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="palet__item"
                        data-aktif={index === aktif}
                        onMouseEnter={() => setAktif(index)}
                        onClick={() => {
                          onTutup();
                          item.jalankan();
                        }}
                      >
                        {item.ikon}
                        <span className="palet__teks">
                          <span className="palet__judul">{item.judul}</span>
                          {item.sub ? <span className="palet__sub">{item.sub}</span> : null}
                        </span>
                        {item.pintasan?.map((pintasan) => (
                          <span className="kunci" key={pintasan}>
                            {pintasan}
                          </span>
                        ))}
                      </button>
                    );
                  })}
              </div>
            ))
          )}
        </div>

        <div className="palet__kaki">
          <span className="baris baris--rapat">
            <span className="kunci">↑↓</span> navigasi
          </span>
          <span className="baris baris--rapat">
            <span className="kunci">↵</span> jalankan
          </span>
          <span className="baris baris--rapat geser">
            <CornerDownLeft size={12} aria-hidden="true" /> {hasil.length} hasil
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pintasan papan                                                     */
/* ------------------------------------------------------------------ */

export const PINTASAN: Array<{ kelompok: string; items: Array<[string, string]> }> = [
  {
    kelompok: 'Umum',
    items: [
      ['Palet perintah', 'Ctrl K'],
      ['Bantuan pintasan', '?'],
      ['Buka Dasbor', 'G D'],
      ['Buka Reservasi', 'G R'],
      ['Buka Jadwal', 'G J'],
      ['Buka Aset', 'G A'],
      ['Buka Otomasi', 'G O'],
      ['Reservasi baru', 'N'],
    ],
  },
  {
    kelompok: 'Mengubah',
    items: [
      ['Urungkan', 'Ctrl Z'],
      ['Ulangi', 'Ctrl ⇧ Z'],
      ['Simpan perubahan', 'Ctrl S'],
      ['Ekspor cadangan', 'Ctrl E'],
    ],
  },
  {
    kelompok: 'Tampilan',
    items: [
      ['Tema terang / gelap', 'Ctrl ⇧ L'],
      ['Mode rapat', 'Ctrl ⇧ D'],
      ['Perlebar / tipiskan rail', 'Ctrl B'],
    ],
  },
];

export function PapanPintasan({ buka, onTutup }: { buka: boolean; onTutup: () => void }): ReactNode {
  if (!buka) return null;
  return (
    <div
      className="tirai"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onTutup();
      }}
    >
      <div className="dialog dialog--lebar" role="dialog" aria-modal="true" aria-label="Pintasan papan ketik">
        <header className="dialog__kepala">
          <div>
            <h2 className="dialog__judul">Pintasan papan ketik</h2>
            <p className="dialog__sub">Ribuan langkah lebih hemat tanpa menyentuh tetikus.</p>
          </div>
          <button type="button" className="tbl tbl--halus tbl--ikon" onClick={onTutup} aria-label="Tutup">
            <Keyboard size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="dialog__isi">
          <div className="pintasan">
            {PINTASAN.map((grup) => (
              <div className="pintasan__grup" key={grup.kelompok}>
                <p className="label" style={{ marginBottom: 6 }}>
                  {grup.kelompok}
                </p>
                {grup.items.map(([nama, pintasan]) => (
                  <div className="pintasan__baris" key={nama}>
                    <span>{nama}</span>
                    <span className="kunci">{pintasan}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pembangun perintah                                                 */
/* ------------------------------------------------------------------ */

export interface KonteksPalet {
  goto: (halaman: string) => void;
  baruReservasi: (preset?: { asetId?: string; tanggalMulai?: string }) => void;
  baruAset: () => void;
  bukaReservasi: (reservasi: Reservasi) => void;
  bukaAset: (aset: Aset) => void;
  ubahStatusReservasi: (reservasi: Reservasi, status: StatusReservasi) => void;
  ubahStatusAset: (aset: Aset, status: StatusAset) => void;
  hapusReservasi: (reservasi: Reservasi) => void;
  ekspor: () => void;
  impor: () => void;
  resetDemo: () => void;
  urungkan: () => void;
  ulangi: () => void;
  toggleTema: () => void;
  toggleKepadatan: () => void;
  toggleRail: () => void;
  bukaPintasan: () => void;
}

export function bangunPerintah(konteks: KonteksPalet, aset: Aset[], reservasi: Reservasi[]): PerintahPalet[] {
  const navigasi: PerintahPalet[] = [
    {
      id: 'nav-dasbor',
      judul: 'Buka Dasbor',
      sub: 'Ringkasan hari ini',
      kelompok: 'Navigasi',
      ikon: <ArrowRight size={15} />,
      pintasan: ['G', 'D'],
      jalankan: () => konteks.goto('dasbor'),
    },
    {
      id: 'nav-reservasi',
      judul: 'Buka Reservasi',
      sub: 'Tabel, filter, dan alur status',
      kelompok: 'Navigasi',
      ikon: <ArrowRight size={15} />,
      pintasan: ['G', 'R'],
      jalankan: () => konteks.goto('reservasi'),
    },
    {
      id: 'nav-jadwal',
      judul: 'Buka Papan Jadwal',
      sub: 'Ketersediaan per hari',
      kelompok: 'Navigasi',
      ikon: <ArrowRight size={15} />,
      pintasan: ['G', 'J'],
      jalankan: () => konteks.goto('jadwal'),
    },
    {
      id: 'nav-aset',
      judul: 'Buka Aset',
      kelompok: 'Navigasi',
      ikon: <Package size={15} />,
      pintasan: ['G', 'A'],
      jalankan: () => konteks.goto('aset'),
    },
    {
      id: 'nav-otomasi',
      judul: 'Buka Otomasi',
      kelompok: 'Navigasi',
      ikon: <CheckCircle2 size={15} />,
      pintasan: ['G', 'O'],
      jalankan: () => konteks.goto('otomasi'),
    },
    {
      id: 'nav-data',
      judul: 'Buka Data &amp; Pengaturan',
      kelompok: 'Navigasi',
      ikon: <Settings2 size={15} />,
      jalankan: () => konteks.goto('data'),
    },
  ];

  const buat: PerintahPalet[] = [
    {
      id: 'buat-reservasi',
      judul: 'Reservasi baru',
      sub: 'Cek ketersediaan dan harga langsung',
      kelompok: 'Buat',
      ikon: <CalendarPlus size={15} />,
      pintasan: ['N'],
      jalankan: () => konteks.baruReservasi(),
    },
    {
      id: 'buat-aset',
      judul: 'Aset baru',
      kelompok: 'Buat',
      ikon: <Plus size={15} />,
      jalankan: () => konteks.baruAset(),
    },
  ];

  const data: PerintahPalet[] = [
    {
      id: 'data-ekspor',
      judul: 'Ekspor cadangan JSON',
      kelompok: 'Data',
      ikon: <Download size={15} />,
      pintasan: ['Ctrl', 'E'],
      jalankan: () => konteks.ekspor(),
    },
    {
      id: 'data-impor',
      judul: 'Impor berkas JSON',
      kelompok: 'Data',
      ikon: <FileUp size={15} />,
      jalankan: () => konteks.impor(),
    },
    {
      id: 'data-reset',
      judul: 'Pulihkan data demo',
      kelompok: 'Data',
      ikon: <RotateCcw size={15} />,
      jalankan: () => konteks.resetDemo(),
    },
    {
      id: 'data-undo',
      judul: 'Urungkan perubahan',
      kelompok: 'Data',
      ikon: <Undo2 size={15} />,
      pintasan: ['Ctrl', 'Z'],
      jalankan: () => konteks.urungkan(),
    },
    {
      id: 'data-redo',
      judul: 'Jalankan ulang',
      kelompok: 'Data',
      ikon: <Undo2 size={15} style={{ transform: 'scaleX(-1)' }} />,
      pintasan: ['Ctrl', '⇧', 'Z'],
      jalankan: () => konteks.ulangi(),
    },
  ];

  const tampilan: PerintahPalet[] = [
    {
      id: 'tema',
      judul: 'Ganti tema terang / gelap',
      kelompok: 'Tampilan',
      ikon: <Moon size={15} />,
      pintasan: ['Ctrl', '⇧', 'L'],
      jalankan: () => konteks.toggleTema(),
    },
    {
      id: 'kepadatan',
      judul: 'Ganti mode kepadatan',
      kelompok: 'Tampilan',
      ikon: <Sun size={15} />,
      pintasan: ['Ctrl', '⇧', 'D'],
      jalankan: () => konteks.toggleKepadatan(),
    },
    {
      id: 'rail',
      judul: 'Perlebar / tipiskan rail',
      kelompok: 'Tampilan',
      ikon: <ArrowRight size={15} style={{ transform: 'rotate(90deg)' }} />,
      pintasan: ['Ctrl', 'B'],
      jalankan: () => konteks.toggleRail(),
    },
    {
      id: 'pintasan',
      judul: 'Buka daftar pintasan',
      kelompok: 'Tampilan',
      ikon: <Keyboard size={15} />,
      pintasan: ['?'],
      jalankan: () => konteks.bukaPintasan(),
    },
  ];

  const cariAset: PerintahPalet[] = aset.slice(0, 200).map((item) => ({
    id: `aset-${item.id}`,
    judul: `${item.nama}`,
    sub: `${item.kode} · ${item.jumlahTersedia} unit · ${formatRupiahRingkas(item.hargaPerHari)}/hari`,
    kelompok: 'Aset',
    ikon: <Package size={15} />,
    jalankan: () => konteks.bukaAset(item),
  }));

  const cariReservasi: PerintahPalet[] = reservasi.slice(0, 200).map((item) => ({
    id: `rsv-${item.id}`,
    judul: `${item.kode} · ${item.pelanggan}`,
    sub: `${item.status} · ${formatTanggal(item.tanggalMulai)}–${formatTanggal(item.tanggalSelesai)}`,
    kelompok: 'Reservasi',
    ikon: <CalendarPlus size={15} />,
    jalankan: () => konteks.bukaReservasi(item),
  }));

  return [...navigasi, ...buat, ...data, ...tampilan, ...cariReservasi, ...cariAset];
}

/* Quick-action row used in empty states and the help sheet. */
export function BarisCepat({ children }: { children: ReactNode }): ReactNode {
  return <div className="baris-bungkus">{children}</div>;
}