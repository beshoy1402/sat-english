alter table private.ai_provider_configs drop constraint if exists ai_provider_configs_provider_check;
alter table private.ai_provider_configs add constraint ai_provider_configs_provider_check
check(provider in ('qwen','gemini','groq','deepseek','openrouter','openai','anthropic','meta_llama','custom'));

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
set search_path=''
as $$
declare v_secret_id uuid; v_host text;
begin
  if p_provider not in ('qwen','gemini','groq','deepseek','openrouter','openai','anthropic','meta_llama','custom') then
    raise exception 'Unsupported AI provider';
  end if;
  if p_provider<>'custom' and p_base_url not in (
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    'https://generativelanguage.googleapis.com/v1beta',
    'https://api.groq.com/openai/v1',
    'https://api.deepseek.com/v1',
    'https://openrouter.ai/api/v1',
    'https://api.openai.com/v1',
    'https://api.anthropic.com/v1',
    'https://api.together.xyz/v1'
  ) then raise exception 'Unsupported provider endpoint'; end if;
  if p_provider='custom' then
    if p_base_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[^[:space:]]*)?$' then raise exception 'Custom endpoints must use a valid HTTPS URL'; end if;
    v_host:=lower(split_part(split_part(replace(p_base_url,'https://',''), '/', 1),':',1));
    if v_host in ('localhost','127.0.0.1','0.0.0.0','::1') or v_host ~ '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.)' then
      raise exception 'Private network endpoints are not allowed';
    end if;
  end if;
  select vault_secret_id into v_secret_id from private.ai_provider_configs where provider=p_provider;
  if coalesce(p_api_key,'')<>'' then
    if v_secret_id is null then
      select vault.create_secret(p_api_key,'ai-provider-'||p_provider,'AI provider API key') into v_secret_id;
    else
      perform vault.update_secret(v_secret_id,p_api_key,'ai-provider-'||p_provider,'AI provider API key');
    end if;
  end if;
  insert into private.ai_provider_configs(provider,vault_secret_id,base_url,model,is_enabled,priority,updated_at)
  values(p_provider,v_secret_id,p_base_url,coalesce(p_model,''),coalesce(p_is_enabled,false),greatest(1,least(coalesce(p_priority,100),999)),now())
  on conflict(provider) do update set vault_secret_id=excluded.vault_secret_id,base_url=excluded.base_url,model=excluded.model,
    is_enabled=excluded.is_enabled,priority=excluded.priority,updated_at=now();
end;
$$;

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid references public.profiles(id) on delete set null,
  feature text not null check(feature in ('tutor','homework_review')),
  provider text not null,
  model text not null default '',
  success boolean not null default false,
  error_message text,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  estimated_cost_usd numeric(12,6),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_logs_created_idx on public.ai_usage_logs(created_at desc);
create index if not exists ai_usage_logs_provider_idx on public.ai_usage_logs(provider,created_at desc);
create index if not exists ai_usage_logs_user_idx on public.ai_usage_logs(user_profile_id,created_at desc);
alter table public.ai_usage_logs enable row level security;
revoke all on public.ai_usage_logs from anon,authenticated;
grant select on public.ai_usage_logs to authenticated;
drop policy if exists ai_usage_logs_read_owner_or_developer on public.ai_usage_logs;
create policy ai_usage_logs_read_owner_or_developer on public.ai_usage_logs for select to authenticated
using(user_profile_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='developer'));

create table if not exists public.ai_homework_review_drafts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  score_suggestion numeric(9,2),
  feedback_suggestion text not null default '',
  strengths jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  provider text not null,
  model text not null default '',
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(submission_id)
);
alter table public.ai_homework_review_drafts enable row level security;
revoke all on public.ai_homework_review_drafts from anon,authenticated;
grant select on public.ai_homework_review_drafts to authenticated;
drop policy if exists ai_homework_review_drafts_staff_read on public.ai_homework_review_drafts;
create policy ai_homework_review_drafts_staff_read on public.ai_homework_review_drafts for select to authenticated
using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant')));
