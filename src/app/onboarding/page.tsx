import { redirect } from 'next/navigation';
import { completeOnboarding } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { getActivePillars } from '@/lib/queries';
import { PillarPicker } from './PillarPicker';

export default async function OnboardingPage() {
  const { db, user } = await requireUser();
  const pillars = await getActivePillars(db, user.id);
  if (pillars.length > 0) redirect('/dashboard');

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="label-xs">Season 1 · setup</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        Which five pillars are you actually playing for?
      </h1>
      <p className="mt-2 max-w-2xl text-ink-300">
        These become the axes you get scored on every week. Pick the ones you would be
        embarrassed to neglect — not the ones that sound impressive. Five is the default; you
        can add more later without losing any history.
      </p>

      <div className="mt-8">
        <PillarPicker onSubmit={completeOnboarding} />
      </div>
    </div>
  );
}
