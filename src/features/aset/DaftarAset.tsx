import { useMemo, useState, type ReactNode } from 'react';
import { Package, Pencil, Plus, Wrench } from 'lucide-react';
import type { Aset, DataAplikasi, StatusAset } from '../../domain/types';
import { KATEGORI_ASET, STATUS_ASET } from '../../domain/types';
import { selKetersediaanHarian, totalHariDisewa } from '../../domain/ketersediaan';
import { asetTerlaris } from '../../domain/selektor';
import { formatPersen, formatRupiah, formatRupiahRingkas, formatUnit } from '../../domain/uang';
import { Kosong, LencanaAset, Meter, Panel, Tombol } from '../../ui/primitif';
import { IkonCari } from '../../ui/ikon';

type Urut = 'nama' | 'kode' | 'harga-tinggi' | 'harga-rendah' | 'paling-sibuk';

const OPSI_URUT: Array<{ nilai: Urut; label: string }> = [
  { nilai: 'nama', label: 'Nama A–Z' },
  { nilai: 'kode', label: 'Kode A–Z' },
  { nilai: 'paling-sibuk', label: 'Paling sering disewa' },
  { nilai: 'harga-tinggi', label: 'Harga tertinggi' },
  { nilai: 'harga-rendah', label: 'Harga terendah' },
];

export interface PropsDaftarAset {
  data: DataAplikasi;
  hariIni: string;
  jeda: number;
  /** Asset focus coming from the schedule board; '' means no focus. */
  fokusAsetId: string;
  onFokus: (id: string) => void;
  onBuat: () => void;
  onUbah: (aset: Aset) => void;
  onDetail: (aset: Aset) => void;
  onStatus: (aset: Aset, status: StatusAset) => void;
  onBuatReservasi: (preset: { asetId: string; tanggalMulai: string }) => void;
}

