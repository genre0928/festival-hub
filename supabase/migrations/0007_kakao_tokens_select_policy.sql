-- kakao_tokens에 SELECT 정책이 하나도 없어서(0005에서 의도적으로 뺐음) 클라이언트의
-- upsert(INSERT ... ON CONFLICT DO UPDATE)가 "new row violates row-level security
-- policy"로 매번 실패했다. Postgres는 ON CONFLICT DO UPDATE 경로를 처리하려면 RLS로
-- 그 행이 조회 가능해야 하는데, SELECT 정책이 전혀 없으면 실제로 충돌이 없는 순수
-- INSERT여도 이 경로 자체를 안전하게 처리하지 못하고 거부한다(JWT/세션은 정상이었음을
-- sub/role 클레임까지 직접 확인해서 검증함).
--
-- 본인 행만 보이는 SELECT 정책을 추가한다 - 이미 자기가 아는 자기 토큰을 다시 읽는
-- 것뿐이라 보안상 새로 노출되는 정보는 없다(다른 사용자/anon은 여전히 못 봄).
drop policy if exists "kakao_tokens select own" on public.kakao_tokens;
create policy "kakao_tokens select own"
  on public.kakao_tokens for select
  using (auth.uid() = user_id);
