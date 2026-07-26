-- 알림 주기를 매주/매달 중 하나만 고르게 했던 것을, regions처럼 배열로 바꿔 복수 선택을
-- 허용한다. 빈 배열이면 정기 다이제스트를 받지 않는다(신규 축제 알림은 별개로 계속 받음).

alter table public.subscribers add column if not exists frequencies text[] not null default '{}';

update public.subscribers
set frequencies = case when frequency is not null then array[frequency] else '{}'::text[] end
where frequencies = '{}';

alter table public.subscribers drop column if exists frequency;

alter table public.subscribers drop constraint if exists subscribers_frequencies_check;
alter table public.subscribers
  add constraint subscribers_frequencies_check check (frequencies <@ array['weekly', 'monthly']::text[]);

comment on column public.subscribers.frequencies is
  '받아볼 정기 알림 주기(복수 선택 가능): weekly, monthly. 빈 배열이면 정기 다이제스트는 안 받고 신규 축제 알림만 받음.';
