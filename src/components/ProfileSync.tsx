'use client';

import { useEffect } from 'react';
import { ensureProfile } from '@/lib/actions';
import { browserTimezone } from '@/lib/timezone';

/**
 * Reports the browser's timezone to the profile once per session, and doubles
 * as a safety net that creates the profile row for any account whose auth
 * trigger never fired. Renders nothing.
 */
export function ProfileSync({ storedTimezone }: { storedTimezone: string | null }) {
  useEffect(() => {
    const tz = browserTimezone();
    if (tz === storedTimezone) return;
    if (sessionStorage.getItem('5star:tz') === tz) return;

    ensureProfile({ timezone: tz })
      .then(() => sessionStorage.setItem('5star:tz', tz))
      .catch(() => {
        // A failed sync is not worth interrupting the user over; the next page
        // load will try again.
      });
  }, [storedTimezone]);

  return null;
}
