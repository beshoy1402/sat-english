-- Correct staff authorization and exam access policies; protect answer keys and add server-graded attempts.
drop policy if exists assignment_targets_insert_staff on public.assignment_targets;
create policy assignment_targets_insert_staff on public.assignment_targets for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant')));
drop policy if exists assignment_targets_update_staff on public.assignment_targets;
create policy assignment_targets_update_staff on public.assignment_targets for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant')));
drop policy if exists assignment_targets_delete_staff on public.assignment_targets;
create policy assignment_targets_delete_staff on public.assignment_targets for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant')));

drop policy if exists course_access_insert_staff on public.course_access;
create policy course_access_insert_staff on public.course_access for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant')));
drop policy if exists course_access_update_staff on public.course_access;
create policy course_access_update_staff on public.course_access for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant')));
drop policy if exists course_access_delete_staff on public.course_access;
create policy course_access_delete_staff on public.course_access for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant')));

drop policy if exists exam_assignments_insert_staff on public.exam_assignments;
create policy exam_assignments_insert_staff on public.exam_assignments for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant')));
drop policy if exists exam_assignments_update_staff on public.exam_assignments;
create policy exam_assignments_update_staff on public.exam_assignments for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant')));
drop policy if exists exam_assignments_delete_staff on public.exam_assignments;
create policy exam_assignments_delete_staff on public.exam_assignments for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant')));

drop policy if exists assignments_read_authorized on public.assignments;
create policy assignments_read_authorized on public.assignments for select to authenticated
using (
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant'))
  or (status='published' and exists (
    select 1 from public.assignment_targets t
    where t.assignment_id=assignments.id and t.student_profile_id=(select auth.uid())
  ))
);
drop policy if exists courses_read_staff_or_published_access on public.courses;
create policy courses_read_staff_or_published_access on public.courses for select to authenticated
using (
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant','developer','designer'))
  or (status='published' and exists (
    select 1 from public.course_access ca
    where ca.course_id=courses.id and ca.student_profile_id=(select auth.uid())
      and ca.status='active' and (ca.starts_at is null or ca.starts_at<=now())
      and (ca.expires_at is null or ca.expires_at>now())
  ))
);
drop policy if exists exams_read_authorized on public.exams;
create policy exams_read_authorized on public.exams for select to authenticated
using (
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('admin','teacher','assistant'))
  or (status='published' and exists (
    select 1 from public.exam_assignments ea
    where ea.exam_id=exams.id and ea.student_profile_id=(select auth.uid())
      and (ea.available_from is null or ea.available_from<=now())
      and (ea.available_until is null or ea.available_until>now())
  ))
);

-- Keep question prompts and options readable, but never expose the answer key through direct table queries.
revoke select on table public.questions from anon, authenticated;
grant select (id,exam_id,prompt,passage,image_path,question_type,choices,explanation,topic,difficulty,points,sort_order,created_by,created_at)
on table public.questions to authenticated;

alter table public.exam_attempts add column if not exists auto_score numeric not null default 0;
alter table public.exam_attempts add column if not exists manual_score numeric;
alter table public.exam_attempts add column if not exists max_score numeric not null default 0;
alter table public.exam_attempts add column if not exists manual_review_required boolean not null default false;
alter table public.exam_attempts add column if not exists review_feedback text;
alter table public.exam_attempts add column if not exists reviewed_by uuid references public.profiles(id);
alter table public.exam_attempts add column if not exists reviewed_at timestamptz;

create or replace function public.staff_list_questions()
returns setof public.questions
language plpgsql
security definer
set search_path=''
as $$
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant')) then
    raise exception 'Staff access required';
  end if;
  return query select q.* from public.questions q order by q.exam_id nulls first,q.sort_order,q.created_at;
end;
$$;

