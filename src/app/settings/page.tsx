import { signOut } from '@/lib/actions';
import { ensureProfileRow } from '@/lib/engine';
import { requireUser } from '@/lib/auth';
import { formatDate, toIso } from '@/lib/dates';
import { getActivePillars, getCurrentSeason, getProfile, getXpTotals } from '@/lib/queries';
import { Button, Card, CardDescription, CardTitle, Chip, StatTile } from '@/components/ui';
import { PageTitle, Shell } from '@/components/Shell';
import { ProfileSync } from '@/components/ProfileSync';
import { PasswordForm, SettingsForm } from './SettingsForm';

export default async function SettingsPage() {
  const { db, user } = await requireUser();

  // Repairs any account whose profile row is missing before we read it.
  await ensureProfileRow(db, user);

  const [profile, season, pillars, xp] = await Promise.all([
    getProfile(db, user.id),
    getCurrentSeason(db, user.id),
    getActivePillars(db, user.id),
    getXpTotals(db, user.id),
  ]);

  const hasPassword = user.app_metadata?.providers?.includes('email') ?? true;

  return (
    <Shell active="/settings">
      <ProfileSync storedTimezone={profile?.timezone ?? null} />

      <PageTitle title="Settings" subtitle="Your account and how the app treats your days." />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total XP" value={xp.total.toLocaleString()} accent="#fbbf24" />
        <StatTile label="Active pillars" value={pillars.length} />
        <StatTile label="Season" value={season?.name ?? '—'} sub={season ? `since ${formatDate(season.started_on)}` : undefined} />
        <StatTile
          label="Member since"
          value={formatDate(toIso(new Date(user.created_at)), { month: 'short', year: 'numeric' })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Saved to your own database, nowhere else.</CardDescription>
          <div className="mt-4">
            <SettingsForm
              displayName={profile?.display_name ?? null}
              timezone={profile?.timezone ?? 'UTC'}
            />
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>Account</CardTitle>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-400">Email</dt>
                <dd className="truncate font-medium">{user.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-400">Email confirmed</dt>
                <dd>
                  <Chip tone={user.email_confirmed_at ? 'good' : 'neutral'}>
                    {user.email_confirmed_at ? 'Yes' : 'Pending'}
                  </Chip>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-400">Streak freezes</dt>
                <dd className="num font-medium">{profile?.freezes_available ?? 0}</dd>
              </div>
            </dl>

            <form action={signOut} className="mt-4">
              <Button variant="secondary" type="submit" className="w-full">
                Sign out
              </Button>
            </form>
          </Card>

          {hasPassword && (
            <Card>
              <CardTitle>Password</CardTitle>
              <CardDescription>Changing it signs out your other devices.</CardDescription>
              <div className="mt-4">
                <PasswordForm />
              </div>
            </Card>
          )}
        </div>
      </div>
    </Shell>
  );
}
