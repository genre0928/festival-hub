-- 카카오톡 알림 기능을 위한 스키마.
-- 실제 발송 방식(카카오로그인 '나에게 보내기' vs 알림톡/비즈메시지)이 아직 정해지지 않아
-- channel_type으로 두 방식 모두 수용 가능하게 설계하고, 실제 발송 로직은 별도 Edge Function으로
-- 추후 추가한다. 지금은 구독 정보 저장 + 신규 축제 감지(트래킹)까지만 구현.

-- subscribers: 카카오톡 알림을 받을 구독자
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  -- 'kakao_login' (카카오로그인 사용자 식별자) | 'phone' (알림톡용 전화번호) 등, 발송 방식 확정 시 확장
  channel_type text not null,
  channel_identifier text not null,
  -- 'weekly' | 'monthly'
  frequency text not null default 'weekly',
  -- 관심 지역 코드 배열 (app/components/map/region-data.ts의 code). 빈 배열이면 전체 지역.
  regions text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscribers_channel_type_check check (channel_type in ('kakao_login', 'phone')),
  constraint subscribers_frequency_check check (frequency in ('weekly', 'monthly')),
  unique (channel_type, channel_identifier)
);

comment on table public.subscribers is '카카오톡 정기/관심지역 알림 구독자';

drop trigger if exists subscribers_set_updated_at on public.subscribers;
create trigger subscribers_set_updated_at
  before update on public.subscribers
  for each row
  execute function public.set_updated_at();

-- festival_new_detections: 동기화 과정에서 "이전에 없던" 축제가 새로 생겼을 때 기록.
-- notified_at이 null인 행이 아직 알림을 보내지 않은 대상.
create table if not exists public.festival_new_detections (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivals (id) on delete cascade,
  detected_at timestamptz not null default now(),
  notified_at timestamptz
);

comment on table public.festival_new_detections is '신규로 감지된(처음 upsert된) 축제 기록. 카카오톡 신규 축제 알림 발송 대상 트래킹용.';

create index if not exists festival_new_detections_pending_idx
  on public.festival_new_detections (detected_at)
  where notified_at is null;

alter table public.subscribers enable row level security;
alter table public.festival_new_detections enable row level security;

-- 구독자 본인 정보/알림 기록은 service_role(Edge Function)에서만 다룬다. 클라이언트 anon 접근 차단.
drop policy if exists "subscribers no anon access" on public.subscribers;
create policy "subscribers no anon access"
  on public.subscribers for all
  using (false);

drop policy if exists "festival_new_detections no anon access" on public.festival_new_detections;
create policy "festival_new_detections no anon access"
  on public.festival_new_detections for all
  using (false);

-- 아직 알림을 보내지 않은 신규 축제 + 축제 정보를 한번에 볼 수 있는 뷰 (추후 발송 Edge Function에서 사용)
create or replace view public.pending_new_festival_notifications as
select
  d.id as detection_id,
  d.detected_at,
  f.*
from public.festival_new_detections d
join public.festivals f on f.id = d.festival_id
where d.notified_at is null;
