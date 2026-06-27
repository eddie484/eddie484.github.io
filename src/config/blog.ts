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

export const CATEGORY_TREE: CategoryTreeItem[] = [
	{
		type: 'category',
		id: 'projects',
		label: '프로젝트',
		icon: 'folder',
		children: [
			{ type: 'category', id: 'project-a', label: '프로젝트 A', icon: 'document' },
			{ type: 'category', id: 'design', label: '설계', icon: 'document' },
			{ type: 'category', id: 'notes', label: '잡설', icon: 'document' },
		],
	},
	{ type: 'divider', id: 'divider-main' },
	{
		type: 'category',
		id: 'games',
		label: '게임',
		icon: 'folder',
		children: [
			{ type: 'category', id: 'game-a', label: '게임A', icon: 'document' },
			{ type: 'category', id: 'game-b', label: '게임B', icon: 'document' },
			{ type: 'category', id: 'game-c', label: '게임C', icon: 'document' },
		],
	},
	{ type: 'category', id: 'thoughts', label: '잡생각', icon: 'document' },
	{ type: 'category', id: 'food', label: '식사', icon: 'document' },
];

export const PRIMARY_NAV: NavItem[] = [
	{ label: '블로그', href: '/blog/' },
	{ label: '프로필', href: '/profile/' },
	{ label: '프로젝트', categoryId: 'projects' },
	{ label: '게임', categoryId: 'games' },
];

export const EXTERNAL_NAV = [{ label: 'GitHub', href: 'https://github.com/eddie484' }];