export function DaftarAset({
  data,
  hariIni,
  jeda,
  fokusAsetId,
  onFokus,
  onBuat,
  onUbah,
  onDetail,
  onStatus,
  onBuatReservasi,
}: PropsDaftarAset): ReactNode {
  const [cari, setCari] = useState('');
  const [kategori, setKategori] = useState<string>('semua');
  const [status, setStatus] = useState<StatusAset | 'semua'>('semua');
  const [urut, setUrut] = useState<Urut>('nama');

  /** Utilisation per asset over the last 90 days — powers both sorting and the hint line. */
  const sibuk = useMemo(() => {
    const petaSibuk = new Map<string, number>();
    for (const item of asetTerlaris(data, hariIni, 90, 999)) {
      petaSibuk.set(item.aset.id, item.aset.jumlahTersedia > 0 ? item.hari / 90 : 0);
    }
    return petaSibuk;
  }, [data, hariIni]);

  const hasil = useMemo(() => {
    const kunci = cari.trim().toLowerCase();
    const daftar = data.aset.filter((item) => {
      if (kategori !== 'semua' && item.kategori !== kategori) return false;
      if (status !== 'semua' && item.statusPemeliharaan !== status) return false;
      if (fokusAsetId && item.id !== fokusAsetId) return false;
      if (!kunci) return true;
      return `${item.nama} ${item.kode} ${item.kategori} ${item.catatan}`.toLowerCase().includes(kunci);
    });

    const sorted = [...daftar];
    switch (urut) {
      case 'kode':
        sorted.sort((a, b) => a.kode.localeCompare(b.kode));
        break;
      case 'harga-tinggi':
        sorted.sort((a, b) => b.hargaPerHari - a.hargaPerHari);
        break;
      case 'harga-rendah':
        sorted.sort((a, b) => a.hargaPerHari - b.hargaPerHari);
        break;
      case 'paling-sibuk':
        sorted.sort((a, b) => (sibuk.get(b.id) ?? 0) - (sibuk.get(a.id) ?? 0));
        break;
      default:
        sorted.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
    }
    return sorted;
  }, [data.aset, cari, kategori, status, urut, fokusAsetId, sibuk]);

  const totalUnit = hasil.reduce((n, item) => n + item.jumlahTersedia, 0);
  const nilaiHarian = hasil.reduce((n, item) => n + item.hargaPerHari * item.jumlahTersedia, 0);
  const adaFilter = cari !== '' || kategori !== 'semua' || status !== 'semua' || fokusAsetId !== '';

  return (
    <>
      <div className="filter">
        <div className="filter__cari">
          <label className="sr-only" htmlFor="cari-aset">
            Cari aset
          </label>
          <IkonCari />
          <input
            id="cari-aset"
            className="input"
            type="search"
            value={cari}
            placeholder="Cari nama, kode, atau catatan aset…"
            onChange={(event) => setCari(event.target.value)}
          />
        </div>

        <label className="kolom filter__med">
          <span className="kolom__label">Kategori</span>
          <select className="pilih" value={kategori} onChange={(event) => setKategori(event.target.value)}>
            <option value="semua">Semua kategori</option>
            {KATEGORI_ASET.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="kolom filter__med">
          <span className="kolom__label">Status</span>
          <select
            className="pilih"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusAset | 'semua')}
          >
            <option value="semua">Semua status</option>
            {STATUS_ASET.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <div className="filter__akhir">
          <select
            className="pilih"
            aria-label="Urutkan aset"
            value={urut}
            onChange={(event) => setUrut(event.target.value as Urut)}
          >
            {OPSI_URUT.map((item) => (
              <option key={item.nilai} value={item.nilai}>
                {item.label}
              </option>
            ))}
          </select>
          {adaFilter ? (
            <Tombol
              varian="halus"
              ukuran="kecil"
              onClick={() => {
                setCari('');
                setKategori('semua');
                setStatus('semua');
                onFokus('');
              }}
            >
              Bersihkan
            </Tombol>
          ) : null}
          <Tombol varian="utama" ukuran="kecil" ikon={<Plus size={14} />} onClick={onBuat}>
            Aset baru
          </Tombol>
        </div>
      </div>

      <div className="bagian">
        <div className="bagian__kepala">
          <div className="bagian__judul">
            <span className="label">{hasil.length} aset tampil</span>
            <span style={{ fontSize: 12.5, color: 'var(--teks-3)' }}>
              {formatUnit(totalUnit)} unit · kapasitas harian {formatRupiah(nilaiHarian)}
            </span>
          </div>
        </div>

        {hasil.length === 0 ? (
          <Panel>
            <div className="panel__isi">
              <Kosong
                ikon={<Package size={18} />}
                judul="Tidak ada aset yang cocok"
                teks="Ubah kata kunci atau filter. Kalau inventarismu memang masih kosong, tambahkan aset pertama."
                aksi={
                  <Tombol varian="utama" ikon={<Plus size={15} />} onClick={onBuat}>
                    Aset baru
                  </Tombol>
                }
              />
            </div>
          </Panel>
        ) : (
          <div className="grid-aset">
            {hasil.map((aset) => {
              const harian = selKetersediaanHarian(aset, data.reservasi, hariIni, jeda);
              const hariDisewa = totalHariDisewa(data.reservasi, aset.id);
              const pemesanan = data.reservasi.filter((item) => item.asetId === aset.id).length;
              const utilisasi = sibuk.get(aset.id) ?? 0;
              const diServis = aset.statusPemeliharaan !== 'Aktif';
              return (
                <article key={aset.id} className={`kartu-aset${diServis ? ' kartu-aset--servis' : ''}`}>
                  <header className="kartu-aset__kepala">
                    <div style={{ minWidth: 0 }}>
                      <button
                        type="button"
                        className="kartu-aset__nama"
                        onClick={() => onDetail(aset)}
                        style={{ textAlign: 'left' }}
                      >
                        {aset.nama}
                      </button>
                      <p className="kartu-aset__kode">
                        <span className="mono">{aset.kode}</span> · {aset.kategori}
                      </p>
                    </div>
                    <LencanaAset status={aset.statusPemeliharaan} />
                  </header>

                  <div className="kartu-aset__angka">
                    <div className="kartu-aset__sel">
                      <span className="kartu-aset__label">Unit</span>
                      <span className="kartu-aset__nilai">{formatUnit(aset.jumlahTersedia)}</span>
                    </div>
                    <div className="kartu-aset__sel">
                      <span className="kartu-aset__label">Bebas</span>
                      <span className="kartu-aset__nilai">
                        {diServis ? '—' : formatUnit(harian.tersedia)}
                      </span>
                    </div>
                    <div className="kartu-aset__sel">
                      <span className="kartu-aset__label">Per hari</span>
                      <span className="kartu-aset__nilai">{formatRupiahRingkas(aset.hargaPerHari)}</span>
                    </div>
                  </div>

                  <Meter
                    persentase={(harian.terpakai / Math.max(1, aset.jumlahTersedia)) * 100}
                    label={`${harian.terpakai} dari ${aset.jumlahTersedia} unit terpakai hari ini`}
                  />

                  <p className="kartu-aset__catatan">
                    {aset.catatan
                      ? aset.catatan
                      : `${hariDisewa} hari terpakai · ${pemesanan} pemesanan · utilisasi ${formatPersen(
                          utilisasi * 100,
                        )} dalam 90 hari`}
                  </p>

                  <div className="kartu-aset__aksi">
                    <Tombol
                      varian="garis"
                      ukuran="kecil"
                      onClick={() => onBuatReservasi({ asetId: aset.id, tanggalMulai: hariIni })}
                      disabled={diServis}
                      title={diServis ? 'Aset sedang pemeliharaan' : 'Buat reservasi untuk aset ini'}
                    >
                      Sewakan
                    </Tombol>
                    <Tombol
                      varian="halus"
                      ukuran="kecil"
                      hanyaIkon
                      aria-label={`Ubah ${aset.nama}`}
                      ikon={<Pencil size={14} aria-hidden="true" />}
                      onClick={() => onUbah(aset)}
                    />
                    <Tombol
                      varian={diServis ? 'utama' : 'halus'}
                      ukuran="kecil"
                      hanyaIkon
                      aria-label={diServis ? `Aktifkan ${aset.nama}` : `Setel servis ${aset.nama}`}
                      title={diServis ? 'Kembalikan ke aktif' : 'Tandai sedang pemeliharaan'}
                      ikon={<Wrench size={14} aria-hidden="true" />}
                      onClick={() => onStatus(aset, diServis ? 'Aktif' : 'Pemeliharaan')}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Panel judul="Tiga aturan inventaris" sub="Yang perlu dipahami supaya data tetap sehat.">
        <div className="panel__isi">
          <div className="aturan">
            <p className="aturan__item">
              <strong>Status pemeliharaan menahan pemesanan.</strong>
              <span>
                Aset berstatus Pemeliharaan tidak bisa dipilih di form reservasi dan tidak menambah unit bebas.
              </span>
            </p>
            <p className="aturan__item">
              <strong>Jarak servis menghasilkan saran otomatis.</strong>
              <span>
                Bila jarak servis diisi, RentOps memberi teguran saat aset mendekati jadwal servis berikutnya.
              </span>
            </p>
            <p className="aturan__item">
              <strong>Jumlah unit dijaga.</strong>
              <span>
                Jumlah unit tidak bisa diturunkan di bawah unit yang sedang disewa atau sudah dipesan.
              </span>
            </p>
          </div>
        </div>
      </Panel>
    </>
  );
}