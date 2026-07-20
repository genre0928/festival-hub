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

- 스키마: [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — `regions`, `festivals` 테이블과 `festivals_with_status` 뷰(진행중/예정/종료 계산). [`0002_festival_sync.sql`](supabase/migrations/0002_festival_sync.sql) — 외부 데이터 동기화용 `external_id`/`source` 컬럼과 `(source, external_id)` 유니크 인덱스 추가.
- Supabase CLI로 마이그레이션 적용: `supabase db push` (프로젝트 링크 후)
- 클라이언트: [`app/lib/supabase/client.ts`](app/lib/supabase/client.ts) — `.env`가 없으면 `null`을 반환하며, 이 경우 [`app/lib/festivals.ts`](app/lib/festivals.ts)가 자동으로 mock 데이터로 대체한다. `.env`에 Supabase 정보를 채우고 `festivals` 테이블에 데이터가 있으면 실제 DB에서 조회한다.

## TourAPI 연동 (한국관광공사 축제 정보 자동 수집)

[`supabase/functions/sync-festivals`](supabase/functions/sync-festivals/index.ts) Edge Function이 한국관광공사 TourAPI(`searchFestival2`)에서 축제 목록을 가져와 `festivals` 테이블에 `upsert` 한다. `external_id`(TourAPI `contentid`) 기준으로 중복 없이 반복 실행 가능하며, 지역은 TourAPI `areacode` → 없으면 주소 텍스트로 보조 매칭, 카테고리는 제목 키워드로 대략 분류한다(정밀도가 필요하면 `guessCategory` 함수를 다듬을 것).

1. data.go.kr에서 **한국관광공사_국문 관광정보 서비스_GW** API를 활용신청하고 인증키(인코딩 값)를 발급받는다.
2. Supabase 프로젝트를 CLI로 링크: `supabase link --project-ref <project-ref>`
3. TourAPI 키를 Edge Function 시크릿으로 등록 (프론트 `.env`에는 절대 넣지 않는다):
   ```bash
   supabase secrets set TOUR_API_KEY="<발급받은 인코딩 키>"
   ```
4. 함수 배포:
   ```bash
   supabase functions deploy sync-festivals
   ```
5. 수동 실행(테스트):
   ```bash
   supabase functions invoke sync-festivals
   ```
6. 주기적 자동 실행이 필요하면 `pg_cron` + `pg_net` 확장을 켠 뒤, 아래처럼 매일 함수를 호출하도록 예약한다 (Supabase 대시보드 SQL Editor에서 실행, `<project-ref>`/`<anon-or-service-key>`는 실제 값으로 교체):
   ```sql
   select cron.schedule(
     'sync-festivals-daily',
     '0 18 * * *', -- UTC 18:00 = KST 03:00
     $$
     select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/sync-festivals',
       headers := jsonb_build_object('Authorization', 'Bearer <anon-or-service-key>')
     );
     $$
   );
   ```

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
