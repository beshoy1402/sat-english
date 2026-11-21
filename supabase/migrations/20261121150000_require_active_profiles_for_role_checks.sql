-- Inactive accounts must not retain privileges through SECURITY DEFINER helpers.
-- This helper is used by staff-only RPCs and role-aware RLS policies.
create or replace function private.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $function$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true
$function$;

comment on function private.current_user_role() is
  'Returns the authenticated profile role only while the profile is active.';


-- Course write policies must reject inactive staff profiles as well.
drop policy if exists courses_insert_staff on public.courses;
create policy courses_insert_staff
on public.courses
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin', 'teacher', 'assistant')
  )
);

drop policy if exists courses_update_staff on public.courses;
create policy courses_update_staff
on public.courses
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin', 'teacher', 'assistant')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin', 'teacher', 'assistant')
  )
);

drop policy if exists courses_delete_staff on public.courses;
create policy courses_delete_staff
on public.courses
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin', 'teacher', 'assistant')
  )
);


-- Existing exam attempts must stop accepting changes after a profile is deactivated.
create or replace function public.exam_save_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_answer jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_attempt public.exam_attempts;
  v_duration integer;
begin
  if coalesce(private.current_user_role()::text, '') <> 'student' then
    raise exception 'An active student account is required';
  end if;

  select a.* into v_attempt
  from public.exam_attempts a
  where a.id = p_attempt_id
    and a.student_profile_id = auth.uid()
  for update;

  if not found or v_attempt.status <> 'in_progress' then
    raise exception 'This exam attempt is not editable';
  end if;

  select e.duration_minutes into v_duration
  from public.exams e
  where e.id = v_attempt.exam_id;

  if now() > v_attempt.started_at + make_interval(mins => v_duration) then
    raise exception 'Exam time has expired';
  end if;

  if not exists (
    select 1
    from public.questions q
    where q.id = p_question_id
      and q.exam_id = v_attempt.exam_id
  ) then
    raise exception 'Question does not belong to this exam';
  end if;

  update public.exam_attempts
  set answers = jsonb_set(
    coalesce(answers, '{}'::jsonb),
    array[p_question_id::text],
    coalesce(p_answer, 'null'::jsonb),
    true
  )
  where id = p_attempt_id;
end;
$function$;

create or replace function public.exam_submit_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_attempt public.exam_attempts;
  v_auto numeric;
  v_max numeric;
  v_manual boolean;
begin
  if coalesce(private.current_user_role()::text, '') <> 'student' then
    raise exception 'An active student account is required';
  end if;

  select a.* into v_attempt
  from public.exam_attempts a
  where a.id = p_attempt_id
    and a.student_profile_id = auth.uid()
  for update;

  if not found then
    raise exception 'Exam attempt not found';
  end if;

  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object(
      'attempt_id', v_attempt.id,
      'status', v_attempt.status,
      'score', v_attempt.score,
      'max_score', v_attempt.max_score,
      'manual_review_required', v_attempt.manual_review_required
    );
  end if;

  select
    coalesce(sum(case
      when q.answer_key is not null
        and v_attempt.answers ? q.id::text
        and v_attempt.answers->q.id::text = q.answer_key
      then q.points else 0 end), 0),
    coalesce(sum(q.points), 0),
    coalesce(bool_or(q.answer_key is null), false)
  into v_auto, v_max, v_manual
  from public.questions q
  where q.exam_id = v_attempt.exam_id;

  update public.exam_attempts
  set
    auto_score = v_auto,
    max_score = v_max,
    score = case when v_manual then null else v_auto end,
    manual_review_required = v_manual,
    status = 'submitted',
    submitted_at = now()
  where id = p_attempt_id;

  return jsonb_build_object(
    'attempt_id', p_attempt_id,
    'status', 'submitted',
    'score', case when v_manual then null else v_auto end,
    'auto_score', v_auto,
    'max_score', v_max,
    'manual_review_required', v_manual
  );
end;
$function$;

-- A deactivated student or parent cannot retrieve an old exam result.
create or replace function public.exam_get_result(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_attempt public.exam_attempts;
  v_staff boolean;
  v_parent boolean;
  v_questions jsonb;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  ) then
    raise exception 'An active account is required';
  end if;

  select a.* into v_attempt
  from public.exam_attempts a
  where a.id = p_attempt_id;

  if not found then
    raise exception 'Exam attempt not found';
  end if;

  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active
      and p.role in ('admin', 'teacher', 'assistant')
  ) into v_staff;

  select exists (
    select 1
    from public.parent_student_links l
    where l.parent_profile_id = auth.uid()
      and l.student_profile_id = v_attempt.student_profile_id
  ) into v_parent;

  if not v_staff
    and not v_parent
    and v_attempt.student_profile_id <> auth.uid() then
    raise exception 'Not authorized to view this result';
  end if;

  if v_attempt.status <> 'submitted' then
    raise exception 'This attempt has not been submitted';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'prompt', q.prompt,
        'passage', q.passage,
        'choices', q.choices,
        'question_type', q.question_type,
        'student_answer', v_attempt.answers->q.id::text,
        'correct_answer', case
          when v_staff or not v_attempt.manual_review_required then q.answer_key
          else null
        end,
        'explanation', case
          when v_staff or not v_attempt.manual_review_required then q.explanation
          else null
        end,
        'points', q.points,
        'earned_points', case
          when q.answer_key is not null
            and v_attempt.answers->q.id::text = q.answer_key
          then q.points else 0
        end
      ) order by q.sort_order
    ),
    '[]'::jsonb
  ) into v_questions
  from public.questions q
  where q.exam_id = v_attempt.exam_id;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'status', v_attempt.status,
    'score', v_attempt.score,
    'auto_score', v_attempt.auto_score,
    'max_score', v_attempt.max_score,
    'manual_review_required', v_attempt.manual_review_required,
    'review_feedback', v_attempt.review_feedback,
    'questions', v_questions
  );
end;
$function$;
