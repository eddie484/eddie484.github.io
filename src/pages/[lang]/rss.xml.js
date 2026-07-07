import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../../consts';
import { LANGS } from '../../i18n/ui';
import { getPostUrl, getPostsByLang, sortPosts } from '../../lib/blog';

export function getStaticPaths() {
	return LANGS.map((lang) => ({ params: { lang } }));
}

export async function GET(context) {
	const lang = context.params.lang;
	const posts = sortPosts(getPostsByLang(await getCollection('blog'), lang));
	return rss({
		title: SITE_TITLE[lang],
		description: SITE_DESCRIPTION[lang],
		site: context.site,
		items: posts.map((post) => ({
			...post.data,
			link: getPostUrl(post),
		})),
	});
}
