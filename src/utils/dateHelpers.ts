/** Format a Date as a local YYYY-MM-DD string (timezone-aware). */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Return the YYYY-MM-DD string for the day after the given date string. */
export function getNextDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return toDateString(d);
}
