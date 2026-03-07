import type { ImageMetadata } from "astro";

const images = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/images/**/*",
);

export function resolveImage(src: string) {
  return images[`/src/assets${src}`];
}
