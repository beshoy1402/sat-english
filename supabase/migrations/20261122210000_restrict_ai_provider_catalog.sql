-- Restrict the configured runtime catalog to the approved zero-cost routing stack.
-- Legacy provider rows and their Vault secrets are retained for audit/recovery,
-- but are disabled and cannot be selected by the application Edge Functions.
update private.ai_provider_configs
set is_enabled = false,
    updated_at = now()
where provider not in ('gemini', 'openrouter', 'groq');

-- Make the intended fallback order explicit without enabling providers or changing credentials.
update private.ai_provider_configs
set priority = case provider
  when 'gemini' then 1
  when 'openrouter' then 2
  when 'groq' then 3
  else priority
end,
updated_at = now()
where provider in ('gemini', 'openrouter', 'groq');

comment on table private.ai_provider_configs is
  'Server-side AI provider configuration. The SAT English application runtime allowlist is Gemini, OpenRouter Free and Groq GPT-OSS; legacy provider records remain disabled and retained for audit/recovery.';
