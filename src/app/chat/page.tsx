import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { userToday } from '@/lib/userDate';
import { addDays, formatDate } from '@/lib/dates';
import { getActionLogDates, getActivePillars, getEntries } from '@/lib/queries';
import { getChattablePillars, loadChatSession, transcriptOf } from '@/lib/ai/context';
import { isAiConfigured } from '@/lib/ai/config';
import { Card, CardDescription, CardTitle, EmptyState } from '@/components/ui';
import { PageTitle, Shell } from '@/components/Shell';
import { ChatBox } from './ChatBox';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { db, user } = await requireUser();
  const params = await searchParams;
  const today = await userToday(db, user.id);

  // `?d=` lets the calendar hand a specific day straight to the chat.
  const requested = params.d;
  const date =
    requested && ISO_DATE.test(requested) && requested <= today && requested >= addDays(today, -364)
      ? requested
      : today;

  const all = await getActivePillars(db, user.id);
  if (all.length === 0) redirect('/onboarding');

  const [pillars, entries, completed, history] = await Promise.all([
    getChattablePillars(db, user.id),
    getEntries(db, user.id, date, date),
    getActionLogDates(db, user.id, date),
    loadChatSession(db, user.id, date),
  ]);

  const ratings = entries[0]?.ratings ?? {};

  return (
    <Shell active="/chat">
      <PageTitle
        title="Talk it through"
        subtitle="Describe a day and it fills in the ratings. Mention any date and it will switch."
        action={
          <Link
            href="/calendar"
            className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm text-ink-200 transition-colors hover:bg-ink-700"
          >
            {'📅 Calendar'}
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
              1. Create a key at <span className="text-gold-400">aistudio.google.com/apikey</span>.
            </li>
            <li>
              2. Add <code className="rounded bg-ink-800 px-1.5 py-0.5">GEMINI_API_KEY</code> to{' '}
              <code className="rounded bg-ink-800 px-1.5 py-0.5">.env.local</code>, and to the
              Vercel project for production.
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
          today={today}
          pillars={pillars.map((p) => ({
            id: p.id,
            name: p.name,
            icon: p.icon,
            color: p.color,
            definition: p.definition,
          }))}
          excludedCount={all.length - pillars.length}
          ratings={ratings}
          completedActionIds={[...completed]}
          history={transcriptOf(history)}
          dateLabel={formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
        />
      )}
    </Shell>
  );
}
