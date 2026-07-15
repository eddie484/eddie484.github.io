import type { APIRoute } from 'astro';

const version = process.env.GITHUB_SHA ?? 'development';

export const GET: APIRoute = () => {
	return new Response(JSON.stringify({ version }), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store',
		},
	});
};
