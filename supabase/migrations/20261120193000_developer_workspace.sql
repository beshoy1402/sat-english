-- Developer collaboration workspace: tasks, bug reports, PR tracking, comments and private attachments.
create table if not exists public.developer_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 180),
  description text not null default '',
  feature_area text not null default 'General',
  status text not null default 'backlog' check (status in ('backlog','todo','in_progress','blocked','review','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  assignee_profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists developer_tasks_status_idx on public.developer_tasks(status, priority);
create index if not exists developer_tasks_assignee_idx on public.developer_tasks(assignee_profile_id);

create table if not exists public.developer_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.developer_tasks(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id),
  body text not null check (length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists developer_task_comments_task_idx on public.developer_task_comments(task_id, created_at);

create table if not exists public.developer_task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.developer_tasks(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  created_at timestamptz not null default now()
);

create table if not exists public.developer_bug_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 180),
  description text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','triaged','in_progress','fixed','wont_fix')),
  page_url text,
  steps_to_reproduce text,
  expected_result text,
  actual_result text,
  reported_by uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists developer_bug_reports_status_idx on public.developer_bug_reports(status, severity);

-- This is a review tracker. GitHub's authoritative review/merge action is a separate integration.
create table if not exists public.developer_pull_requests (
  id uuid primary key default gen_random_uuid(),
  repository_full_name text not null,
  pr_number integer not null check (pr_number > 0),
  pr_url text not null,
  title text not null,
  status text not null default 'review_requested' check (status in ('draft','review_requested','approved','changes_requested','merged','closed')),
  notes text not null default '',
  submitted_by uuid not null references public.profiles(id),
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(repository_full_name, pr_number)
);
create index if not exists developer_pull_requests_status_idx on public.developer_pull_requests(status, created_at desc);

alter table public.developer_tasks enable row level security;
alter table public.developer_task_comments enable row level security;
alter table public.developer_task_attachments enable row level security;
alter table public.developer_bug_reports enable row level security;
alter table public.developer_pull_requests enable row level security;

do $$
declare t text;
begin
  foreach t in array array['developer_tasks','developer_task_comments','developer_task_attachments','developer_bug_reports','developer_pull_requests'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists developer_tasks_access on public.developer_tasks;
create policy developer_tasks_access on public.developer_tasks for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'developer' and p.is_active))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'developer' and p.is_active));

drop policy if exists developer_task_comments_access on public.developer_task_comments;
create policy developer_task_comments_access on public.developer_task_comments for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'developer' and p.is_active))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'developer' and p.is_active));

drop policy if exists developer_task_attachments_access on public.developer_task_attachments;
create policy developer_task_attachments_access on public.developer_task_attachments for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'developer' and p.is_active))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'developer' and p.is_active));

drop policy if exists developer_bug_reports_access on public.developer_bug_reports;
create policy developer_bug_reports_access on public.developer_bug_reports for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'developer' and p.is_active))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'developer' and p.is_active));

drop policy if exists developer_pull_requests_access on public.developer_pull_requests;
create policy developer_pull_requests_access on public.developer_pull_requests for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'developer' and p.is_active))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'developer' and p.is_active));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('developer-workspace','developer-workspace',false,10485760,
  array['image/png','image/jpeg','image/webp','application/pdf','text/plain','text/markdown','application/zip'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists developer_workspace_storage_access on storage.objects;
create policy developer_workspace_storage_access on storage.objects for all to authenticated
using (
  bucket_id = 'developer-workspace'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'developer' and p.is_active)
)
with check (
  bucket_id = 'developer-workspace'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'developer' and p.is_active)
);
