import { useEffect, useState, type ReactNode } from 'react';
import {
  CalendarDays,
  Database,
  LayoutDashboard,
  Menu as MenuIkon,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  PanelTop,
  Search,
  Settings2,
  Sparkles,
  Undo2,
  Redo2,
  X,
} from 'lucide-react';
import type { Preferensi } from '../domain/types';
import { formatTanggalPanjang } from '../domain/tanggal';
import { PaletPerintah, type PerintahPalet } from '../ui/palet';

export interface Navigasi {
  halaman: string;
  goto: (halaman: string) => void;
}

export interface PropsShell extends Navigasi {
  judul: string;
  konteks: string;
  preferensi: Preferensi;
  hariIni: string;
  versiSimpan: number;
  gagalSimpan: boolean;
  jumlahSaran: number;
  bisaUrungkan: boolean;
  bisaUlangi: boolean;
  namaUsaha: string;
  avatar: string;
  perintah: PerintahPalet[];
  palet: boolean;
  onPalet: (buka: boolean) => void;
  onUrungkan: () => void;
  onUlangi: () => void;
  onAturPreferensi: (perubahan: Partial<Preferensi>) => void;
  children: ReactNode;
}

const MENU: Array<{ kunci: string; label: string; ikon: typeof LayoutDashboard; hitung?: number }> = [
  { kunci: 'dasbor', label: 'Dasbor', ikon: LayoutDashboard },
  { kunci: 'reservasi', label: 'Reservasi', ikon: PanelTop },
  { kunci: 'jadwal', label: 'Papan Jadwal', ikon: CalendarDays },
  { kunci: 'aset', label: 'Aset', ikon: Package },
  { kunci: 'otomasi', label: 'Otomasi', ikon: Sparkles },
  { kunci: 'data', label: 'Data & Cadangan', ikon: Database },
];

export function Shell({
  halaman,
  goto,
  judul,
  konteks,
  preferensi,
  hariIni,
  versiSimpan,
  gagalSimpan,
  jumlahSaran,
  bisaUrungkan,
  bisaUlangi,
  namaUsaha,
  avatar,
  perintah,
  palet,
  onPalet,
  onUrungkan,
  onUlangi,
  onAturPreferensi,
  children,
}: PropsShell): ReactNode {
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    setDrawer(false);
  }, [halaman]);

  const railTipis = preferensi.sidebar === 'tipis';

  return (
    <div className="rangka" data-rail={preferensi.sidebar} data-drawer={drawer ? 'buka' : 'tutup'}>
      {drawer ? (
        <div
          className="rangka__tirai"
          role="presentation"
          onClick={() => setDrawer(false)}
        />
      ) : null}

      <aside className="rail" aria-label="Navigasi utama">
        <div className="rail__merek">
          <span className="rail__tanda" aria-hidden="true">
            <Settings2 size={14} />
          </span>
          <span className="rail__nama">
            <strong>RentOps</strong>
            <span>Ruang kendali</span>
          </span>
          <button
            type="button"
            className="rail__tutup"
            aria-label="Tutup navigasi"
            onClick={() => setDrawer(false)}
          >
            <X size={16} />
          </button>
        </div>

        <nav className="rail__nav">
          <span className="rail__grup">Operasional</span>
          {MENU.map((item) => {
            const Ikon = item.ikon;
            const aktif = halaman === item.kunci;
            const hitung = item.kunci === 'otomasi' ? jumlahSaran : 0;
            return (
              <button
                key={item.kunci}
                type="button"
                className="rail__tautan"
                aria-current={aktif ? 'page' : undefined}
                onClick={() => goto(item.kunci)}
              >
                <Ikon size={16} aria-hidden="true" />
                <span className="rail__nama-teks">{item.label}</span>
                {hitung > 0 ? (
                  <span className={`rail__hitungan${item.kunci === 'otomasi' ? ' rail__hitungan--warna' : ''}`}>
                    {hitung}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="rail__kaki">
          <div className="rail__operator">
            <span className="rail__avatar" aria-hidden="true">
              {avatar}
            </span>
            <span className="rail__operator-info">
              <strong>{namaUsaha || 'Usaha saya'}</strong>
              <span>Lokal di perangkat ini</span>
            </span>
          </div>
          <button
            type="button"
            className="rail__lipatan"
            onClick={() =>
              onAturPreferensi({ sidebar: railTipis ? 'lebar' : 'tipis' })
            }
          >
            {railTipis ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            <span>{railTipis ? 'Perlebar rail' : 'Tipiskan rail'}</span>
          </button>
        </div>
      </aside>

      <div className="rangka__isi">
        <header className="bilah">
          <button
            type="button"
            className="tbl tbl--halus tbl--ikon bilah__menu"
            aria-label="Buka navigasi"
            onClick={() => setDrawer(true)}
          >
            <MenuIkon size={16} />
          </button>

          <div className="bilah__lokasi">
            <strong>{judul}</strong>
            <span className="bilah__pemisah" aria-hidden="true">
              ·
            </span>
            <span className="bilah__konteks">{konteks}</span>
          </div>

          <button type="button" className="pemicu-palet" onClick={() => onPalet(true)}>
            <Search size={14} aria-hidden="true" />
            <span>Cari atau jalankan apa saja…</span>
            <kbd className="kunci">Ctrl K</kbd>
          </button>

          <div className="bilah__kanan">
            <span className="tanggal-bilah">{formatTanggalPanjang(hariIni)}</span>
            <span
              className={`chip-simpan ${gagalSimpan ? 'chip-simpan--galat' : 'chip-simpan--sukses'}`}
              title={`Versi simpan ${versiSimpan}`}
            >
              <span className="titik-hidup" aria-hidden="true" />
              {gagalSimpan ? 'Tidak tersimpan' : 'Tersimpan'}
            </span>
            <button
              type="button"
              className="tbl tbl--halus tbl--ikon"
              aria-label="Urungkan (Ctrl+Z)"
              disabled={!bisaUrungkan}
              onClick={onUrungkan}
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              className="tbl tbl--halus tbl--ikon"
              aria-label="Ulangi (Ctrl+Shift+Z)"
              disabled={!bisaUlangi}
              onClick={onUlangi}
            >
              <Redo2 size={15} />
            </button>
          </div>
        </header>

        <main className="halaman">{children}</main>

        <footer className="tumpuk" style={{ padding: '0 var(--s-6) var(--s-6)', gap: 6 }}>
          <div className="pemisah" />
          <p style={{ fontSize: 11.5, color: 'var(--teks-4)', lineHeight: 1.6 }}>
            Semua data disimpan di peramban perangkat ini — tanpa akun, tanpa server, tanpa biaya bulanan.
            Ekspor cadangan secara berkala agar aman. RentOps · {formatTanggalPanjang(hariIni)}
          </p>
        </footer>
      </div>

      {palet ? (
        <PaletPerintah buka onTutup={() => onPalet(false)} perintah={perintah} />
      ) : null}
    </div>
  );
}

