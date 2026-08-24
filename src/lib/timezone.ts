/** IANA timezone of the current browser, e.g. `Asia/Kolkata`. Falls back to
 *  UTC on the server or in browsers that refuse to answer. */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** A short, sorted list for the settings dropdown, always including whatever
 *  the browser reports so the user's own zone is never missing. */
export function timezoneOptions(current?: string): string[] {
  const common = [
    'UTC',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Europe/London',
    'Europe/Berlin',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
  ];
  const all = new Set(common);
  if (current) all.add(current);
  all.add(browserTimezone());
  return [...all].sort();
}
