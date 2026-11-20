create or replace function public.notify_student_and_parents(
  p_student_id uuid,p_title text,p_body text,p_type text,p_actor uuid default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.notifications(recipient_profile_id,title,body,notification_type,created_by,channel,delivery_status)
  values(p_student_id,left(p_title,180),left(p_body,5000),p_type,p_actor,'in_app','delivered');
  insert into public.notifications(recipient_profile_id,title,body,notification_type,created_by,channel,delivery_status)
  select distinct l.parent_profile_id,left(p_title,180),left(p_body,5000),p_type,p_actor,'in_app','delivered'
  from public.parent_student_links l where l.student_profile_id=p_student_id;
end;
$$;
revoke all on function public.notify_student_and_parents(uuid,text,text,text,uuid) from public,anon,authenticated;

create or replace function public.notify_grade_entry_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    perform public.notify_student_and_parents(new.student_profile_id,'New grade: '||new.title,
      'A new '||replace(new.category,'_',' ')||' grade was recorded: '||new.value||case when new.max_value is null then ' points' else ' / '||new.max_value end||'.',
      'grade',new.recorded_by);
  elsif old.value is distinct from new.value or old.max_value is distinct from new.max_value then
    perform public.notify_student_and_parents(new.student_profile_id,'Grade updated: '||new.title,
      'Your grade was updated to '||new.value||case when new.max_value is null then ' points' else ' / '||new.max_value end||'.',
      'grade',new.recorded_by);
  end if;
  return new;
end $$;
revoke all on function public.notify_grade_entry_change() from public,anon,authenticated;
drop trigger if exists grade_entry_notify on public.grade_entries;
create trigger grade_entry_notify after insert or update on public.grade_entries for each row execute function public.notify_grade_entry_change();

create or replace function public.notify_attendance_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_title text;
begin
  select title into v_title from public.attendance_sessions where id=new.session_id;
  if tg_op='INSERT' or old.status is distinct from new.status then
    perform public.notify_student_and_parents(new.student_profile_id,'Attendance marked: '||coalesce(v_title,'Class session'),
      'Your attendance status is '||new.status::text||'.','attendance',new.marked_by);
  end if;
  return new;
end $$;
revoke all on function public.notify_attendance_change() from public,anon,authenticated;
drop trigger if exists attendance_record_notify on public.attendance_records;
create trigger attendance_record_notify after insert or update on public.attendance_records for each row execute function public.notify_attendance_change();

create or replace function public.notify_assignment_target()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_title text;
begin
  select title into v_title from public.assignments where id=new.assignment_id;
  perform public.notify_student_and_parents(new.student_profile_id,'New homework: '||coalesce(v_title,'Assignment'),
    'A new homework assignment has been added to your account.','homework',new.assigned_by);
  return new;
end $$;
revoke all on function public.notify_assignment_target() from public,anon,authenticated;
drop trigger if exists assignment_target_notify on public.assignment_targets;
create trigger assignment_target_notify after insert on public.assignment_targets for each row execute function public.notify_assignment_target();

create or replace function public.notify_exam_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_title text;
begin
  select title into v_title from public.exams where id=new.exam_id;
  perform public.notify_student_and_parents(new.student_profile_id,'New exam assigned: '||coalesce(v_title,'Exam'),
    'A new exam has been assigned to your account. Check its availability and deadline.','exam',new.assigned_by);
  return new;
end $$;
revoke all on function public.notify_exam_assignment() from public,anon,authenticated;
drop trigger if exists exam_assignment_notify on public.exam_assignments;
create trigger exam_assignment_notify after insert on public.exam_assignments for each row execute function public.notify_exam_assignment();

create or replace function public.notify_course_access_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_title text;
begin
  select title into v_title from public.courses where id=new.course_id;
  if tg_op='INSERT' or old.status is distinct from new.status then
    perform public.notify_student_and_parents(new.student_profile_id,'Course access: '||coalesce(v_title,'Course'),
      'Your course access status is now '||new.status::text||'.','course',new.granted_by);
  end if;
  return new;
end $$;
revoke all on function public.notify_course_access_change() from public,anon,authenticated;
drop trigger if exists course_access_notify on public.course_access;
create trigger course_access_notify after insert or update on public.course_access for each row execute function public.notify_course_access_change();

create or replace function public.notify_homework_review()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_title text;
begin
  if old.reviewed_at is null and new.reviewed_at is not null then
    select title into v_title from public.assignments where id=new.assignment_id;
    perform public.notify_student_and_parents(new.student_profile_id,'Homework reviewed: '||coalesce(v_title,'Assignment'),
      'Your homework has been reviewed. Score: '||coalesce(new.score::text,'Pending')||'. '||coalesce(new.feedback,''),
      'homework',new.reviewed_by);
  end if;
  return new;
end $$;
revoke all on function public.notify_homework_review() from public,anon,authenticated;
drop trigger if exists homework_review_notify on public.submissions;
create trigger homework_review_notify after update on public.submissions for each row execute function public.notify_homework_review();
