# 블로그 한/영 이중 언어화 계획서

## 1. 목표

- 블로그를 `/ko/...`(한글)와 `/en/...`(영문) 두 버전으로 분리한다.
- 모든 페이지에 언어 토글을 넣어, 같은 글/페이지의 반대 언어 버전으로 바로 이동할 수 있게 한다.
- 한글로 글을 쓰면 LLM API(Claude)가 자동으로 영문 번역본을 생성하고, 검토 후 승인하면 영문 블로그에 자동 게시된다.
- 영어 검색에는 영문 페이지가, 한글 검색에는 한글 페이지가 노출되도록 SEO(hreflang, sitemap, RSS)를 정비한다.

## 2. 현재 구조 요약

| 영역 | 현재 상태 |
| --- | --- |
| 라우팅 | `/`, `/blog/`, `/blog/[slug]`, `/blog/category/[...]`, `/profile`, `/about` — 언어 구분 없음 |
| 콘텐츠 | `src/content/blog/` 단일 폴더, frontmatter에 언어 정보 없음 |
| UI 문자열 | 컴포넌트와 `src/config/blog.ts`에 한글 하드코딩 (카테고리 라벨, 블로그 제목 등) |
| 글 작성 | `public/admin/write.html`(초안) → Sveltia CMS → `main` 브랜치 커밋 |
| 배포 | push to main → GitHub Actions(`deploy.yml`) → GitHub Pages |

정적 사이트이므로 클라이언트에 LLM API 키를 둘 수 없다. → 번역은 GitHub Actions(서버 사이드)에서 수행한다.

## 3. URL / 라우팅 설계

### 3.1 URL 구조

```
/               → /ko/ 로 리다이렉트
/ko/            → 한글 홈
/ko/blog/[slug]/
/ko/blog/category/[...]/
/ko/profile/, /ko/about/
/en/            → 영문 홈 (이하 동일 구조)
/en/blog/[slug]/
...
```

기존 URL(`/blog/[slug]/` 등)은 `/ko/...`로 301 리다이렉트하여 기존 검색 유입과 북마크를 보존한다.

### 3.2 Astro 설정

`astro.config.mjs`:

```js
i18n: {
  locales: ['ko', 'en'],
  defaultLocale: 'ko',
  routing: { prefixDefaultLocale: true, redirectToDefaultLocale: true },
},
```

### 3.3 페이지 재구성

페이지 중복을 피하기 위해 동적 `[lang]` 세그먼트를 사용한다:

```
src/pages/
  index.astro                     → /ko/ 리다이렉트만 담당
  rss.xml.js                      → /ko/rss.xml 리다이렉트(또는 유지)
  [lang]/index.astro
  [lang]/profile.astro
  [lang]/about.astro
  [lang]/blog/index.astro
  [lang]/blog/[...slug].astro
  [lang]/blog/category/[...category].astro
  [lang]/rss.xml.js
```

각 페이지의 `getStaticPaths`에서 `lang: 'ko' | 'en'`을 파라미터로 생성하고, 레이아웃/컴포넌트에 `lang`을 내려보낸다.

## 4. 콘텐츠 구조

### 4.1 폴더 분리

```
src/content/blog/
  ko/my-post.md      ← 원본 (한글)
  en/my-post.md      ← 번역본 (파일명 동일 = 번역 쌍)
```

- 글로브 로더는 그대로 두고(`**/*.{md,mdx}`), `post.id`가 `ko/my-post` 형태가 되므로 접두어로 언어를 판별한다.
- **같은 파일명(slug)이 번역 쌍의 연결 고리**다. 별도 매핑 테이블이 필요 없다.
- 기존 글은 `ko/` 하위로 이동한다.

### 4.2 frontmatter 확장

영문 번역본에만 추가 필드를 둔다:

```yaml
sourceHash: <한글 원본 파일의 SHA-256>   # 원본 수정 감지용
translatedAt: 2026-07-07T12:00:00
```

한글 원본을 수정하면 `sourceHash`가 달라지므로, 번역 파이프라인이 "재번역 필요"를 자동 감지할 수 있다.

### 4.3 `src/lib/blog.ts` 수정

- `getPostsByLang(posts, lang)` — id 접두어로 필터
- `getPostUrl(post)` → `/${lang}/blog/${slug}/` 형태로 변경
- `getTranslationOf(post)` — 반대 언어의 같은 slug 글 찾기 (언어 토글용)

## 5. UI 다국어화

### 5.1 카테고리 라벨 (`src/config/blog.ts`)

```ts
label: { ko: '프로젝트', en: 'Projects' }
```

`CategoryItem.label`을 언어별 객체로 바꾸고, 사용처에서 `label[lang]`으로 참조한다. `PRIMARY_NAV`, `BLOG_TITLE`, `BLOG_DESCRIPTION`도 동일하게 처리한다.

### 5.2 UI 문자열 사전

컴포넌트에 흩어진 하드코딩 한글("카테고리", 날짜 포맷 등)을 `src/config/i18n.ts` 사전으로 모은다:

```ts
export const UI = {
  ko: { category: '카테고리', latestPosts: '최근 글', ... },
  en: { category: 'Category', latestPosts: 'Recent Posts', ... },
};
```

날짜 포맷(`formatPostDate`)도 언어별로 분기한다 (`2026. 7. 7.` vs `Jul 7, 2026`).

### 5.3 언어 토글 컴포넌트

`BlogHeader.astro`에 `KO | EN` 토글 추가:

- 글 페이지: 번역 쌍이 있으면 해당 글로, 없으면 그 언어의 블로그 홈으로 이동 (+ "번역 없음" 안내 가능)
- 목록/기타 페이지: 같은 경로의 반대 언어 버전으로 이동

