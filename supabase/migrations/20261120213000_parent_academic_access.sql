drop policy if exists profiles_read_linked_child on public.profiles;
create policy profiles_read_linked_child on public.profiles for select to authenticated
using (
  exists(select 1 from public.parent_student_links l where l.parent_profile_id=auth.uid() and l.student_profile_id=profiles.id)
);

drop policy if exists course_access_read_related on public.course_access;
create policy course_access_read_related on public.course_access for select to authenticated
using (
  student_profile_id=auth.uid()
  or exists(select 1 from public.parent_student_links l where l.parent_profile_id=auth.uid() and l.student_profile_id=course_access.student_profile_id)
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant'))
);

drop policy if exists courses_read_staff_or_published_access on public.courses;
create policy courses_read_staff_or_published_access on public.courses for select to authenticated
using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant','developer','designer'))
  or (status='published' and exists (
    select 1 from public.course_access ca
    where ca.course_id=courses.id and ca.status='active'
      and (ca.starts_at is null or ca.starts_at<=now()) and (ca.expires_at is null or ca.expires_at>now())
      and (ca.student_profile_id=auth.uid() or exists(select 1 from public.parent_student_links l where l.parent_profile_id=auth.uid() and l.student_profile_id=ca.student_profile_id))
  ))
);

drop policy if exists lessons_read_authorized on public.lessons;
create policy lessons_read_authorized on public.lessons for select to authenticated
using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant','developer','designer'))
  or (is_published and exists(
    select 1 from public.course_access ca join public.courses c on c.id=ca.course_id
    where c.id=lessons.course_id and c.status='published' and ca.status='active'
      and (ca.starts_at is null or ca.starts_at<=now()) and (ca.expires_at is null or ca.expires_at>now())
      and (ca.student_profile_id=auth.uid() or exists(select 1 from public.parent_student_links l where l.parent_profile_id=auth.uid() and l.student_profile_id=ca.student_profile_id))
  ))
);

drop policy if exists attendance_sessions_read_staff on public.attendance_sessions;
create policy attendance_sessions_read_staff on public.attendance_sessions for select to authenticated
using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant'))
  or exists(select 1 from public.attendance_records ar join public.parent_student_links l on l.student_profile_id=ar.student_profile_id
    where ar.session_id=attendance_sessions.id and l.parent_profile_id=auth.uid())
);

drop policy if exists exam_assignments_read_related on public.exam_assignments;
create policy exam_assignments_read_related on public.exam_assignments for select to authenticated
using (
  student_profile_id=auth.uid()
  or exists(select 1 from public.parent_student_links l where l.parent_profile_id=auth.uid() and l.student_profile_id=exam_assignments.student_profile_id)
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant'))
);

drop policy if exists exam_attempts_read_related on public.exam_attempts;
create policy exam_attempts_read_related on public.exam_attempts for select to authenticated
using (
  student_profile_id=auth.uid()
  or exists(select 1 from public.parent_student_links l where l.parent_profile_id=auth.uid() and l.student_profile_id=exam_attempts.student_profile_id)
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant'))
);

drop policy if exists exams_read_authorized on public.exams;
create policy exams_read_authorized on public.exams for select to authenticated
using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant'))
  or (status='published' and exists(
    select 1 from public.exam_assignments ea
    where ea.exam_id=exams.id
      and (ea.student_profile_id=auth.uid() or exists(select 1 from public.parent_student_links l where l.parent_profile_id=auth.uid() and l.student_profile_id=ea.student_profile_id))
      and (ea.available_from is null or ea.available_from<=now()) and (ea.available_until is null or ea.available_until>now())
  ))
);

create or replace function public.exam_get_result(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_attempt public.exam_attempts; v_staff boolean; v_parent boolean; v_questions jsonb;
begin
  select a.* into v_attempt from public.exam_attempts a where a.id=p_attempt_id;
  if not found then raise exception 'Exam attempt not found'; end if;
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant')) into v_staff;
  select exists(select 1 from public.parent_student_links l where l.parent_profile_id=auth.uid() and l.student_profile_id=v_attempt.student_profile_id) into v_parent;
  if not v_staff and not v_parent and v_attempt.student_profile_id<>auth.uid() then raise exception 'Not authorized to view this result'; end if;
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
revoke all on function public.exam_get_result(uuid) from public,anon;
grant execute on function public.exam_get_result(uuid) to authenticated;