create or replace function public.exam_get_questions(p_exam_id uuid)
returns table(
  id uuid, exam_id uuid, prompt text, passage text, image_path text,
  question_type text, choices jsonb, answer_key jsonb, explanation text,
  topic text, difficulty text, points numeric, sort_order integer
)
language plpgsql
security definer
set search_path=''
as $$
declare v_role public.app_role;
begin
  select p.role into v_role from public.profiles p where p.id=auth.uid() and p.is_active;
  if v_role in ('admin','teacher','assistant') then
    return query select q.id,q.exam_id,q.prompt,q.passage,q.image_path,q.question_type,q.choices,q.answer_key,q.explanation,q.topic,q.difficulty,q.points,q.sort_order
      from public.questions q where q.exam_id=p_exam_id order by q.sort_order,q.created_at;
  elsif v_role='student' and exists(
    select 1 from public.exam_assignments ea join public.exams e on e.id=ea.exam_id
    where ea.exam_id=p_exam_id and ea.student_profile_id=auth.uid() and e.status='published'
      and (ea.available_from is null or ea.available_from<=now())
      and (ea.available_until is null or ea.available_until>now())
  ) then
    return query select q.id,q.exam_id,q.prompt,q.passage,q.image_path,q.question_type,q.choices,null::jsonb,q.explanation,q.topic,q.difficulty,q.points,q.sort_order
      from public.questions q where q.exam_id=p_exam_id order by q.sort_order,q.created_at;
  else
    raise exception 'You are not authorized to view this exam';
  end if;
end;
$$;

create or replace function public.exam_start_attempt(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_duration integer; v_status public.assignment_status; v_starts timestamptz; v_ends timestamptz; v_attempt public.exam_attempts;
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='student') then
    raise exception 'An active student account is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_exam_id::text||':'||auth.uid()::text,0));
  select e.duration_minutes,e.status,e.starts_at,e.ends_at into v_duration,v_status,v_starts,v_ends
  from public.exams e where e.id=p_exam_id;
  if not found or v_status<>'published' then raise exception 'This exam is not available'; end if;
  if v_starts is not null and v_starts>now() then raise exception 'This exam has not started yet'; end if;
  if v_ends is not null and v_ends<=now() then raise exception 'This exam has ended'; end if;
  if not exists(select 1 from public.exam_assignments ea where ea.exam_id=p_exam_id and ea.student_profile_id=auth.uid()
    and (ea.available_from is null or ea.available_from<=now()) and (ea.available_until is null or ea.available_until>now())) then
    raise exception 'This exam has not been assigned to your account';
  end if;
  select a.* into v_attempt from public.exam_attempts a where a.exam_id=p_exam_id and a.student_profile_id=auth.uid() and a.status='in_progress'
    order by a.started_at desc limit 1 for update;
  if not found then
    insert into public.exam_attempts(exam_id,student_profile_id,answers,status)
    values(p_exam_id,auth.uid(),'{}'::jsonb,'in_progress') returning * into v_attempt;
  end if;
  return jsonb_build_object('attempt_id',v_attempt.id,'started_at',v_attempt.started_at,'duration_minutes',v_duration,'answers',v_attempt.answers);
end;
$$;

create or replace function public.exam_save_answer(p_attempt_id uuid,p_question_id uuid,p_answer jsonb)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_attempt public.exam_attempts; v_duration integer;
begin
  select a.* into v_attempt from public.exam_attempts a where a.id=p_attempt_id and a.student_profile_id=auth.uid() for update;
  if not found or v_attempt.status<>'in_progress' then raise exception 'This exam attempt is not editable'; end if;
  select e.duration_minutes into v_duration from public.exams e where e.id=v_attempt.exam_id;
  if now()>v_attempt.started_at+make_interval(mins=>v_duration) then raise exception 'Exam time has expired'; end if;
  if not exists(select 1 from public.questions q where q.id=p_question_id and q.exam_id=v_attempt.exam_id) then raise exception 'Question does not belong to this exam'; end if;
  update public.exam_attempts set answers=jsonb_set(coalesce(answers,'{}'::jsonb),array[p_question_id::text],coalesce(p_answer,'null'::jsonb),true)
  where id=p_attempt_id;
end;
$$;

create or replace function public.exam_submit_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_attempt public.exam_attempts; v_auto numeric; v_max numeric; v_manual boolean;
begin
  select a.* into v_attempt from public.exam_attempts a where a.id=p_attempt_id and a.student_profile_id=auth.uid() for update;
  if not found then raise exception 'Exam attempt not found'; end if;
  if v_attempt.status<>'in_progress' then
    return jsonb_build_object('attempt_id',v_attempt.id,'status',v_attempt.status,'score',v_attempt.score,'max_score',v_attempt.max_score,'manual_review_required',v_attempt.manual_review_required);
  end if;
  select coalesce(sum(case when q.answer_key is not null and v_attempt.answers ? q.id::text and v_attempt.answers->q.id::text=q.answer_key then q.points else 0 end),0),
         coalesce(sum(q.points),0),
         coalesce(bool_or(q.answer_key is null),false)
  into v_auto,v_max,v_manual
  from public.questions q where q.exam_id=v_attempt.exam_id;
  update public.exam_attempts set auto_score=v_auto,max_score=v_max,score=case when v_manual then null else v_auto end,
    manual_review_required=v_manual,status='submitted',submitted_at=now()
  where id=p_attempt_id;
  return jsonb_build_object('attempt_id',p_attempt_id,'status','submitted','score',case when v_manual then null else v_auto end,
    'auto_score',v_auto,'max_score',v_max,'manual_review_required',v_manual);
