create or replace function public.staff_add_bank_items_to_exam(p_exam_id uuid,p_item_ids uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare v_exam public.exams; v_item public.question_bank_items; v_order integer; v_count integer:=0;
begin
  if coalesce(private.current_user_role()::text,'') not in ('admin','teacher','assistant') then raise exception 'Teaching staff role required'; end if;
  select * into v_exam from public.exams where id=p_exam_id;
  if not found then raise exception 'Exam not found'; end if;
  if v_exam.status::text<>'draft' then raise exception 'Questions can only be added to draft exams'; end if;
  select coalesce(max(sort_order),0) into v_order from public.questions where exam_id=p_exam_id;
  for v_item in select * from public.question_bank_items where id=any(coalesce(p_item_ids,'{}'::uuid[])) order by created_at loop
    if v_item.exam_program<>v_exam.exam_program then raise exception 'Question % belongs to a different exam program',v_item.id; end if;
    v_order:=v_order+1;
    insert into public.questions(exam_id,prompt,question_type,choices,answer_key,explanation,points,sort_order,created_by)
    values(p_exam_id,case when length(trim(v_item.passage))>0 then 'Reading passage:'||E'\n'||v_item.passage||E'\n\nQuestion:'||E'\n'||v_item.prompt else v_item.prompt end,
      v_item.question_type,v_item.choices,v_item.answer_key,v_item.explanation,v_item.points,v_order,auth.uid());
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;
revoke all on function public.staff_add_bank_items_to_exam(uuid,uuid[]) from public,anon;
grant execute on function public.staff_add_bank_items_to_exam(uuid,uuid[]) to authenticated;