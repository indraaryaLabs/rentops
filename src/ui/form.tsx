import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Kolom form                                                          */
/* ------------------------------------------------------------------ */

export interface KolomProps {
  label: string;
  wajib?: boolean;
  bantuan?: ReactNode;
  galat?: string;
  catatan?: string;
  children: (sifat: {
    id: string;
    'aria-invalid': true | undefined;
    'aria-describedby': string | undefined;
  }) => ReactNode;
}

export function Kolom({
  label,
  wajib,
  bantuan,
  galat,
  catatan,
  children,
}: KolomProps): ReactNode {
  const id = useId();
  const idBantuan = `${id}-bantuan`;
  const idGalat = `${id}-galat`;
  const idCatatan = `${id}-catatan`;
  const gabungan = [bantuan ? idBantuan : null, galat ? idGalat : null, catatan ? idCatatan : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="kolom">
      <label className="kolom__label" htmlFor={id}>
        {label}
        {wajib ? (
          <span className="kolom__wajib" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children({ id, 'aria-invalid': galat ? true : undefined, 'aria-describedby': gabungan || undefined })}
      {bantuan ? (
        <span className="kolom__bantuan" id={idBantuan}>
          {bantuan}
        </span>
      ) : null}
      {catatan ? (
        <span className="kolom__catatan" id={idCatatan}>
          {catatan}
        </span>
      ) : null}
      {galat ? (
        <span className="kolom__galat" id={idGalat} role="alert">
          {galat}
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

export interface DialogProps {
  buka: boolean;
  judul: string;
  sub?: string;
  lebar?: 'sempit' | 'normal' | 'lebar';
  onTutup: () => void;
  children: ReactNode;
  kaki?: ReactNode;
}

let dialogTerbuka = 0;

export function Dialog({
  buka,
  judul,
  sub,
  lebar = 'normal',
  onTutup,
  children,
  kaki,
}: DialogProps): ReactNode {
  const kotak = useRef<HTMLDivElement>(null);
  const pemicu = useRef<Element | null>(null);

  useEffect(() => {
    if (!buka) return;
    pemicu.current = document.activeElement;
    const node = kotak.current;
    const fokusAwal = node?.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
    );
    (fokusAwal ?? node)?.focus();

    const overflowSebelum = document.body.style.overflow;
    dialogTerbuka += 1;
    document.body.style.overflow = 'hidden';

    const tombol = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onTutup();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const bisa = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (bisa.length === 0) return;
      const pertama = bisa[0];
      const terakhir = bisa[bisa.length - 1];
      if (event.shiftKey && document.activeElement === pertama) {
        event.preventDefault();
        terakhir.focus();
      } else if (!event.shiftKey && document.activeElement === terakhir) {
        event.preventDefault();
        pertama.focus();
      }
    };

    document.addEventListener('keydown', tombol);
    return () => {
      document.removeEventListener('keydown', tombol);
      dialogTerbuka = Math.max(0, dialogTerbuka - 1);
      if (dialogTerbuka === 0) document.body.style.overflow = overflowSebelum;
      if (pemicu.current instanceof HTMLElement) pemicu.current.focus();
    };
  }, [buka, onTutup]);

  if (!buka) return null;
  const kelasLebar = lebar === 'lebar' ? ' dialog--lebar' : lebar === 'sempit' ? ' dialog--sempit' : '';

  return (
    <div
      className="tirai"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onTutup();
      }}
    >
      <div className={`dialog${kelasLebar}`} role="dialog" aria-modal="true" aria-label={judul} ref={kotak} tabIndex={-1}>
        <header className="dialog__kepala">
          <div style={{ minWidth: 0 }}>
            <h2 className="dialog__judul">{judul}</h2>
            {sub ? <p className="dialog__sub">{sub}</p> : null}
          </div>
          <button
            type="button"
            className="tbl tbl--halus tbl--ikon"
            onClick={onTutup}
            aria-label="Tutup dialog"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="dialog__isi">{children}</div>
        {kaki ? <footer className="dialog__kaki">{kaki}</footer> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog konfirmasi                                                  */
/* ------------------------------------------------------------------ */

export function Konfirmasi({
  buka,
  judul,
  pesan,
  detail,
  labelYa = 'Ya, lanjutkan',
  labelBatal = 'Batal',
  nada = 'bahaya',
  onYa,
  onBatal,
}: {
  buka: boolean;
  judul: string;
  pesan: ReactNode;
  detail?: ReactNode;
  labelYa?: string;
  labelBatal?: string;
  nada?: 'bahaya' | 'aksen' | 'peringatan';
  onYa: () => void;
  onBatal: () => void;
}): ReactNode {
  return (
    <Dialog
      buka={buka}
      judul={judul}
      lebar="sempit"
      onTutup={onBatal}
      kaki={
        <>
          <button type="button" className="tbl tbl--garis" onClick={onBatal}>
            {labelBatal}
          </button>
          <button
            type="button"
            className={`tbl ${nada === 'bahaya' ? 'tbl--utama' : 'tbl--utama'}`}
            onClick={onYa}
            style={nada === 'bahaya' ? { background: 'var(--bahaya)' } : undefined}
          >
            {labelYa}
          </button>
        </>
      }
    >
      <div className="tumpuk" style={{ gap: 12 }}>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--teks-2)' }}>{pesan}</div>
        {detail}
      </div>
    </Dialog>
  );
}