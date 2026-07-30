import { fields } from "@keystatic/core";
import { contentComponents } from "./content-components";

export const newsSchema = {
  title: fields.text({ label: "Titel" }),
  slug: fields.text({ label: "Slug" }),
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
