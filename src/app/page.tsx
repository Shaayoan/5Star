import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PILLAR_TEMPLATES } from '@/lib/catalog';
import { getOptionalUser } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { Button, Card } from '@/components/ui';
import { SetupNotice } from '@/components/SetupNotice';
import { LifeTree } from '@/components/LifeTree';

const FEATURES = [
  {
    icon: '🎯',
    title: 'Your five, not ours',
    body: 'Choose five pillars from a bank of ten, rename them, and write your own definition of what a good day looks like.',
  },
  {
    icon: '⭐',
    title: 'A thirty-second check-in',
    body: 'Rate each pillar one to five stars, tap the micro-actions you actually did, add a note if it mattered.',
  },
  {
    icon: '📊',
    title: 'A weekly verdict',
    body: 'Radar chart, balance score, best and hardest day, and a plain-English write-up of what moved.',
  },
  {
    icon: '🔥',
    title: 'Streaks that forgive',
    body: 'Earn freezes for consistency so one bad Tuesday does not erase a month of work.',
  },
  {
    icon: '🧭',
    title: 'Quests on your weak spot',
    body: 'Every Monday the app picks the pillar you neglected and sets a target you can actually hit.',
  },
  {
    icon: '🌳',
    title: 'A tree that tells the truth',
    body: 'Each pillar is a branch. Neglect one and the branch goes bare — no dashboard-reading required.',
  },
];

const DEMO_BRANCHES = PILLAR_TEMPLATES.slice(0, 5).map((t, i) => ({
  id: t.key,
  name: t.name,
  icon: t.icon,
  color: t.color,
  mean: [4.6, 3.8, 2.1, 4.9, 0][i],
  streak: [12, 5, 1, 21, 0][i],
}));

export default async function LandingPage() {
  if (!isSupabaseConfigured) return <SetupNotice />;

  const { user } = await getOptionalUser();
  if (user) redirect('/dashboard');

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold">
          <span className="text-gold-400">★</span> 5 Star
        </span>
        <Link href="/login">
          <Button size="sm" variant="secondary">
            Sign in
          </Button>
        </Link>
      </header>

      <section className="mt-14 grid items-center gap-10 md:grid-cols-2">
        <div>
          <p className="label-xs">Five pillars · one life</p>
          <h1 className="mt-2 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Become a{' '}
            <span className="bg-gradient-to-r from-gold-400 to-amber-200 bg-clip-text text-transparent">
              five star
            </span>{' '}
            human being.
          </h1>
          <p className="mt-4 max-w-md text-ink-300">
            Most self-improvement apps optimise one thing until the rest of your life quietly
            rots. 5 Star scores all five of your pillars — and tells you every Sunday which one
            you have been lying to yourself about.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/login">
              <Button size="lg">Start your first season</Button>
            </Link>
            <Link href="#how">
              <Button size="lg" variant="secondary">
                How it works
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-ink-400">
            Free, private, and yours — your logs never leave your own database.
          </p>
        </div>

        <Card className="p-2">
          <LifeTree branches={DEMO_BRANCHES} vitality={0.62} className="w-full" />
          <p className="pb-2 text-center text-xs text-ink-400">
            A real week: four pillars thriving, one going bare.
          </p>
        </Card>
      </section>

      <section id="how" className="mt-20">
        <h2 className="text-2xl font-bold tracking-tight">What you get</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="card-hover">
              <span className="text-2xl">{f.icon}</span>
              <h3 className="mt-2 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-ink-300">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <h2 className="text-2xl font-bold tracking-tight">Pick any five</h2>
        <p className="mt-1 text-sm text-ink-400">
          Ten to choose from, all fully editable — or write your own.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {PILLAR_TEMPLATES.map((t) => (
            <span
              key={t.key}
              className="card flex items-center gap-2 px-3 py-2 text-sm"
              style={{ borderColor: `${t.color}55` }}
            >
              <span>{t.icon}</span>
              <span className="font-medium">{t.name}</span>
              <span className="text-xs text-ink-400">{t.tagline}</span>
            </span>
          ))}
        </div>
      </section>

      <footer className="mt-24 border-t border-[var(--border)] pt-6 text-xs text-ink-400">
        5 Star — built to be honest with you once a week.
      </footer>
    </div>
  );
}
