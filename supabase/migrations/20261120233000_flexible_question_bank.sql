create table if not exists public.question_bank_items (
  id uuid primary key default gen_random_uuid(),
  exam_program text not null check(exam_program in ('SAT English','EST English','ACT English')),
  topic text not null default 'General',
  difficulty text not null default 'medium' check(difficulty in ('easy','medium','hard')),
  passage text not null default '',
  prompt text not null check(length(trim(prompt)) between 1 and 12000),
  question_type text not null check(question_type in ('multiple_choice','short_answer','essay')),
  choices jsonb not null default '[]'::jsonb check(jsonb_typeof(choices)='array'),
  answer_key jsonb,
  explanation text not null default '',
  points numeric(7,2) not null default 1 check(points>0 and points<=100),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists question_bank_program_topic_idx on public.question_bank_items(exam_program,topic,difficulty);
create index if not exists question_bank_created_idx on public.question_bank_items(created_at desc);
alter table public.question_bank_items enable row level security;
revoke all on public.question_bank_items from anon,authenticated;

create or replace function public.staff_list_question_bank_items(p_exam_program text default null)
returns setof public.question_bank_items
language plpgsql security definer set search_path='' as $$
begin
  if coalesce(private.current_user_role()::text,'') not in ('admin','teacher','assistant') then raise exception 'Teaching staff role required'; end if;
  return query select * from public.question_bank_items q where p_exam_program is null or q.exam_program=p_exam_program order by q.updated_at desc;
end $$;
revoke all on function public.staff_list_question_bank_items(text) from public,anon;
grant execute on function public.staff_list_question_bank_items(text) to authenticated;

create or replace function public.staff_save_question_bank_item(
  p_id uuid,p_exam_program text,p_topic text,p_difficulty text,p_passage text,p_prompt text,
  p_question_type text,p_choices jsonb,p_answer_key jsonb,p_explanation text,p_points numeric
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if coalesce(private.current_user_role()::text,'') not in ('admin','teacher','assistant') then raise exception 'Teaching staff role required'; end if;
  if p_exam_program not in ('SAT English','EST English','ACT English') then raise exception 'Invalid exam program'; end if;
  if p_difficulty not in ('easy','medium','hard') then raise exception 'Invalid difficulty'; end if;
  if p_question_type not in ('multiple_choice','short_answer','essay') then raise exception 'Invalid question type'; end if;
  if p_question_type='multiple_choice' and (jsonb_typeof(p_choices)<>'array' or jsonb_array_length(p_choices)<2 or p_answer_key is null) then raise exception 'Multiple choice questions require at least two choices and an answer key'; end if;
  if length(trim(coalesce(p_prompt,'')))=0 then raise exception 'Question prompt is required'; end if;
  if p_points is null or p_points<=0 or p_points>100 then raise exception 'Points must be between 0 and 100'; end if;
  if p_id is null then
    insert into public.question_bank_items(exam_program,topic,difficulty,passage,prompt,question_type,choices,answer_key,explanation,points,created_by)
    values(p_exam_program,coalesce(nullif(trim(p_topic),''),'General'),p_difficulty,coalesce(p_passage,''),p_prompt,p_question_type,coalesce(p_choices,'[]'::jsonb),p_answer_key,coalesce(p_explanation,''),p_points,auth.uid())
    returning id into v_id;
  else
    update public.question_bank_items set exam_program=p_exam_program,topic=coalesce(nullif(trim(p_topic),''),'General'),difficulty=p_difficulty,
      passage=coalesce(p_passage,''),prompt=p_prompt,question_type=p_question_type,choices=coalesce(p_choices,'[]'::jsonb),
      answer_key=p_answer_key,explanation=coalesce(p_explanation,''),points=p_points,updated_at=now()
    where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Question bank item not found'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.staff_save_question_bank_item(uuid,text,text,text,text,text,text,jsonb,jsonb,text,numeric) from public,anon;
grant execute on function public.staff_save_question_bank_item(uuid,text,text,text,text,text,text,jsonb,jsonb,text,numeric) to authenticated;

create or replace function public.staff_delete_question_bank_item(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(private.current_user_role()::text,'') not in ('admin','teacher','assistant') then raise exception 'Teaching staff role required'; end if;
  delete from public.question_bank_items where id=p_id;
  if not found then raise exception 'Question bank item not found'; end if;
end $$;
revoke all on function public.staff_delete_question_bank_item(uuid) from public,anon;
grant execute on function public.staff_delete_question_bank_item(uuid) to authenticated;

create or replace function public.staff_add_bank_items_to_exam(p_exam_id uuid,p_item_ids uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare v_exam public.exams; v_item public.question_bank_items; v_order integer; v_count integer:=0;
begin
  if coalesce(private.current_user_role()::text,'') not in ('admin','teacher','assistant') then raise exception 'Teaching staff role required'; end if;
  select * into v_exam from public.exams where id=p_exam_id;
  if not found then raise exception 'Exam not found'; end if;
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
