-- Align provider catalog with the requested routing order:
-- 1) NVIDIA NIM, 2) Gemini, 3) OpenRouter.
-- Legacy provider rows and Vault secrets are retained; unsupported providers are disabled.
update private.ai_provider_configs
set is_enabled = false,
    updated_at = now()
where provider not in ('nvidia', 'gemini', 'openrouter');

update private.ai_provider_configs
set priority = case provider
  when 'nvidia' then 1
  when 'gemini' then 2
  when 'openrouter' then 3
  else priority
end,
updated_at = now()
where provider in ('nvidia', 'gemini', 'openrouter');

comment on table private.ai_provider_configs is
  'Server-side AI provider configuration. SAT English routing order: NVIDIA NIM, Gemini, OpenRouter. Unsupported provider records remain disabled and retained for audit/recovery.';
