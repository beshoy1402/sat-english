create table if not exists private.github_integrations (
  id boolean primary key default true check(id=true),
  vault_secret_id uuid,
  repo_owner text not null default 'beshoy1402',
  repo_name text not null default 'sat-english',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
revoke all on private.github_integrations from public,anon,authenticated;

create or replace function public.github_integration_save(p_token text,p_repo_owner text,p_repo_name text)
returns void language plpgsql security definer set search_path='' as $$
declare v_secret uuid;
begin
  if private.current_user_role() <> 'developer' then raise exception 'Developer role required'; end if;
  if coalesce(trim(p_token),'')='' then raise exception 'GitHub token is required'; end if;
  if p_repo_owner !~ '^[A-Za-z0-9-]{1,39}$' or p_repo_name !~ '^[A-Za-z0-9_.-]{1,100}$' then raise exception 'Invalid GitHub repository name'; end if;
  select vault_secret_id into v_secret from private.github_integrations where id=true;
  if v_secret is null then
    select vault.create_secret(p_token,'sat-english-github-token','GitHub pull request integration token') into v_secret;
  else
    perform vault.update_secret(v_secret,p_token,'sat-english-github-token','GitHub pull request integration token');
  end if;
  insert into private.github_integrations(id,vault_secret_id,repo_owner,repo_name,updated_by,updated_at)
  values(true,v_secret,p_repo_owner,p_repo_name,auth.uid(),now())
  on conflict(id) do update set vault_secret_id=excluded.vault_secret_id,repo_owner=excluded.repo_owner,repo_name=excluded.repo_name,updated_by=auth.uid(),updated_at=now();
end $$;
revoke all on function public.github_integration_save(text,text,text) from public,anon,authenticated;
grant execute on function public.github_integration_save(text,text,text) to authenticated;

create or replace function public.github_integration_get()
returns table(repo_owner text,repo_name text,key_configured boolean)
language sql security definer set search_path='' as $$
  select coalesce(g.repo_owner,'beshoy1402'),coalesce(g.repo_name,'sat-english'),g.vault_secret_id is not null
  from (select true as id) seed left join private.github_integrations g on g.id=seed.id;
$$;
revoke all on function public.github_integration_get() from public,anon,authenticated;
grant execute on function public.github_integration_get() to service_role;

create or replace function public.github_integration_read_secret()
returns text language plpgsql security definer set search_path='' as $$
declare v_secret uuid; v_value text;
begin
  select vault_secret_id into v_secret from private.github_integrations where id=true;
  if v_secret is null then return null; end if;
  select decrypted_secret into v_value from vault.decrypted_secrets where id=v_secret;
  return v_value;
end $$;
revoke all on function public.github_integration_read_secret() from public,anon,authenticated;
grant execute on function public.github_integration_read_secret() to service_role;
