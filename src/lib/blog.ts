import type { CollectionEntry } from 'astro:content';
import {
	CATEGORY_TREE,
	getCategoryLabel,
	type CategoryItem,
	type CategoryTreeItem,
} from '../config/blog';
import { DEFAULT_LANG, otherLang, UI, type Lang } from '../i18n/ui';

export type BlogPost = CollectionEntry<'blog'>;

export type FlatCategory = CategoryItem & {
	depth: number;
	path: string[];
	parentId?: string;
};

export function isCategoryItem(item: CategoryTreeItem): item is CategoryItem {
	return item.type === 'category';
}

export function flattenCategories(
	items: CategoryTreeItem[] = CATEGORY_TREE,
	depth = 0,
	parentPath: string[] = [],
	parentId?: string,
): FlatCategory[] {
	return items.flatMap((item) => {
		if (!isCategoryItem(item)) {
			return [];
		}

		const path = [...parentPath, item.id];
		const current: FlatCategory = { ...item, depth, path, parentId };
		return [current, ...flattenCategories(item.children ?? [], depth + 1, path, item.id)];
	});
}

export const FLAT_CATEGORIES = flattenCategories();

export function getCategoryById(categoryId: string) {
	return FLAT_CATEGORIES.find((category) => category.id === categoryId);
}

export function getCategoryByPath(path: string[]) {
	return FLAT_CATEGORIES.find((category) => category.path.join('/') === path.join('/'));
}

export function getCategoryUrl(category: Pick<FlatCategory, 'path'>, lang: Lang) {
	return `/${lang}/blog/category/${category.path.join('/')}/`;
}

export function getCategoryUrlById(categoryId: string, lang: Lang) {
	const category = getCategoryById(categoryId);
	return category ? getCategoryUrl(category, lang) : `/${lang}/blog/`;
}

// 글의 언어는 콘텐츠 폴더(ko/, en/) 접두어로 판별한다.
export function getPostLang(post: BlogPost): Lang {
	return post.id.startsWith('en/') ? 'en' : DEFAULT_LANG;
}

export function getPostSlug(post: BlogPost) {
	const [prefix, ...rest] = post.id.split('/');
	return prefix === 'ko' || prefix === 'en' ? rest.join('/') : post.id;
}

export function getPostsByLang(posts: BlogPost[], lang: Lang) {
	return posts.filter((post) => getPostLang(post) === lang);
}

// 같은 slug(파일명)를 가진 반대 언어 글 = 번역 쌍
export function findTranslation(posts: BlogPost[], post: BlogPost) {
	const targetLang = otherLang(getPostLang(post));
	const slug = getPostSlug(post);
	return posts.find(
		(candidate) => getPostLang(candidate) === targetLang && getPostSlug(candidate) === slug,
	);
}

export function getPostUrl(post: BlogPost) {
	return `/${getPostLang(post)}/blog/${getPostSlug(post)}/`;
}

export function getAllPostUrl(post: BlogPost) {
	return `/${getPostLang(post)}/blog/all/${getPostSlug(post)}/`;
}

export function sortPosts(posts: BlogPost[]) {
	return [...posts].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function getDescendantCategoryIds(categoryId: string) {
	const category = getCategoryById(categoryId);
	if (!category) {
		return [categoryId];
	}

	const prefix = category.path.join('/');
	return FLAT_CATEGORIES.filter((candidate) => {
		const candidatePath = candidate.path.join('/');
		return candidatePath === prefix || candidatePath.startsWith(`${prefix}/`);
	}).map((candidate) => candidate.id);
}

export function getPostsForCategory(posts: BlogPost[], categoryId: string) {
	const categoryIds = new Set(getDescendantCategoryIds(categoryId));
	return sortPosts(posts).filter((post) => categoryIds.has(post.data.category));
}

export function getLatestPost(posts: BlogPost[]) {
	return sortPosts(posts)[0];
}

export function getPostCategory(post: BlogPost) {
	return getCategoryById(post.data.category);
}

export function getPostScopePosts(posts: BlogPost[], post: BlogPost) {
	return getPostsForCategory(posts, post.data.category);
}

export function getPostScopeTitle(post: BlogPost, lang: Lang) {
	const category = getPostCategory(post);
	return category ? getCategoryLabel(category, lang) : UI[lang].categoryFallback;
}

export function getAdjacentWindow(posts: BlogPost[], currentPost: BlogPost, size = 5) {
	const currentIndex = posts.findIndex((post) => post.id === currentPost.id);
	if (currentIndex < 0) {
		return {
			items: posts.slice(0, size),
			newerPost: undefined,
			olderPost: undefined,
		};
	}

	const half = Math.floor(size / 2);
	let start = Math.max(0, currentIndex - half);
	const endLimit = Math.max(0, posts.length - size);
	start = Math.min(start, endLimit);
	const items = posts.slice(start, start + size);

	return {
		items,
		newerPost: currentIndex > 0 ? posts[currentIndex - 1] : undefined,
		olderPost: currentIndex < posts.length - 1 ? posts[currentIndex + 1] : undefined,
	};
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatPostDate(date: Date, lang: Lang = DEFAULT_LANG) {
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');

	if (lang === 'en') {
		return `${EN_MONTHS[date.getMonth()]} ${day}, ${year} ${hours}:${minutes}`;
	}

	return `${year}. ${month}. ${day}. ${hours}:${minutes}`;
}
