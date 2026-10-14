import { useMemo, useState, type ReactNode } from 'react';
import { Pencil, Printer, Trash2 } from 'lucide-react';
import type { Aset, DataAplikasi, Reservasi, StatusReservasi } from '../../domain/types';
import { STATUS_RESERVASI } from '../../domain/types';
import { transisiBerikut, tindakanUntuk } from '../../domain/alur';
import { ketersediaanHarian, petaAset } from '../../domain/selektor';
import { ringkasSewa } from '../../domain/sewa';
import {
  OPSI_PERIODE,
  adaFilterAktif,
  filterKosong,
  saringReservasi,
  urutkanReservasi,
  type FilterReservasi,
} from '../../domain/filter';
import { formatTanggal } from '../../domain/tanggal';
import { formatRupiahRingkas, formatUnit } from '../../domain/uang';
import { Lencana, Meter, Kosong, Panel, Tombol } from '../../ui/primitif';
import { IkonCari } from '../../ui/ikon';

export interface PropsTabelReservasi {
  data: DataAplikasi;
  hariIni: string;
  /**
   * dipakai hanya untuk pesan konfirmasi & tombol aksinya — tampilan modal
   * hidup di fitur reservasi yang lebih tinggi.
   */
  onBuat: () => void;
  onUbah: (reservasi: Reservasi) => void;
  onHapus: (reservasi: Reservasi) => void;
  onStatus: (reservasi: Reservasi, status: StatusReservasi) => void;
  onDetail: (reservasi: Reservasi) => void;
  onCetak: () => void;
  onJalankanSemua: () => void;
}

