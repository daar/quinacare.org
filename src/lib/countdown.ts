/**
 * Days remaining on a fundraiser, worked out in the visitor's browser.
 *
 * This used to be computed in the page frontmatter, which meant it was
 * baked into the HTML when the site was built and then stood still. The
 * raised amount and backer count beside it are fetched live, so a
 * fundraiser could show money from this morning next to a countdown from
 * whenever the site was last deployed — drifting a day further out with
 * every day that passed.
 *
 * The arithmetic is deliberately the same as the old build-time version,
 * so no fundraiser's number shifts as a result of moving the calculation:
 * `end_date` is a date with no time, which parses as UTC midnight, and the
 * count rounds up so the final day reads as 1 rather than 0.
 */
export function daysToGo(
  endDate: string | Date,
  now: number = Date.now(),
): number {
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  if (Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.ceil((end.getTime() - now) / 86_400_000));
}

/** A fundraiser counts as active until its end date passes. */
export function isActive(
  endDate: string | Date,
  now: number = Date.now(),
): boolean {
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  return !Number.isNaN(end.getTime()) && end.getTime() > now;
}
