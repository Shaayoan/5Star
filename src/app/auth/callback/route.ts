import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const SAFE_NEXT = /^\/[A-Za-z0-9\-._~/]*$/;

/**
 * Landing point for every email link: magic link, signup confirmation and
 * password recovery. Supabase sends either a PKCE `code` or a `token_hash`
 * depending on the template, so both are handled here.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const errorDescription = searchParams.get('error_description');

  // Never redirect to an attacker-supplied absolute URL.
  const requested = searchParams.get('next') ?? '/dashboard';
  const next = SAFE_NEXT.test(requested) ? requested : '/dashboard';

  // A recovery link must land on the "set a new password" screen regardless of
  // whatever `next` the email happened to carry.
  const destination = type === 'recovery' ? '/auth/reset' : next;

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`,
    );
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destination}`);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${destination}`);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('That link is no longer valid.')}`);
}
