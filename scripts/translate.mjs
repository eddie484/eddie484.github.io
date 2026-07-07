// 한글 원본(src/content/blog/ko/*.md)을 Claude API로 번역해
// 같은 파일명의 영문본(src/content/blog/en/*.md)을 생성한다.
//
// 사용법:
//   node scripts/translate.mjs [ko파일경로...]   # 지정한 파일만 번역
//   node scripts/translate.mjs --all             # ko/ 전체 중 번역이 없거나 오래된 글만 번역
//
// 필요 환경변수: ANTHROPIC_API_KEY
import Anthropic from '@anthropic-ai/sdk';
import matter from 'gray-matter';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const KO_DIR = 'src/content/blog/ko';
const EN_DIR = 'src/content/blog/en';
const MODEL = 'claude-opus-4-8';

const TRANSLATION_SCHEMA = {
	type: 'object',
	properties: {
		title: { type: 'string', description: 'Translated post title' },
		description: { type: 'string', description: 'Translated post description' },
		body: { type: 'string', description: 'Translated post body in Markdown' },
	},
	required: ['title', 'description', 'body'],
	additionalProperties: false,
};

const SYSTEM_PROMPT = `You are translating posts for a personal engineering blog from Korean to English.
The author writes about hobby projects: CPU/compiler development on a custom ISA, hardware timing issues, games, and daily life.

Rules:
- Translate into natural, readable English aimed at an international engineering audience. Prefer clear technical prose over literal word-by-word translation.
- Preserve the Markdown structure exactly: headings, lists, tables, blockquotes, links, images, emphasis.
- Do NOT translate: code blocks, inline code, file paths, URLs, HTML/MDX tags and their attributes, commands, register/signal names, and other identifiers.
- Keep technical terms in their standard English form (e.g. IP block, waveform, store/load, testbench).
- Keep image alt text translated but leave the image URL untouched.
- Do not add translator notes, comments, or any content that is not in the original.`;

function sha256(text) {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function translate(client, { title, description, body }) {
	const stream = client.messages.stream({
		model: MODEL,
		max_tokens: 64000,
		thinking: { type: 'adaptive' },
		system: SYSTEM_PROMPT,
		output_config: { format: { type: 'json_schema', schema: TRANSLATION_SCHEMA } },
		messages: [
			{
				role: 'user',
				content: `Translate the following blog post from Korean to English. Return JSON with "title", "description", and "body".\n\n${JSON.stringify({ title, description, body })}`,
			},
		],
	});

	const message = await stream.finalMessage();

	if (message.stop_reason === 'refusal') {
		throw new Error('번역 요청이 거부되었습니다 (stop_reason: refusal).');
	}
	if (message.stop_reason === 'max_tokens') {
		throw new Error('출력이 max_tokens에서 잘렸습니다. 글을 나누거나 max_tokens를 올려주세요.');
	}

	const text = message.content
		.filter((block) => block.type === 'text')
		.map((block) => block.text)
		.join('');
	return JSON.parse(text);
}

async function translateFile(client, koPath) {
	const slug = path.basename(koPath);
	const enPath = path.join(EN_DIR, slug);

	const koRaw = readFileSync(koPath, 'utf8');
	const sourceHash = sha256(koRaw);

	if (existsSync(enPath)) {
		const existing = matter(readFileSync(enPath, 'utf8'));
		if (existing.data.sourceHash === sourceHash) {
			console.log(`skip (최신 번역 있음): ${slug}`);
			return false;
		}
	}

	const ko = matter(koRaw);
	console.log(`번역 중: ${slug}`);
	const translated = await translate(client, {
		title: ko.data.title ?? '',
		description: ko.data.description ?? '',
		body: ko.content.trim(),
	});

	const enData = {
		...ko.data,
		title: translated.title,
		description: translated.description,
		sourceHash,
		translatedAt: new Date().toISOString(),
	};

	mkdirSync(EN_DIR, { recursive: true });
	writeFileSync(enPath, matter.stringify(`\n${translated.body.trim()}\n`, enData), 'utf8');
	console.log(`생성됨: ${enPath}`);
	return true;
}

async function main() {
	if (!process.env.ANTHROPIC_API_KEY) {
		console.error('ANTHROPIC_API_KEY가 설정되어 있지 않습니다.');
		process.exit(1);
	}

	const args = process.argv.slice(2);
	let targets;
	if (args.length === 0 || args[0] === '--all') {
		targets = readdirSync(KO_DIR)
			.filter((name) => /\.(md|mdx)$/.test(name))
			.map((name) => path.join(KO_DIR, name));
	} else {
		targets = args.filter((file) => existsSync(file));
	}

	if (targets.length === 0) {
		console.log('번역할 파일이 없습니다.');
		return;
	}

	const client = new Anthropic();
	let translatedCount = 0;
	const failures = [];

	for (const koPath of targets) {
		try {
			if (await translateFile(client, koPath)) translatedCount += 1;
		} catch (error) {
			console.error(`실패: ${koPath}\n  ${error.message}`);
			failures.push(koPath);
		}
	}

	console.log(`완료: ${translatedCount}개 번역됨, ${failures.length}개 실패`);
	if (failures.length > 0) process.exit(1);
}

await main();
