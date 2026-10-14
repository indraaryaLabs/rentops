import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarPlus } from 'lucide-react';
import type { Aset, Reservasi, StatusReservasi } from '../../domain/types';
import { periksaKetersediaan } from '../../domain/ketersediaan';
import { hitungSubtotal, normalisasiDP } from '../../domain/sewa';
import { formatTanggal, hitungHariSewa } from '../../domain/tanggal';
import { formatUnit, formatRupiah } from '../../domain/uang';
import {
  formReservasiDari,
  formReservasiKosong,
  kodeBerikut,
  reservasiDariForm,
  validasiFormReservasi,
} from '../../domain/validasi';
import { TRANSISI } from '../../domain/alur';
import { buatId } from '../../domain/id';
import { Dialog, Kolom } from '../../ui/form';
import { Info, LencanaAset, Tombol } from '../../ui/primitif';

export interface FormReservasiProps {
  buka: boolean;
  aset: Aset[];
  reservasi: Reservasi[];
  /** null → create mode. */
  sedangDiubah: Reservasi | null;
  presetAsetId?: string;
  presetMulai?: string;
  jeda: number;
  hariIni: string;
  onTutup: () => void;
  onSimpan: (reservasi: Reservasi) => void;
  onHapus: (reservasi: Reservasi) => void;
}

