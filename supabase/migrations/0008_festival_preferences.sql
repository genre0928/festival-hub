-- 로그인한 사용자가 축제별로 즐겨찾기/관심없음을 표시할 수 있게 한다.
-- 카카오 로그인 사용자 기준(auth.uid())으로 기록해서 관리·필터에 쓴다.
create table if not exists public.festival_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  festival_id uuid not null references public.festivals (id) on delete cascade,
  preference text not null check (preference in ('favorite', 'not_interested')),
  created_at timestamptz not null default now(),
  primary key (user_id, festival_id)
);

comment on table public.festival_preferences is '로그인한 사용자의 축제별 즐겨찾기/관심없음 표시';

-- kakao_tokens에서 SELECT 정책을 빼먹어 upsert(ON CONFLICT DO UPDATE)가 깨졌던 걸 겪어서,
-- 여기는 처음부터 for all(=SELECT/INSERT/UPDATE/DELETE 전부)로 본인 행 전체를 허용한다.
alter table public.festival_preferences enable row level security;

drop policy if exists "festival_preferences own row" on public.festival_preferences;
create policy "festival_preferences own row"
  on public.festival_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
