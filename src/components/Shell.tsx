import Link from 'next/link';
import { signOut } from '@/lib/actions';
import { Button } from '@/components/ui';

const LINKS = [
  { href: '/dashboard', label: 'Today' },
  { href: '/chat', label: 'Chat' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/report', label: 'Report' },
  { href: '/pillars', label: 'Pillars' },
  { href: '/badges', label: 'Badges' },
  { href: '/settings', label: 'Settings' },
];

export function Shell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: string;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="text-gold-400">★</span>
            <span>5 Star</span>
          </Link>

          <nav className="flex items-center gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={
                  active === l.href
                    ? 'rounded-lg bg-ink-800 px-3 py-1.5 text-sm font-medium text-ink-50'
                    : 'rounded-lg px-3 py-1.5 text-sm text-ink-300 transition-colors hover:bg-ink-800/60 hover:text-ink-50'
                }
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-20">{children}</main>
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
