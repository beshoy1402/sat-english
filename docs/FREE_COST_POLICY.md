# Free-cost requirement

The SAT English platform must remain deployable and usable without requiring a paid subscription, paid hosting upgrade, paid database branch, paid video-conferencing server, or paid API plan.

## Rules for development

- Do not create paid Supabase branches or paid compute resources for testing.
- Do not enable Vercel Pro-only features or add paid Marketplace services.
- Keep the existing production Supabase project unchanged while working on this feature branch.
- Use the local Supabase CLI + Docker stack for database migration and role testing. This runs on the developer's computer and does not create a second hosted database.
- Keep the app compatible with the existing free-tier deployment configuration, subject to the provider's current usage limits and terms.
- Do not add required paid APIs. AI integrations must remain optional and must not prevent the non-AI learning platform from working.
- Before enabling any AI provider, make its pricing, free-tier quota and rate limits explicit. Never assume a provider's free tier is permanent.
- Current AI routing keeps Gemini 3.8 Flash as the primary provider and maps the configured OpenRouter Llama 3.3 fallback to the explicitly free `:free` model variant. The currently configured Groq `llama-3.3-70b-versatile` model was retired on August 16, 2026, so the request service skips it until a supported replacement is deliberately configured.
- A zero-priced model variant does not guarantee unlimited access: provider quotas, account billing tier, and terms still apply. If the free quota is exhausted, AI features may be temporarily unavailable; they must not silently switch to a metered model.

Current provider references (verify before launch):
- Google Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- OpenRouter free Llama 3.3 endpoint: https://openrouter.ai/meta-llama/llama-3.3-70b-instruct:free
- Groq model deprecations: https://console.groq.com/docs/deprecations
- For live classes, prefer external meeting links or a no-cost hosted meeting option. Do not deploy a self-hosted media server or introduce paid video infrastructure as a hidden requirement.
- File storage and bandwidth must remain within the existing free-tier allowance. Large recording uploads may be disabled or constrained if free storage/bandwidth quotas cannot support them.

## Important limits

"Free" means no mandatory new recurring infrastructure spend. It does not mean unlimited usage or guaranteed permanent free tiers. Vercel, Supabase, AI providers, and meeting providers can change quotas, suspend inactive resources, or impose usage limits. Verify current account plan and quotas before public launch.

## Current testing strategy

- Use the existing feature branch and preview deployments.
- Use local Supabase (Docker + Supabase CLI) for migrations, RLS checks and fake test accounts.
- Never use production student data in local tests.
- Do not create a hosted Supabase development branch unless the owner explicitly approves a cost.
- Do not apply pending migrations to the production database as a substitute for testing.
