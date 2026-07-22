-- 0002에서 만든 부분 유니크 인덱스(festivals_source_external_id_key, WHERE external_id is not null)는
-- Postgres가 ON CONFLICT (source, external_id) 추론에 쓸 수 없다 (부분 인덱스는 WHERE 절이
-- ON CONFLICT 쪽에도 동일하게 있어야 매칭됨). supabase-js의 upsert(onConflict: "source,external_id")가
-- WHERE 절 없이 ON CONFLICT (source, external_id)를 생성하기 때문에 "no unique or exclusion
-- constraint matching the ON CONFLICT specification" 오류가 발생했다.
--
-- external_id가 NULL인 행끼리는 유니크 제약에서 서로 다른 값으로 취급되어 충돌하지 않으므로
-- (Postgres 표준 동작), 부분 인덱스 없이 일반 유니크 제약으로 바꿔도 manual 소스의 다건 NULL은 여전히 허용된다.
drop index if exists public.festivals_source_external_id_key;

alter table public.festivals
  add constraint festivals_source_external_id_key unique (source, external_id);
