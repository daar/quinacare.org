import { getCollection } from "astro:content";
import type { Lang } from "../i18n";

// Build-time index linking the language variants of a post or fundraiser.
// Entries that share a `translationKey` are linked explicitly; entries
// without one fall back to a same-slug lookup, so identical slugs across
// languages link automatically without needing the key.
export type TranslateKind = "news" | "fundraisers" | "projects";
const LANGS: Lang[] = ["nl", "en", "es"];

type KeyMap = Map<string, Partial<Record<Lang, string>>>;
type KindIndex = {
  keyToSlugs: KeyMap;
  slugToKey: Record<Lang, Map<string, string>>;
  allSlugs: Record<Lang, Set<string>>;
};

let indices: Record<TranslateKind, KindIndex> | null = null;
// Cache the in-flight build so concurrent callers share one run; `indices`
// is only assigned once it is fully populated, so a second caller can never
// observe a half-built index (which previously crashed with `slugToKey` of
// undefined).
let buildPromise: Promise<void> | null = null;

async function build(): Promise<void> {
  if (indices) return;
  if (!buildPromise) {
    buildPromise = (async () => {
      const kinds: TranslateKind[] = ["news", "fundraisers", "projects"];
      const result = {} as Record<TranslateKind, KindIndex>;
      for (const kind of kinds) {
        const idx: KindIndex = {
          keyToSlugs: new Map(),
          slugToKey: { nl: new Map(), en: new Map(), es: new Map() },
          allSlugs: { nl: new Set(), en: new Set(), es: new Set() },
        };
        for (const lang of LANGS) {
          let entries = await getCollection(`${kind}-${lang}` as "news-nl");
          // Only index entries that are actually built, so the switcher never
          // links to an unpublished page. News is publish-only everywhere;
          // fundraisers/projects drafts are built in dev but excluded in prod.
          if (kind === "news")
            entries = entries.filter(
              (p) => (p.data as { status?: string }).status === "publish",
            );
          else
            entries = entries.filter(
              (p) =>
                import.meta.env.DEV || !(p.data as { draft?: boolean }).draft,
            );
          for (const p of entries) {
            const slug = p.data.slug || p.id;
            idx.allSlugs[lang].add(slug);
            const key = (p.data as { translationKey?: string }).translationKey;
            if (!key) continue;
            const entry = idx.keyToSlugs.get(key) ?? {};
            entry[lang] = slug;
            idx.keyToSlugs.set(key, entry);
            idx.slugToKey[lang].set(slug, key);
          }
        }
        result[kind] = idx;
      }
      indices = result;
    })().catch((e) => {
      buildPromise = null; // allow a retry on a transient failure
      throw e;
    });
  }
  await buildPromise;
}

/**
 * Returns a function that maps an entry slug from one language to its
 * counterpart in another, within the given collection kind (defaults to
 * "news"). Resolves via the shared translationKey first; if that yields
 * nothing but an entry with the same slug exists in the target language,
 * returns that same slug. Returns null when no translation can be found.
 */
export async function buildPostTranslator(): Promise<
  (slug: string, from: Lang, to: Lang, kind?: TranslateKind) => string | null
> {
  await build();
  return (slug, from, to, kind = "news") => {
    const idx = indices?.[kind];
    if (!idx) return null;
    const key = idx.slugToKey[from].get(slug);
    if (key) {
      const linked = idx.keyToSlugs.get(key)?.[to];
      if (linked) return linked;
    }
    if (idx.allSlugs[to].has(slug)) return slug;
    return null;
  };
}
