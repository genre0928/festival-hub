-- 축제 허브 초기 스키마
-- regions: 대한민국 17개 시/도 마스터 테이블
create table if not exists public.regions (
  code text primary key,
  name text not null,
  name_en text,
  created_at timestamptz not null default now()
);

comment on table public.regions is '대한민국 17개 시/도 마스터 데이터';

-- festivals: 축제 정보
create table if not exists public.festivals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  region_code text not null references public.regions (code) on delete restrict,
  address text not null default '',
  start_date date not null,
  end_date date not null,
  category text not null,
  tags text[] not null default '{}',
  image_url text,
  latitude double precision,
  longitude double precision,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint festivals_date_range_check check (end_date >= start_date)
);

comment on table public.festivals is '전국 축제 정보';
comment on column public.festivals.latitude is '추후 카카오맵 연동 시 사용할 좌표';
comment on column public.festivals.longitude is '추후 카카오맵 연동 시 사용할 좌표';

create index if not exists festivals_region_code_idx on public.festivals (region_code);
create index if not exists festivals_date_range_idx on public.festivals (start_date, end_date);

-- updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists festivals_set_updated_at on public.festivals;
create trigger festivals_set_updated_at
  before update on public.festivals
  for each row
  execute function public.set_updated_at();

-- festivals_with_status: CURRENT_DATE 기준 진행 상태를 계산해 노출하는 뷰
-- (generated column은 CURRENT_DATE 같은 비고정 함수를 쓸 수 없어 뷰로 처리)
create or replace view public.festivals_with_status as
select
  f.*,
  case
    when current_date < f.start_date then 'upcoming'
    when current_date > f.end_date then 'ended'
    else 'ongoing'
  end as status
from public.festivals f;

-- RLS: 익명 사용자는 조회만 가능
alter table public.regions enable row level security;
alter table public.festivals enable row level security;

drop policy if exists "regions are publicly readable" on public.regions;
create policy "regions are publicly readable"
  on public.regions for select
  using (true);

drop policy if exists "festivals are publicly readable" on public.festivals;
create policy "festivals are publicly readable"
  on public.festivals for select
  using (true);

-- seed: 17개 시/도
insert into public.regions (code, name, name_en) values
  ('seoul', '서울특별시', 'Seoul'),
  ('incheon', '인천광역시', 'Incheon'),
  ('gyeonggi', '경기도', 'Gyeonggi-do'),
  ('gangwon', '강원특별자치도', 'Gangwon-do'),
  ('chungbuk', '충청북도', 'Chungcheongbuk-do'),
  ('chungnam', '충청남도', 'Chungcheongnam-do'),
  ('sejong', '세종특별자치시', 'Sejong'),
  ('daejeon', '대전광역시', 'Daejeon'),
  ('gyeongbuk', '경상북도', 'Gyeongsangbuk-do'),
  ('gyeongnam', '경상남도', 'Gyeongsangnam-do'),
  ('daegu', '대구광역시', 'Daegu'),
  ('ulsan', '울산광역시', 'Ulsan'),
  ('busan', '부산광역시', 'Busan'),
  ('jeonbuk', '전북특별자치도', 'Jeonbuk-do'),
  ('jeonnam', '전라남도', 'Jeollanam-do'),
  ('gwangju', '광주광역시', 'Gwangju'),
  ('jeju', '제주특별자치도', 'Jeju-do')
on conflict (code) do nothing;
