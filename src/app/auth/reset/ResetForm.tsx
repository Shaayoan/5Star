'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    // The recovery link already exchanged itself for a session in the callback,
    // so this is an ordinary authenticated password change.
    const { error: err } = await createClient().auth.updateUser({ password });
    setBusy(false);

    if (err) {
      setError(err.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  };

  const field =
    'w-full rounded-lg border border-[var(--border)] bg-ink-900/70 px-3 py-2.5 text-sm outline-none focus:border-gold-500/60';

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="New password (8+ characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={field}
      />
      <input
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className={field}
      />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Set new password'}
      </Button>
      {error && (
        <p className={cn('rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300')}>{error}</p>
      )}
    </form>
  );
}
