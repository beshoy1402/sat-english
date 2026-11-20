create table if not exists public.exam_attempt_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  student_profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check(event_type in ('visibility_hidden','window_blur','copy','paste','context_menu','fullscreen_exit')),
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists exam_attempt_events_attempt_idx on public.exam_attempt_events(attempt_id,created_at);
create index if not exists exam_attempt_events_student_idx on public.exam_attempt_events(student_profile_id,created_at desc);
alter table public.exam_attempt_events enable row level security;
revoke all on public.exam_attempt_events from anon,authenticated;
grant select on public.exam_attempt_events to authenticated;
drop policy if exists exam_attempt_events_read_related on public.exam_attempt_events;
create policy exam_attempt_events_read_related on public.exam_attempt_events for select to authenticated
using(student_profile_id=auth.uid() or private.current_user_role() in ('admin','teacher','assistant'));

create or replace function public.exam_record_integrity_event(p_attempt_id uuid,p_event_type text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_attempt public.exam_attempts; v_id uuid;
begin
  if private.current_user_role() <> 'student' then raise exception 'Student role required'; end if;
  if p_event_type not in ('visibility_hidden','window_blur','copy','paste','context_menu','fullscreen_exit') then raise exception 'Unsupported integrity event'; end if;
  select * into v_attempt from public.exam_attempts where id=p_attempt_id and student_profile_id=auth.uid() for update;
  if not found or v_attempt.status<>'in_progress' then raise exception 'No active exam attempt found'; end if;
  if v_attempt.started_at + make_interval(mins=>coalesce(v_attempt.duration_minutes,0)) < now() then raise exception 'Exam time has expired'; end if;
  insert into public.exam_attempt_events(attempt_id,student_profile_id,event_type,event_data)
  values(p_attempt_id,auth.uid(),p_event_type,'{}'::jsonb) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.exam_record_integrity_event(uuid,text) from public,anon;
grant execute on function public.exam_record_integrity_event(uuid,text) to authenticated;
