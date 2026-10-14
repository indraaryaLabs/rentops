# RentOps — FastTrack MVP PRD

## 1. Product brief
- **Product:** RentOps
- **Positioning:** Jadwal rental dan ketersediaan aset tanpa double-booking.
- **Audience:** Small Indonesian businesses; use realistic Indonesian sample data and Bahasa Indonesia UI.
- **Purpose:** Demo pengelolaan rental kendaraan/peralatan kecil untuk menata aset, reservasi, pengambilan, dan pengembalian.
- **Portfolio goal:** demonstrate a working business workflow, polished UI, reliable calculations, validation, and maintainable frontend code.
- **Reference products:** Booqable rental workflow, inventory availability, orders, pickup/return: https://booqable.com/features/ ; https://booqable.com/inventory-management/

## 2. MVP features — must implement
- Dashboard: reservasi aktif, aset tersedia, akan diambil hari ini, terlambat kembali.
- CRUD aset dengan nama, kategori, kode, jumlah tersedia, harga per hari, dan status pemeliharaan.
- CRUD reservasi dengan pelanggan, item, jumlah, tanggal mulai/selesai, estimasi harga, DP, dan status.
- Tampilan tabel reservasi dengan pencarian, filter status, dan pilihan rentang tanggal.
- Validasi tanggal dan kuantitas; cegah jumlah reservasi melampaui stok pada rentang waktu yang tumpang tindih.
- Workflow: Permintaan, Dipesan, Dipinjam, Dikembalikan, Dibatalkan; aksi jelas dan konfirmasi untuk pembatalan.
- localStorage, seeded demo data, ekspor/impor JSON, Reset Demo dengan konfirmasi.

## 3. Business rules and edge cases
- Overlap tanggal memakai rentang inklusif: startA <= endB dan endA >= startB; booking batal tidak menghitung kapasitas.
- Jika aset sedang maintenance, aset tidak bisa dipesan selama status maintenance; pastikan aturan dijelaskan di UI.
- Harga estimasi dihitung dari jumlah × harga per hari × jumlah hari sewa, dengan minimum 1 hari sesuai tanggal yang dipilih.


## 4. UX/UI requirements
Follow `../../shared/DESIGN_SYSTEM.md`. Use a cohesive, premium SaaS workspace; a distinct app identity; responsive layout; consistent sidebar/top bar; good typography; thoughtful spacing; real loading-free local state; meaningful empty states; accessible forms; and natural Bahasa Indonesia throughout. Make the first view impressive with seeded data but ensure all metrics and tables derive from actual application state.

## 5. Technical constraints
- Standalone frontend app in this folder. Use **Vite + React + TypeScript**.
- Keep dependencies small and stable. Use `lucide-react` for icons. Use plain CSS/CSS modules or the lightest reliable styling setup already present. Do not spend time configuring a complex monorepo or design system package.
- No paid services, no API keys, no mandatory server, no login requirement, no paid fonts/images, no runtime dependency on external URLs.
- Persist demo data using versioned `localStorage`; initialize with realistic seed data on first run. Add a reset-to-demo control with confirmation. Provide export/import backup where specified.
- Currency in IDR; display dates in Indonesian locale (`id-ID`). Store numeric money values as integers in rupiah where appropriate.
- Treat imported JSON as untrusted: validate its basic schema before replacing local data; failed import must not destroy current data.
- Avoid `any` unless there is a documented reason. Extract business calculations into pure, testable functions.
- No remote messaging/payment automation. If a share action exists, use clipboard or `wa.me` link only, and never claim a message was sent automatically.

## 6. Out of scope — do not build
- Authentication, multi-user permissions, backend/API, cloud sync, payments, email/SMS/WhatsApp APIs, AI features, multi-tenant SaaS, mobile native apps, elaborate charts, or features not listed in this PRD.
- Do not add features merely to make the app appear bigger. Finish and test this MVP first.

## 7. Definition of done
- All must-have features in this PRD work end-to-end.
- UI is in Bahasa Indonesia; no lorem ipsum, broken links, dead buttons, fake chart values, or console errors from normal use.
- Data survives reload and the reset-demo flow works.
- Forms validate edge cases; important destructive actions require confirmation.
- `npm run build` succeeds; run lint/typecheck/tests if configured and fix findings. Include at least focused tests for key business rules.
- `README.md` includes install/run/build/test commands, features, architecture notes, demo limitations, and how to reset demo data.
- Include a final report distinguishing tests actually run from checks not performed. Never claim “zero bugs”; list known limitations honestly.

## 8. Scope boundary
MVP local-only untuk satu operator. Tidak ada payment gateway, login, live sync, atau booking publik.
