import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

/** Every authenticated route funnels through here, so the "who is this?" logic
 *  exists in exactly one place. */
export async function requireUser() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) redirect('/login');
  return { db, user };
}

export async function getOptionalUser() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  return { db, user };
}
