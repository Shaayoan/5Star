import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOptionalUser } from '@/lib/auth';
import { Card } from '@/components/ui';
import { ResetForm } from './ResetForm';

export default async function ResetPasswordPage() {
  const { user } = await getOptionalUser();

  // Reaching this page without a session means the recovery link expired or was
  // already used — send them back to ask for a fresh one.
  if (!user) redirect('/login');

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2 font-bold">
        <span className="text-gold-400">★</span> 5 Star
      </Link>

      <Card>
        <h1 className="text-xl font-bold tracking-tight">Choose a new password</h1>
        <p className="mt-1 mb-5 text-sm text-ink-400">
          Signed in as <span className="text-ink-200">{user.email}</span>.
        </p>
        <ResetForm />
      </Card>
    </div>
  );
}
