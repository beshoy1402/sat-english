drop policy if exists attendance_sessions_read_staff on public.attendance_sessions;
create policy attendance_sessions_read_staff on public.attendance_sessions for select to authenticated
using (
  private.current_user_role() in ('admin','teacher','assistant')
  or exists(select 1 from public.attendance_records ar where ar.session_id=attendance_sessions.id and ar.student_profile_id=auth.uid())
  or exists(select 1 from public.attendance_records ar join public.parent_student_links l on l.student_profile_id=ar.student_profile_id
    where ar.session_id=attendance_sessions.id and l.parent_profile_id=auth.uid())
);