export function FormReservasi({
  buka,
  aset,
  reservasi,
  sedangDiubah,
  presetAsetId,
  presetMulai,
  jeda,
  hariIni,
  onTutup,
  onSimpan,
  onHapus,
}: FormReservasiProps): ReactNode {
  const formAwal = useMemo(() => {
    if (sedangDiubah) return formReservasiDari(sedangDiubah);
    return {
      ...formReservasiKosong(hariIni),
      kode: kodeBerikut(reservasi, 'RSV'),
      asetId: presetAsetId ?? '',
      tanggalMulai: presetMulai ?? hariIni,
      tanggalSelesai: presetMulai ?? hariIni,
    };
  }, [sedangDiubah, reservasi, hariIni, presetAsetId, presetMulai]);

  const [form, setForm] = useState(formAwal);
  const [dikirim, setDikirim] = useState(false);

  useEffect(() => {
    if (buka) {
      setForm(formAwal);
      setDikirim(false);
    }
  }, [buka, formAwal]);

  const asetTerpilih = aset.find((item) => item.id === form.asetId);

  const ketersediaan = useMemo(() => {
    if (!asetTerpilih || !form.tanggalMulai || !form.tanggalSelesai) return null;

    if (form.tanggalSelesai < form.tanggalMulai) return null;
    return periksaKetersediaan({
      aset: asetTerpilih,
      reservasi,
      mulai: form.tanggalMulai,
      selesai: form.tanggalSelesai,
      jumlah: Math.max(1, Number(form.jumlah) || 1),
      jeda,
      kecualiId: sedangDiubah?.id,
    });
  }, [asetTerpilih, form.tanggalMulai, form.tanggalSelesai, form.jumlah, reservasi, jeda, sedangDiubah?.id]);

  const statusTersedia: StatusReservasi[] = sedangDiubah
    ? [sedangDiubah.status, ...TRANSISI[sedangDiubah.status]]
    : ['Permintaan', 'Dipesan'];

  const { galat, catatan } = validasiFormReservasi(form, {
    aset: asetTerpilih,
    reservasi,
    preferensi: { jedaAntarSewaHari: jeda },
    idSaatIni: sedangDiubah?.id,
    hariIni,
  });

  const jumlah = Math.max(1, Number(form.jumlah) || 1);
  const hariSewa = hitungHariSewa(form.tanggalMulai, form.tanggalSelesai);
  const subtotal = asetTerpilih
    ? hitungSubtotal(jumlah, asetTerpilih.hargaPerHari, {
        mulai: form.tanggalMulai,
        selesai: form.tanggalSelesai,
      })
    : 0;
  const dp = normalisasiDP(form.dp.trim() === '' ? 0 : Number(form.dp) || 0, subtotal);

  const simpan = (): void => {
    setDikirim(true);
    if (Object.keys(galat).length > 0) return;
    const dasar = sedangDiubah ? { ...formReservasiDari(sedangDiubah), ...form } : form;
    onSimpan(reservasiDariForm(dasar, sedangDiubah?.id ?? buatId('rsv'), new Date().toISOString()));
  };

  return (
    <Dialog
      buka={buka}
      lebar="lebar"
      judul={sedangDiubah ? `Ubah reservasi ${sedangDiubah.kode}` : 'Reservasi baru'}
      sub="Estimasi dihitung langsung dari harga harian aset dan rentang yang kamu pilih."
      onTutup={onTutup}
      kaki={
        <>
          {sedangDiubah ? (
            <Tombol varian="bahaya" ukuran="kecil" onClick={() => onHapus(sedangDiubah)}>
              Hapus
            </Tombol>
          ) : null}
          <span className="geser" />
          <Tombol varian="garis" onClick={onTutup}>
            Batal
          </Tombol>
          <Tombol varian="utama" onClick={simpan} ikon={<CalendarPlus size={15} aria-hidden="true" />}>
            {sedangDiubah ? 'Simpan perubahan' : 'Simpan reservasi'}
          </Tombol>
        </>
      }
    >
      <form
        className="formulir"
        onSubmit={(event) => {
          event.preventDefault();
          simpan();
        }}
      >
        <div className="formulir__baris">
          <Kolom
            label="Nomor reservasi"
            wajib
            galat={dikirim ? galat.kode : undefined}
            bantuan="Bisa ditulis manual mis. nomor internalmu sendiri."
          >
            {(sifat) => (
              <input
                {...sifat}
                className="input mono"
                type="text"
                value={form.kode}
                onChange={(event) => setForm({ ...form, kode: event.target.value.toUpperCase() })}
              />
            )}
          </Kolom>

          <Kolom label="Status" bantuan="Hanya status yang bisa dicapai dari alur saat ini.">
            {(sifat) => (
              <select
                {...sifat}
                className="input"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as StatusReservasi })}
              >
                {statusTersedia.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            )}
          </Kolom>
        </div>

        <div className="formulir__baris">
          <Kolom label="Pelanggan" wajib galat={dikirim ? galat.pelanggan : undefined}>
            {(sifat) => (
              <input
                {...sifat}
                className="input"
                type="text"
                value={form.pelanggan}
                placeholder="Bapak Agus Setiawan"
                onChange={(event) => setForm({ ...form, pelanggan: event.target.value })}
              />
            )}
          </Kolom>

          <Kolom
            label="Kontak"
            galat={dikirim ? galat.kontak : undefined}
            bantuan="Dipakai untuk menyiapkan pesan WhatsApp."
          >
            {(sifat) => (
              <input
                {...sifat}
                className="input"
                type="tel"
                value={form.kontak}
                placeholder="0812 3456 7890"
                onChange={(event) => setForm({ ...form, kontak: event.target.value })}
              />
            )}
          </Kolom>
        </div>

        <Kolom label="Aset yang disewa" wajib galat={dikirim ? galat.asetId : undefined}>
          {(sifat) => (
            <select
              {...sifat}
              className="input"
              value={form.asetId}
              onChange={(event) => setForm({ ...form, asetId: event.target.value })}
            >
              <option value="">Pilih aset…</option>
              {aset.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.kode} · {item.nama} — {formatUnit(item.jumlahTersedia)}
                  {item.statusPemeliharaan !== 'Aktif' ? ' (pemeliharaan)' : ''}
                </option>
              ))}
            </select>
          )}
        </Kolom>

        <div className="formulir__baris formulir__tiga">
          <Kolom label="Jumlah unit" wajib galat={dikirim ? galat.jumlah : undefined}>
            {(sifat) => (
              <input
                {...sifat}
                className="input input--angka"
                type="number"
                min={1}
                value={form.jumlah}
                onChange={(event) => setForm({ ...form, jumlah: event.target.value })}
              />
            )}
          </Kolom>

          <Kolom label="Tanggal mulai" wajib galat={dikirim ? galat.tanggalMulai : undefined}>
            {(sifat) => (
              <input
                {...sifat}
                className="input"
                type="date"
                value={form.tanggalMulai}
                onChange={(event) =>
                  setForm({
                    ...form,
                    tanggalMulai: event.target.value,
                    tanggalSelesai:
                      form.tanggalSelesai < event.target.value ? event.target.value : form.tanggalSelesai,
                  })
                }
              />
            )}
          </Kolom>

          <Kolom
            label="Tanggal selesai"
            wajib
            galat={dikirim ? galat.tanggalSelesai : undefined}
            bantuan="Termasuk hari terakhir pemakaian."
          >
            {(sifat) => (
              <input
                {...sifat}
                className="input"
                type="date"
                min={form.tanggalMulai}
                value={form.tanggalSelesai}
                onChange={(event) => setForm({ ...form, tanggalSelesai: event.target.value })}
              />
            )}
          </Kolom>
        </div>

        <Kolom
          label="DP (uang muka)"
          galat={dikirim ? galat.dp : undefined}
          bantuan="Isi 0 bila belum menerima pembayaran."
        >
          {(sifat) => (
            <input
              {...sifat}
              className="input input--angka"
              type="number"
              min={0}
              step={50_000}
              value={form.dp}
              onChange={(event) => setForm({ ...form, dp: event.target.value })}
            />
          )}
        </Kolom>

        <div className="total">
          <div className="total__sel">
            <span className="total__label">Lama sewa</span>
            <span className="total__nilai">{hariSewa > 0 ? `${hariSewa} hari` : '—'}</span>
          </div>
          <div className="total__sel">
            <span className="total__label">Estimasi biaya</span>
            <span className="total__nilai">{subtotal > 0 ? formatRupiah(subtotal) : '—'}</span>
          </div>
          <div className="total__sel">
            <span className="total__label">DP tertera</span>
            <span className="total__nilai">{formatRupiah(dp)}</span>
          </div>
          <div className="total__sel">
            <span className="total__label">Sisa bayar</span>
            <span className="total__nilai total__nilai--aksen">{formatRupiah(subtotal - dp)}</span>
          </div>
        </div>

        {asetTerpilih && asetTerpilih.statusPemeliharaan !== 'Aktif' ? (
          <Info nada="peringatan" judul="Aset sedang pemeliharaan">
            {asetTerpilih.nama} ({asetTerpilih.kode}) tidak bisa dipesan sampai statusnya kembali Aktif.
            <div style={{ marginTop: 8 }}>
              <LencanaAset status={asetTerpilih.statusPemeliharaan} />
            </div>
          </Info>
        ) : null}

        {ketersediaan && !ketersediaan.boleh && asetTerpilih?.statusPemeliharaan === 'Aktif' ? (
          <Info nada="bahaya" judul="Ketersediaan tidak cukup">
            {ketersediaan.alasan}
          </Info>
        ) : null}

        {ketersediaan?.boleh ? (
          <Info nada="sukses" judul="Ketersediaan cukup">
            {ketersediaan.tersedia} dari {asetTerpilih?.jumlahTersedia} unit {asetTerpilih?.nama} bebas pada{' '}
            {formatTanggal(form.tanggalMulai)}–{formatTanggal(form.tanggalSelesai)}.
            {jeda > 0 ? ` Jeda antar sewa ${jeda} hari sudah diperhitungkan.` : ''}
          </Info>
        ) : null}

        {catatan ? <Info nada="peringatan" judul="Perhatian">{catatan}</Info> : null}

        <Kolom
          label="Catatan"
          galat={dikirim ? galat.catatan : undefined}
          bantuan="Opsional — maksimal 280 karakter."
        >
          {(sifat) => (
            <textarea
              {...sifat}
              className="textarea"
              rows={3}
              value={form.catatan}
              placeholder="Contoh: perlu diantar sore hari"
              onChange={(event) => setForm({ ...form, catatan: event.target.value })}
            />
          )}
        </Kolom>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Simpan reservasi
        </button>
      </form>
    </Dialog>
  );
}


