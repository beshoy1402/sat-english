-- AI provider credentials are stored in Supabase Vault, never in browser-accessible tables.
create schema if not exists private;

create table if not exists private.ai_provider_configs (
  provider text primary key check (provider in ('qwen','gemini','groq','deepseek','openrouter')),
  vault_secret_id uuid references vault.secrets(id) on delete set null,
  base_url text not null,
  model text not null default '',
  is_enabled boolean not null default false,
  priority integer not null default 100,
  last_tested_at timestamptz,
  last_test_status text,
  updated_at timestamptz not null default now()
);

revoke all on schema private from public, anon, authenticated;
revoke all on private.ai_provider_configs from public, anon, authenticated;
grant usage on schema private to service_role;
grant all on private.ai_provider_configs to service_role;

create or replace function public.ai_provider_config_list()
returns table (
  provider text,
  base_url text,
  model text,
  is_enabled boolean,
  priority integer,
  key_configured boolean,
  last_tested_at timestamptz,
  last_test_status text
)
language sql
security definer
set search_path = ''
as $$
  select c.provider, c.base_url, c.model, c.is_enabled, c.priority,
         (c.vault_secret_id is not null), c.last_tested_at, c.last_test_status
  from private.ai_provider_configs c
  order by c.priority, c.provider;
$$;

create or replace function public.ai_provider_config_save(
  p_provider text,
  p_api_key text,
  p_base_url text,
  p_model text,
  p_is_enabled boolean,
  p_priority integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
begin
  if p_provider not in ('qwen','gemini','groq','deepseek','openrouter') then
    raise exception 'Unsupported AI provider';
  end if;
  if p_base_url not in (
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    'https://generativelanguage.googleapis.com/v1beta',
    'https://api.groq.com/openai/v1',
    'https://api.deepseek.com/v1',
    'https://openrouter.ai/api/v1'
  ) then
    raise exception 'Unsupported provider endpoint';
  end if;

  select vault_secret_id into v_secret_id
  from private.ai_provider_configs where provider = p_provider;

  if coalesce(p_api_key, '') <> '' then
    if v_secret_id is null then
      select vault.create_secret(p_api_key, 'ai-provider-' || p_provider, 'AI provider API key')
      into v_secret_id;
    else
      perform vault.update_secret(v_secret_id, p_api_key, 'ai-provider-' || p_provider, 'AI provider API key');
    end if;
  end if;

  insert into private.ai_provider_configs
    (provider, vault_secret_id, base_url, model, is_enabled, priority, updated_at)
  values
    (p_provider, v_secret_id, p_base_url, coalesce(p_model,''), coalesce(p_is_enabled,false), greatest(1,least(coalesce(p_priority,100),999)), now())
  on conflict (provider) do update set
    vault_secret_id = excluded.vault_secret_id,
    base_url = excluded.base_url,
    model = excluded.model,
    is_enabled = excluded.is_enabled,
    priority = excluded.priority,
    updated_at = now();
end;
$$;

create or replace function public.ai_provider_config_read_secret(p_provider text)
returns text
language sql
security definer
set search_path = ''
as $$
  select ds.decrypted_secret
  from private.ai_provider_configs c
  join vault.decrypted_secrets ds on ds.id = c.vault_secret_id
  where c.provider = p_provider;
$$;

create or replace function public.ai_provider_config_tested(p_provider text, p_status text)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.ai_provider_configs
  set last_tested_at = now(), last_test_status = left(p_status, 120), updated_at = now()
  where provider = p_provider;
$$;

revoke all on function public.ai_provider_config_list() from public, anon, authenticated;
revoke all on function public.ai_provider_config_save(text,text,text,text,boolean,integer) from public, anon, authenticated;
revoke all on function public.ai_provider_config_read_secret(text) from public, anon, authenticated;
revoke all on function public.ai_provider_config_tested(text,text) from public, anon, authenticated;
grant execute on function public.ai_provider_config_list() to service_role;
grant execute on function public.ai_provider_config_save(text,text,text,text,boolean,integer) to service_role;
grant execute on function public.ai_provider_config_read_secret(text) to service_role;
grant execute on function public.ai_provider_config_tested(text,text) to service_role;
