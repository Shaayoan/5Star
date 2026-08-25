import 'server-only';
import { todayIn } from './dates';
import type { DB } from './queries';
import type { IsoDate } from './types';

/**
 * The user's own calendar day, derived from the timezone stored on their
 * profile. Every server path that needs "today" goes through here — using the
 * server's clock puts anyone outside UTC on the wrong day.
 *
 * Falls back to UTC when the profile has not been created yet, which only
 * happens in the moments between signing up and the first page load.
 */
export async function userToday(db: DB, userId: string): Promise<IsoDate> {
  const { data } = await db
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle<{ timezone: string | null }>();

  return todayIn(data?.timezone ?? 'UTC');
}
