/**
 * News selection / ordering shared by the homepage strip and the blog roll.
 *
 * `pinned` is a boolean that only affects *selection*, not display order:
 * pinned posts are guaranteed a slot before any non-pinned post, the
 * remaining slots are filled with the newest non-pinned posts, and the
 * resulting set is then rendered newest-first by date.
 */

type PinnableNews = { data: { pinned?: boolean; date: Date } };

const byDateDesc = (a: PinnableNews, b: PinnableNews) =>
  new Date(b.data.date).getTime() - new Date(a.data.date).getTime();

/**
 * Pick up to `slots` posts: all pinned first, then the newest non-pinned to
 * fill the remaining slots, returned newest-first. If there are more pinned
 * posts than slots, the newest pinned win (so the layout never overflows).
 */
export function selectNews<T extends PinnableNews>(
  posts: T[],
  slots: number,
): T[] {
  const pinned = posts.filter((p) => p.data.pinned);
  const nonPinned = posts.filter((p) => !p.data.pinned).sort(byDateDesc);
  const fill = Math.max(0, slots - pinned.length);
  return [...pinned, ...nonPinned.slice(0, fill)]
    .sort(byDateDesc)
    .slice(0, slots);
}

/**
 * Full ordering for the paginated blog roll: the first `pageSize` slots use
 * the pinned-first selection (so pinned posts always land on page one,
 * newest-first), and everything else follows newest-first behind them.
 */
export function orderNews<T extends PinnableNews>(
  posts: T[],
  pageSize: number,
): T[] {
  const firstPage = selectNews(posts, pageSize);
  const selected = new Set<T>(firstPage);
  const rest = posts.filter((p) => !selected.has(p)).sort(byDateDesc);
  return [...firstPage, ...rest];
}
