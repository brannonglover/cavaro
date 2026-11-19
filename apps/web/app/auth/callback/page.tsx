'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSupabaseBrowser, parseAuthParams } from '@/lib/supabase-browser';

type View = 'loading' | 'recovery' | 'done' | 'error';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const { access_token, refresh_token, type, error } = parseAuthParams(window.location);

    if (error) {
      setMessage(error);
      setView('error');
      return;
    }

    if (!supabase) {
      setMessage('Auth is not configured. Contact support if this persists.');
      setView('error');
      return;
    }

    if (!access_token) {
      setMessage('This link is invalid or has expired. Request a new reset email from the Cavaro app.');
      setView('error');
      return;
    }

    supabase.auth
      .setSession({
        access_token,
        refresh_token: refresh_token || '',
      })
      .then(({ error: sessionError }) => {
        if (sessionError) {
          setMessage(sessionError.message);
          setView('error');
          return;
        }

        if (type === 'recovery') {
          setView('recovery');
          return;
        }

        router.replace('/success');
      });
  }, [router]);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');

    if (password.length < 6) {
      setMessage('Use at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setMessage('Auth is not configured.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.auth.signOut();
    setView('done');
  }

  if (view === 'loading') {
    return (
      <main className="min-h-screen px-6 py-16">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-humidor-muted">Confirming your link…</p>
        </div>
      </main>
    );
  }

  if (view === 'error') {
    return (
      <main className="min-h-screen px-6 py-16">
        <div className="mx-auto max-w-xl">
          <div className="rounded-xl border-2 border-humidor-border bg-humidor-card p-8 text-center">
            <h1 className="font-sans text-2xl font-semibold text-humidor-cream">
              Link not valid
            </h1>
            <p className="mt-3 text-humidor-muted">{message}</p>
            <Link
              href="/#download"
              className="mt-8 inline-block rounded-xl bg-humidor-primary px-8 py-3 font-semibold text-humidor-bg transition-colors hover:bg-humidor-primary-light"
            >
              Open Cavaro app
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (view === 'done') {
    return (
      <main className="min-h-screen px-6 py-16">
        <div className="mx-auto max-w-xl">
          <div className="rounded-xl border-2 border-humidor-border bg-humidor-card p-8 text-center">
            <h1 className="font-sans text-2xl font-semibold text-humidor-cream">
              Password updated
            </h1>
            <p className="mt-3 text-humidor-muted">
              Your new password is ready. Open the Cavaro app and sign in with your email and new password.
            </p>
            <Link
              href="/#download"
              className="mt-8 inline-block rounded-xl bg-humidor-primary px-8 py-3 font-semibold text-humidor-bg transition-colors hover:bg-humidor-primary-light"
            >
              Download the app
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-xl">
        <div className="rounded-xl border-2 border-humidor-border bg-humidor-card p-8">
          <h1 className="font-sans text-2xl font-semibold text-humidor-cream">
            Set a new password
          </h1>
          <p className="mt-2 text-humidor-muted">
            Choose a new password for your Cavaro account.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleReset}>
            <div>
              <label htmlFor="password" className="sr-only">
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl border border-humidor-border bg-humidor-bg px-4 py-3 text-humidor-cream placeholder:text-humidor-muted focus:border-humidor-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="sr-only">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl border border-humidor-border bg-humidor-bg px-4 py-3 text-humidor-cream placeholder:text-humidor-muted focus:border-humidor-primary focus:outline-none"
              />
            </div>

            {message ? (
              <p className="text-sm text-red-400" role="alert">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-humidor-primary py-3 font-semibold text-humidor-bg transition-colors hover:bg-humidor-primary-light disabled:opacity-70"
            >
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </form>

          <p className="mt-6 text-center">
            <Link href="/" className="text-humidor-primary hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
