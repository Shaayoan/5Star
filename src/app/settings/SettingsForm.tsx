'use client';

import { useState, useTransition } from 'react';
import { updateProfile } from '@/lib/actions';
import { createClient } from '@/lib/supabase/client';
import { browserTimezone, timezoneOptions } from '@/lib/timezone';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export function SettingsForm({
  displayName,
  timezone,
}: {
  displayName: string | null;
  timezone: string;
}) {
  const [name, setName] = useState(displayName ?? '');
  const [tz, setTz] = useState(timezone);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const dirty = name !== (displayName ?? '') || tz !== timezone;
  const detected = browserTimezone();

  const save = () =>
    startTransition(async () => {
      setStatus(null);
      try {
        await updateProfile({ display_name: name, timezone: tz });
        setStatus({ kind: 'info', text: 'Saved.' });
      } catch (e) {
        setStatus({
          kind: 'error',
          text: e instanceof Error ? e.message : 'Could not save your changes',
        });
      }
    });

  const field =
    'w-full rounded-lg border border-[var(--border)] bg-ink-900/70 px-3 py-2.5 text-sm outline-none focus:border-gold-500/60';

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="display-name" className="label-xs">
          Display name
        </label>
        <input
          id="display-name"
          value={name}
          maxLength={60}
          placeholder="What should the app call you?"
          onChange={(e) => setName(e.target.value)}
          className={cn(field, 'mt-1')}
        />
      </div>

      <div>
        <label htmlFor="timezone" className="label-xs">
          Timezone
        </label>
        <select
          id="timezone"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          className={cn(field, 'mt-1')}
        >
          {timezoneOptions(timezone).map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-400">
          Decides when your day rolls over.
          {detected !== tz && (
            <>
              {' '}
              This browser reports <span className="text-ink-200">{detected}</span>.{' '}
              <button
                type="button"
                onClick={() => setTz(detected)}
                className="text-gold-400 hover:underline"
              >
                Use it
              </button>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!dirty || pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        {status && (
          <span
            className={cn(
              'text-xs',
              status.kind === 'error' ? 'text-rose-300' : 'text-emerald-300',
            )}
          >
            {status.text}
          </span>
        )}
      </div>
    </div>
  );
}

/** Password change for accounts that signed up with one. Supabase requires an
 *  active session, which the settings page already guarantees. */
export function PasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (password !== confirm) {
      setStatus({ kind: 'error', text: 'The two passwords do not match.' });
      return;
    }

    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setStatus({ kind: 'error', text: error.message });
      return;
    }
    setPassword('');
    setConfirm('');
    setStatus({ kind: 'info', text: 'Password updated.' });
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
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={busy || !password}>
          {busy ? 'Updating…' : 'Update password'}
        </Button>
        {status && (
          <span
            className={cn(
              'text-xs',
              status.kind === 'error' ? 'text-rose-300' : 'text-emerald-300',
            )}
          >
            {status.text}
          </span>
        )}
      </div>
    </form>
  );
}
