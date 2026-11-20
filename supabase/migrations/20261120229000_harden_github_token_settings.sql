create or replace function public.github_integration_save(p_token text,p_repo_owner text,p_repo_name text)
returns void language plpgsql security definer set search_path='' as $$
declare v_secret uuid;
begin
  if coalesce(private.current_user_role()::text,'') <> 'developer' then raise exception 'Developer role required'; end if;
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
revoke all on function public.github_integration_save(text,text,text) from public,anon;
grant execute on function public.github_integration_save(text,text,text) to authenticated;