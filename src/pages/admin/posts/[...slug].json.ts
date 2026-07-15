import type { APIRoute } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { getPostLang, getPostSlug } from '../../../lib/blog';

export const prerender = true;

interface Props {
	post: CollectionEntry<'blog'>;
}

export async function getStaticPaths() {
	const posts = await getCollection('blog');

	return posts
		.filter((post) => getPostLang(post) === 'ko')
		.map((post) => ({
			params: { slug: getPostSlug(post) },
			props: { post },
		}));
}

function formatLocalDateTime(date: Date) {
	const pad = (value: number) => String(value).padStart(2, '0');
	return [
		date.getFullYear(),
		'-',
		pad(date.getMonth() + 1),
		'-',
		pad(date.getDate()),
		'T',
		pad(date.getHours()),
		':',
		pad(date.getMinutes()),
	].join('');
}

export const GET: APIRoute<Props> = ({ props }) => {
	const { post } = props;

	return new Response(
		JSON.stringify({
			slug: getPostSlug(post),
			title: post.data.title,
			description: post.data.description,
			category: post.data.category,
			pubDate: formatLocalDateTime(post.data.pubDate),
			body: post.body ?? '',
		}),
		{
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Cache-Control': 'no-cache',
			},
		},
	);
};