end;
$$;

create or replace function public.exam_review_attempt(p_attempt_id uuid,p_manual_score numeric,p_feedback text default '')
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_attempt public.exam_attempts;
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant')) then
    raise exception 'Staff access required';
  end if;
  select a.* into v_attempt from public.exam_attempts a where a.id=p_attempt_id for update;
  if not found or v_attempt.status<>'submitted' or not v_attempt.manual_review_required then raise exception 'This attempt is not awaiting manual review'; end if;
  if p_manual_score<0 or p_manual_score>greatest(v_attempt.max_score-v_attempt.auto_score,0) then raise exception 'Manual score is outside the available marks'; end if;
  update public.exam_attempts set manual_score=p_manual_score,score=auto_score+p_manual_score,manual_review_required=false,
    review_feedback=left(coalesce(p_feedback,''),5000),reviewed_by=auth.uid(),reviewed_at=now()
  where id=p_attempt_id;
  return jsonb_build_object('attempt_id',p_attempt_id,'score',v_attempt.auto_score+p_manual_score,'max_score',v_attempt.max_score,'manual_review_required',false);
end;
$$;

create or replace function public.exam_get_result(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_attempt public.exam_attempts; v_staff boolean; v_questions jsonb;
begin
  select a.* into v_attempt from public.exam_attempts a where a.id=p_attempt_id;
  if not found then raise exception 'Exam attempt not found'; end if;
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant')) into v_staff;
  if not v_staff and v_attempt.student_profile_id<>auth.uid() then raise exception 'Not authorized to view this result'; end if;
  if v_attempt.status<>'submitted' then raise exception 'This attempt has not been submitted'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'prompt',q.prompt,'passage',q.passage,'choices',q.choices,'question_type',q.question_type,
    'student_answer',v_attempt.answers->q.id::text,
    'correct_answer',case when v_staff or not v_attempt.manual_review_required then q.answer_key else null end,
    'explanation',case when v_staff or not v_attempt.manual_review_required then q.explanation else null end,
    'points',q.points,
    'earned_points',case when q.answer_key is not null and v_attempt.answers->q.id::text=q.answer_key then q.points else 0 end
  ) order by q.sort_order),'[]'::jsonb) into v_questions
  from public.questions q where q.exam_id=v_attempt.exam_id;
  return jsonb_build_object('attempt_id',v_attempt.id,'status',v_attempt.status,'score',v_attempt.score,'auto_score',v_attempt.auto_score,
    'max_score',v_attempt.max_score,'manual_review_required',v_attempt.manual_review_required,'review_feedback',v_attempt.review_feedback,'questions',v_questions);
end;
$$;

revoke all on function public.staff_list_questions() from public,anon;
revoke all on function public.exam_get_questions(uuid) from public,anon;
revoke all on function public.exam_start_attempt(uuid) from public,anon;
revoke all on function public.exam_save_answer(uuid,uuid,jsonb) from public,anon;
revoke all on function public.exam_submit_attempt(uuid) from public,anon;
revoke all on function public.exam_review_attempt(uuid,numeric,text) from public,anon;
revoke all on function public.exam_get_result(uuid) from public,anon;
grant execute on function public.staff_list_questions() to authenticated;
grant execute on function public.exam_get_questions(uuid) to authenticated;
grant execute on function public.exam_start_attempt(uuid) to authenticated;
grant execute on function public.exam_save_answer(uuid,uuid,jsonb) to authenticated;
grant execute on function public.exam_submit_attempt(uuid) to authenticated;
grant execute on function public.exam_review_attempt(uuid,numeric,text) to authenticated;
grant execute on function public.exam_get_result(uuid) to authenticated;
