create table if not exists public.student_study_plans (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.profiles(id) on delete cascade,
  exam_program text not null check(exam_program in ('SAT English','EST English','ACT English')),
  target_date date,
  current_score numeric(6,2),
  target_score numeric(6,2),
  weekly_hours numeric(5,2) not null default 5 check(weekly_hours>0 and weekly_hours<=80),
  status text not null default 'active' check(status in ('active','paused','completed')),
  plan_json jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists student_study_plans_student_idx on public.student_study_plans(student_profile_id,updated_at desc);
alter table public.student_study_plans enable row level security;
grant select,insert,update on public.student_study_plans to authenticated;
drop policy if exists student_study_plans_read_related on public.student_study_plans;
create policy student_study_plans_read_related on public.student_study_plans for select to authenticated
using(
  student_profile_id=auth.uid()
  or exists(select 1 from public.parent_student_links l where l.parent_profile_id=auth.uid() and l.student_profile_id=student_study_plans.student_profile_id)
  or private.current_user_role() in ('admin','teacher','assistant')
);
drop policy if exists student_study_plans_insert_related on public.student_study_plans;
create policy student_study_plans_insert_related on public.student_study_plans for insert to authenticated
with check(
  created_by=auth.uid()
  and (student_profile_id=auth.uid() or private.current_user_role() in ('admin','teacher','assistant'))
);
drop policy if exists student_study_plans_update_related on public.student_study_plans;
create policy student_study_plans_update_related on public.student_study_plans for update to authenticated
using(student_profile_id=auth.uid() or private.current_user_role() in ('admin','teacher','assistant'))
with check(student_profile_id=auth.uid() or private.current_user_role() in ('admin','teacher','assistant'));
