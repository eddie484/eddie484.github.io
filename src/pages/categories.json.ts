import type { APIRoute } from 'astro';
import categoriesData from '../data/categories.json';

// write.html 등 정적 페이지에서 카테고리 목록을 fetch할 수 있도록
// src/data/categories.json을 /categories.json으로 그대로 내보낸다.
export const GET: APIRoute = () => {
	return new Response(JSON.stringify(categoriesData), {
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
	});
};
