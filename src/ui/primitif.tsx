import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { StatusAset, StatusReservasi } from '../domain/types';

/* ------------------------------------------------------------------ */
/* Tombol                                                              */
/* ------------------------------------------------------------------ */

type VarianTombol = 'utama' | 'garis' | 'halus' | 'bahaya';

export interface TombolProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  varian?: VarianTombol;
  ukuran?: 'kecil' | 'normal' | 'besar';
  ikon?: ReactNode;
  ikonKanan?: ReactNode;
  penuh?: boolean;
  hanyaIkon?: boolean;
}

export function Tombol({
  varian = 'garis',
  ukuran = 'normal',
  ikon,
  ikonKanan,
  penuh,
  hanyaIkon,
  children,
  className,
  type = 'button',
  ...sisa
}: TombolProps): ReactNode {
  const kelas = [
    'tbl',
    `tbl--${varian}`,
    ukuran !== 'normal' ? `tbl--${ukuran}` : '',
    penuh ? 'tbl--penuh' : '',
    hanyaIkon ? 'tbl--ikon' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button {...sisa} type={type} className={kelas}>
      {ikon}
      {hanyaIkon ? null : children}
      {hanyaIkon ? <span className="sr-only">{children}</span> : ikonKanan}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Lencana status                                                      */
/* ------------------------------------------------------------------ */

type Nada = 'netral' | 'info' | 'sukses' | 'peringatan' | 'bahaya' | 'aksen';

const NADA_RESERVASI: Record<StatusReservasi, Nada> = {
  Permintaan: 'netral',
  Dipesan: 'info',
  Dipinjam: 'aksen',
  Dikembalikan: 'sukses',
  Dibatalkan: 'bahaya',
};

const NADA_ASET: Record<StatusAset, Nada> = {
  Aktif: 'sukses',
  Pemeliharaan: 'peringatan',
};

export function Lencana({
  nada = 'netral',
  children,
  titik = true,
}: {
  nada?: Nada;
  children: ReactNode;
  titik?: boolean;
}): ReactNode {
  return (
    <span className={`lencana lencana--${nada}${titik ? '' : ' lencana--tanpa-titik'}`}>
      {children}
    </span>
  );
}

export function LencanaReservasi({ status }: { status: StatusReservasi }): ReactNode {
  return <Lencana nada={NADA_RESERVASI[status]}>{status}</Lencana>;
}

export function LencanaAset({ status }: { status: StatusAset }): ReactNode {
  return <Lencana nada={NADA_ASET[status]}>{status}</Lencana>;
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export function Panel({
  judul,
  sub,
  aksi,
  children,
  rapat,
  kelas,
}: {
  judul?: ReactNode;
  sub?: ReactNode;
  aksi?: ReactNode;
  children: ReactNode;
  rapat?: boolean;
  kelas?: string;
}): ReactNode {
  return (
    <section className={`panel${rapat ? ' panel--rapat' : ''}${kelas ? ` ${kelas}` : ''}`}>
      {judul || aksi ? (
        <header className="panel__kepala">
          <div className="tumpuk" style={{ gap: 2, minWidth: 0 }}>
            {judul ? <h2>{judul}</h2> : null}
            {sub ? <span className="redup" style={{ fontSize: 12.5 }}>{sub}</span> : null}
          </div>
          {aksi ? <div className="baris">{aksi}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Meter                                                               */
/* ------------------------------------------------------------------ */

export function Meter({
  persentase,
  label,
}: {
  persentase: number;
  label?: string;
}): ReactNode {
  const nilai = Math.max(0, Math.min(100, Math.round(persentase)));
  const nada = nilai >= 100 ? ' meter__isi--penuh' : nilai >= 66 ? ' meter__isi--hampir' : '';
  return (
    <div className="meter-baris">
      <div
        className="meter"
        role="img"
        aria-label={label ?? `${nilai}% terpakai`}
      >
        <div className={`meter__isi${nada}`} style={{ width: `${nilai}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Info box                                                            */
/* ------------------------------------------------------------------ */

export function Info({
  nada = 'netral',
  ikon,
  judul,
  children,
  aksi,
}: {
  nada?: Nada | 'netral';
  ikon?: ReactNode;
  judul?: ReactNode;
  children?: ReactNode;
  aksi?: ReactNode;
}): ReactNode {
  return (
    <div className={`info${nada !== 'netral' ? ` info--${nada}` : ''}`}>
      {ikon}
      <div style={{ flex: 1, minWidth: 0 }}>
        {judul ? <strong>{judul}</strong> : null}
        {children ? <div>{children}</div> : null}
        {aksi ? <div style={{ marginTop: 8 }}>{aksi}</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Keadaan kosong                                                      */
/* ------------------------------------------------------------------ */

export function Kosong({
  ikon,
  judul,
  teks,
  aksi,
}: {
  ikon?: ReactNode;
  judul: string;
  teks?: ReactNode;
  aksi?: ReactNode;
}): ReactNode {
  return (
    <div className="kosong">
      {ikon ? <span className="kosong__ikon">{ikon}</span> : null}
      <p className="kosong__judul">{judul}</p>
      {teks ? <p className="kosong__teks">{teks}</p> : null}
      {aksi ? <div className="baris-bungkus" style={{ justifyContent: 'center' }}>{aksi}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kontrol tersegmentasi                                              */
/* ------------------------------------------------------------------ */

export function Segmen<T extends string>({
  nilai,
  opsi,
  onUbah,
  label,
}: {
  nilai: T;
  opsi: Array<{ nilai: T; label: string; ikon?: ReactNode }>;
  onUbah: (nilai: T) => void;
  label?: string;
}): ReactNode {
  return (
    <div className="segmen" role="group" aria-label={label}>
      {opsi.map((item) => (
        <button
          key={item.nilai}
          type="button"
          className="segmen__opsi"
          aria-pressed={item.nilai === nilai}
          onClick={() => onUbah(item.nilai)}
        >
          {item.ikon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Sakelar({
  cek,
  onUbah,
  label,
  keterangan,
}: {
  cek: boolean;
  onUbah: (nilai: boolean) => void;
  label: string;
  keterangan?: string;
}): ReactNode {
  const id = `sakelar-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label className="sakelar" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          className="sr-only"
          checked={cek}
          onChange={(event) => onUbah(event.target.checked)}
        />
        <span className="sakelar__rel" aria-hidden="true" />
        <span className="pengaturan__label">{label}</span>
      </label>
      {keterangan ? <p className="pengaturan__keterangan">{keterangan}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kartu metrik                                                        */
/* ------------------------------------------------------------------ */

export interface MetrikProps {
  label: string;
  nilai: ReactNode;
  satuan?: string;
  kaki?: ReactNode;
  nada?: 'netral' | 'aksen' | 'waspada';
  onKlik?: () => void;
  grafik?: ReactNode;
}

export function Metrik({
  label,
  nilai,
  satuan,
  kaki,
  nada = 'netral',
  onKlik,
  grafik,
}: MetrikProps): ReactNode {
  const kelas = `metrik${nada !== 'netral' ? ` metrik--${nada}` : ''}`;
  const isi = (
    <>
      <div className="metrik__label">
        <span className="label">{label}</span>
      </div>
      <div className="metrik__nilai">
        {nilai}
        {satuan ? <span className="metrik__satuan"> {satuan}</span> : null}
      </div>
      {grafik}
      {kaki ? <div className="metrik__kaki">{kaki}</div> : null}
    </>
  );

  if (onKlik) {
    return (
      <button type="button" className={kelas} onClick={onKlik}>
        {isi}
      </button>
    );
  }
  return <div className={kelas}>{isi}</div>;
}

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

export function Sparkline({
  nilai,
  lebar = 120,
  tinggi = 34,
}: {
  nilai: number[];
  lebar?: number;
  tinggi?: number;
}): ReactNode {
  if (nilai.length < 2) return <div style={{ height: tinggi }} />;
  const maks = Math.max(...nilai, 1);
  const titik = nilai.map((v, i) => {
    const x = (i / (nilai.length - 1)) * lebar;
    const y = tinggi - (v / maks) * (tinggi - 4) - 2;
    return [x, y] as const;
  });
  const garis = titik.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${garis} L${lebar},${tinggi} L0,${tinggi} Z`;

  return (
    <svg className="spark" viewBox={`0 0 ${lebar} ${tinggi}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="spark__area" d={area} />
      <path className="spark__garis" d={garis} />
      {titik[titik.length - 1] ? (
        <circle
          className="spark__titik"
          cx={titik[titik.length - 1][0]}
          cy={titik[titik.length - 1][1]}
          r="2.4"
        />
      ) : null}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Baris detail                                                        */
/* ------------------------------------------------------------------ */

export function DetailItem({
  label,
  nilai,
  catatan,
}: {
  label: string;
  nilai: ReactNode;
  catatan?: ReactNode;
}): ReactNode {
  return (
    <div className="detail__item">
      <span className="label">{label}</span>
      <span className="detail__nilai">{nilai}</span>
      {catatan ? <span className="detail__catatan">{catatan}</span> : null}
    </div>
  );
}