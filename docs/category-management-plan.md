# 카테고리 관리 개선 계획서

## 1. 목표

- 카테고리를 **한 곳에서만** 정의하고, 사이트 전체(사이드바, 카테고리 페이지, CMS, 글쓰기 페이지)에 자동 반영되게 한다.
- Sveltia CMS 안에 **"카테고리 설정" 관리 페이지**를 추가한다. 거기서 수정 → 저장하면 main에 커밋되고, GitHub Actions가 재빌드하면서 전부 적용된다.
- 카테고리를 삭제/이름 변경했을 때 기존 글이 조용히 미아가 되지 않도록 빌드 시 검증을 넣는다.

## 2. 현재 문제

카테고리 목록이 **3곳에 중복 하드코딩**되어 있다:

| 위치 | 역할 | 형태 |
| --- | --- | --- |
| `src/config/blog.ts` `CATEGORY_TREE` | 사이트 본체 (사이드바, 라우팅, 글 분류) | TS 객체 (트리 구조) |
| `public/admin/config.yml` | Sveltia CMS 글쓰기 시 카테고리 select | YAML options 목록 |
| `public/admin/write.html` | 자체 글쓰기 페이지의 카테고리 select | HTML `<option>` 목록 |

카테고리를 하나 추가/수정하려면 세 파일을 손으로 맞춰야 하고, 빠뜨리면 CMS와 사이트가 어긋난다.

## 3. 설계: 단일 소스 오브 트루스(SSOT)

### 3.1 데이터 파일: `src/data/categories.json`

카테고리 정의를 코드에서 데이터로 분리한다. CMS 편집과 상위 카테고리 선택(relation 위젯)을 쉽게 하기 위해 **트리 대신 평탄한 목록 + `parent` 필드** 구조를 쓴다:

```json
{
  "categories": [
    { "type": "category", "id": "projects", "label": "프로젝트", "icon": "folder" },
    { "type": "category", "id": "customisa2doom", "label": "customISA to DOOM", "icon": "folder" },
    { "type": "category", "id": "journal", "label": "일지", "icon": "document", "parent": "customisa2doom" },
    { "type": "divider" },
    { "type": "category", "id": "games", "label": "게임", "icon": "folder" },
    { "type": "category", "id": "game-a", "label": "게임A", "icon": "document", "parent": "games" },
    { "type": "category", "id": "game-b", "label": "게임B", "icon": "document", "parent": "games" },
    { "type": "category", "id": "game-c", "label": "게임C", "icon": "document", "parent": "games" },
    { "type": "category", "id": "thoughts", "label": "잡생각", "icon": "document" },
    { "type": "category", "id": "food", "label": "식사", "icon": "document" }
  ]
}
```

- **순서** = 목록 순서 (사이드바 표시 순서, 같은 부모 안에서의 순서)
- **중첩** = `parent`로 표현 (깊이 제한 없음, 현재는 2단계)
- **구분선** = `"type": "divider"` 항목 (기존 `CATEGORY_TREE`의 `type` 판별 방식과 동일)
- 나중에 i18n 계획(`docs/i18n-plan.md`)을 진행하면 `label`을 `{ "ko": "...", "en": "..." }`로 확장하면 된다 — 이 구조가 그대로 호환된다.

### 3.2 `src/config/blog.ts` 수정

- `CATEGORY_TREE` 하드코딩 배열을 삭제하고, `categories.json`을 import해서 평탄 목록 → 트리(`CategoryTreeItem[]`)로 변환하는 함수로 대체한다. (구분선 항목의 `id`는 JSON에 없으므로 변환 시 `divider-0` 식으로 자동 부여)
- 타입(`CategoryItem`, `CategoryTreeItem` 등)과 변환 로직만 남고, 데이터는 JSON에서 온다.
- `src/lib/blog.ts`의 `flattenCategories` 등 기존 헬퍼와 사용처(컴포넌트, 페이지)는 **수정 불필요** — `CATEGORY_TREE`가 여전히 같은 형태로 export되기 때문.
- `PRIMARY_NAV`의 `categoryId` 참조는 그대로 두되, 빌드 시 존재하는 id인지 검증한다(4장).

## 4. 사용처별 반영 방법

### 4.1 Sveltia CMS — 카테고리 관리 페이지 (핵심)

`public/admin/config.yml`에 **파일 컬렉션(file collection)** 을 추가한다:

```yaml
collections:
  - name: settings
    label: 설정
    files:
      - name: categories
        label: 카테고리 관리
        file: src/data/categories.json
        fields:
          - name: categories
            label: 카테고리 목록
            widget: list
            types:
              - name: category
                label: 카테고리
                widget: object
                fields:
                  - { name: id, label: ID, widget: string }
                  - { name: label, label: 이름, widget: string }
                  - name: icon
                    label: 아이콘
                    widget: select
                    options: [folder, document]
                    default: document
                  - name: parent
                    label: 상위 카테고리
                    widget: relation
                    collection: settings
                    file: categories
                    search_fields: ['categories.*.label']
                    value_field: 'categories.*.id'
                    display_fields: ['categories.*.label']
                    required: false
              - name: divider
                label: 구분선
                widget: object
                fields: []
```

- 가변 타입 목록(`types`)이라서 "추가" 버튼을 누르면 **카테고리 추가 / 구분선 추가**를 골라서 넣을 수 있다. 구분선은 입력 필드가 없는 항목으로, 드래그로 위치만 옮긴다.
- 관리 페이지(`/admin/`)에 "카테고리 관리" 메뉴가 생기고, 목록 항목을 **추가/삭제/드래그로 순서 변경/수정** 후 저장하면 `categories.json`이 main에 커밋된다.
- push → 기존 `deploy.yml`이 재빌드 → 사이트 전체 반영. **끝.**

