import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Lock,
  LogOut,
  Moon,
  ShieldAlert,
  Sun,
} from 'lucide-react';
import type { StudioAuthStatus } from '../hooks/useStudioAuth';

interface AdminLoginViewProps {
  status: StudioAuthStatus;
  error: string | null;
  sessionExpiredNotice: boolean;
  submitting: boolean;
  userEmail?: string | null;
  studioTheme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSignIn: (email: string, password: string) => Promise<boolean>;
  onSignOut: () => Promise<void>;
}

export function AdminLoginView({
  status,
  error,
  sessionExpiredNotice,
  submitting,
  userEmail,
  studioTheme,
  onToggleTheme,
  onSignIn,
  onSignOut,
}: AdminLoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSignIn(email, password);
  };

  return (
    <div
      className={`studio-auth-shell studio-allow-select studio-theme-${studioTheme}`}
    >
      <div className="studio-auth-topbar">
        <Link to="/" className="studio-auth-back-link">
          <ArrowLeft size={15} />
          <span>Kembali ke Beranda</span>
        </Link>

        <button
          type="button"
          className="studio-auth-theme-btn"
          onClick={onToggleTheme}
          title={
            studioTheme === 'dark'
              ? 'Beralih ke Mode Terang'
              : 'Beralih ke Mode Gelap'
          }
          aria-label={
            studioTheme === 'dark'
              ? 'Beralih ke Mode Terang'
              : 'Beralih ke Mode Gelap'
          }
        >
          {studioTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          <span>{studioTheme === 'dark' ? 'Terang' : 'Gelap'}</span>
        </button>
      </div>

      <main className="studio-auth-card" aria-labelledby="studio-login-title">
        <div className="studio-auth-brand">
          <div className="studio-auth-logo" aria-hidden="true">
            <span>✦</span>
          </div>
          <div>
            <p className="studio-auth-eyebrow">Ruang Karya</p>
            <h1 id="studio-login-title" className="studio-auth-title">
              Studio Editor
            </h1>
          </div>
        </div>

        <p className="studio-auth-desc">
          Ruang penyuntingan Novel, Cerpen, dan Notes khusus administrator.
          Pendaftaran akun publik dinonaktifkan.
        </p>

        {status === 'loading' && (
          <div className="studio-auth-notice info" role="status">
            Memeriksa sesi autentikasi administrator…
          </div>
        )}

        {status === 'unconfigured' && (
          <div className="studio-auth-notice warn" role="alert">
            <AlertCircle size={16} />
            <div>
              <strong>Supabase belum dikonfigurasi.</strong>
              <p>
                Tambahkan <code>VITE_SUPABASE_URL</code> dan{' '}
                <code>VITE_SUPABASE_ANON_KEY</code> pada environment aplikasi
                serta jalankan migrasi SQL di <code>supabase/migrations/</code>{' '}
                untuk mengaktifkan login administrator.
              </p>
            </div>
          </div>
        )}

        {sessionExpiredNotice && (
          <div className="studio-auth-notice warn" role="status">
            <AlertCircle size={16} />
            <span>
              Sesi Anda telah berakhir. Silakan masuk kembali untuk melanjutkan
              penyuntingan.
            </span>
          </div>
        )}

        {error && (
          <div className="studio-auth-notice error" role="alert">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {status === 'unauthorized' ? (
          <div className="studio-auth-unauthorized">
            <p>
              Akun <strong>{userEmail || 'saat ini'}</strong> tidak terdaftar pada
              tabel otorisasi <code>admin_users</code>.
            </p>
            <button
              type="button"
              className="studio-btn studio-btn-secondary"
              onClick={() => void onSignOut()}
            >
              <LogOut size={15} />
              <span>Keluar &amp; Ganti Akun</span>
            </button>
          </div>
        ) : (
          <form className="studio-auth-form" onSubmit={(e) => void handleSubmit(e)}>
            <div className="studio-field">
              <label htmlFor="studio-admin-email">Email Administrator</label>
              <input
                id="studio-admin-email"
                type="email"
                autoComplete="username"
                required
                disabled={status === 'unconfigured' || status === 'loading' || submitting}
                placeholder="admin@domain-anda.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="studio-field">
              <label htmlFor="studio-admin-password">Password</label>
              <input
                id="studio-admin-password"
                type="password"
                autoComplete="current-password"
                required
                disabled={status === 'unconfigured' || status === 'loading' || submitting}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="studio-btn studio-btn-primary studio-auth-submit"
              disabled={status === 'unconfigured' || status === 'loading' || submitting}
            >
              <Lock size={15} />
              <span>{submitting ? 'Memverifikasi…' : 'Masuk ke Studio Editor'}</span>
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
