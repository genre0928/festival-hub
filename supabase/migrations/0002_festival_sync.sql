-- TourAPI 연동을 위한 컬럼 추가: 외부 데이터 소스 식별 및 중복 없는 upsert 지원
alter table public.festivals
  add column if not exists external_id text,
  add column if not exists source text not null default 'manual';

comment on column public.festivals.external_id is 'TourAPI contentid 등 외부 데이터 소스의 고유 식별자. upsert(onConflict) 대상 키.';
comment on column public.festivals.source is '데이터 출처: manual(수기 입력) | tourapi(한국관광공사 TourAPI 동기화)';

-- 같은 소스 내에서만 external_id가 유일하면 되므로 (source, external_id) 복합 유니크로 설정
create unique index if not exists festivals_source_external_id_key
  on public.festivals (source, external_id)
  where external_id is not null;
