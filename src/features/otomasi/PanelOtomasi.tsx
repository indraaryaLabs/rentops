import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, PackageCheck, Sparkles, Zap } from 'lucide-react';
import type { DataAplikasi, Preferensi } from '../../domain/types';
import type { Saran } from '../../domain/otomasi';
import { perintahDariTindakan } from '../../application/perintah';
import { agendaMendatang, asetMenganggur, ringkasanOtomasi } from '../../domain/otomasi';
import { formatTanggal, labelRelatif } from '../../domain/tanggal';
import { formatRupiah } from '../../domain/uang';
import { Panel, Kosong, Tombol, Segmen } from '../../ui/primitif';
import { petaAset } from '../../domain/selektor';

export interface PropsOtomasi {
  data: DataAplikasi;
  hariIni: string;
  preferensi: Preferensi;
  saran: Saran[];
  jalankan: (perintah: ReturnType<typeof perintahDariTindakan>) => void;
  goto: (halaman: string) => void;
}

type Saring = 'semua' | 'tinggi' | 'sedang';

export function PanelOtomasi({
  data,
  hariIni,
  preferensi,
  saran,
  jalankan,
  goto,
}: PropsOtomasi): ReactNode {
  const [saring, setSaring] = useState<Saring>('semua');

  const tampil = useMemo(
    () => (saring === 'semua' ? saran : saran.filter((item) => item.prioritas === saring)),
    [saran, saring],
  );

  const agenda = useMemo(() => agendaMendatang(data, hariIni, 7), [data, hariIni]);
  const menganggur = useMemo(
    () => asetMenganggur(data, hariIni, preferensi.ambangSisaHariServis),
    [data, hariIni, preferensi.ambangSisaHariServis],
  );
  const peta = useMemo(() => petaAset(data), [data]);

  const jumlah = (p: Saran['prioritas']) => saran.filter((item) => item.prioritas === p).length;

  return (
    <>
      <Panel
        judul="Saran satu klik"
        sub={ringkasanOtomasi(saran) || 'Tidak ada kondisi yang perlu ditangani saat ini.'}
        aksi={
          <Segmen
            label="Saring prioritas"
            nilai={saring}
            onUbah={setSaring}
            opsi={[
              { nilai: 'semua', label: `Semua (${saran.length})` },
              { nilai: 'tinggi', label: `Tinggi (${jumlah('tinggi')})` },
              { nilai: 'sedang', label: `Sedang (${jumlah('sedang')})` },
            ]}
          />
        }
      >
        <div className="panel__isi--rapat">
          {tampil.length === 0 ? (
            <div style={{ padding: 'var(--pad-sel)' }}>
              <Kosong
                ikon={<CheckCircle2 size={18} />}
                judul={saran.length === 0 ? 'Semua beres' : 'Tidak ada saran di prioritas ini'}
                teks={
                  saran.length === 0
                    ? 'Tidak ada keterlambatan, permintaan menunggu, atau piutang yang perlu ditindak. Lanjutkan operasional seperti biasa.'
                    : 'Coba pilih Semua untuk melihat saran lain.'
                }
                aksi={
                  saring !== 'semua' ? (
                    <Tombol varian="garis" onClick={() => setSaring('semua')}>
                      Tampilkan semua
                    </Tombol>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div>
              {tampil.map((item) => (
                <div key={item.id} className={`saran saran--${item.prioritas}`}>
                  <span className="saran__garis" aria-hidden="true" />
                  <div className="saran__isi">
                    <p className="saran__judul">{item.judul}</p>
                    <p className="saran__detail">{item.detail}</p>
                  </div>
                  <div className="saran__aksi">
                    <Tombol
                      varian="utama"
                      ukuran="kecil"
                      ikon={<Zap size={13} aria-hidden="true" />}
                      onClick={() => jalankan(perintahDariTindakan(item.tindakan))}
                    >
                      {labelTindakan(item.tindakan)}
                    </Tombol>
                    {item.tindakanAlternatif ? (
                      <Tombol
                        varian="halus"
                        ukuran="kecil"
                        onClick={() => jalankan(perintahDariTindakan(item.tindakanAlternatif!))}
                      >
                        {item.labelAlternatif}
                      </Tombol>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <div className="grid-utama">
        <Panel judul="Tujuh hari ke depan" sub="Yang akan keluar dan masuk — urutan waktu, bukan urutan status.">
          <div className="panel__isi--rapat">
            {agenda.length === 0 ? (
              <div style={{ padding: 'var(--pad-sel)' }}>
                <Kosong
                  judul="Agenda kosong"
                  teks="Belum ada pengambilan atau pengembalian dalam tujuh hari ke depan."
                  aksi={
                    <Tombol varian="utama" onClick={() => goto('reservasi')}>
                      Buat reservasi
                    </Tombol>
                  }
                />
              </div>
            ) : (
              <div className="garis-waktu">
                {agenda.map((item) => {
                  const kunci = item.status === 'Dipinjam' ? item.tanggalSelesai : item.tanggalMulai;
                  const baru = kunci === hariIni;
                  return (
                    <div key={item.id} className={`garis-waktu__item${baru ? ' garis-waktu__item--baru' : ''}`}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--teks-4)' }}>
                        {labelRelatif(kunci, hariIni)}
                      </span>
                      <span className="garis-waktu__titik" aria-hidden="true">
                        <span />
                      </span>
                      <div>
                        <p className="daftar__judul">
                          <span className="mono">{item.kode}</span> · {item.pelanggan}
                        </p>
                        <p className="daftar__sub">
                          {formatTanggal(item.tanggalMulai)} – {formatTanggal(item.tanggalSelesai)} ·{' '}
                          {peta.get(item.asetId)?.kode ?? '—'} · {item.jumlah} unit
                        </p>
                        <div style={{ marginTop: 6 }}>
                          {item.status === 'Dipinjam' ? (
                            <Tombol
                              varian="garis"
                              ukuran="kecil"
                              ikon={<PackageCheck size={13} />}
                              onClick={() =>
                                jalankan({ jenis: 'reservasi/status', id: item.id, status: 'Dikembalikan' })
                              }
                            >
                              Terima kembali
                            </Tombol>
                          ) : (
                            <Tombol
                              varian="garis"
                              ukuran="kecil"
                              ikon={<PackageCheck size={13} />}
                              onClick={() =>
                                jalankan({ jenis: 'reservasi/status', id: item.id, status: 'Dipinjam' })
                              }
                            >
                              Serahkan
                            </Tombol>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>

        <div className="tumpuk" style={{ gap: 'var(--s-5)' }}>
          <Panel judul="Aset menganggur" sub={`Tidak tersewa lebih dari ${preferensi.ambangSisaHariServis} hari.`}>
            <div className="panel__isi--rapat">
              {menganggur.length === 0 ? (
                <div style={{ padding: 'var(--pad-sel)' }}>
                  <Kosong judul="Semua aset aktif" teks="Tidak ada aset yang menganggur melewati ambang yang kamu tetapkan." />
                </div>
              ) : (
                <div className="daftar">
                  {menganggur.slice(0, 6).map((item) => (
                    <div key={item.id} className="daftar__item">
                      <div className="daftar__isi">
                        <p className="daftar__judul">{item.nama}</p>
                        <p className="daftar__sub">
                          <span className="mono">{item.kode}</span> · {formatRupiah(item.hargaPerHari)}/hari ·{' '}
                          {item.jumlahTersedia} unit
                          {item.jarakServisHari ? ` · servis tiap ${item.jarakServisHari} hari` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <Panel judul="Cara kerja otomasi" sub="Tidak ada yang berjalan diam-diam.">
            <div className="panel__isi">
              <div className="aturan">
                <p className="aturan__item">
                  <strong>Aturan murni dan dapat dijelaskan.</strong>
                  <span>
                    Setiap saran menyebut barang mana, kenapa penting, dan tindakan apa yang akan dijalankan kalau
                    kamu menekan tombolnya.
                  </span>
                </p>
                <p className="aturan__item">
                  <strong>Kamu tetap memegang kendali.</strong>
                  <span>
                    Tidak ada perubahan status yang terjadi otomatis. Semua harus ditekan satu per satu, dan
                    setiap tindakan bisa dibatalkan dengan Ctrl+Z.
                  </span>
                </p>
                <p className="aturan__item">
                  <strong>Aturan yang berjalan saat ini.</strong>
                  <span>
                    Keterlambatan pengembalian, permintaan menunggu lebih dari dua hari, reservasi yang perlu
                    dp, aset mendekati jadwal servis, dan permintaan yang belum sempat di ACC.
                  </span>
                </p>
                <p className="aturan__item">
                  <strong>Tanpa biaya.</strong>
                  <span>
                    Seluruh ini berjalan di dalam peramban. Tidak ada layanan pihak ketiga, tidak ada API key,
                    tidak ada biaya bulanan.
                  </span>
                </p>
              </div>
              <div style={{ marginTop: 'var(--s-4)' }}>
                <Tombol varian="halus" ikon={<Sparkles size={15} />} onClick={() => goto('data')}>
                  Aturan ambang di pengaturan
                </Tombol>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function labelTindakan(tindakan: Saran['tindakan']): string {
  switch (tindakan.jenis) {
    case 'reservasi/status':
      return tindakan.status === 'Dipinjam' ? 'Serahkan' : 'Terima';
    case 'reservasi/perpanjang':
      return 'Perpanjang';
    case 'reservasi/lunasi':
      return 'Tandai lunas';
    case 'aset/status':
      return 'Setel servis';
  }
}