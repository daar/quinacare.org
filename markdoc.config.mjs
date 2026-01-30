import { defineMarkdocConfig, component } from '@astrojs/markdoc/config';

export default defineMarkdocConfig({
  tags: {
    image: {
      render: component('./src/components/markdoc/Image.astro'),
      attributes: {
        src: { type: String, required: true },
        alt: { type: String },
        width: { type: Number },
        height: { type: Number },
        align: { type: String },
        caption: { type: String },
      },
    },
  },
});
