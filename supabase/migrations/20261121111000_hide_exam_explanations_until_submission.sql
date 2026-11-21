-- Do not reveal answer explanations while a student is still taking an exam.
-- Explanations remain available through exam_get_result after submission.
create or replace function public.exam_get_questions(p_exam_id uuid)
returns table(
  id uuid,
  exam_id uuid,
  prompt text,
  passage text,
  image_path text,
  question_type text,
  choices jsonb,
  answer_key jsonb,
  explanation text,
  topic text,
  difficulty text,
  points numeric,
  sort_order integer
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role public.app_role;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid() and p.is_active;

  if v_role in ('admin','teacher','assistant') then
    return query
      select q.id,q.exam_id,q.prompt,q.passage,q.image_path,q.question_type,
             q.choices,q.answer_key,q.explanation,q.topic,q.difficulty,q.points,q.sort_order
      from public.questions q
      where q.exam_id = p_exam_id
      order by q.sort_order,q.created_at;
  elsif v_role = 'student' and exists (
    select 1
    from public.exam_assignments ea
    join public.exams e on e.id = ea.exam_id
    where ea.exam_id = p_exam_id
      and ea.student_profile_id = auth.uid()
      and e.status = 'published'
      and (ea.available_from is null or ea.available_from <= now())
      and (ea.available_until is null or ea.available_until > now())
  ) then
    return query
      select q.id,q.exam_id,q.prompt,q.passage,q.image_path,q.question_type,
             q.choices,null::jsonb,null::text,q.topic,q.difficulty,q.points,q.sort_order
      from public.questions q
      where q.exam_id = p_exam_id
      order by q.sort_order,q.created_at;
  else
    raise exception 'You are not authorized to view this exam';
  end if;
end;
$function$;
