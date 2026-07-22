# 축제 허브 (festival-hub)

국내에서 개최되는 축제 정보를 지역·기간별로 모아 보여주는 웹사이트.

**배포**: https://festival-hub-iota.vercel.app (Vercel, `main` 브랜치 자동 배포)

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

카카오맵 API 연동, 카카오톡 메시지 발송(정기 알림/신규 축제 알림)은 API 키·발송 방식 확정 후 별도로 추가 예정. 다만 신규 축제 감지 트래킹과 구독자 스키마는 미리 구축해둠 (아래 "카카오톡 알림" 절 참고).

## 시작하기

```bash
npm install
cp .env.example .env   # Supabase 프로젝트 URL/anon key 입력 (선택, 없으면 mock 데이터로 동작)
npm run dev
```

`http://localhost:5173` 에서 확인.

## Supabase 연동

- 스키마: [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — `regions`, `festivals` 테이블과 `festivals_with_status` 뷰(진행중/예정/종료 계산). [`0002_festival_sync.sql`](supabase/migrations/0002_festival_sync.sql) — 외부 데이터 동기화용 `external_id`/`source` 컬럼과 `(source, external_id)` 유니크 인덱스 추가. [`0003_notifications.sql`](supabase/migrations/0003_notifications.sql) — 카카오톡 알림용 `subscribers`(구독자), `festival_new_detections`(신규 축제 감지 기록) 테이블과 `pending_new_festival_notifications` 뷰.
- Supabase CLI로 마이그레이션 적용: `supabase db push` (프로젝트 링크 후)
- 클라이언트: [`app/lib/supabase/client.ts`](app/lib/supabase/client.ts) — `.env`가 없으면 `null`을 반환하며, 이 경우 [`app/lib/festivals.ts`](app/lib/festivals.ts)가 자동으로 mock 데이터로 대체한다. `.env`에 Supabase 정보를 채우고 `festivals` 테이블에 데이터가 있으면 실제 DB에서 조회한다.

## TourAPI 연동 (한국관광공사 축제 정보 자동 수집)

[`supabase/functions/sync-festivals`](supabase/functions/sync-festivals/index.ts) Edge Function이 한국관광공사 TourAPI(`searchFestival2`)에서 축제 목록을 가져와 `festivals` 테이블에 `upsert` 한다. `external_id`(TourAPI `contentid`) 기준으로 중복 없이 반복 실행 가능하며, 지역은 `lDongRegnCd`(법정동 시도코드) 우선 매칭 → 실패 시 주소 텍스트 보조 매칭(`areacode`는 실제 응답에서 거의 항상 비어있어 최후 fallback으로만 사용), 카테고리는 제목 키워드로 대략 분류한다(정밀도가 필요하면 `guessCategory` 함수를 다듬을 것).

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

## 축제 상세 모달 (주변 관광지·음식점·숙소)

축제 카드를 클릭하면 상세 모달이 열린다([`app/components/festival/festival-detail-modal.tsx`](app/components/festival/festival-detail-modal.tsx)):

- 상단: 축제 상세 정보(이미지, 상태, 카테고리, 설명, 주소, 기간, 태그)
- 하단: "같이 가면 좋은 주변 관광지", 주변 음식점, 주변 숙소 — 축제의 위경도 기준 반경 5km 이내 정보를 가로 스크롤 카드로 표시

주변 정보는 [`supabase/functions/nearby-info`](supabase/functions/nearby-info/index.ts) Edge Function이 **한국관광공사_무장애 여행 정보_GW**(`KorWithService2`, `locationBasedList2`) API를 호출해서 가져온다(관광지=contentTypeId 12, 음식점=39, 숙박=32). `apis.data.go.kr`는 브라우저에서 직접 호출하면 CORS로 막히기 때문에 프론트는 이 Edge Function만 호출한다(`app/lib/nearby.ts`).

- 이 API는 TourAPI(`KorService2`)와 별도로 활용신청이 필요하다 — [무장애 여행 정보_GW 신청 페이지](https://www.data.go.kr/data/15101897/openapi.do)에서 활용신청 후 `TOUR_API_KEY` 시크릿을 그대로 재사용하면 된다.
- 배포: `supabase functions deploy nearby-info`
- 축제에 좌표(`latitude`/`longitude`)가 없으면 주변 정보 섹션 대신 안내 문구만 표시한다.

## 카카오톡 알림 (진행 중)

계획 중인 기능은 두 가지:

1. **정기 알림** — 구독자가 설정한 주기(주간/월간)·관심 지역 기준으로 축제 정보를 요약해 보냄
2. **신규 축제 알림** — 동기화 과정에서 새로 발견된 축제를 바로 알려줌

카카오톡 메시지 발송 방식은 아직 정하지 않았고(카카오로그인 "나에게 보내기" vs 알림톡/친구톡 비즈메시지 — 방식마다 사전 준비물이 다름), 그래서 **발송 로직 없이 스키마와 트래킹만 먼저 구축**해뒀다:

- `subscribers` 테이블: `channel_type`("kakao_login" | "phone")과 `channel_identifier`로 발송 방식이 정해지면 그대로 확장 가능. `frequency`(weekly/monthly), `regions`(관심 지역 코드 배열, 빈 배열=전체)를 저장.
- `festival_new_detections` 테이블: [`sync-festivals`](supabase/functions/sync-festivals/index.ts)가 매 실행마다 이전에 없던 `external_id`를 판별해 자동으로 기록한다(`notified_at`이 `null`이면 미발송). 응답 JSON에도 `newlyDetected` 건수가 포함됨.
- `pending_new_festival_notifications` 뷰: 아직 알림을 안 보낸 신규 축제 + 축제 정보를 한 번에 조회. 발송 Edge Function을 만들 때 이 뷰만 읽고, 보낸 뒤 해당 `detection_id`로 `notified_at`을 채우면 됨.

발송 방식이 정해지면 `subscribers`를 조회해 대상자를 추리고, 카카오 API를 호출하는 Edge Function(`send-new-festival-alerts`, `send-digest` 등)을 추가하는 순서로 이어가면 된다.

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
