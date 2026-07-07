import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORY_IDS } from './config/blog';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			category: z.string().refine(
				(id) => CATEGORY_IDS.has(id),
				(id) => ({
					message: `존재하지 않는 카테고리 "${id}"입니다. src/data/categories.json을 확인하세요.`,
				}),
			),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			// 번역본(en/)에만 존재: 원본(ko) 파일의 해시와 번역 시각. 재번역 필요 감지에 쓴다.
			sourceHash: z.string().optional(),
			translatedAt: z.coerce.date().optional(),
		}),
});

export const collections = { blog };
