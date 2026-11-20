create or replace function public.exam_record_integrity_event(p_attempt_id uuid,p_event_type text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_attempt public.exam_attempts; v_duration integer; v_count integer; v_id uuid;
begin
  if coalesce(private.current_user_role()::text,'') <> 'student' then raise exception 'Student role required'; end if;
  if p_event_type not in ('visibility_hidden','window_blur','copy','paste','context_menu','fullscreen_exit') then raise exception 'Unsupported integrity event'; end if;
  select * into v_attempt from public.exam_attempts where id=p_attempt_id and student_profile_id=auth.uid() for update;
  if not found or v_attempt.status<>'in_progress' then raise exception 'No active exam attempt found'; end if;
  select duration_minutes into v_duration from public.exams where id=v_attempt.exam_id;
  if v_attempt.started_at + make_interval(mins=>coalesce(v_duration,0)) < now() then raise exception 'Exam time has expired'; end if;
  select count(*) into v_count from public.exam_attempt_events where attempt_id=p_attempt_id and created_at>now()-interval '1 minute';
  if v_count>=20 then raise exception 'Integrity event rate limit reached'; end if;
  insert into public.exam_attempt_events(attempt_id,student_profile_id,event_type,event_data)
  values(p_attempt_id,auth.uid(),p_event_type,'{}'::jsonb) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.exam_record_integrity_event(uuid,text) from public,anon;
grant execute on function public.exam_record_integrity_event(uuid,text) to authenticated;