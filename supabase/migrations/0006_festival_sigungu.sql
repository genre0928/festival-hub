-- festivals에 시/군/구 단위 상세 지역을 추가한다. region_code(17개 시/도)만으로는
-- "경상북도 안에서도 구미시만" 같은 상세 필터를 걸 수 없어, TourAPI 주소(addr1)에서
-- 파싱한 시/군/구 이름을 자유 텍스트로 저장한다(전국 시군구 코드 테이블을 새로 두지 않고
-- 표시/필터 용도로만 쓰는 값이라 FK 없는 text로 충분하다). 세종처럼 시/군/구 단위가 없는
-- 지역은 null로 남는다.
alter table public.festivals add column if not exists sigungu text;

comment on column public.festivals.sigungu is
  '시/군/구 단위 상세 지역명(예: 구미시). 주소에서 파싱한 자유 텍스트, 없으면 null.';

create index if not exists festivals_region_sigungu_idx
  on public.festivals (region_code, sigungu);
