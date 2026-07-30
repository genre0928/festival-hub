-- 신규(NEW) 축제 표시/정렬/검색 기능을 위해 클라이언트(anon)가 festival_new_detections를
-- 읽을 수 있도록 허용한다. 0003에서 만든 "no anon access" 정책은 all 커맨드를 막는
-- permissive 정책이라, select에 한해서만 허용하는 정책을 별도로 추가하면 select는 OR로
-- 허용되고 insert/update/delete는 여전히 service_role(Edge Function)만 가능하다.

drop policy if exists "festival_new_detections public read" on public.festival_new_detections;
create policy "festival_new_detections public read"
  on public.festival_new_detections for select
  using (true);