## 6. 자동 번역 파이프라인 (핵심)

### 6.1 흐름

```
① 한글로 글 작성 (write.html → Sveltia CMS → main에 ko/ 커밋)
② GitHub Actions "translate" 워크플로 트리거
   - 트리거: push to main, paths: 'src/content/blog/ko/**'
③ 변경된 ko 글 감지 (git diff) → Claude API 호출로 번역
④ en/<같은 파일명>.md 생성 → translate/<slug> 브랜치 → PR 자동 생성
⑤ 사용자가 PR에서 번역 검토 (GitHub 웹/모바일에서 diff 확인, 필요시 직접 수정)
⑥ PR 머지 → deploy.yml이 자동 실행 → 영문 글 게시 완료
```

"검토 간단히 하고 확인" = **PR 리뷰 후 Merge 버튼 하나**. 별도 관리 UI를 만들 필요가 없다.

### 6.2 워크플로 파일: `.github/workflows/translate.yml`

```yaml
on:
  push:
    branches: [main]
    paths: ['src/content/blog/ko/**']
permissions:
  contents: write
  pull-requests: write
```

주요 단계:

1. 변경/추가된 `ko/*.md` 파일 목록 추출
2. 각 파일에 대해 번역 스크립트(`scripts/translate.mjs`) 실행
   - frontmatter 파싱 → `title`, `description`, `body`를 Claude API로 번역
   - 코드 블록·MDX 컴포넌트·링크 URL은 번역하지 않도록 프롬프트에 명시
   - `sourceHash`, `translatedAt` 추가하여 `en/`에 저장
3. `peter-evans/create-pull-request` 액션으로 PR 생성 (브랜치: `translate/<slug>`)

### 6.3 필요한 것

- **Repo secret**: `ANTHROPIC_API_KEY`
- **모델**: `claude-sonnet-5` 권장 (번역 품질/비용 균형; 글 하나당 몇 센트 수준)
- 무한 루프 방지: `paths`가 `ko/**`로 한정되어 있어 en 커밋으로는 재트리거되지 않음

### 6.4 수정 글 처리

- 한글 원본 수정 push → 같은 파이프라인이 재번역 PR 생성 (기존 en 파일 덮어쓰기)
- 검토 중 영문본을 직접 고친 뒤 원본이 또 바뀌는 경우를 대비해, PR 본문에 원본 diff 링크를 첨부해 검토를 돕는다.

## 7. SEO

| 항목 | 조치 |
| --- | --- |
| `<html lang>` | 페이지 `lang` 파라미터로 `ko`/`en` 설정 |
| hreflang | `BaseHead.astro`에 `<link rel="alternate" hreflang="ko/en/x-default">` — 번역 쌍이 있는 페이지에만 |
| sitemap | `@astrojs/sitemap`의 `i18n` 옵션 활성화 (`ko-KR`/`en-US`) — 사이트맵에 hreflang 자동 포함 |
| og:locale | `ko_KR` / `en_US` 분기 |
| RSS | `/ko/rss.xml`, `/en/rss.xml` 분리. 기존 `/rss.xml`은 ko로 리다이렉트 |
| 기존 URL | `/blog/...` → `/ko/blog/...` 301 리다이렉트 (`astro.config.mjs` `redirects`) |

## 8. CMS / admin 영향

- `public/admin/config.yml`: `folder: src/content/blog` → `src/content/blog/ko`
- `write.html`: 변경 최소 (저장 위치가 ko 폴더로 바뀌는 것뿐, 사용자는 지금처럼 한글로만 작성)
- 영문본은 CMS에서 편집하지 않고 GitHub PR에서 검토/수정하는 것을 기본으로 한다.

## 9. 구현 단계

### Phase 1 — i18n 라우팅 + UI 다국어화

1. `astro.config.mjs` i18n 설정 + 리다이렉트
2. 콘텐츠를 `ko/` 하위로 이동, CMS config 경로 수정
3. 페이지를 `[lang]/` 구조로 재배치, `getStaticPaths`에 lang 추가
4. `blog.ts` URL 헬퍼 / 언어 필터 함수 수정
5. 카테고리 라벨·UI 문자열 사전화, 날짜 포맷 분기
6. 언어 토글 컴포넌트
7. 검증: `/ko/`, `/en/` 빌드 확인 (en은 이 시점엔 글 0개여도 정상)

### Phase 2 — 자동 번역 파이프라인

1. `scripts/translate.mjs` 작성 (frontmatter 파싱 + Claude API 호출 + en 파일 생성)
2. `.github/workflows/translate.yml` 작성
3. `ANTHROPIC_API_KEY` secret 등록
4. 기존 글 1개로 end-to-end 테스트: ko push → PR 생성 → 머지 → en 게시 확인
5. 기존 글 전체 일괄 번역 (workflow_dispatch로 수동 트리거)

### Phase 3 — SEO 마무리

1. hreflang / og:locale / html lang
2. sitemap i18n, RSS 분리
3. 기존 URL 301 리다이렉트
4. Google Search Console에서 색인 확인

## 10. 결정 필요 / 열린 질문

1. **미번역 글의 영문 사이트 노출**: 번역 전에는 en 목록에서 숨김(권장) vs 한글 원문 그대로 노출 + 안내 문구
2. **profile / about 페이지**: 글이 아니라 페이지라 자동 파이프라인 대상이 아님 → 1회 수동 번역으로 처리할지
3. **번역 톤**: 기술 블로그 톤(격식) vs 캐주얼 톤 — 번역 프롬프트에 반영 필요
4. **모델/비용**: claude-sonnet-5 기준 글 하나당 수 센트. 더 저렴하게 하려면 haiku, 품질 우선이면 sonnet 유지