### 4.2 Sveltia CMS — 글쓰기 시 카테고리 선택

blog 컬렉션의 category 필드를 하드코딩 select에서 **relation 위젯**으로 교체한다:

```yaml
- name: category
  label: Category
  widget: relation
  collection: settings
  file: categories
  search_fields: ['categories.*.label']
  value_field: 'categories.*.id'
  display_fields: ['categories.*.label']
```

카테고리 파일이 바뀌면 글쓰기 화면의 선택지도 자동으로 따라온다.

> **폴백**: Sveltia에서 파일 컬렉션 대상 relation 위젯(와일드카드 경로)이 제대로 동작하지 않으면, 빌드/커밋 시 `categories.json`에서 `config.yml`의 options를 재생성하는 소형 스크립트(`scripts/sync-categories.mjs`)로 대체한다. 관리 페이지 편집(4.1)은 그대로 유효하다.

### 4.3 자체 글쓰기 페이지 (`write.html`)

하드코딩된 `<option>`을 지우고, 페이지 로드 시 JSON을 fetch해서 select를 동적으로 채운다:

- `src/pages/categories.json.ts` — `categories.json`을 그대로 내보내는 Astro 정적 엔드포인트를 추가 (`/categories.json`으로 배포됨)
- `write.html` 스크립트에서 `fetch('/categories.json')` → `parent` 깊이에 따라 들여쓰기(`— 일지`)해서 `<option>` 생성
- 구분선 항목은 `<option disabled>` 또는 생략
- fetch 실패 시(오프라인 등) 안내 메시지 표시

### 4.4 사이트 본체

3.2에서 끝. 사이드바(`CategorySidebar.astro`), 카테고리 페이지(`blog/category/[...category].astro`), 글 목록 등은 전부 `CATEGORY_TREE`/`FLAT_CATEGORIES`를 통해 데이터를 받으므로 자동 반영된다.

## 5. 안전장치: 빌드 시 검증

카테고리를 CMS에서 쉽게 지울 수 있게 되면, 기존 글이 삭제된 카테고리를 참조하는 사고가 생기기 쉽다. 빌드가 **명확한 에러로 실패**하도록 한다:

1. **글 → 카테고리 검증**: `src/content.config.ts`의 `category: z.string()`을
   `z.string().refine(id => 존재하는 카테고리 id, { message: '...' })`로 강화.
   삭제된 카테고리를 참조하는 글이 있으면 빌드가 파일명과 함께 실패한다.
2. **JSON 자체 검증** (`blog.ts`의 로딩 시점):
   - `id` 중복 금지
   - `parent`가 존재하는 id를 가리키는지 (자기 자신/순환 참조 금지)
   - 구분선이 아닌 항목은 `label` 필수
3. **`PRIMARY_NAV` 검증**: `categoryId`가 존재하는지 확인.

CMS에서 저장 → 빌드 실패 시 GitHub Actions가 빨간불 + 이메일 알림을 주므로, 잘못된 수정을 바로 알 수 있다.

## 6. 카테고리 이름 변경 vs id 변경

- **이름(label) 변경**: 자유. JSON만 고치면 끝, 글은 id로 연결되므로 영향 없음. → 이게 가장 흔한 작업이고, 이 계획의 주 수혜 지점.
- **id 변경/삭제**: 해당 카테고리 글들의 frontmatter `category`도 함께 바꿔야 한다(5장 검증이 누락을 잡아줌). URL(`/blog/category/<id>/`)도 바뀌므로 자주 할 일은 아니다. 필요해지면 일괄 변경 스크립트를 나중에 추가할 수 있다.

## 7. 구현 단계

### Phase 1 — SSOT 전환 (사이트 본체)

1. `src/data/categories.json` 생성 (현재 `CATEGORY_TREE` 내용을 평탄 구조로 이관)
2. `src/config/blog.ts`를 JSON 로드 + 트리 변환으로 교체, 검증 로직(5장 2·3번) 추가
3. `content.config.ts` zod refine 추가 (5장 1번)
4. 빌드 + 로컬 확인: 사이드바/카테고리 페이지가 이전과 동일하게 나오는지

### Phase 2 — CMS 관리 페이지

1. `config.yml`에 settings 파일 컬렉션 추가 (4.1)
2. blog 컬렉션 category를 relation 위젯으로 교체 (4.2) — 안 되면 폴백 스크립트
3. `/admin/`에서 실제로 카테고리 추가→저장→커밋→재빌드→사이트 반영 end-to-end 테스트

### Phase 3 — write.html 연동

1. `/categories.json` 엔드포인트 추가
2. `write.html` select 동적 생성으로 교체
3. 글 발행 테스트

## 8. 결정 사항 / 열린 질문

1. **아이콘 종류** (확정): 현행 유지 — `folder`/`document` 2종만 CMS select에 노출.
2. **구분선 편집** (확정): 가변 타입 목록(`types`) 사용 — 항목 추가 시 "카테고리 / 구분선" 중 골라서 추가. 체크박스 없음.
3. **카테고리 삭제 시 글 처리** (확정): 빌드 실패로 알려주기 — 삭제된 카테고리를 참조하는 글이 있으면 빌드가 파일명과 함께 실패한다.
