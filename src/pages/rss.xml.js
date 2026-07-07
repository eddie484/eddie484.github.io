import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getPostUrl, getPostsByLang, sortPosts } from '../lib/blog';

// 언어 분리 이전 주소(/rss.xml)를 구독 중인 리더를 위해 한글 피드를 그대로 제공한다.
export async function GET(context) {
	const posts = sortPosts(getPostsByLang(await getCollection('blog'), 'ko'));
	return rss({
		title: SITE_TITLE.ko,
		description: SITE_DESCRIPTION.ko,
		site: context.site,
		items: posts.map((post) => ({
			...post.data,
			link: getPostUrl(post),
		})),
	});
}
