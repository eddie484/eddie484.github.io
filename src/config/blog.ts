import categoriesData from '../data/categories.json';

export type CategoryItem = {
	type: 'category';
	id: string;
	label: string;
	icon?: string;
	children?: CategoryTreeItem[];
};

export type CategoryDivider = {
	type: 'divider';
	id: string;
};

export type CategoryTreeItem = CategoryItem | CategoryDivider;

export type NavItem =
	| {
			label: string;
			href: string;
	  }
	| {
			label: string;
			categoryId: string;
	  };

export const BLOG_TITLE = '기록 공간';
export const BLOG_DESCRIPTION = '프로젝트 기록과 일지를 정리하는 개인 공간입니다.';
export const BLOG_AUTHOR = 'Eddie';

export const BANNER = {
	backgroundColor: '#eef3f1',
	image: '',
};

type RawCategoryEntry = {
	type: string;
	id?: string;
	label?: string;
	icon?: string;
	parent?: string;
};

// src/data/categories.json이 카테고리의 단일 소스다.
// 순서 = 표시 순서, 중첩 = parent 필드 (상위 카테고리가 목록에서 먼저 나와야 한다).
function buildCategoryTree(entries: RawCategoryEntry[]): CategoryTreeItem[] {
	const roots: CategoryTreeItem[] = [];
	const itemsById = new Map<string, CategoryItem>();
	let dividerCount = 0;

	for (const entry of entries) {
		if (entry.type === 'divider') {
			roots.push({ type: 'divider', id: `divider-${dividerCount++}` });
			continue;
		}

		if (entry.type !== 'category') {
			throw new Error(`categories.json: 알 수 없는 type "${entry.type}" 항목이 있습니다.`);
		}
		if (!entry.id) {
			throw new Error('categories.json: id가 비어 있는 카테고리가 있습니다.');
		}
		if (itemsById.has(entry.id)) {
			throw new Error(`categories.json: 중복된 카테고리 id "${entry.id}"가 있습니다.`);
		}
		if (!entry.label) {
			throw new Error(`categories.json: 카테고리 "${entry.id}"에 label이 없습니다.`);
		}

		const item: CategoryItem = {
			type: 'category',
			id: entry.id,
			label: entry.label,
			...(entry.icon ? { icon: entry.icon } : {}),
		};

		if (entry.parent) {
			const parent = itemsById.get(entry.parent);
			if (!parent) {
				throw new Error(
					`categories.json: 카테고리 "${entry.id}"의 상위 카테고리 "${entry.parent}"를 찾을 수 없습니다. ` +
						'상위 카테고리가 목록에서 먼저 나와야 합니다.',
				);
			}
			(parent.children ??= []).push(item);
		} else {
			roots.push(item);
		}

		itemsById.set(item.id, item);
	}

	return roots;
}

const RAW_CATEGORIES = categoriesData.categories as RawCategoryEntry[];

export const CATEGORY_TREE: CategoryTreeItem[] = buildCategoryTree(RAW_CATEGORIES);

export const CATEGORY_IDS: ReadonlySet<string> = new Set(
	RAW_CATEGORIES.filter((entry) => entry.type === 'category').map((entry) => entry.id as string),
);

export const PRIMARY_NAV: NavItem[] = [
	{ label: '프로필', href: '/profile/' },
	{ label: '블로그', href: '/blog/' },
	{ label: '프로젝트', categoryId: 'projects' },
	{ label: '게임', categoryId: 'games' },
];

for (const item of PRIMARY_NAV) {
	if ('categoryId' in item && !CATEGORY_IDS.has(item.categoryId)) {
		throw new Error(
			`PRIMARY_NAV의 "${item.label}"이 존재하지 않는 카테고리 "${item.categoryId}"를 참조합니다. ` +
				'src/data/categories.json을 확인하세요.',
		);
	}
}

export const EXTERNAL_NAV = [{ label: 'GitHub', href: 'https://github.com/eddie484' }];
