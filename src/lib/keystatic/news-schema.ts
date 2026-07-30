import { fields } from "@keystatic/core";
import { kebabCase } from "lodash-es";
import { contentComponents } from "./content-components";

const currentYear = () => new Date().getFullYear();

const generateYearScopedSlug = (value: string) => {
  const slug = kebabCase(value);
  return `${currentYear()}/${slug}`;
};

export const newsSchema = {
  title: fields.slug({
    name: {
      label: "Titel",
      validation: {
        isRequired: true,
      },
    },
    slug: {
      label: "Map (jaar/slug)",
      generate: generateYearScopedSlug,
      validation: {
        pattern: {
          regex: /^\d{4}\/.+$/,
          message: "Gebruik formaat YYYY/slug.",
        },
      },
    },
  }),
  slug: fields.text({
    label: "URL slug (optioneel, legacy)",
  }),
  date: fields.date({ label: "Datum" }),
  status: fields.select({
    label: "Status",
    options: [
      { label: "Gepubliceerd", value: "publish" },
      { label: "Concept", value: "draft" },
    ],
    defaultValue: "publish",
  }),
  pinned: fields.checkbox({
    label: "Vastgepind op homepage",
    defaultValue: false,
  }),
  author: fields.text({ label: "Auteur" }),
  excerpt: fields.text({ label: "Samenvatting", multiline: true }),
  categories: fields.array(fields.text({ label: "Categorie" }), {
    label: "Categorieën",
    itemLabel: (props) => props.fields.value.value ?? "Categorie",
  }),
  translationKey: fields.text({ label: "Vertaalsleutel (NL slug)" }),
  language: fields.text({ label: "Taal" }),
  featured_image: fields.image({
    label: "Uitgelichte afbeelding",
    directory: "src/assets/media/cms",
    publicPath: "../../../../assets/media/cms/",
  }),
  featured_image_caption: fields.text({ label: "Bijschrift afbeelding" }),
  featured_image_copyright: fields.text({ label: "Copyright afbeelding" }),
  content: fields.markdoc({
    label: "Inhoud",
    // image: false prevents the built-in ProseMirror image node from
    // overwriting our custom image component in the editor schema.
    options: { image: false },
    components: contentComponents,
  }),
};
