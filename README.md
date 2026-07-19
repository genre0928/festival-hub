# 축제 허브 (festival-hub)

국내에서 개최되는 축제 정보를 지역·기간별로 모아 보여주는 웹사이트.

## 기술 스택

- React Router v7 (framework mode, SPA)
- TypeScript
- Tailwind CSS v4
- lucide-react
- Magic UI 스타일 컴포넌트 (`app/components/magicui`)
- Supabase (`@supabase/supabase-js`)

## 주요 기능

- 봄/여름/가을/겨울 계절 테마 자동 전환 (네비게이션 바에서 수동 미리보기도 가능)
- 지역별 도트 지도 + 축제 리스트 연동 필터링
- 검색(축제명/태그), 지역, 날짜, 진행 상태(진행중/예정/종료)별 필터
- URL 쿼리 파라미터와 필터 상태 동기화 (검색 결과 링크 공유 가능)

카카오맵 API 연동, 카카오톡 신규 축제 알림 발송 기능은 API 키/사업자 계정 확보 후 별도로 추가 예정.

## 시작하기

```bash
npm install
cp .env.example .env   # Supabase 프로젝트 URL/anon key 입력 (선택, 없으면 mock 데이터로 동작)
npm run dev
```

`http://localhost:5173` 에서 확인.

## Supabase 연동

- 스키마: [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — `regions`, `festivals` 테이블과 `festivals_with_status` 뷰(진행중/예정/종료 계산) 포함.
- Supabase CLI로 마이그레이션 적용: `supabase db push` (프로젝트 링크 후)
- 클라이언트: [`app/lib/supabase/client.ts`](app/lib/supabase/client.ts) — env가 없으면 `null`을 반환하며, 현재는 [`app/lib/festivals.ts`](app/lib/festivals.ts)의 mock 데이터 seam을 통해 화면에 데이터를 공급한다. 실제 연동 시 이 seam 내부만 Supabase 쿼리로 교체하면 됨.

## 빌드 / 타입체크

```bash
npm run typecheck
npm run build
```

## 브랜치 전략 (Gitflow)

- `main`: 배포 가능한 안정 버전
- `develop`: 다음 릴리스를 위한 통합 브랜치
- `feature/*`: 기능 단위 작업 브랜치, `develop`에서 분기 후 `--no-ff`로 다시 병합

원격 저장소 연결 시:

```bash
git remote add origin <repo-url>
git push -u origin main
git push -u origin develop
```

---

Built with React Router.
