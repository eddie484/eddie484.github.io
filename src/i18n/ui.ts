export const LANGS = ['ko', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = 'ko';

export type LocalizedText = Record<Lang, string>;

export function otherLang(lang: Lang): Lang {
	return lang === 'ko' ? 'en' : 'ko';
}

export function isLang(value: string | undefined): value is Lang {
	return value === 'ko' || value === 'en';
}

const ko = {
	// 공통
	adminMenuAria: '관리자 메뉴',
	topMenuAria: '상단 메뉴',
	goToMain: (title: string) => `${title} 메인으로 이동`,
	login: '로그인',
	logout: '로그아웃',
	langToggleAria: '언어 선택',
	postAreaAria: '글 영역',
	firstFollowNav: 'FIRST/FOLLOW',
	firstFollow: 'FIRST/FOLLOW 계산기',
	firstFollowDescription: '문법을 입력해 FIRST와 FOLLOW 집합을 계산하고 결과를 비교합니다.',

	// 사이드바
	categories: '카테고리',
	allPosts: '전체보기',
	write: '글쓰기',
	manage: '관리',

	// 글 목록
	postCount: (count: number) => `${count}개의 글`,
	listClose: '목록닫기',
	listOpen: '목록열기',
	postTitle: '글 제목',
	pubDate: '작성일',
	rowsView: (n: number) => `${n}줄 보기`,
	listSizeAria: '목록 표시 개수',
	listPageAria: '글 목록 페이지',

	// 글 본문
	categoryFallback: '카테고리',
	postActionsAria: '글 작업',
	copyUrl: 'URL 복사',
	copied: '복사됨',
	copyFailed: '복사 실패',
	postMenuAria: '글 관리 메뉴 열기',
	edit: '수정하기',

	// 하단 목록
	footerListAria: '현재 범위의 다른 글',
	allPostsList: '전체 글',
	postsOf: (scope: string) => `${scope}의 글`,
	viewAll: '전체글 보기',
	listNavAria: '목록 이동',
	prev: '‹ 이전',
	next: '다음 ›',

	emptyScope: '아직 이 범위에 표시할 글이 없습니다.',

	// 프로필
	profile: '프로필',
	profilePlaceholder: '이 공간은 나중에 정리합니다.',

	// 리다이렉트 안내
	goToBlog: '블로그로 이동합니다.',
	goToProfile: '프로필로 이동합니다.',
	goToFirstFollow: 'FIRST/FOLLOW 계산기로 이동합니다.',
};

export type UIDict = typeof ko;

const en: UIDict = {
	adminMenuAria: 'Admin menu',
	topMenuAria: 'Top menu',
	goToMain: (title: string) => `Go to ${title} home`,
	login: 'Log in',
	logout: 'Log out',
	langToggleAria: 'Select language',
	postAreaAria: 'Post area',
	firstFollowNav: 'FIRST/FOLLOW',
	firstFollow: 'FIRST/FOLLOW Calculator',
	firstFollowDescription: 'Calculate FIRST and FOLLOW sets from a grammar and compare results.',

	categories: 'Categories',
	allPosts: 'All Posts',
	write: 'Write',
	manage: 'Manage',

	postCount: (count: number) => (count === 1 ? '1 post' : `${count} posts`),
	listClose: 'Hide list',
	listOpen: 'Show list',
	postTitle: 'Title',
	pubDate: 'Published',
	rowsView: (n: number) => `${n} rows`,
	listSizeAria: 'Number of rows to show',
	listPageAria: 'Post list pages',

	categoryFallback: 'Category',
	postActionsAria: 'Post actions',
	copyUrl: 'Copy URL',
	copied: 'Copied',
	copyFailed: 'Copy failed',
	postMenuAria: 'Open post admin menu',
	edit: 'Edit',

	footerListAria: 'Other posts in this scope',
	allPostsList: 'All posts',
	postsOf: (scope: string) => `Posts in ${scope}`,
	viewAll: 'View all',
	listNavAria: 'List navigation',
	prev: '‹ Prev',
	next: 'Next ›',

	emptyScope: 'There are no posts to show here yet.',

	profile: 'Profile',
	profilePlaceholder: 'This space will be organized later.',

	goToBlog: 'Redirecting to the blog.',
	goToProfile: 'Redirecting to the profile.',
	goToFirstFollow: 'Redirecting to the FIRST/FOLLOW calculator.',
};

export const UI: Record<Lang, UIDict> = { ko, en };
