'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { browserTimezone } from '@/lib/timezone';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

type Mode = 'signin' | 'signup' | 'magic' | 'forgot';

const TITLES: Record<Mode, string> = {
  signin: 'Sign in',
  signup: 'Create account',
  magic: 'Send magic link',
  forgot: 'Send reset link',
};

/** Supabase error strings are terse and occasionally alarming; these are the
 *  ones a normal person will actually hit. */
function humanise(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password do not match.';
  if (m.includes('email not confirmed')) return 'Confirm your email first — check your inbox.';
  if (m.includes('user already registered')) return 'That email already has an account. Sign in instead.';
  if (m.includes('password should be')) return 'Password must be at least 8 characters.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('failed to fetch')) return 'Cannot reach the server. Check your connection.';
  return message;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';

  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<{ kind: 'error' | 'info'; text: string } | null>(() => {
    // Errors bounced here by the email-link callback.
    const bounced = params.get('error');
    return bounced ? { kind: 'error', text: humanise(bounced) } : null;
  });
  const [busy, setBusy] = useState(false);

  const go = (m: Mode) => {
    setMode(m);
    setStatus(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const supabase = createClient();

    try {
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            data: { timezone: browserTimezone() },
          },
        });
        if (error) throw error;
        setStatus({ kind: 'info', text: 'Check your inbox for the sign-in link.' });
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/callback?next=/auth/reset`,
        });
        if (error) throw error;
        setStatus({ kind: 'info', text: 'If that email has an account, a reset link is on its way.' });
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // Read back by the profiles trigger, so the display name survives
            // even if the client never reaches the dashboard.
            data: { full_name: name.trim() || email.split('@')[0], timezone: browserTimezone() },
            emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push(next);
          router.refresh();
        } else {
          setStatus({
            kind: 'info',
            text: 'Account created. Confirm your email, then come back and sign in.',
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setStatus({
        kind: 'error',
        text: humanise(err instanceof Error ? err.message : 'Something went wrong'),
      });
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-lg border border-[var(--border)] bg-ink-900/70 px-3 py-2.5 text-sm outline-none placeholder:text-ink-400 focus:border-gold-500/60';

  const needsPassword = mode === 'signin' || mode === 'signup';

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="mb-4 flex gap-1 rounded-lg bg-ink-800 p-1">
        {(
          [
            ['signin', 'Sign in'],
            ['signup', 'Sign up'],
            ['magic', 'Magic link'],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => go(m)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mode === m || (mode === 'forgot' && m === 'signin')
                ? 'bg-ink-600 text-ink-50'
                : 'text-ink-300 hover:text-ink-50',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'forgot' && (
        <p className="rounded-lg bg-ink-800/60 px-3 py-2 text-xs text-ink-300">
          Enter your email and we will send a link to set a new password.
        </p>
      )}

      {mode === 'signup' && (
        <input
          type="text"
          autoComplete="name"
          maxLength={60}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
        />
      )}

      <input
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={field}
      />

      {needsPassword && (
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          placeholder="Password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
        />
      )}

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? 'Working…' : TITLES[mode]}
      </Button>

      {mode === 'signin' && (
        <button
          type="button"
          onClick={() => go('forgot')}
          className="w-full text-center text-xs text-ink-400 hover:text-ink-200"
        >
          Forgot your password?
        </button>
      )}

      {mode === 'forgot' && (
        <button
          type="button"
          onClick={() => go('signin')}
          className="w-full text-center text-xs text-ink-400 hover:text-ink-200"
        >
          ← Back to sign in
        </button>
      )}

      {status && (
        <p
          className={cn(
            'rounded-lg px-3 py-2 text-xs',
            status.kind === 'error'
              ? 'bg-rose-500/10 text-rose-300'
              : 'bg-emerald-500/10 text-emerald-300',
          )}
        >
          {status.text}
        </p>
      )}
    </form>
  );
}
