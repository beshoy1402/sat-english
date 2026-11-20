create table if not exists public.grade_entries (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  category text not null check (category in ('participation','attendance','homework','quiz','exam','custom')),
  title text not null check (length(trim(title)) between 1 and 180),
  entry_type text not null default 'score' check (entry_type in ('score','adjustment')),
  value numeric(9,2) not null,
  max_value numeric(9,2),
  grade_date date not null default current_date,
  notes text not null default '',
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grade_entries_value_shape check (
    (entry_type = 'score' and value >= 0 and max_value is not null and max_value > 0 and value <= max_value)
    or (entry_type = 'adjustment' and max_value is null)
  )
);
create index if not exists grade_entries_student_date_idx on public.grade_entries(student_profile_id, grade_date desc);
create index if not exists grade_entries_category_idx on public.grade_entries(category, grade_date desc);
create index if not exists grade_entries_course_idx on public.grade_entries(course_id);

create table if not exists public.grade_entry_history (
  id uuid primary key default gen_random_uuid(),
  grade_entry_id uuid references public.grade_entries(id) on delete set null,
  student_profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id),
  action text not null check (action in ('created','updated','deleted')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists grade_entry_history_student_idx on public.grade_entry_history(student_profile_id, created_at desc);
create index if not exists grade_entry_history_entry_idx on public.grade_entry_history(grade_entry_id);

alter table public.grade_entries enable row level security;
alter table public.grade_entry_history enable row level security;
grant select, insert, update, delete on public.grade_entries to authenticated;
grant select on public.grade_entry_history to authenticated;

drop policy if exists grade_entries_read_related on public.grade_entries;
create policy grade_entries_read_related on public.grade_entries for select to authenticated
using (
  student_profile_id = (select auth.uid())
  or exists (select 1 from public.parent_student_links l where l.parent_profile_id=(select auth.uid()) and l.student_profile_id=grade_entries.student_profile_id)
  or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','teacher','assistant') and p.is_active)
);
drop policy if exists grade_entries_insert_staff on public.grade_entries;
create policy grade_entries_insert_staff on public.grade_entries for insert to authenticated
with check (recorded_by=(select auth.uid()) and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','teacher','assistant') and p.is_active));
drop policy if exists grade_entries_update_staff on public.grade_entries;
create policy grade_entries_update_staff on public.grade_entries for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','teacher','assistant') and p.is_active))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','teacher','assistant') and p.is_active));
drop policy if exists grade_entries_delete_staff on public.grade_entries;
create policy grade_entries_delete_staff on public.grade_entries for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','teacher','assistant') and p.is_active));

drop policy if exists grade_entry_history_read_related on public.grade_entry_history;
create policy grade_entry_history_read_related on public.grade_entry_history for select to authenticated
using (
  student_profile_id = (select auth.uid())
  or exists (select 1 from public.parent_student_links l where l.parent_profile_id=(select auth.uid()) and l.student_profile_id=grade_entry_history.student_profile_id)
  or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','teacher','assistant') and p.is_active)
);

create or replace function public.log_grade_entry_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.grade_entry_history(grade_entry_id,student_profile_id,actor_profile_id,action,after_data)
    values (new.id,new.student_profile_id,auth.uid(),'created',to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.grade_entry_history(grade_entry_id,student_profile_id,actor_profile_id,action,before_data,after_data)
    values (new.id,new.student_profile_id,auth.uid(),'updated',to_jsonb(old),to_jsonb(new));
    return new;
  else
    insert into public.grade_entry_history(grade_entry_id,student_profile_id,actor_profile_id,action,before_data)
    values (old.id,old.student_profile_id,auth.uid(),'deleted',to_jsonb(old));
    return old;
  end if;
end;
$$;
revoke all on function public.log_grade_entry_history() from public, anon, authenticated;
drop trigger if exists grade_entries_history_trigger on public.grade_entries;
create trigger grade_entries_history_trigger after insert or update or delete on public.grade_entries
for each row execute function public.log_grade_entry_history();