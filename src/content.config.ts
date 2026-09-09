import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		// `created` overrides the git-derived created date the same way
		// Starlight's built-in `lastUpdated` frontmatter field overrides the
		// git-derived last-updated date. Use it only when history misleads
		// (a moved or regenerated file); git provides it otherwise.
		schema: docsSchema({ extend: z.object({ created: z.date().optional() }) }),
	}),
};
