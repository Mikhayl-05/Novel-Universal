import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { verifyAdminAccess } from '../services/studioRepository';
import { getSupabaseClient, isSupabaseConfigured } from '../services/supabaseClient';
import type { AdminProfile } from '../types/studio';

export type StudioAuthStatus =
  | 'loading'
  | 'unconfigured'
  | 'unauthenticated'
  | 'unauthorized'
  | 'authenticated';

export interface UseStudioAuthResult {
  status: StudioAuthStatus;
  user: User | null;
  adminProfile: AdminProfile | null;
  error: string | null;
  sessionExpiredNotice: boolean;
  submitting: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export function useStudioAuth(): UseStudioAuthResult {
  const [status, setStatus] = useState<StudioAuthStatus>(() =>
    isSupabaseConfigured ? 'loading' : 'unconfigured',
  );
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const wasAuthenticatedRef = useRef(false);
  const manualSignOutRef = useRef(false);

  const evaluateUser = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      if (wasAuthenticatedRef.current && !manualSignOutRef.current) {
        setSessionExpiredNotice(true);
      }
      wasAuthenticatedRef.current = false;
      manualSignOutRef.current = false;
      setUser(null);
      setAdminProfile(null);
      setStatus('unauthenticated');
      return;
    }

    try {
      const profile = await verifyAdminAccess(nextUser.id);
      if (!profile || !profile.isActive) {
        wasAuthenticatedRef.current = false;
        setUser(nextUser);
        setAdminProfile(null);
        setStatus('unauthorized');
        setError(
          'Akun ini tidak terdaftar di allowlist administrator aktif (admin_users).',
        );
        return;
      }

      wasAuthenticatedRef.current = true;
      setSessionExpiredNotice(false);
      setUser(nextUser);
      setAdminProfile(profile);
      setError(null);
      setStatus('authenticated');
    } catch (err) {
      wasAuthenticatedRef.current = false;
      setUser(null);
      setAdminProfile(null);
      setStatus('unauthenticated');
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal memverifikasi otorisasi admin.',
      );
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus('unconfigured');
      return;
    }

    let mounted = true;
    void supabase.auth.getSession().then(({ data, error: sessError }) => {
      if (!mounted) return;
      if (sessError) {
        setError(sessError.message);
        setStatus('unauthenticated');
        return;
      }
      void evaluateUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        void evaluateUser(null);
        return;
      }
      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED' ||
        event === 'INITIAL_SESSION'
      ) {
        void evaluateUser(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [evaluateUser]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('Supabase belum dikonfigurasi pada environment.');
        return false;
      }

      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        setError('Email dan password wajib diisi.');
        return false;
      }

      setSubmitting(true);
      setError(null);
      setSessionExpiredNotice(false);
      manualSignOutRef.current = false;

      try {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (signInErr) {
          setError(
            signInErr.message === 'Invalid login credentials'
              ? 'Email atau password administrator tidak valid.'
              : signInErr.message,
          );
          return false;
        }

        if (!data.user) {
          setError('Gagal memperoleh sesi pengguna.');
          return false;
        }

        const profile = await verifyAdminAccess(data.user.id);
        if (!profile || !profile.isActive) {
          await supabase.auth.signOut();
          setStatus('unauthorized');
          setError(
            'Akses ditolak: akun ini tidak memiliki izin administrator di Novel Studio.',
          );
          return false;
        }

        wasAuthenticatedRef.current = true;
        setUser(data.user);
        setAdminProfile(profile);
        setStatus('authenticated');
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Terjadi kesalahan saat masuk.',
        );
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    manualSignOutRef.current = true;
    wasAuthenticatedRef.current = false;
    setSessionExpiredNotice(false);
    setError(null);
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setAdminProfile(null);
    setStatus(isSupabaseConfigured ? 'unauthenticated' : 'unconfigured');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    status,
    user,
    adminProfile,
    error,
    sessionExpiredNotice,
    submitting,
    signIn,
    signOut,
    clearError,
  };
}
