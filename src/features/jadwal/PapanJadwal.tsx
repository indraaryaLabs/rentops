import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Layers, Wrench } from 'lucide-react';
import type { Aset, DataAplikasi, Preferensi } from '../../domain/types';
import { papanJadwal, type BarisJadwal, type SelJadwal } from '../../domain/selektor';
import {
  formatHariMinggu,
  formatTanggal,
  formatTanggalRingkas,
  hariDalamBulan,
  tambahHari,
} from '../../domain/tanggal';
import { formatUnit } from '../../domain/uang';
import { Panel, Segmen, Tombol } from '../../ui/primitif';

export interface PropsJadwal {
  data: DataAplikasi;
  hariIni: string;
  preferensi: Preferensi;
  onBuat: (preset: { asetId: string; tanggalMulai: string; tanggalSelesai: string }) => void;
  onBukaAset: (aset: Aset) => void;
}

type Cakupan = 'semua' | 'terpakai' | 'tersedia';

/**
 * Papan Jadwal — the signature surface.
 *
 * Rows are assets, columns are days, and each cell is a stock bar showing how
 * many units are committed. Clicking a cell opens a booking preset for exactly
 * that asset and day, which turns "is it free?" into a two-second action.
 */
export function PapanJadwal({
  data,
  hariIni,
  preferensi,
  onBuat,
  onBukaAset,
}: PropsJadwal): ReactNode {
  const [jumlahHari, setJumlahHari] = useState<7 | 14 | 28>(14);
  const [mulai, setMulai] = useState(() => tambahHari(hariIni, -3));
  const [cakupan, setCakupan] = useState<Cakupan>('semua');
  const [sorot, setSorot] = useState<{ baris: BarisJadwal; sel: SelJadwal } | null>(null);
  const [difilter, setDifilter] = useState('');

  const baris = useMemo(
    () => papanJadwal(data, hariIni, { mulai, jumlahHari, jeda: preferensi.jedaAntarSewaHari }),
    [data, hariIni, mulai, jumlahHari, preferensi.jedaAntarSewaHari],
  );

  const barisTampil = useMemo(() => {
    const kunci = difilter.trim().toLowerCase();
    const hasil = baris.filter((item) => {
      if (cakupan === 'terpakai' && item.puncak === 0) return false;
      if (cakupan === 'tersedia' && item.puncak >= 100) return false;
      if (!kunci) return true;
      return `${item.aset.nama} ${item.aset.kode}`.toLowerCase().includes(kunci);
    });
    return hasil;
  }, [baris, cakupan, difilter]);

  const totalUnit = data.aset.reduce((total, item) => total + item.jumlahTersedia, 0);
  const terpakaiHariIni = baris.reduce(
    (total, item) => total + (item.sel.find((sel) => sel.tanggal === hariIni)?.terpakai ?? 0),
    0,
  );

  return (
    <Panel
      judul="Papan Jadwal"
      sub={`${barisTampil.length} aset × ${jumlahHari} hari. Klik sel untuk menyewa aset pada tanggal itu.`}
      aksi={
        <>
          <input
            className="input"
            type="search"
            value={difilter}
            placeholder="Saring aset…"
            aria-label="Saring aset pada papan"
            onChange={(event) => setDifilter(event.target.value)}
            style={{ width: 160, height: 28 }}
          />
          <Segmen
            label="Periode papan"
            nilai={String(jumlahHari) as '7' | '14' | '28'}
            opsi={[
              { nilai: '7', label: '7 hari' },
              { nilai: '14', label: '14 hari' },
              { nilai: '28', label: '28 hari' },
            ]}
            onUbah={(nilai) => setJumlahHari(Number(nilai) as 7 | 14 | 28)}
          />
        </>
      }
    >
      <div className="panel__isi--rapat">
        <div className="papan__alat">
          <Tombol
            varian="garis"
            ukuran="kecil"
            hanyaIkon
            aria-label="Geser papan mundur"
            ikon={<ChevronLeft size={15} aria-hidden="true" />}
            onClick={() => setMulai((v) => tambahHari(v, -jumlahHari))}
          />
          <Tombol
            varian={mulai === hariIni ? 'halus' : 'garis'}
            ukuran="kecil"
            onClick={() => setMulai(hariIni)}
          >
            {mulai === hariIni ? 'Mulai hari ini' : `Kembali ke hari ini`}
          </Tombol>
          <Tombol
            varian="garis"
            ukuran="kecil"
            hanyaIkon
            aria-label="Geser papan maju"
            ikon={<ChevronRight size={15} aria-hidden="true" />}
            onClick={() => setMulai((v) => tambahHari(v, jumlahHari))}
          />

          <span className="redup mono" style={{ fontSize: 11.5, marginLeft: 4 }}>
            {formatTanggal(mulai)} — {formatTanggal(tambahHari(mulai, jumlahHari - 1))}
          </span>

          <span className="geser baris baris--rapat">
            <Layers size={14} aria-hidden="true" style={{ color: 'var(--teks-4)' }} />
            <Segmen
              label="Saring baris"
              nilai={cakupan}
              opsi={[
                { nilai: 'semua', label: 'Semua' },
                { nilai: 'terpakai', label: 'Ada pemakaian' },
                { nilai: 'tersedia', label: 'Ada unit kosong' },
              ]}
              onUbah={setCakupan}
            />
          </span>
        </div>

        <div className="papan__gulir">
          <table className="papan__tabel">
            <caption className="sr-only">
              Ketersediaan unit per aset untuk setiap hari dalam rentang papan.
            </caption>
            <thead>
              <tr>
                <th className="papan__kolom-aset" scope="col">
                  Aset
                </th>
                {baris[0]?.sel.map((sel) => (
                  <th
                    key={sel.tanggal}
                    className={`papan__hari${sel.tanggal === hariIni ? ' papan__hari--ini' : ''}`}
                    scope="col"
                    title={formatTanggal(sel.tanggal)}
                  >
                    {formatHariMinggu(sel.tanggal)}
                    <strong>{hariDalamBulan(sel.tanggal)}</strong>
                  </th>
                ))}
                <th className="papan__hari" scope="col" style={{ minWidth: 62 }}>
                  Util
                </th>
              </tr>
            </thead>
            <tbody>
              {barisTampil.length === 0 ? (
                <tr>
                  <td colSpan={(baris[0]?.sel.length ?? 0) + 2} style={{ padding: 24 }}>
                    <p className="kosong__teks" style={{ textAlign: 'center' }}>
                      Tidak ada aset yang cocok dengan saringan ini.
                    </p>
                  </td>
                </tr>
              ) : (
                barisTampil.map((barisJadwal) => (
                  <tr
                    key={barisJadwal.aset.id}
                    className={`papan__baris${barisJadwal.aset.statusPemeliharaan !== 'Aktif' ? ' papan__baris--servis' : ''}`}
                  >
                    <th className="papan__kolom-aset" scope="row">
                      <button
                        type="button"
                        onClick={() => onBukaAset(barisJadwal.aset)}
                        style={{ textAlign: 'left', width: '100%' }}
                      >
                        <span className="papan__aset">
                          <strong>{barisJadwal.aset.nama}</strong>
                          <span>
                            {barisJadwal.aset.kode} · {formatUnit(barisJadwal.aset.jumlahTersedia)}
                            {barisJadwal.aset.statusPemeliharaan !== 'Aktif' ? ' · servis' : ''}
                          </span>
                        </span>
                      </button>
                    </th>
                    {barisJadwal.sel.map((sel) => (
                      <td
                        key={sel.tanggal}
                        className={`papan__sel${sel.tanggal === hariIni ? ' papan__sel--ini' : ''}`}
                      >
                        <button
                          type="button"
                          className={`papan__isi papan__isi--${nadaSel(sel)}${sel.tanggal === hariIni ? ' papan__sel--ini' : ''}`}
                          style={{ width: '100%', height: '100%' }}
                          onMouseEnter={() => setSorot({ baris: barisJadwal, sel })}
                          onMouseLeave={() => setSorot(null)}
                          onFocus={() => setSorot({ baris: barisJadwal, sel })}
                          onBlur={() => setSorot(null)}
                          onClick={() =>
                            onBuat({
                              asetId: barisJadwal.aset.id,
                              tanggalMulai: sel.tanggal,
                              tanggalSelesai: sel.tanggal,
                            })
                          }
                          aria-label={`${barisJadwal.aset.nama}, ${formatTanggal(sel.tanggal)}, ${sel.terpakai} dari ${barisJadwal.aset.jumlahTersedia} unit terpakai`}
                        >
                          {sel.maintenance ? (
                            <Wrench size={10} aria-hidden="true" />
                          ) : sel.terpakai > 0 ? (
                            <span>{sel.terpakai}</span>
                          ) : (
                            <span style={{ opacity: 0.4 }}>{barisJadwal.aset.jumlahTersedia}</span>
                          )}
                        </button>
                      </td>
                    ))}
                    <td className="papan__hari">
                      <span className="mono" style={{ color: 'var(--teks-2)' }}>
                        {barisJadwal.utilisasi}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="papan__kaki">
          <span className="papan__kunci-legend">
            <span className="papan__kunci papan__isi--u2" /> sebagian terpakai
          </span>
          <span className="papan__kunci-legend">
            <span className="papan__kunci papan__isi--penuh" /> penuh
          </span>
          <span className="papan__kunci-legend">
            <span className="papan__kunci papan__isi--servis" /> pemeliharaan
          </span>
          <span className="geser mono" style={{ fontSize: 11 }}>
            {formatTanggalRingkas(hariIni)}: {terpakaiHariIni} dari {totalUnit} unit terpakai
            {preferensi.jedaAntarSewaHari > 0 ? ` · jeda ${preferensi.jedaAntarSewaHari} hari aktif` : ''}
          </span>
        </div>
      </div>

      {sorot ? <PopoverPapan baris={sorot.baris} sel={sorot.sel} /> : null}
    </Panel>
  );
}

function nadaSel(sel: SelJadwal): string {
  if (sel.maintenance) return 'servis';
  if (sel.utilisasi >= 100) return 'penuh';
  if (sel.utilisasi <= 25) return 'u1';
  if (sel.utilisasi <= 50) return 'u2';
  if (sel.utilisasi <= 75) return 'u3';
  return 'u4';
}

function PopoverPapan({ baris, sel }: { baris: BarisJadwal; sel: SelJadwal }): ReactNode {
  return (
    <div
      className="pop"
      role="tooltip"
      style={{ position: 'fixed', right: 24, bottom: 24, pointerEvents: 'none' }}
    >
      <p className="pop__judul">
        {baris.aset.nama} · {formatTanggal(sel.tanggal)}
      </p>
      <div className="pop__baris">
        <span>Terpakai</span>
        <strong>
          {sel.terpakai} / {baris.aset.jumlahTersedia} unit
        </strong>
      </div>
      <div className="pop__baris">
        <span>Tersedia</span>
        <strong>
          {sel.maintenance ? 'pemeliharaan' : `${sel.tersedia} unit`}
        </strong>
      </div>
      {sel.reservasi.length > 0 ? (
        <div className="pemisah" />
      ) : null}
      {sel.reservasi.slice(0, 3).map((r) => (
        <div className="pop__baris" key={r.id}>
          <span className="mono">{r.kode}</span>
          <strong>{r.pelanggan.split(' ')[0]}</strong>
        </div>
      ))}
    </div>
  );
}
