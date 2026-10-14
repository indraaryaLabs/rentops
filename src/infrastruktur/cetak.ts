/**
 * Printable documents — nota (rental receipt) and the daily run sheet.
 *
 * Built as self-contained HTML strings so printing needs nothing but the browser
 * dialog: no PDF library, no server, no watermark. A dedicated print stylesheet
 * hides the application chrome and keeps the sheet ink-efficient.
 */

import type { DataAplikasi, Reservasi } from '../domain/types';
import { formatTanggal, formatTanggalPanjang } from '../domain/tanggal';
import { ringkasSewa } from '../domain/sewa';
import { formatRupiah } from '../domain/uang';
import { DESKRIPSI_STATUS } from '../domain/alur';
import { petaAset } from '../domain/selektor';

function escapeHTML(teks: string): string {
  return teks
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function kop(
  profil: DataAplikasi['profil'],
  judul: string,
  subjudul: string,
  kanan: string,
): string {
  return `
    <header class="doc__head">
      <div>
        <p class="doc__brand">${escapeHTML(profil.nama || 'RentalOps')}</p>
        <p class="doc__muted">${escapeHTML(profil.alamat || '')}${
          profil.telepon ? ` · ${escapeHTML(profil.telepon)}` : ''
        }</p>
      </div>
      <div class="doc__meta">
        <h1>${escapeHTML(judul)}</h1>
        <p class="doc__muted">${escapeHTML(subjudul)}</p>
        <p class="doc__meta-right">${escapeHTML(kanan)}</p>
      </div>
    </header>`;
}

function kaki(profil: DataAplikasi['profil'], catatan: string): string {
  return `
    <footer class="doc__foot">
      <p>${escapeHTML(catatan)}</p>
      ${profil.catatan ? `<p class="doc__muted">${escapeHTML(profil.catatan)}</p>` : ''}
      <p class="doc__muted">Dicetak dari RentOps pada ${escapeHTML(formatTanggalPanjang(new Date().toISOString().slice(0, 10)))}</p>
    </footer>`;
}

/** Nota rental: what was handed over, for how long, and how much is settled. */
export function notaReservasi(data: DataAplikasi, reservasi: Reservasi): string {
  const aset = petaAset(data).get(reservasi.asetId);
  const ringkasan = ringkasSewa(reservasi, aset?.hargaPerHari ?? 0);
  const baris = [
    ['Nomor reservasi', reservasi.kode],
    ['Status', `${reservasi.status} — ${DESKRIPSI_STATUS[reservasi.status]}`],
    ['Pelanggan', reservasi.pelanggan],
    ['Kontak', reservasi.kontak || '—'],
    ['Aset', aset ? `${aset.kode} · ${aset.nama}` : '—'],
    ['Jumlah', `${reservasi.jumlah} unit`],
    ['Periode', `${formatTanggal(reservasi.tanggalMulai)} — ${formatTanggal(reservasi.tanggalSelesai)} (${ringkasan.hariSewa} hari)`],
    ['Harga harian', formatRupiah(ringkasan.hargaPerHari)],
  ]
    .map(
      ([label, nilai]) =>
        `<tr><th>${escapeHTML(label)}</th><td>${escapeHTML(nilai)}</td></tr>`,
    )
    .join('');

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>Nota ${escapeHTML(reservasi.kode)}</title>
<style>${GAYA_CETAK}</style></head><body class="doc">
<main class="doc__page">
  ${kop(data.profil, 'Nota Rental', `Nomor ${reservasi.kode}`, formatTanggal(new Date().toISOString().slice(0, 10)))}
  <table class="doc__table doc__table--kv">${baris}</table>
  ${
    reservasi.catatan
      ? `<section class="doc__note"><h2>Catatan</h2><p>${escapeHTML(reservasi.catatan)}</p></section>`
      : ''
  }
  <table class="doc__table doc__table--totals">
    <tr><th>Harga sewa (${ringkasan.hariSewa} hari × ${formatRupiah(ringkasan.hargaPerHari)} × ${reservasi.jumlah} unit)</th><td>${formatRupiah(ringkasan.subtotal)}</td></tr>
    <tr><th>DP diterima</th><td>${formatRupiah(ringkasan.dp)}</td></tr>
    <tr class="doc__total"><th>Sisa pembayaran</th><td>${formatRupiah(ringkasan.sisa)}</td></tr>
  </table>
  <div class="doc__sign">
    <div><span class="doc__line"></span><p>Petugas</p></div>
    <div><span class="doc__line"></span><p>Pelanggan</p></div>
  </div>
  ${kaki(data.profil, 'Simpan nota ini sebagai bukti peminjaman aset.')}</main></body></html>`;
}

/** One-page daily sheet: what leaves, what comes back, what is late. */
export function lembarKerja(
  data: DataAplikasi,
  hariIni: string,
  ambil: Reservasi[],
  kembali: Reservasi[],
  terlambat: Reservasi[],
): string {
  const peta = petaAset(data);
  const sebaris = (daftar: Reservasi[]) =>
    daftar
      .map((r) => {
        const aset = peta.get(r.asetId);
        return `<tr>
          <td><strong>${escapeHTML(r.kode)}</strong></td>
          <td>${escapeHTML(r.pelanggan)}</td>
          <td>${escapeHTML(aset ? `${aset.kode} ${aset.nama}` : '—')}</td>
          <td class="num">${r.jumlah}</td>
          <td>${escapeHTML(formatTanggal(r.tanggalSelesai))}</td>
          <td>${escapeHTML(r.kontak || '—')}</td>
        </tr>`;
      })
      .join('');

  const kosong = '<tr><td colspan="6" class="muted">Tidak ada.</td></tr>';

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>Lembar kerja ${escapeHTML(formatTanggal(hariIni))}</title>
<style>${GAYA_CETAK}</style></head><body class="doc">
<main class="doc__page">
  ${kop(data.profil, 'Lembar Kerja Harian', formatTanggalPanjang(hariIni), `Aset aktif: ${data.aset.filter((a) => a.statusPemeliharaan === 'Aktif').length}`)}
  ${terlambat.length > 0 ? `<section class="doc__alert"><strong>${terlambat.length} reservasi terlambat</strong><p class="muted">Hubungi pelanggan sebelum unit kembali disewa.</p></section>` : ''}
  <section><h2>Perlu diserahkan hari ini (${ambil.length})</h2>
    <table class="doc__table"><thead><tr><th>No</th><th>Pelanggan</th><th>Aset</th><th class="num">Unit</th><th>Kembali</th><th>Kontak</th></tr></thead>
    <tbody>${ambil.length ? sebaris(ambil) : kosong}</tbody></table></section>
  <section><h2>Perlu diterima hari ini (${kembali.length})</h2>
    <table class="doc__table"><thead><tr><th>No</th><th>Pelanggan</th><th>Aset</th><th class="num">Unit</th><th>Kembali</th><th>Kontak</th></tr></thead>
    <tbody>${kembali.length ? sebaris(kembali) : kosong}</tbody></table></section>
  <section><h2>Terlambat (${terlambat.length})</h2>
    <table class="doc__table"><thead><tr><th>No</th><th>Pelanggan</th><th>Aset</th><th class="num">Unit</th><th>Seharusnya</th><th>Kontak</th></tr></thead>
    <tbody>${terlambat.length ? sebaris(terlambat) : kosong}</tbody></table></section>
  ${kaki(data.profil, 'Centik setiap baris setelah aset diserahkan atau diterima.')}
</main></body></html>`;
}

/** Whole-schedule sheet, useful as a laminated wall chart. */
export function laporanJadwal(
  data: DataAplikasi,
  baris: Array<{ tanggal: string; label: string; held: number; tersedia: number; maintenance: number; totalUnit: number }>,
): string {
  const isi = baris
    .map(
      (b) => `<tr>
        <td>${escapeHTML(b.label)}</td>
        <td class="num">${b.totalUnit}</td>
        <td class="num">${b.held}</td>
        <td class="num">${b.tersedia}</td>
        <td class="num">${b.maintenance}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>Jadwal ketersediaan</title>
<style>${GAYA_CETAK}</style></head><body class="doc">
<main class="doc__page">
  ${kop(data.profil, 'Jadwal Ketersediaan', 'Rekap ketersediaan unit', `${data.aset.length} aset`)}
  <table class="doc__table"><thead><tr><th>Tanggal</th><th class="num">Total unit</th><th class="num">Dipesan</th><th class="num">Tersedia</th><th class="num">Maintenance</th></tr></thead>
  <tbody>${isi}</tbody></table>
  ${kaki(data.profil, 'Angka dihitung dari status Permintaan, Dipesan, dan Dipinjam.')}
</main></body></html>`;
}

export function cetakHTML(html: string): void {
  const jendela = window.open('', '_blank', 'noopener,noreferrer,width=880,height=1000');
  if (!jendela) {
    // Popup blocked: fall back to writing into a hidden iframe.
    const bingkai = document.createElement('iframe');
    bingkai.style.position = 'fixed';
    bingkai.style.right = '0';
    bingkai.style.bottom = '0';
    bingkai.style.width = '0';
    bingkai.style.height = '0';
    bingkai.style.border = '0';
    document.body.appendChild(bingkai);
    const doc = bingkai.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      bingkai.contentWindow?.focus();
      bingkai.contentWindow?.print();
    }
    window.setTimeout(() => bingkai.remove(), 1_000);
    return;
  }
  jendela.document.open();
  jendela.document.write(html);
  jendela.document.close();
  jendela.focus();
  jendela.addEventListener('load', () => jendela.print(), { once: true });
}

export const GAYA_CETAK = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body.doc { margin: 0; padding: 24px; background: #f4f4f2; color: #14161a;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 12px; line-height: 1.5; }
  .doc__page { max-width: 780px; margin: 0 auto; background: #fff; padding: 32px; border: 1px solid #e3e4e0; }
  .doc__head { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1.5px solid #14161a; padding-bottom: 14px; }
  .doc__brand { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
  .doc__meta { text-align: right; }
  .doc__meta h1 { margin: 0; font-size: 15px; letter-spacing: -0.01em; }
  .doc__meta-right { margin: 4px 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
  .doc__muted, .muted { color: #6b7280; }
  .doc__table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  .doc__table th, .doc__table td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #e9eae6; vertical-align: top; }
  .doc__table thead th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
  .doc__table--kv th { width: 30%; color: #6b7280; font-weight: 500; }
  .doc__table--totals { margin-left: auto; width: min(360px, 100%); }
  .doc__table--totals th { text-align: left; font-weight: 500; color: #6b7280; }
  .doc__table--totals td { text-align: right; font-variant-numeric: tabular-nums; }
  .doc__total th, .doc__total td { font-weight: 700; border-top: 1.5px solid #14161a; color: #14161a; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .doc__note h2, section h2 { margin: 18px 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
  .doc__note p { margin: 0; }
  .doc__alert { margin: 16px 0; padding: 10px 12px; border-left: 3px solid #b42318; background: #fdf3f2; }
  .doc__sign { display: flex; gap: 48px; margin-top: 32px; }
  .doc__sign > div { flex: 1; }
  .doc__line { display: block; border-bottom: 1px solid #14161a; height: 28px; }
  .doc__sign p { margin: 4px 0 0; color: #6b7280; }
  .doc__foot { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e9eae6; }
  .doc__foot p { margin: 2px 0; }
  @media print {
    body.doc { padding: 0; background: #fff; }
    .doc__page { border: 0; padding: 0; max-width: none; }
    @page { margin: 14mm; }
  }`;