alter table public.lessons add column if not exists delivery_mode text not null default 'self_paced' check(delivery_mode in ('online','in_person','self_paced'));
alter table public.lessons add column if not exists location text;
alter table public.lessons add column if not exists starts_at timestamptz;
alter table public.lessons add column if not exists ends_at timestamptz;
alter table public.lessons add column if not exists duration_minutes integer;

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'not_started' check(status in ('not_started','in_progress','completed')),
  progress_seconds integer not null default 0 check(progress_seconds>=0),
  last_position_seconds integer not null default 0 check(last_position_seconds>=0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(lesson_id,student_profile_id)
);
create index if not exists lesson_progress_student_idx on public.lesson_progress(student_profile_id,status);
create index if not exists lesson_progress_lesson_idx on public.lesson_progress(lesson_id);

alter table public.lesson_progress enable row level security;
grant select,insert,update on public.lesson_progress to authenticated;
drop policy if exists lesson_progress_read_related on public.lesson_progress;
create policy lesson_progress_read_related on public.lesson_progress for select to authenticated
using (
  student_profile_id=auth.uid()
  or exists(select 1 from public.parent_student_links l where l.parent_profile_id=auth.uid() and l.student_profile_id=lesson_progress.student_profile_id)
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant'))
);
drop policy if exists lesson_progress_insert_own on public.lesson_progress;
create policy lesson_progress_insert_own on public.lesson_progress for insert to authenticated
with check (
  student_profile_id=auth.uid()
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='student')
  and exists(select 1 from public.lessons l join public.courses c on c.id=l.course_id
    join public.course_access ca on ca.course_id=c.id
    where l.id=lesson_progress.lesson_id and l.is_published and c.status='published' and ca.student_profile_id=auth.uid()
      and ca.status='active' and (ca.starts_at is null or ca.starts_at<=now()) and (ca.expires_at is null or ca.expires_at>now()))
);
drop policy if exists lesson_progress_update_own on public.lesson_progress;
create policy lesson_progress_update_own on public.lesson_progress for update to authenticated
using (
  student_profile_id=auth.uid()
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='student')
)
with check (
  student_profile_id=auth.uid()
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='student')
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('lesson-content','lesson-content',false,52428800,array['application/pdf','video/mp4','image/png','image/jpeg','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','text/plain'])
on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists lesson_content_staff_upload on storage.objects;
create policy lesson_content_staff_upload on storage.objects for insert to authenticated
with check(bucket_id='lesson-content' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant')));
drop policy if exists lesson_content_read_authorized on storage.objects;
create policy lesson_content_read_authorized on storage.objects for select to authenticated
using(
  bucket_id='lesson-content'
  and (
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant'))
    or exists(select 1 from public.lessons l join public.courses c on c.id=l.course_id join public.course_access ca on ca.course_id=c.id
      where l.content_path=storage.objects.name and l.is_published and c.status='published' and ca.status='active'
        and ca.student_profile_id=auth.uid() and (ca.starts_at is null or ca.starts_at<=now()) and (ca.expires_at is null or ca.expires_at>now()))
    or exists(select 1 from public.lessons l join public.courses c on c.id=l.course_id join public.course_access ca on ca.course_id=c.id
      join public.parent_student_links pl on pl.student_profile_id=ca.student_profile_id
      where l.content_path=storage.objects.name and l.is_published and c.status='published' and ca.status='active'
        and pl.parent_profile_id=auth.uid() and (ca.starts_at is null or ca.starts_at<=now()) and (ca.expires_at is null or ca.expires_at>now()))
  )
);
