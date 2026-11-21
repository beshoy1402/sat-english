-- Add NVIDIA NIM to the server-side AI provider registry.
-- This migration is committed for review; it is not applied to production here.
alter table private.ai_provider_configs
  drop constraint if exists ai_provider_configs_provider_check;

alter table private.ai_provider_configs
  add constraint ai_provider_configs_provider_check
  check (provider in ('qwen','nvidia','gemini','groq','deepseek','openrouter'));

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
  if p_provider not in ('qwen','nvidia','gemini','groq','deepseek','openrouter') then
    raise exception 'Unsupported AI provider';
  end if;
  if p_base_url not in (
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    'https://integrate.api.nvidia.com/v1',
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

-- Seed a disabled NVIDIA row so the Developer UI can securely save its key.
-- Existing credentials and enablement states are preserved.
insert into private.ai_provider_configs
  (provider, vault_secret_id, base_url, model, is_enabled, priority, updated_at)
values
  ('nvidia', null, 'https://integrate.api.nvidia.com/v1', 'nvidia/nemotron-3.5-lightning-30b-a3b', false, 1, now())
on conflict (provider) do update set
  base_url = excluded.base_url,
  model = excluded.model,
  priority = 1,
  updated_at = now();

update private.ai_provider_configs set priority = 2, updated_at = now()
where provider = 'gemini';
update private.ai_provider_configs set priority = 3, updated_at = now()
where provider = 'openrouter';

revoke all on function public.ai_provider_config_save(text,text,text,text,boolean,integer) from public, anon, authenticated;
grant execute on function public.ai_provider_config_save(text,text,text,text,boolean,integer) to service_role;
