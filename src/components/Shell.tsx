import Link from 'next/link';
import { signOut } from '@/lib/actions';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/dashboard', label: 'Today', icon: '⭐' },
  { href: '/chat', label: 'Chat', icon: '💬' },
  { href: '/calendar', label: 'Calendar', icon: '📅' },
  { href: '/report', label: 'Report', icon: '📈' },
  { href: '/pillars', label: 'Pillars', icon: '🏛️' },
  { href: '/badges', label: 'Badges', icon: '🏅' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

/**
 * Seven destinations do not fit in a phone-width header — the row was 511px
 * wide in a 264px viewport and pushed the whole page into horizontal scroll.
 * So navigation splits: inline in the header on desktop, a fixed bottom tab bar
 * on mobile, which is where a thumb expects it anyway.
 */
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
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2 font-bold tracking-tight transition-opacity hover:opacity-80"
          >
            <span className="text-gold-400">★</span>
            <span>5 Star</span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm transition-colors',
                  active === l.href
                    ? 'bg-ink-800 font-medium text-ink-50'
                    : 'text-ink-300 hover:bg-ink-800/60 hover:text-ink-50',
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <form action={signOut} className="shrink-0">
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      {/* pb-24 on mobile clears the fixed tab bar. */}
      <main className="mx-auto max-w-5xl px-4 py-6 pb-28 md:pb-20">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-ink-950/95 backdrop-blur-xl md:hidden">
        <div className="flex items-stretch justify-between px-1">
          {LINKS.map((l) => {
            const on = active === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? 'page' : undefined}
                // min-w-0 is load-bearing: without it `flex-1` still refuses to
                // shrink past the label's min-content width, and seven tabs push
                // the whole page into horizontal scroll on a narrow phone.
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2 transition-colors',
                  on ? 'text-gold-400' : 'text-ink-400',
                )}
              >
                <span className={cn('text-base leading-none', on && 'animate-pop')}>
                  {l.icon}
                </span>
                <span className="w-full truncate text-center text-[9px] leading-none">
                  {l.label}
                </span>
                <span
                  className={cn(
                    'mt-0.5 h-0.5 w-5 rounded-full transition-colors',
                    on ? 'bg-gold-400' : 'bg-transparent',
                  )}
                />
              </Link>
            );
          })}
        </div>
      </nav>
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
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
