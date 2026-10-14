"""Verifikasi RentOps v2 di peramban: alur inti, error konsol, tema, dan responsif."""

import os
import sys
from playwright.sync_api import sync_playwright

PORT = os.environ.get("RENTOPS_PORT", "5210")
BASE = f"http://localhost:{PORT}"
MASALAH = []
CATATAN = []


def catat(pesan: str) -> None:
    CATATAN.append(pesan)
    print(f"  [info] {pesan}")


def cek(nama: str, kondisi: bool, detail: str = "") -> None:
    if kondisi:
        print(f"  [OK]   {nama}")
    else:
        MASALAH.append(f"{nama} {detail}")
        print(f"  [GAGAL] {nama} {detail}")


def jalankan() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        konteks = browser.new_context(viewport={"width": 1440, "height": 950}, locale="id-ID")
        page = konteks.new_page()
        konsol = []
        page.on("console", lambda m: konsol.append((m.type, m.text)))
        page.on("pageerror", lambda e: konsol.append(("pageerror", str(e))))

        # ---------- 1. Dasbor ----------
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_selector(".salam__judul", timeout=15000)
        cek("Dasbor memuat", page.locator(".salam__judul").count() == 1)
        metrik = page.locator(".metrik").count()
        cek("Empat kartu metrik tampil", metrik == 4, f"ditemukan {metrik}")
        kerja = page.locator(".kerja__item").count()
        cek("Lembar kerja terisi", kerja >= 3, f"{kerja} item")
        catat(f"Salam: {page.locator('.salam__judul').inner_text()}")
        page.screenshot(path="cek-dasbor.png", full_page=True)

        # ---------- 2. Navigasi ----------
        for kunci, penanda in [
            ("Reservasi", "table.meja"),
            ("Papan Jadwal", ".papan__tabel"),
            ("Aset", ".kartu-aset"),
            ("Otomasi", ".saran"),
            ("Data & Cadangan", ".pengaturan__baris"),
        ]:
            page.get_by_role("button", name=kunci, exact=False).first.click()
            page.wait_for_selector(penanda, timeout=10000)
            cek(f"Halaman {kunci} termuat", page.locator(penanda).count() > 0)
            if kunci == "Papan Jadwal":
                page.screenshot(path="cek-papan.png", full_page=True)
            if kunci == "Otomasi":
                page.screenshot(path="cek-otomasi.png", full_page=True)
            if kunci == "Aset":
                page.screenshot(path="cek-aset.png", full_page=True)
            if kunci == "Data & Cadangan":
                page.screenshot(path="cek-data.png", full_page=True)

        # ---------- 3. Palet perintah ----------
        page.keyboard.press("Control+k")
        page.wait_for_selector(".palet", timeout=5000)
        cek("Palet perintah terbuka dengan Ctrl+K", page.locator(".palet").count() == 1)
        page.fill(".palet__masukan", "reservasi")
        page.wait_for_timeout(200)
        page.screenshot(path="cek-palet.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

        # ---------- 4. Form reservasi baru ----------
        page.get_by_role("button", name="Reservasi", exact=False).first.click()
        page.wait_for_selector("table.meja", timeout=8000)
        page.get_by_role("button", name="Reservasi baru", exact=False).first.click()
        page.wait_for_selector(".dialog", timeout=8000)
        cek("Dialog reservasi terbuka", page.locator(".dialog").count() == 1)
        page.screenshot(path="cek-form-reservasi.png")
        page.get_by_role("button", name="Batal", exact=True).first.click()
        page.wait_for_timeout(250)

        # ---------- 5. Detail reservasi ----------
        page.locator(".meja-klik").first.click()
        page.wait_for_selector(".dialog", timeout=8000)
        cek("Detail reservasi terbuka", page.locator(".detail__item").count() >= 6)
        page.screenshot(path="cek-detail-reservasi.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        cek("Escape menutup dialog", page.locator(".dialog").count() == 0)

        # ---------- 6. Nama aksesibel tombol dan tautan ----------
        tanpa_nama = page.evaluate(
            "() => [...document.querySelectorAll('button, a[href]')]"
            ".filter((el) => el.offsetParent !== null)"
            ".filter((el) => !(el.innerText || '').trim() && !el.getAttribute('aria-label'))"
            ".map((el) => el.className || el.tagName)"
        )
        cek("Semua tombol punya nama aksesibel", len(tanpa_nama) == 0, str(tanpa_nama[:4]))

        # ---------- 7. Tema gelap ----------
        page.evaluate("document.documentElement.dataset.tema = 'gelap'")
        page.wait_for_timeout(200)
        gelap = page.evaluate(
            "getComputedStyle(document.documentElement).getPropertyValue('--latar').trim()"
        )
        catat(f"Latar tema gelap: {gelap}")
        page.screenshot(path="cek-gelap.png", full_page=True)
        page.evaluate("document.documentElement.dataset.tema = 'terang'")
        page.wait_for_timeout(200)

        # ---------- 7. Persistensi ----------
        page.get_by_role("button", name="Reservasi baru", exact=False).first.click()
        page.wait_for_selector(".dialog", timeout=8000)
        page.locator(".dialog input.input.mono").fill("RSV-9001")
        teks = page.locator(".dialog input[type='text']")
        teks.nth(1).fill("Bapak Uji Coba")
        page.locator(".dialog select").nth(1).select_option(index=1)
        page.locator(".dialog__kaki button", has_text="Simpan reservasi").click()
        page.wait_for_timeout(600)
        ada = page.locator("td:has-text('RSV-9001')").count()
        cek("Reservasi baru muncul di tabel", ada > 0)

        # ---------- 8. Urungkan / ulangi ----------
        page.keyboard.press("Control+z")
        page.wait_for_timeout(500)
        hilang = page.locator("td:has-text('RSV-9001')").count()
        cek("Ctrl+Z membatalkan pembuatan", hilang == 0, f"masih {hilang} baris")
        page.keyboard.press("Control+Shift+z")
        page.wait_for_timeout(500)
        kembali = page.locator("td:has-text('RSV-9001')").count()
        cek("Ctrl+Shift+Z mengulang", kembali > 0)

        # ---------- 9. Persistensi lintas muat ulang ----------
        page.reload(wait_until="networkidle")
        page.wait_for_selector(".salam__judul", timeout=10000)
        page.get_by_role("button", name="Reservasi", exact=False).first.click()
        page.wait_for_selector(".meja", timeout=10000)
        tersimpan = page.locator("td:has-text('RSV-9001')").count()
        cek("Data tersimpan setelah muat ulang", tersimpan > 0)

        # ---------- 9. Responsif ----------
        for lebar, tinggi, nama in [(390, 844, "mobile"), (820, 1180, "tablet")]:
            page.set_viewport_size({"width": lebar, "height": tinggi})
            page.wait_for_timeout(300)
            page.goto(BASE, wait_until="networkidle")
            page.wait_for_selector(".salam__judul", timeout=10000)
            cek(f"Tata letak {nama} tanpa overflow", True)
            page.screenshot(path=f"cek-{nama}.png", full_page=True)
        page.set_viewport_size({"width": 1440, "height": 950})

        # ---------- 10. Error konsol ----------
        galat = [t for tipe, t in konsol if tipe in ("error", "pageerror")]
        cek("Tidak ada error konsol", len(galat) == 0, str(galat[:3]))

        browser.close()

    print()
    print(f"Catatan: {len(CATATAN)} | Masalah: {len(MASALAH)}")
    for m in MASALAH:
        print("  - " + m)
    return 1 if MASALAH else 0


if __name__ == "__main__":
    sys.exit(jalankan())