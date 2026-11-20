create table if not exists public.student_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 2 and 120),
  description text not null default '',
  course_id uuid references public.courses(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.student_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.student_groups(id) on delete cascade,
  student_profile_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(group_id,student_profile_id)
);
create index if not exists student_groups_course_idx on public.student_groups(course_id);
create index if not exists student_group_members_student_idx on public.student_group_members(student_profile_id,group_id);
alter table public.student_groups enable row level security;
alter table public.student_group_members enable row level security;
grant select,insert,update,delete on public.student_groups to authenticated;
grant select,insert,delete on public.student_group_members to authenticated;
drop policy if exists student_groups_read_related on public.student_groups;
create policy student_groups_read_related on public.student_groups for select to authenticated
using(
  private.current_user_role() in ('admin','teacher','assistant')
  or exists(select 1 from public.student_group_members gm where gm.group_id=student_groups.id and gm.student_profile_id=auth.uid())
  or exists(select 1 from public.student_group_members gm join public.parent_student_links l on l.student_profile_id=gm.student_profile_id where gm.group_id=student_groups.id and l.parent_profile_id=auth.uid())
);
drop policy if exists student_groups_insert_staff on public.student_groups;
create policy student_groups_insert_staff on public.student_groups for insert to authenticated
with check(created_by=auth.uid() and private.current_user_role() in ('admin','teacher','assistant'));
drop policy if exists student_groups_update_staff on public.student_groups;
create policy student_groups_update_staff on public.student_groups for update to authenticated
using(private.current_user_role() in ('admin','teacher','assistant'))
with check(private.current_user_role() in ('admin','teacher','assistant'));
drop policy if exists student_groups_delete_staff on public.student_groups;
create policy student_groups_delete_staff on public.student_groups for delete to authenticated
using(private.current_user_role() in ('admin','teacher','assistant'));

drop policy if exists student_group_members_read_related on public.student_group_members;
create policy student_group_members_read_related on public.student_group_members for select to authenticated
using(
  student_profile_id=auth.uid()
  or private.current_user_role() in ('admin','teacher','assistant')
  or exists(select 1 from public.parent_student_links l where l.parent_profile_id=auth.uid() and l.student_profile_id=student_group_members.student_profile_id)
);
drop policy if exists student_group_members_insert_staff on public.student_group_members;
create policy student_group_members_insert_staff on public.student_group_members for insert to authenticated
with check(private.current_user_role() in ('admin','teacher','assistant') and exists(select 1 from public.student_groups g where g.id=student_group_members.group_id));
drop policy if exists student_group_members_delete_staff on public.student_group_members;
create policy student_group_members_delete_staff on public.student_group_members for delete to authenticated
using(private.current_user_role() in ('admin','teacher','assistant'));
