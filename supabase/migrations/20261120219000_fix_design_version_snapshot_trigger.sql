create or replace function public.bump_site_design_version()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.content is distinct from old.content or new.name is distinct from old.name then
    new.version:=old.version+1;
    new.updated_at:=now();
  end if;
  return new;
end;
$$;
revoke all on function public.bump_site_design_version() from public,anon,authenticated;

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
  elsif new.version is distinct from old.version then
    insert into public.site_design_versions(draft_id,version,name,content,created_by)
    values(new.id,new.version,new.name,new.content,coalesce(auth.uid(),new.created_by));
  end if;
  return new;
end;
$$;
revoke all on function public.snapshot_site_design_version() from public,anon,authenticated;

drop trigger if exists site_design_version_snapshot on public.site_design_drafts;
drop trigger if exists site_design_version_bump on public.site_design_drafts;
create trigger site_design_version_bump before update on public.site_design_drafts
for each row execute function public.bump_site_design_version();
create trigger site_design_version_snapshot after insert or update on public.site_design_drafts
for each row execute function public.snapshot_site_design_version();
