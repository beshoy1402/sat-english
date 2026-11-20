create or replace function public.log_grade_entry_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.grade_entry_history(grade_entry_id,student_profile_id,actor_profile_id,action,after_data)
    values (new.id,new.student_profile_id,coalesce(auth.uid(),new.recorded_by),'created',to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.grade_entry_history(grade_entry_id,student_profile_id,actor_profile_id,action,before_data,after_data)
    values (new.id,new.student_profile_id,coalesce(auth.uid(),new.recorded_by),'updated',to_jsonb(old),to_jsonb(new));
    return new;
  else
    -- The grade row has already been removed in an AFTER DELETE trigger, so leave the optional FK null.
    insert into public.grade_entry_history(grade_entry_id,student_profile_id,actor_profile_id,action,before_data)
    values (null,old.student_profile_id,coalesce(auth.uid(),old.recorded_by),'deleted',to_jsonb(old));
    return old;
  end if;
end;
$$;
revoke all on function public.log_grade_entry_history() from public, anon, authenticated;