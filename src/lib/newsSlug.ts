type NewsLike = {
  id: string;
  data: {
    slug?: string;
  };
};

function getSlugFromId(id: string): string {
  const segment = id.split("/").pop();
  return segment && segment.length > 0 ? segment : id;
}

export function resolveNewsSlug(entry: NewsLike): string {
  const configuredSlug = entry.data.slug?.trim();
  if (configuredSlug) return configuredSlug;
  return getSlugFromId(entry.id);
}
