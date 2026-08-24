import { Card } from '@/components/ui';

/** Shown instead of a crash when the app has not been pointed at a Supabase
 *  project yet, so `npm run dev` is useful on a fresh clone. */
export function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl items-center px-4">
      <Card className="w-full">
        <p className="label-xs">Setup required</p>
        <h1 className="mt-1 text-xl font-bold">Connect a Supabase project</h1>
        <ol className="mt-4 space-y-2 text-sm text-ink-300">
          <li>
            1. Create a project at <span className="text-gold-400">supabase.com</span>.
          </li>
          <li>
            2. Run <code className="rounded bg-ink-800 px-1.5 py-0.5">supabase/migrations/0001_init.sql</code>{' '}
            in the SQL editor.
          </li>
          <li>
            3. Copy <code className="rounded bg-ink-800 px-1.5 py-0.5">.env.example</code> to{' '}
            <code className="rounded bg-ink-800 px-1.5 py-0.5">.env.local</code> and fill in the
            project URL and anon key.
          </li>
          <li>4. Restart the dev server.</li>
        </ol>
        <p className="mt-4 text-xs text-ink-400">
          Full instructions are in <code>README.md</code>.
        </p>
      </Card>
    </div>
  );
}
