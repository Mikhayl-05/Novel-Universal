# Panduan Konfigurasi Supabase — Ruang Karya (Novel, Cerpen, Notes & Studio)

## 1. Environment Variables
Salin `.env.example` menjadi `.env` di root project (atau atur di Environment Variables platform hosting Anda):
```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```
> **Keamanan**: Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY` ke variabel `VITE_*` atau kode frontend.

## 2. Jalankan SQL Setup di Supabase Dashboard
Buka **Supabase Dashboard → SQL Editor → New query**, lalu tempel dan jalankan seluruh isi file **`supabase/setup_all.sql`** (atau jalankan ketiga file di `supabase/migrations/` secara berurutan `000001` → `000002` → `000003`).

Script ini otomatis membuat:
- Tabel `admin_users`, `novels` (mendukung `work_type`: `'novel' | 'cerpen' | 'notes'`), `chapters`, `chapter_publications`, `chapter_revisions`, `chapter_assets`.
- Kolom `draft_bgm_url`, `published_bgm_url`, dan `bgm_url` untuk audio BGM unggahan kustom.
- Kebijakan keamanan **Row Level Security (RLS)** ketat agar draft hanya bisa diakses administrator, sementara pembaca publik hanya dapat membaca karya dan bab yang sudah terbit.
- Fungsi RPC `public.publish_chapter(uuid)` untuk menerbitkan bab.
- Bucket penyimpanan publik **`novel-assets`** beserta policy upload khusus admin.

## 3. Pengaturan Supabase Authentication & Akun Admin
1. Buka **Authentication → Providers → Email** dan pastikan **Email** provider aktif.
2. Buka **Authentication → Sign In / Up** dan **NONAKTIFKAN** *Allow new users to sign up* agar pengunjung publik tidak dapat mendaftar akun.
3. Buka **Authentication → Users → Add user → Create new user**, masukkan **Email** & **Password** administrator Anda (centang *Auto Confirm User*).
4. Daftarkan user tersebut sebagai administrator aktif lewat **SQL Editor** (ganti `<EMAIL_ADMIN>` dengan email yang baru saja Anda buat):
```sql
INSERT INTO public.admin_users (user_id, email, display_name, role, is_active)
SELECT id, email, 'Penulis Utama', 'super_admin', true
FROM auth.users
WHERE email = '<EMAIL_ADMIN>'
ON CONFLICT (user_id) DO UPDATE
SET is_active = true, role = 'super_admin', email = EXCLUDED.email;
```

## 4. Akses Studio Editor (Tersembunyi dari Publik)
Rute Studio Editor sengaja tidak ditampilkan di halaman publik mana pun.
- Buka alamat `https://<domain-anda>/editor` langsung di bilah alamat browser.
- Masuk dengan email dan password administrator yang telah terdaftar di `admin_users`.
- Mulai buat karya baru (**Novel**, **Cerpen**, atau **Notes**), unggah sampul & file musik BGM, lalu terbitkan agar muncul di Beranda (`/`).