export function TabelReservasi({
  data,
  hariIni,
  onBuat,
  onUbah,
  onHapus,
  onStatus,
  onDetail,
  onCetak,
  onJalankanSemua,
}: PropsTabelReservasi): ReactNode {
  const [filter, setFilter] = useState<FilterReservasi>(() => ({
    ...filterKosong(),
    periode: 'berjalan',
  }));
  const [urutan, setUrutan] = useState<'tanggal-asc' | 'tanggal-desc' | 'nilai-desc' | 'nilai-asc' | 'kode-asc'>(
    'tanggal-asc',
  );

  const peta = useMemo(() => petaAset(data), [data]);
  const ketersediaan = useMemo(() => ketersediaanHarian(data, hariIni), [data, hariIni]);

  const hasil = useMemo(
    () => urutkanReservasi(saringReservasi(data.reservasi, filter, peta, hariIni), urutan, peta),
    [data.reservasi, filter, peta, hariIni, urutan],
  );

  const totalEstimasi = hasil.reduce((total, item) => {
    return total + ringkasSewa(item, peta.get(item.asetId)?.hargaPerHari ?? 0).subtotal;
  }, 0);

  const adaHal = adaFilterAktif(filter);

  return (
    <>
      <div className="filter">
        <div className="filter__cari">
          <label className="sr-only" htmlFor="cari-reservasi">
            Cari reservasi
          </label>
          <IkonCari />
          <input
            id="cari-reservasi"
            className="input"
            type="search"
            value={filter.cari}
            placeholder="Cari nomor, pelanggan, kontak, atau aset…"
            onChange={(event) => setFilter({ ...filter, cari: event.target.value })}
          />
        </div>

        <label className="kolom">
          <span className="kolom__label">Status</span>
          <select
            className="input"
            value={filter.status}
            onChange={(event) =>
              setFilter({ ...filter, status: event.target.value as FilterReservasi['status'] })
            }
          >
            <option value="semua">Semua status</option>
            {STATUS_RESERVASI.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="kolom">
          <span className="kolom__label">Periode</span>
          <select
            className="input"
            value={filter.periode}
            onChange={(event) =>
              setFilter({ ...filter, periode: event.target.value as FilterReservasi['periode'] })
            }
          >
            {OPSI_PERIODE.map((opsi) => (
              <option key={opsi.nilai} value={opsi.nilai}>
                {opsi.label}
              </option>
            ))}
          </select>
        </label>

        {filter.periode === 'kustom' ? (
          <label className="kolom">
            <span className="kolom__label">Rentang</span>
            <span className="baris">
              <input
                className="input"
                type="date"
                aria-label="Dari tanggal"
                value={filter.dari}
                onChange={(event) => setFilter({ ...filter, dari: event.target.value })}
              />
              <input
                className="input"
                type="date"
                aria-label="Sampai tanggal"
                value={filter.sampai}
                onChange={(event) => setFilter({ ...filter, sampai: event.target.value })}
              />
            </span>
          </label>
        ) : null}

        <div className="filter__akhir">
          <select
            className="input"
            aria-label="Urutkan reservasi"
            value={urutan}
            onChange={(event) => setUrutan(event.target.value as typeof urutan)}
          >
            <option value="tanggal-asc">Tanggal terdekat</option>
            <option value="tanggal-desc">Tanggal terlama</option>
            <option value="nilai-desc">Nilai terbanyak</option>
            <option value="nilai-asc">Nilai terkecil</option>
            <option value="kode-asc">Kode A–Z</option>
          </select>
          {adaHal ? (
            <Tombol varian="halus" ukuran="kecil" onClick={() => setFilter({ ...filterKosong(), periode: 'berjalan' })}>
              Bersihkan
            </Tombol>
          ) : null}
          <Tombol varian="halus" ukuran="kecil" hanyaIkon
            aria-label="Cetak lembar kerja"
            ikon={<Printer size={14} aria-hidden="true" />}
            onClick={onCetak}
          />
          <Tombol varian="utama" ukuran="kecil" onClick={onBuat}>
            Reservasi baru
          </Tombol>
        </div>
      </div>

      <Panel
        judul="Reservasi"
        sub={`${hasil.length} dari ${data.reservasi.length} reservasi · estimasi ${formatRupiahRingkas(
          totalEstimasi,
        )}`}
      >
        <div className="panel__isi--rapat">
          {hasil.length === 0 ? (
            <Kosong
              judul="Tidak ada reservasi yang cocok"
              teks="Ubah kata kunci, status, atau periode. Kamu juga bisa langsung membuat reservasi baru."
              aksi={
                <Tombol varian="utama" onClick={onBuat}>
                  Reservasi baru
                </Tombol>
              }
            />
          ) : (
            <div className="meja-bungkus">
              <table className="meja">
                <caption className="sr-only">
                  Daftar reservasi: pelanggan, aset, periode sewa, status, estimasi biaya, dan aksi.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Reservasi</th>
                    <th scope="col">Aset</th>
                    <th scope="col">Periode sewa</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="meja__angka">
                      Estimasi
                    </th>
                    <th scope="col" className="meja__aksi">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {hasil.map((item) => {
                    const aset = peta.get(item.asetId);
                    const ringkasan = ringkasSewa(item, aset?.hargaPerHari ?? 0);
                    const terlambat = item.status === 'Dipinjam' && item.tanggalSelesai < hariIni;
                    return (
                      <tr key={item.id} className={terlambat ? 'meja__baris--dipilih' : undefined}>
                        <td>
                          <button
                            type="button"
                            className="meja-klik"
                            onClick={() => onDetail(item)}
                            title={`Lihat detail ${item.kode}`}
                          >
                            <span className="mono">{item.kode}</span>
                          </button>
                          <div className="meja__sub">
                            {item.pelanggan}
                            {item.kontak ? ` · ${item.kontak}` : ''}
                          </div>
                        </td>
                        <td>
                          <div className="meja__utama">{aset?.nama ?? '—'}</div>
                          <div className="meja__sub">
                            {formatUnit(item.jumlah)} · <span className="mono">{aset?.kode ?? '—'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="meja__utama">
                            {formatTanggal(item.tanggalMulai)} – {formatTanggal(item.tanggalSelesai)}
                          </div>
                          <div className="meja__sub">
                            {ringkasan.hariSewa} hari
                            {item.tanggalSelesai === hariIni ? ' · kembali hari ini' : ''}
                          </div>
                        </td>
                        <td>
                          <Lencana>{item.status}</Lencana>
                          {terlambat ? (
                            <div className="meja__sub" style={{ color: 'var(--bahaya)', marginTop: 3 }}>
                              lewat tanggal kembali
                            </div>
                          ) : null}
                        </td>
                        <td className="meja__angka">
                          <div className="meja__utama">{formatRupiahRingkas(ringkasan.subtotal)}</div>
                          <div className="meja__sub">sisa {formatRupiahRingkas(ringkasan.sisa)}</div>
                        </td>
                        <td className="meja__aksi">
                          <div className="baris">
                            {transisiBerikut(item.status).map((status) => (
                              <Tombol
                                key={status}
                                varian={status === 'Dibatalkan' ? 'bahaya' : 'utama'}
                                ukuran="kecil"
                                onClick={() => onStatus(item, status)}
                                title={tindakanUntuk(status).penjelasan}
                              >
                                {tindakanUntuk(status).label}
                              </Tombol>
                            ))}
                            <Tombol
                              varian="halus"
                              ukuran="kecil"
                              hanyaIkon
                              aria-label={`Ubah ${item.kode}`}
                              ikon={<Pencil size={14} aria-hidden="true" />}
                              onClick={() => onUbah(item)}
                            />
                            <Tombol
                              varian="bahaya"
                              ukuran="kecil"
                              hanyaIkon
                              aria-label={`Hapus ${item.kode}`}
                              ikon={<Trash2 size={14} aria-hidden="true" />}
                              onClick={() => onHapus(item)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      <Panel
        judul="Ketersediaan hari ini"
        sub={`Unit yang terpakai dan bebas pada ${formatTanggal(hariIni)}.`}
        aksi={
          <Tombol varian="halus" ukuran="kecil" onClick={onJalankanSemua}>
            Jalankan otomasi
          </Tombol>
        }
      >
        <div className="panel__isi--rapat">
          <div className="meja-bungkus">
            <table className="meja">
              <caption className="sr-only">Ketersediaan unit setiap aset pada hari ini.</caption>
              <thead>
                <tr>
                  <th scope="col">Aset</th>
                  <th scope="col">Pemakaian</th>
                  <th scope="col" className="meja__angka">
                    Tersedia
                  </th>
                </tr>
              </thead>
              <tbody>
                {(ketersediaan as Array<{ aset: Aset; terpakaiHariIni: number; tersediaHariIni: number; maintenance: boolean }>).map((baris) => (
                  <tr key={baris.aset.id}>
                    <td>
                      <div className="meja__utama">{baris.aset.nama}</div>
                      <div className="meja__sub">
                        <span className="mono">{baris.aset.kode}</span> ·{' '}
                        {formatRupiahRingkas(baris.aset.hargaPerHari)}/hari
                      </div>
                      {baris.maintenance ? (
                        <div style={{ marginTop: 4 }}>
                          <Lencana>Pemeliharaan</Lencana>
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <Meter
                        persentase={(baris.terpakaiHariIni / Math.max(1, baris.aset.jumlahTersedia)) * 100}
                      />
                      <div className="meja__sub num">
                        {baris.terpakaiHariIni} dari {baris.aset.jumlahTersedia} unit
                      </div>
                    </td>
                    <td className="meja__angka meja__utama">
                      {baris.maintenance ? '—' : formatUnit(baris.tersediaHariIni)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </>
  );
}



