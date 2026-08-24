import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOptionalUser } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { Card } from '@/components/ui';
import { SetupNotice } from '@/components/SetupNotice';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  if (!isSupabaseConfigured) return <SetupNotice />;

  const { user } = await getOptionalUser();
  if (user) redirect('/dashboard');

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2 font-bold">
        <span className="text-gold-400">★</span> 5 Star
      </Link>

      <Card>
        <h1 className="text-xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-1 mb-5 text-sm text-ink-400">
          One account, five pillars, one honest report a week.
        </p>
        <Suspense fallback={<div className="h-52 animate-pulse rounded-lg bg-ink-800" />}>
          <LoginForm />
        </Suspense>
      </Card>
    </div>
  );
}
