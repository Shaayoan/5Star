import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { formatDate, today as todayIso } from '@/lib/dates';
import { getActionLogDates, getActivePillars, getEntries } from '@/lib/queries';
import { getChattablePillars, loadChatSession, transcriptOf } from '@/lib/ai/context';
import { isAiConfigured } from '@/lib/ai/config';
import { Card, CardDescription, CardTitle, EmptyState } from '@/components/ui';
import { PageTitle, Shell } from '@/components/Shell';
import { ChatBox } from './ChatBox';

export default async function ChatPage() {
  const { db, user } = await requireUser();
  const date = todayIso();

  const all = await getActivePillars(db, user.id);
  if (all.length === 0) redirect('/onboarding');

  const [pillars, entries, completed, history] = await Promise.all([
    getChattablePillars(db, user.id),
    getEntries(db, user.id, date, date),
    getActionLogDates(db, user.id, date),
    loadChatSession(db, user.id, date),
  ]);

  const todayRatings = entries[0]?.ratings ?? {};

  return (
    <Shell active="/chat">
      <PageTitle
        title="Talk it through"
        subtitle={`Describe your day and it fills in the ratings — ${formatDate(date, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}`}
        action={
          <Link href="/dashboard" className="text-sm text-gold-400 hover:underline">
            {'Rate by hand instead →'}
          </Link>
        }
      />

      {!isAiConfigured ? (
        <Card>
          <CardTitle>The chat needs an API key</CardTitle>
          <CardDescription>
            Everything else in 5 Star works without it — this page is the only part that
            calls a model.
          </CardDescription>
          <ol className="mt-4 space-y-2 text-sm text-ink-300">
            <li>
              1. Create a key at{' '}
              <span className="text-gold-400">aistudio.google.com/apikey</span>.
            </li>
            <li>
              2. Add <code className="rounded bg-ink-800 px-1.5 py-0.5">GEMINI_API_KEY</code>{' '}
              to <code className="rounded bg-ink-800 px-1.5 py-0.5">.env.local</code>, and to
              the Vercel project for production.
            </li>
            <li>3. Restart the dev server, or redeploy.</li>
          </ol>
          <p className="mt-4 text-xs text-ink-400">
            The key stays server-side — it is never sent to the browser.
          </p>
        </Card>
      ) : pillars.length === 0 ? (
        <Card>
          <EmptyState icon="🔒" title="Every pillar is opted out of chat">
            You have switched all of your pillars off for the chat. Turn at least one back on
            from the Pillars page to use this.
          </EmptyState>
        </Card>
      ) : (
        <ChatBox
          date={date}
          pillars={pillars.map((p) => ({
            id: p.id,
            name: p.name,
            icon: p.icon,
            color: p.color,
            definition: p.definition,
          }))}
          excludedCount={all.length - pillars.length}
          todayRatings={todayRatings}
          completedActionIds={[...completed]}
          history={transcriptOf(history)}
        />
      )}
    </Shell>
  );
}
