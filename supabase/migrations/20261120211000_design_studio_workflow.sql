create table if not exists public.site_design_drafts (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 2 and 120),
  status text not null default 'draft' check(status in ('draft','submitted','approved','rejected','implemented')),
  content jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_by uuid not null references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  review_notes text not null default '',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  implemented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists site_design_drafts_status_idx on public.site_design_drafts(status,updated_at desc);
create index if not exists site_design_drafts_creator_idx on public.site_design_drafts(created_by,updated_at desc);

create table if not exists public.site_design_versions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.site_design_drafts(id) on delete cascade,
  version integer not null,
  name text not null,
  content jsonb not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(draft_id,version)
);
create index if not exists site_design_versions_draft_idx on public.site_design_versions(draft_id,version desc);

alter table public.site_design_drafts enable row level security;
alter table public.site_design_versions enable row level security;
revoke all on public.site_design_drafts from anon,authenticated;
grant select on public.site_design_drafts to authenticated;
grant insert(name,content,created_by) on public.site_design_drafts to authenticated;
grant update(name,content,updated_at) on public.site_design_drafts to authenticated;
revoke all on public.site_design_versions from anon,authenticated;
grant select on public.site_design_versions to authenticated;

drop policy if exists site_design_drafts_read on public.site_design_drafts;
create policy site_design_drafts_read on public.site_design_drafts for select to authenticated
using (
  created_by=(select auth.uid())
  or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('developer','admin'))
);
drop policy if exists site_design_drafts_insert on public.site_design_drafts;
create policy site_design_drafts_insert on public.site_design_drafts for insert to authenticated
with check (
  created_by=(select auth.uid())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='designer')
);
drop policy if exists site_design_drafts_update on public.site_design_drafts;
create policy site_design_drafts_update on public.site_design_drafts for update to authenticated
using (
  created_by=(select auth.uid()) and status in ('draft','rejected')
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='designer')
)
with check (
  created_by=(select auth.uid()) and status in ('draft','rejected')
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='designer')
);
drop policy if exists site_design_versions_read on public.site_design_versions;
create policy site_design_versions_read on public.site_design_versions for select to authenticated
using (
  exists(select 1 from public.site_design_drafts d where d.id=site_design_versions.draft_id and (
    d.created_by=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('developer','admin'))
  ))
);

create or replace function public.snapshot_site_design_version()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op='INSERT' then
    insert into public.site_design_versions(draft_id,version,name,content,created_by)
    values(new.id,new.version,new.name,new.content,new.created_by);
    return new;
  end if;
  if new.content is distinct from old.content or new.name is distinct from old.name then
    new.version:=old.version+1;
    new.updated_at:=now();
    insert into public.site_design_versions(draft_id,version,name,content,created_by)
    values(new.id,new.version,new.name,new.content,auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.snapshot_site_design_version() from public,anon,authenticated;
drop trigger if exists site_design_version_snapshot on public.site_design_drafts;
create trigger site_design_version_snapshot before insert or update on public.site_design_drafts
for each row execute function public.snapshot_site_design_version();

create or replace function public.submit_site_design(p_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v public.site_design_drafts;
begin
  select * into v from public.site_design_drafts where id=p_draft_id and created_by=auth.uid() for update;
  if not found or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='designer') then
    raise exception 'Designer draft not found or access denied';
  end if;
  if v.status not in ('draft','rejected') then raise exception 'Only a draft or rejected design can be submitted'; end if;
  update public.site_design_drafts set status='submitted',submitted_at=now(),reviewed_by=null,reviewed_at=null,review_notes='' where id=p_draft_id returning * into v;
  return jsonb_build_object('id',v.id,'status',v.status,'version',v.version,'submitted_at',v.submitted_at);
end;
$$;

create or replace function public.review_site_design(p_draft_id uuid,p_decision text,p_notes text default '')
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v public.site_design_drafts;
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('developer','admin')) then
    raise exception 'Developer or Admin access required';
  end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  update public.site_design_drafts set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=left(coalesce(p_notes,''),5000)
  where id=p_draft_id and status='submitted' returning * into v;
  if not found then raise exception 'Only submitted designs can be reviewed'; end if;
  return jsonb_build_object('id',v.id,'status',v.status,'review_notes',v.review_notes,'reviewed_at',v.reviewed_at);
end;
$$;

create or replace function public.mark_site_design_implemented(p_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v public.site_design_drafts;
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('developer','admin')) then
    raise exception 'Developer or Admin access required';
  end if;
  update public.site_design_drafts set status='implemented',implemented_at=now()
  where id=p_draft_id and status='approved' returning * into v;
  if not found then raise exception 'Only approved designs can be marked implemented'; end if;
  return jsonb_build_object('id',v.id,'status',v.status,'implemented_at',v.implemented_at);
end;
$$;

revoke all on function public.submit_site_design(uuid) from public,anon;
revoke all on function public.review_site_design(uuid,text,text) from public,anon;
revoke all on function public.mark_site_design_implemented(uuid) from public,anon;
grant execute on function public.submit_site_design(uuid) to authenticated;
grant execute on function public.review_site_design(uuid,text,text) to authenticated;
grant execute on function public.mark_site_design_implemented(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('site-design-assets','site-design-assets',false,10485760,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists site_design_assets_access on storage.objects;
create policy site_design_assets_access on storage.objects for all to authenticated
using(bucket_id='site-design-assets' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('designer','developer','admin')))
with check(bucket_id='site-design-assets' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('designer','developer','admin')));
