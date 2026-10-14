import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CalendarArrowDown,
  Copy,
  Download,
  HardDriveDownload,
  Printer,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import type { CatatanLog } from '../../application/toko';
import type { DataAplikasi, Preferensi } from '../../domain/types';
import { barisAgenda } from '../../domain/selektor';
import { antreanHariIni } from '../../domain/otomasi';
import { deretTanggal, formatTanggal, formatTanggalPendekBulan } from '../../domain/tanggal';
import { formatRupiah, formatUnit } from '../../domain/uang';
import {
  backupJSON,
  bacaBerkasTeks,
  imporJSON,
  namaBerkasCadangan,
  namaBerkasSnapshot,
  ringkasData,
  unduhTeks,
} from '../../infrastruktur/backup';
import { buatICS, namaBerkasICS } from '../../infrastruktur/ics';
import { cetakHTML, laporanJadwal, lembarKerja } from '../../infrastruktur/cetak';
import { BATAS_SNAPSHOT, muatSnapshot, type Snapshot } from '../../infrastruktur/db';
import { Kolom } from '../../ui/form';
import { Info, Kosong, Lencana, Panel, Segmen, Tombol } from '../../ui/primitif';
import { useNotif } from '../../ui/notifikasi';

export interface PropsData {
  data: DataAplikasi;
  preferensi: Preferensi;
  hariIni: string;
  log: CatatanLog[];
  sumber: string;
  pesanSistem: string;
  gagalSimpan: boolean;
  onAturPreferensi: (perubahan: Partial<Preferensi>) => void;
  onProfil: (nilai: DataAplikasi['profil']) => void;
  onImpor: (data: DataAplikasi) => void;
  onResetDemo: () => void;
  onBersihkan: () => void;
}

