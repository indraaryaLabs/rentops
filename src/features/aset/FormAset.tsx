import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PackagePlus } from 'lucide-react';
import type { Aset, DataAplikasi, KategoriAset, StatusAset } from '../../domain/types';
import { KATEGORI_ASET, STATUS_ASET } from '../../domain/types';
import { POLA_KODE, asetDariForm, formAsetDari, formAsetKosong, kodeBerikut, validasiFormAset } from '../../domain/validasi';
import { buatId } from '../../domain/id';
import { Dialog, Kolom } from '../../ui/form';
import { Info, Tombol } from '../../ui/primitif';

export interface FormAsetProps {
  buka: boolean;
  data: DataAplikasi;
  /** null → create mode. */
  sedangDiubah: Aset | null;
  onTutup: () => void;
  onSimpan: (aset: Aset) => void;
  onHapus: (aset: Aset) => void;
}

export function FormAset({
  buka,
  data,
  sedangDiubah,
  onTutup,
  onSimpan,
  onHapus,
}: FormAsetProps): ReactNode {
  const formAwal = useMemo(
    () =>
      sedangDiubah
        ? formAsetDari(sedangDiubah)
        : { ...formAsetKosong(), kode: kodeBerikut(data.aset, 'AST') },
    [sedangDiubah, data.aset],
  );

  const [form, setForm] = useState(formAwal);
  const [dikirim, setDikirim] = useState(false);

  useEffect(() => {
    if (buka) {
      setForm(formAwal);
      setDikirim(false);
    }
  }, [buka, formAwal]);

  const galat = validasiFormAset(form, data, sedangDiubah?.id);

  /** How many units are already committed — the floor for the stock field. */
  const terpakai = data.reservasi
    .filter((item) => item.asetId === sedangDiubah?.id && menahanStokStatus(item.status))
    .reduce((n, item) => n + item.jumlah, 0);

  const simpan = (): void => {
    setDikirim(true);
    if (Object.keys(galat).length > 0) return;
    onSimpan(asetDariForm(form, sedangDiubah?.id ?? buatId('ast'), new Date().toISOString()));
  };

  return (
    <Dialog
      buka={buka}
      judul={sedangDiubah ? `Ubah ${sedangDiubah.nama}` : 'Aset baru'}
      sub="Harga per hari dipakai untuk menghitung estimasi di setiap reservasi."
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
          <Tombol varian="utama" onClick={simpan} ikon={<PackagePlus size={15} aria-hidden="true" />}>
            {sedangDiubah ? 'Simpan perubahan' : 'Tambah aset'}
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
          <Kolom label="Nama aset" wajib galat={dikirim ? galat.nama : undefined}>
            {(sifat) => (
              <input
                {...sifat}
                className="input"
                type="text"
                value={form.nama}
                placeholder="Tenda dome 4x6"
                onChange={(event) => setForm({ ...form, nama: event.target.value })}
              />
            )}
          </Kolom>

          <Kolom
            label="Kode aset"
            wajib
            galat={dikirim ? galat.kode : undefined}
            bantuan={`Pola: ${POLA_KODE.source}. Contoh: TND-01.`}
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
        </div>

        <div className="formulir__baris formulir__tiga">
          <Kolom label="Kategori" wajib galat={dikirim ? galat.kategori : undefined}>
            {(sifat) => (
              <select
                {...sifat}
                className="pilih"
                value={form.kategori}
                onChange={(event) =>
                  setForm({ ...form, kategori: event.target.value as KategoriAset })
                }
              >
                <option value="">Pilih kategori…</option>
                {KATEGORI_ASET.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            )}
          </Kolom>

          <Kolom
            label="Jumlah unit"
            wajib
            galat={dikirim ? galat.jumlahUnit : undefined}
            bantuan={terpakai > 0 ? `${terpakai} unit sedang tersewa.` : 'Total unit yang kamu miliki.'}
          >
            {(sifat) => (
              <input
                {...sifat}
                className="input input--angka"
                type="number"
                min={Math.max(1, terpakai)}
                value={form.jumlahUnit}
                onChange={(event) => setForm({ ...form, jumlahUnit: event.target.value })}
              />
            )}
          </Kolom>

          <Kolom
            label="Harga per hari"
            wajib
            galat={dikirim ? galat.hargaPerHari : undefined}
            bantuan="Boleh ditulis 150000 atau 150.000."
          >
            {(sifat) => (
              <input
                {...sifat}
                className="input input--angka"
                type="text"
                inputMode="numeric"
                value={form.hargaPerHari}
                onChange={(event) => setForm({ ...form, hargaPerHari: event.target.value })}
              />
            )}
          </Kolom>
        </div>

        <div className="formulir__baris">
          <Kolom
            label="Status"
            galat={dikirim ? galat.status : undefined}
            bantuan="Pemeliharaan menahan pemesanan baru."
          >
            {(sifat) => (
              <select
                {...sifat}
                className="pilih"
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value as StatusAset })
                }
              >
                {STATUS_ASET.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            )}
          </Kolom>

          <Kolom
            label="Jarak servis (hari)"
            galat={dikirim ? galat.jarakServisHari : undefined}
            bantuan="Kosongkan bila tidak perlu dijadwalkan servis."
          >
            {(sifat) => (
              <input
                {...sifat}
                className="input input--angka"
                type="number"
                min={1}
                max={3650}
                placeholder="90"
                value={form.jarakServisHari}
                onChange={(event) => setForm({ ...form, jarakServisHari: event.target.value })}
              />
            )}
          </Kolom>
        </div>

        {form.status !== 'Aktif' ? (
          <Info nada="peringatan" judul="Aset tidak bisa disewa selama ini">
            Selama status Pemeliharaan, aset disembunyikan dari pilihan di form reservasi dan tidak menambah
            unit bebas pada papan jadwal.
          </Info>
        ) : null}

        <Kolom
          label="Catatan"
          galat={dikirim ? galat.catatan : undefined}
          bantuan="Opsional — maksimal 280 karakter."
        >
          {(sifat) => (
            <textarea
              {...sifat}
              className="area"
              rows={3}
              value={form.catatan}
              placeholder="Contoh: sudah termasuk tiang, tenda, dan 6 kursi"
              onChange={(event) => setForm({ ...form, catatan: event.target.value })}
            />
          )}
        </Kolom>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Simpan aset
        </button>
      </form>
    </Dialog>
  );
}

/** Local copy of the stock-holding rule so the form stays free of extra imports. */
function menahanStokStatus(status: string): boolean {
  return status === 'Permintaan' || status === 'Dipesan' || status === 'Dipinjam';
}