import { describe, expect, it } from 'vitest';
import type { DataAplikasi } from '../domain/types';
import { buatDataDemo } from '../domain/seed';
import { antreanHariIni } from '../domain/otomasi';
import { barisAgenda } from '../domain/selektor';
import { laporanJadwal, lembarKerja, notaReservasi } from './cetak';
import { nomorWa, pesanReservasi, tautanWa } from './sistem';

function contoh(): DataAplikasi {
  return buatDataDemo(new Date(2026, 9, 14));
}

const HARI_INI = '2026-10-14';

describe('dokumen siap cetak', () => {
  const data = contoh();
  const r = data.reservasi[0];

  it('nota memuat pelanggan, aset, dan total', () => {
    const html = notaReservasi(data, r);
    expect(html).toContain(r.pelanggan);
    expect(html).toContain(r.kode);
    expect(html).toContain('Sisa pembayaran');
    expect(html).toContain('</html>');
  });

  it('nota memuat kop usaha', () => {
    const dataProfil = { ...data, profil: { ...data.profil, nama: 'Rental Uji', telepon: '0812 9999 0000' } };
    const html = notaReservasi(dataProfil, dataProfil.reservasi[0]);
    expect(html).toContain('Rental Uji');
    expect(html).toContain('0812 9999 0000');
  });

  it('nota menahan HTML dari masukan pengguna', () => {
    const jahat = {
      ...data,
      reservasi: [{ ...r, pelanggan: '<script>alert(1)</script>' }],
    };
    expect(notaReservasi(jahat, jahat.reservasi[0])).not.toContain('<script>');
  });

  it('lembar kerja mencantumkan semua kelompok antrean', () => {
    const antrean = antreanHariIni(data, HARI_INI);
    const html = lembarKerja(data, HARI_INI, antrean.ambil, antrean.kembali, antrean.terlambat);
    expect(html).toContain('Terlambat');
    expect(html).toContain('Perlu diserahkan hari ini');
    expect(html).toContain('Perlu diterima hari ini');
    for (const item of antrean.terlambat) {
      expect(html).toContain(item.kode);
    }
  });

  it('laporan jadwal mencantumkan satu baris per hari', () => {
    const baris = barisAgenda(data, { mulai: HARI_INI, jumlahHari: 7 });
    const html = laporanJadwal(data, baris);
    expect((html.match(/<tr>/g) ?? []).length).toBe(8);
  });

  it('dokumen siap cetak punya gaya versi cetak', () => {
    const html = notaReservasi(data, r);
    expect(html).toContain('@media print');
    expect(html).toContain('<!doctype html>');
  });
});

describe('pesan WhatsApp', () => {
  const data = contoh();
  const r = data.reservasi[0];

  it('merapikan nomor lokal, 62, dan 8', () => {
    expect(nomorWa('0812 1111 2222')).toBe('6281211112222');
    expect(nomorWa('+62 812 1111 2222')).toBe('6281211112222');
    expect(nomorWa('812 1111 2222')).toBe('6281211112222');
    expect(nomorWa('0812')).toBeNull();
  });

  it('menyiapkan tautan wa.me yang terenkode', () => {
    const pesan = pesanReservasi(r, data.aset[0]);
    const tautan = tautanWa(r.kontak, pesan);
    const nomor = nomorWa(r.kontak)!;
    expect(tautan?.tautan?.startsWith(`https://wa.me/${nomor}?text=`)).toBe(true);
    expect(decodeURIComponent(tautan!.tautan!)).toContain(r.kode);
    expect(tautan?.ringkasan).toBe(pesan);
  });

  it('tidak membuat tautan bila kontak tidak valid', () => {
    expect(tautanWa('abc', 'pesan')).toBeNull();
  });

  it('pesan menyebutkan status dan belum dikirim', () => {
    const pesan = pesanReservasi(r, data.aset[0]);
    expect(pesan).toContain(r.status);
    expect(pesan).toContain('belum terkirim');
    expect(pesan).toContain('Rp');
  });
});