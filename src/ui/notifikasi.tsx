import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToko } from '../application/toko';

export type NadaNotifikasi = 'sukses' | 'galat' | 'info' | 'peringatan';

interface Notif {
  id: number;
  nada: NadaNotifikasi;
  pesan: string;
  rincian?: string;
}

export interface OpsiNotif {
  nada?: NadaNotifikasi;
  rincian?: string;
  /** Ms; 0 berarti tidak menutup otomatis. */
  durasi?: number;
}

interface KonteksNotif {
  tampil: (pesan: string, opsi?: OpsiNotif) => void;
}

const NotifContext = createContext<KonteksNotif | null>(null);

const IKON: Record<NadaNotifikasi, typeof Info> = {
  sukses: CheckCircle2,
  galat: XCircle,
  info: Info,
  peringatan: AlertTriangle,
};

const DURASI = 4_500;

let penghitungManual = 0;

/**
 * Notifications mirror the store's activity log: every command produces one.
 * That means undo happens *here* — press undo, the toast that caused it is gone.
 */
export function ProviderNotifikasi({ children }: { children: ReactNode }): React.JSX.Element {
  const { log, urungkan, bisaUrungkan } = useToko();
  const [daftar, setDaftar] = useState<Notif[]>([]);
  const terlihat = useRef<Set<number>>(new Set());

  useEffect(() => {
    const teratas = log[0];
    if (!teratas) return;
    if (terlihat.current.has(teratas.id)) return;
    terlihat.current.add(teratas.id);
    setDaftar((sebelumnya) =>
      [
        {
          id: teratas.id,
          nada: teratas.nada,
          pesan: teratas.pesan,
          rincian: teratas.rincian,
        },
        ...sebelumnya,
      ].slice(0, 4),
    );
    const pewaktu = window.setTimeout(() => {
      setDaftar((sebelumnya) => sebelumnya.filter((item) => item.id !== teratas.id));
    }, DURASI);
    return () => window.clearTimeout(pewaktu);
  }, [log]);

  const tampil = useCallback((pesan: string, opsi: OpsiNotif = {}) => {
    penghitungManual += 1;
    const notif: Notif = {
      id: -penghitungManual,
      nada: opsi.nada ?? 'info',
      pesan,
      rincian: opsi.rincian,
    };
    setDaftar((sebelumnya) => [notif, ...sebelumnya].slice(0, 4));
    if (opsi.durasi !== 0) {
      window.setTimeout(() => {
        setDaftar((sebelumnya) => sebelumnya.filter((item) => item.id !== notif.id));
      }, opsi.durasi ?? DURASI);
    }
  }, []);

  const tutup = useCallback((id: number) => {
    setDaftar((sebelumnya) => sebelumnya.filter((item) => item.id !== id));
  }, []);

  const nilai = useMemo<KonteksNotif>(() => ({ tampil }), [tampil]);

  return (
    <NotifContext.Provider value={nilai}>
      {children}
      <div className="notifikasi" role="status" aria-live="polite">
        {daftar.map((item, index) => {
          const Ikon = IKON[item.nada];
          return (
            <div key={`${item.id}-${index}`} className={`notifikasi__item notifikasi__item--${item.nada}`}>
              <Ikon size={16} aria-hidden="true" style={{ marginTop: 1 }} />
              <div className="notifikasi__isi">
                <p className="notifikasi__pesan">{item.pesan}</p>
                {item.rincian ? <p className="notifikasi__rinci">{item.rincian}</p> : null}
              </div>
              {index === 0 && bisaUrungkan && item.nada !== 'info' ? (
                <button
                  type="button"
                  className="tbl tbl--halus tbl--kecil"
                  onClick={() => {
                    urungkan();
                    tutup(item.id);
                  }}
                  title="Batalkan perubahan ini (Ctrl+Z)"
                >
                  Urungkan
                </button>
              ) : null}
              <button
                type="button"
                className="notifikasi__tutup"
                onClick={() => tutup(item.id)}
                aria-label="Tutup notifikasi"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </NotifContext.Provider>
  );
}

export function useNotif(): KonteksNotif {
  const nilai = useContext(NotifContext);
  if (!nilai) throw new Error('useNotif harus dipakai di dalam <ProviderNotifikasi>.');
  return nilai;
}