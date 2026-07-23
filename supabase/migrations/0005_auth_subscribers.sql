-- subscribers를 실제 로그인(카카오 로그인, Supabase Auth) 사용자와 직접 연결하도록 재설계.
-- 0003에서 로그인 도입 전 임시로 만들어둔 channel_type/channel_identifier는 실 데이터가
-- 없는 상태라 안전하게 컬럼을 교체한다.

alter table public.subscribers drop constraint if exists subscribers_channel_type_channel_identifier_key;
alter table public.subscribers drop constraint if exists subscribers_channel_type_check;
alter table public.subscribers drop column if exists channel_type;
alter table public.subscribers drop column if exists channel_identifier;

-- subscribers 테이블에 아직 실 데이터가 없어(비어있음을 확인함) not null/unique를 바로 적용한다.
alter table public.subscribers
  add column if not exists user_id uuid not null references auth.users (id) on delete cascade,
  add constraint subscribers_user_id_key unique (user_id),
  add column if not exists kakao_connected boolean not null default false;

comment on table public.subscribers is '로그인한 사용자의 카카오톡 정기/관심지역 알림 구독 설정';
comment on column public.subscribers.kakao_connected is 'kakao_tokens에 유효한 토큰이 저장되어 실제 발송이 가능한 상태인지';
comment on column public.subscribers.frequency is '정기 알림 주기: weekly | monthly ("이달의 축제정보"는 monthly)';
comment on column public.subscribers.regions is '관심 지역 코드 배열. 빈 배열이면 전체 지역 대상.';

-- RLS: 로그인한 본인만 자기 구독 정보를 읽고/쓸 수 있다. service_role(Edge Function)은 RLS 우회.
drop policy if exists "subscribers no anon access" on public.subscribers;
drop policy if exists "subscribers own row" on public.subscribers;
create policy "subscribers own row"
  on public.subscribers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- kakao_tokens: 카카오 로그인 시 발급받은 talk_message 스코프 access/refresh token 저장.
-- 탈취 위험을 줄이기 위해 본인도 값을 다시 읽을 수는 없게(select 정책 없음) 하고,
-- 로그인 직후 insert/update만 허용한다. 실제 발송 시엔 service_role로만 조회한다.
create table if not exists public.kakao_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

comment on table public.kakao_tokens is '카카오 로그인으로 발급받은 talk_message 스코프 토큰. 카카오톡 발송 Edge Function 전용.';

drop trigger if exists kakao_tokens_set_updated_at on public.kakao_tokens;
create trigger kakao_tokens_set_updated_at
  before update on public.kakao_tokens
  for each row
  execute function public.set_updated_at();

alter table public.kakao_tokens enable row level security;

drop policy if exists "kakao_tokens insert own" on public.kakao_tokens;
create policy "kakao_tokens insert own"
  on public.kakao_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "kakao_tokens update own" on public.kakao_tokens;
create policy "kakao_tokens update own"
  on public.kakao_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
