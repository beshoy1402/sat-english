-- Recorded session library with private storage and course-scoped student access.
create table if not exists public.session_recordings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 180),
  description text not null default '',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  recorded_at timestamptz,
  is_published boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists session_recordings_course_published_idx
  on public.session_recordings(course_id, is_published, created_at desc);
create index if not exists session_recordings_created_by_idx
  on public.session_recordings(created_by);

alter table public.session_recordings enable row level security;

create policy session_recordings_staff_select
on public.session_recordings for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
    and p.role in ('admin','teacher','assistant','developer')
));

create policy session_recordings_student_select
on public.session_recordings for select to authenticated
using (
  is_published
  and exists (
    select 1 from public.course_access ca
    join public.courses c on c.id = ca.course_id
    where ca.course_id = session_recordings.course_id
      and c.status = 'published'
      and ca.status = 'active'
      and (ca.starts_at is null or ca.starts_at <= now())
      and (ca.expires_at is null or ca.expires_at > now())
      and ca.student_profile_id = (select auth.uid())
  )
);

create policy session_recordings_staff_insert
on public.session_recordings for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role in ('admin','teacher','assistant')
  )
);

create policy session_recordings_staff_update
on public.session_recordings for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
    and p.role in ('admin','teacher','assistant')
))
with check (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
    and p.role in ('admin','teacher','assistant')
));

create policy session_recordings_staff_delete
on public.session_recordings for delete to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
    and p.role in ('admin','teacher')
));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sat-session-recordings',
  'sat-session-recordings',
  false,
  524288000,
  array['video/mp4','video/quicktime','video/webm']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy session_recordings_storage_staff_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'sat-session-recordings'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role in ('admin','teacher','assistant')
  )
);

create policy session_recordings_storage_staff_update
on storage.objects for update to authenticated
using (
  bucket_id = 'sat-session-recordings'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role in ('admin','teacher','assistant')
  )
)
with check (
  bucket_id = 'sat-session-recordings'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role in ('admin','teacher','assistant')
  )
);

create policy session_recordings_storage_staff_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'sat-session-recordings'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role in ('admin','teacher')
  )
);

create policy session_recordings_storage_read_authorized
on storage.objects for select to authenticated
using (
  bucket_id = 'sat-session-recordings'
  and (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active
        and p.role in ('admin','teacher','assistant','developer')
    )
    or exists (
      select 1 from public.session_recordings sr
      join public.course_access ca on ca.course_id = sr.course_id
      join public.courses c on c.id = sr.course_id
      where sr.storage_path = storage.objects.name
        and sr.is_published
        and c.status = 'published'
        and ca.status = 'active'
        and (ca.starts_at is null or ca.starts_at <= now())
        and (ca.expires_at is null or ca.expires_at > now())
        and ca.student_profile_id = (select auth.uid())
    )
  )
);