export function PanelData({
  data,
  preferensi,
  hariIni,
  log,
  sumber,
  pesanSistem,
  gagalSimpan,
  onAturPreferensi,
  onProfil,
  onImpor,
  onResetDemo,
  onBersihkan,
}: PropsData): ReactNode {
  const { tampil } = useNotif();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [konfirmasi, setKonfirmasi] = useState<'demo' | 'bersihkan' | null>(null);
  const berkasRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSnapshots(muatSnapshot());
  }, [data]);

  const ringkas = useMemo(() => ringkasData(data), [data]);
  const antrean = useMemo(() => antreanHariIni(data, hariIni), [data, hariIni]);

  const ekspor = () => {
    unduhTeks(namaBerkasCadangan(), backupJSON(data));
    tampil('Cadangan diunduh.', { nada: 'sukses', rincian: 'Simpan berkas ini di tempat yang aman.' });
  };

  const eksporICS = () => {
    unduhTeks(namaBerkasICS(), buatICS(data, { hanyaAktif: false }), 'text/calendar');
    tampil('Kalender diunduh.', { nada: 'sukses', rincian: 'Buka di Google Calendar, Apple Calendar, atau Outlook.' });
  };

  const pilihBerkas = async (file: File | undefined) => {
    if (!file) return;
    const hasil = imporJSON(await bacaBerkasTeks(file));
    if (!hasil.ok) {
      tampil('Berkas ditolak.', { nada: 'galat', rincian: hasil.galat.join(' ') });
      return;
    }
    onImpor(hasil.data);
    tampil(`Data berhasil diimpor: ${hasil.ringkasan}`, { nada: 'sukses' });
  };

  const pulih = (snapshot: Snapshot) => {
    const hasil = imporJSON(JSON.stringify({ skema: 2, data: snapshot.data }));
    if (!hasil.ok) {
      tampil('Snapshot tidak bisa dipulihkan.', { nada: 'galat', rincian: hasil.galat.join(' ') });
      return;
    }
    onImpor(hasil.data);
    tampil('Snapshot dipulihkan.', { nada: 'sukses', rincian: snapshot.label });
  };

  return (
    <>
      <div className="grid-2">
        <Panel judul="Profil usaha" sub="Dipakai pada nota, lembar kerja, dan pesan WhatsApp.">
          <div className="panel__isi">
            <ProfilForm profil={data.profil} onSimpan={onProfil} />
          </div>
        </Panel>

        <Panel judul="Preferensi" sub="Tersimpan otomatis di perangkat ini.">
          <div className="panel__isi--rapat">
            <div className="pengaturan__baris">
              <div>
                <p className="pengaturan__label">Tema</p>
                <p className="pengaturan__keterangan">
                  Gelap lebih nyaman untuk dipakai malam; terang lebih baik saat di bawah terik matahari.
                </p>
              </div>
              <div className="pengaturan__kontrol">
                <Segmen
                  label="Tema"
                  nilai={preferensi.tema}
                  onUbah={(tema) => onAturPreferensi({ tema })}
                  opsi={[
                    { nilai: 'sistem', label: 'Sistem' },
                    { nilai: 'terang', label: 'Terang' },
                    { nilai: 'gelap', label: 'Gelap' },
                  ]}
                />
              </div>
            </div>

            <div className="pengaturan__baris">
              <div>
                <p className="pengaturan__label">Kepadatan</p>
                <p className="pengaturan__keterangan">
                  Mode rapat menambah baris yang bisa tampil tanpa menggulir.
                </p>
              </div>
              <div className="pengaturan__kontrol">
                <Segmen
                  label="Kepadatan"
                  nilai={preferensi.kepadatan}
                  onUbah={(kepadatan) => onAturPreferensi({ kepadatan })}
                  opsi={[
                    { nilai: 'nyaman', label: 'Nyaman' },
                    { nilai: 'rapat', label: 'Rapat' },
                  ]}
                />
              </div>
            </div>

            <div className="pengaturan__baris">
              <div>
                <p className="pengaturan__label">Jeda antar sewa</p>
                <p className="pengaturan__keterangan">
                  Jeda memperbesar rentang tiap reservasi yang menahan stok, jadi unit tidak langsung dipakai
                  pelanggan berikutnya. Isi 0 untuk perilaku ketat.
                </p>
              </div>
              <div className="pengaturan__kontrol" style={{ minWidth: 128 }}>
                <Kolom label="Hari jeda">
                  {(sifat) => (
                    <input
                      {...sifat}
                      className="input input--angka"
                      type="number"
                      min={0}
                      max={7}
                      value={preferensi.jedaAntarSewaHari}
                      onChange={(event) =>
                        onAturPreferensi({
                          jedaAntarSewaHari: Math.max(0, Math.min(7, Number(event.target.value) || 0)),
                        })
                      }
                    />
                  )}
                </Kolom>
              </div>
            </div>

            <div className="pengaturan__baris">
              <div>
                <p className="pengaturan__label">Ambang servis</p>
                <p className="pengaturan__keterangan">
                  Jarak maksimum tanpa penyewaan sebelum aset dianggap menganggur, dan jarak servis yang
                  memicu saran.
                </p>
              </div>
              <div className="pengaturan__kontrol" style={{ minWidth: 128 }}>
                <Kolom label="Hari">
                  {(sifat) => (
                    <input
                      {...sifat}
                      className="input input--angka"
                      type="number"
                      min={0}
                      max={365}
                      value={preferensi.ambangSisaHariServis}
                      onChange={(event) =>
                        onAturPreferensi({
                          ambangSisaHariServis: Math.max(
                            0,
                            Math.min(365, Number(event.target.value) || 0),
                          ),
                        })
                      }
                    />
                  )}
                </Kolom>
              </div>
            </div>

            <div className="pengaturan__baris">
              <div>
                <p className="pengaturan__label">Mode demo</p>
                <p className="pengaturan__keterangan">
                  Mengganti data tersimpan dengan data contoh. Berguna untuk presentasi atau latihan.
                </p>
              </div>
              <div className="pengaturan__kontrol">
                <Tombol varian="garis" ikon={<RotateCcw size={15} />} onClick={() => setKonfirmasi('demo')}>
                  Muat data demo
                </Tombol>
              </div>
            </div>

            <div className="pengaturan__baris">
              <div>
                <p className="pengaturan__label">Hapus semua data</p>
                <p className="pengaturan__keterangan">
                  Mengosongkan penyimpanan peramban. Unduh cadangan dulu bila masih perlu.
                </p>
              </div>
              <div className="pengaturan__kontrol">
                <Tombol varian="bahaya" ikon={<Trash2 size={15} />} onClick={() => setKonfirmasi('bersihkan')}>
                  Hapus semuanya
                </Tombol>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        judul="Cadangan dan perpindahan"
        sub="Format yang sama dipakai untuk ekspor, impor, dan snapshot — jadi keduanya selalu kompatibel."
      >
        <div className="panel__isi">
          <div className="baris-bungkus">
            <Tombol varian="utama" ikon={<Download size={15} />} onClick={ekspor}>
              Unduh cadangan JSON
            </Tombol>
            <Tombol varian="garis" ikon={<Upload size={15} />} onClick={() => berkasRef.current?.click()}>
              Impor berkas JSON
            </Tombol>
            <Tombol varian="garis" ikon={<CalendarArrowDown size={15} />} onClick={eksporICS}>
              Ekspor kalender (.ics)
            </Tombol>
            <Tombol
              varian="garis"
              ikon={<Printer size={15} />}
              onClick={() =>
                cetakHTML(
                  lembarKerja(
                    data,
                    hariIni,
                    antrean.ambil,
                    antrean.kembali,
                    antrean.terlambat,
                  ),
                )
              }
            >
              Cetak lembar kerja
            </Tombol>
            <Tombol
              varian="garis"
              ikon={<Printer size={15} />}
              onClick={() =>
                cetakHTML(
                  laporanJadwal(
                    data,
                    barisAgenda(data, { mulai: hariIni, jumlahHari: 28, jeda: preferensi.jedaAntarSewaHari }),
                  ),
                )
              }
            >
              Cetak jadwal 28 hari
            </Tombol>
            <Tombol
              varian="halus"
              ikon={<Copy size={15} />}
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(backupJSON(data))
                  .then(() => tampil('Cadangan disalin ke papan klip.', { nada: 'sukses' }))
                  .catch(() => tampil('Peramban menolak penyalinan.', { nada: 'galat' }));
              }}
            >
              Salin cadangan
            </Tombol>
            <input
              ref={berkasRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                void pilihBerkas(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </div>
          <div style={{ marginTop: 'var(--s-4)' }}>
            <Info
              nada={gagalSimpan ? 'bahaya' : 'info'}
              ikon={<HardDriveDownload size={16} aria-hidden="true" />}
              judul={
                gagalSimpan
                  ? 'Penyimpanan lokal tidak tersedia'
                  : `Penyimpanan lokal aktif · sumber data: ${sumber}`
              }
            >
              {gagalSimpan
                ? 'Peramban memblokir penyimpanan situs (mode privat?). Perubahan tetap berjalan di sesi ini tetapi hilang saat tab ditutup.'
                : `${pesanSistem} Ekspor berkala tetap disarankan sebagai jaring pengaman.`}
            </Info>
          </div>
        </div>
      </Panel>

      <div className="grid-2">
        <Panel
          judul="Snapshot otomatis"
          sub={`${snapshots.length} dari ${BATAS_SNAPSHOT} slot terpakai · satu snapshot setiap perubahan data.`}
        >
          <div className="panel__isi--rapat">
            {snapshots.length === 0 ? (
              <div style={{ padding: 'var(--pad-sel)' }}>
                <Kosong
                  judul="Belum ada snapshot"
                  teks="Snapshot otomatis dibuat begitu kamu mengubah data untuk pertama kali."
                />
              </div>
            ) : (
              <div className="daftar">
                {snapshots.map((snap) => {
                  const ringkasSnap = ringkasData(snap.data);
                  const waktu = new Date(snap.waktu);
                  return (
                    <div key={snap.id} className="daftar__item">
                      <div className="daftar__isi">
                        <p className="daftar__judul">{snap.label}</p>
                        <p className="daftar__sub">
                          {formatTanggalPendekBulan(snap.waktu.slice(0, 10))}{' '}
                          {String(waktu.getHours()).padStart(2, '0')}:
                          {String(waktu.getMinutes()).padStart(2, '0')} · {ringkasSnap.aset} aset ·{' '}
                          {formatUnit(ringkasSnap.unit)} unit
                        </p>
                      </div>
                      <div className="baris">
                        <Tombol
                          varian="halus"
                          ukuran="kecil"
                          onClick={() => unduhTeks(namaBerkasSnapshot(snap), backupJSON(snap.data))}
                        >
                          Unduh
                        </Tombol>
                        <Tombol varian="garis" ukuran="kecil" onClick={() => pulih(snap)}>
                          Pulihkan
                        </Tombol>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>

        <Panel judul="Riwayat aktivitas" sub="Setiap perubahan tercatat, termasuk yang dibatalkan.">
          <div className="panel__isi--rapat">
            {log.length === 0 ? (
              <div style={{ padding: 'var(--pad-sel)' }}>
                <Kosong judul="Belum ada aktivitas" teks="Riwayat akan terisi begitu kamu mulai mengubah data." />
              </div>
            ) : (
              <div>
                {log.slice(0, 40).map((catatan) => {
                  const waktu = new Date(catatan.waktu);
                  return (
                    <div key={catatan.id} className="riwayat__item">
                      <span className="riwayat__waktu">
                        {String(waktu.getHours()).padStart(2, '0')}:
                        {String(waktu.getMinutes()).padStart(2, '0')}
                      </span>
                      <div className="riwayat__teks">
                        <strong>{catatan.pesan}</strong>
                        {catatan.rincian ? <p className="riwayat__rinci">{catatan.rincian}</p> : null}
                      </div>
                      {catatan.dapatDibatalkan ? (
                        <Lencana nada="info">bisa dibatalkan</Lencana>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel judul="Ringkasan data" sub="Apa yang sedang tersimpan di perangkat ini.">
        <div className="panel__isi">
          <div className="kv-daftar">
            <div className="kv">
              <span>Aset terdaftar</span>
              <span className="kv__nilai">{ringkas.aset}</span>
            </div>
            <div className="kv">
              <span>Reservasi tercatat</span>
              <span className="kv__nilai">{ringkas.reservasi}</span>
            </div>
            <div className="kv">
              <span>Total unit</span>
              <span className="kv__nilai">{formatUnit(ringkas.unit)}</span>
            </div>
            <div className="kv">
              <span>Periode terlama</span>
              <span className="kv__nilai">
                {data.reservasi.length > 0
                  ? `${formatTanggal(
                      data.reservasi.reduce((min, r) => (r.tanggalMulai < min ? r.tanggalMulai : min), deretTanggal(hariIni, 1)[0]),
                    )} – ${formatTanggal(
                      data.reservasi.reduce((maks, r) => (r.tanggalSelesai > maks ? r.tanggalSelesai : maks), hariIni),
                    )}`
                  : '—'}
              </span>
            </div>
            <div className="kv">
              <span>Estimasi nilai berjalan</span>
              <span className="kv__nilai">{formatRupiah(ringkasDataNilai(data))}</span>
            </div>
          </div>
        </div>
      </Panel>

      <KonfirmasiDanger
        buka={konfirmasi !== null}
        judul={konfirmasi === 'demo' ? 'Muat ulang data demo?' : 'Hapus semua data di perangkat ini?'}
        pesan={
          konfirmasi === 'demo'
            ? 'Seluruh data yang kamu buat akan diganti oleh data contoh. Tindakan ini belum bisa dibatalkan.'
            : 'Penyimpanan lokal akan dikosongkan. Unduh cadangan lebih dulu bila masih perlu.'
        }
        onBatal={() => setKonfirmasi(null)}
        onYa={() => {
          if (konfirmasi === 'demo') onResetDemo();
          if (konfirmasi === 'bersihkan') onBersihkan();
          setKonfirmasi(null);
        }}
      />
    </>
  );
}

function ringkasDataNilai(data: DataAplikasi): number {
  const peta = new Map(data.aset.map((item) => [item.id, item.hargaPerHari]));
  return data.reservasi
    .filter((item) => item.status === 'Permintaan' || item.status === 'Dipesan' || item.status === 'Dipinjam')
    .reduce((total, item) => {
      const harian = peta.get(item.asetId) ?? 0;
      const mulai = new Date(`${item.tanggalMulai}T00:00:00`).getTime();
      const selesai = new Date(`${item.tanggalSelesai}T00:00:00`).getTime();
      const hari = Math.max(1, Math.round((selesai - mulai) / 86_400_000) + 1);
      return total + hari * harian * item.jumlah;
    }, 0);
}

function ProfilForm({
  profil,
  onSimpan,
}: {
  profil: DataAplikasi['profil'];
  onSimpan: (nilai: DataAplikasi['profil']) => void;
}): ReactNode {
  const { tampil } = useNotif();
  const [form, setForm] = useState(profil);

  useEffect(() => {
    setForm(profil);
  }, [profil]);

  return (
    <div className="formulir">
      <Kolom label="Nama usaha">
        {(sifat) => (
          <input
            {...sifat}
            className="input"
            value={form.nama}
            placeholder="Rental-borne Kendari"
            onChange={(event) => setForm({ ...form, nama: event.target.value })}
          />
        )}
      </Kolom>
      <Kolom label="Telepon">
        {(sifat) => (
          <input
            {...sifat}
            className="input"
            value={form.telepon}
            placeholder="0812 3456 7890"
            onChange={(event) => setForm({ ...form, telepon: event.target.value })}
          />
        )}
      </Kolom>
      <Kolom label="Alamat">
        {(sifat) => (
          <input
            {...sifat}
            className="input"
            value={form.alamat}
            placeholder="Jl. Pattimura No. 12, Kendari"
            onChange={(event) => setForm({ ...form, alamat: event.target.value })}
          />
        )}
      </Kolom>
      <Kolom label="Catatan kop" bantuan="Muncul di bawah nota, misalnya nomor NPWP.">
        {(sifat) => (
          <textarea
            {...sifat}
            className="area"
            rows={2}
            value={form.catatan}
            onChange={(event) => setForm({ ...form, catatan: event.target.value })}
          />
        )}
      </Kolom>
      <div className="baris">
        <span className="geser" />
        <Tombol
          varian="utama"
          onClick={() => {
            onSimpan(form);
            tampil('Profil usaha disimpan.', { nada: 'sukses' });
          }}
        >
          Simpan profil
        </Tombol>
      </div>
    </div>
  );
}

function KonfirmasiDanger({
  buka,
  judul,
  pesan,
  onYa,
  onBatal,
}: {
  buka: boolean;
  judul: string;
  pesan: string;
  onYa: () => void;
  onBatal: () => void;
}): ReactNode {
  const { tampil } = useNotif();
  if (!buka) return null;
  return (
    <div
      className="tirai"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onBatal();
      }}
    >
      <div className="dialog dialog--sempit" role="dialog" aria-modal="true" aria-label={judul}>
        <header className="dialog__kepala">
          <div>
            <h2 className="dialog__judul">{judul}</h2>
            <p className="dialog__sub">{pesan}</p>
          </div>
        </header>
        <div className="dialog__kaki dialog__kaki--sebar">
          <Tombol varian="garis" onClick={onBatal}>
            Batal
          </Tombol>
          <Tombol
            varian="bahaya"
            onClick={() => {
              onYa();
              tampil('Selesai.', { nada: 'info' });
            }}
          >
            Ya, lanjutkan
          </Tombol>
        </div>
      </div>
    </div>
  );
}

