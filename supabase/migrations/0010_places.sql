-- places: 지역별 관광지/숙소/음식점 정보. TourAPI areaBasedList2로 지역+콘텐츠타입별로
-- 동기화한다(sync-places Edge Function). festivals와 동일한 source/external_id idempotent
-- upsert 패턴을 쓴다.

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null check (category in ('attraction', 'lodging', 'restaurant')),
  region_code text not null references public.regions (code) on delete restrict,
  sigungu text,
  address text not null default '',
  tel text,
  tags text[] not null default '{}',
  image_url text,
  latitude double precision,
  longitude double precision,
  source_url text,
  external_id text not null,
  source text not null default 'tourapi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint places_source_external_id_key unique (source, external_id)
);

comment on table public.places is '지역별 관광지/숙소/음식점 정보(TourAPI areaBasedList2 동기화)';
comment on column public.places.category is 'attraction(관광지) | lodging(숙소) | restaurant(음식점)';

create index if not exists places_region_code_idx on public.places (region_code);
create index if not exists places_category_idx on public.places (category);

drop trigger if exists places_set_updated_at on public.places;
create trigger places_set_updated_at
  before update on public.places
  for each row
  execute function public.set_updated_at();

alter table public.places enable row level security;

drop policy if exists "places are publicly readable" on public.places;
create policy "places are publicly readable"
  on public.places for select
  using (true);
