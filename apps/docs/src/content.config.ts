import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  // The docs site's own interface words, beside Starlight's (src/content/i18n/<language>.json).
  i18n: defineCollection({
    loader: i18nLoader(),
    schema: i18nSchema({
      extend: z.object({
        'languageSelect.findLabel': z.string(),
        'languageSelect.noMatch': z.string(),
      }),
    }),
  }),
};
