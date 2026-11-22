# Northstar English — SAT English Platform

Independent English exam-preparation platform for SAT English, EST English and ACT English. This repository is intentionally separate from the SAT Math repository.

## Current development milestone

This branch is the active implementation branch for the SAT English platform. It contains working backend schemas, role-based workflows and frontend modules for the core teaching experience.

- Role-based Admin, Teacher, Assistant, Student, Parent, Developer and Designer areas.
- Staff attendance register, gradebook, grade adjustments, immutable grade-change history and class/group membership management.
- Question bank and timed exam workflow, server-side attempt validation, automatic grading and written-answer review.
- Homework assignment, file submission, teacher review and parent monitoring.
- Course access, online meeting links, in-person session scheduling, lesson resources and lesson progress.
- Parent-child account linking, parent academic overview and report export.
- In-app notifications triggered by grades, attendance, homework, exams, course access and messages; realtime internal messaging.
- Staff CSV data export for students, grades, attendance, homework, exams and course access; browser print-to-PDF reports.
- Basic exam integrity signal logging for tab hiding, focus loss, copy/paste and context-menu events.
- Designer draft/version/review workflow and developer task/bug tracking.
- AI provider management, failover request service, student AI tutor, study-plan generation and teacher-reviewed homework feedback drafts.
- Responsive navy-blue public landing page with English/Arabic layout and reduced-motion support.

The current branch is still under development. Each workflow must pass build, permission and end-to-end testing before the production release.

## Local development

Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Architecture and security

The platform is planned to expand into separate permission-controlled experiences for students, parents, teachers, assistants, administrators, developers and designers. Authentication, backend authorization, data storage, exams, AI providers, payment processing, messaging and live-class integrations must be implemented as server-backed services before their workflows are enabled.

Never expose API keys or secrets in client-side code. Keep development, staging and production configuration and data separate. Staging must not use real student records or live payment credentials.

## Current release status

- Core database migrations and the account, AI and learning Edge Functions have been applied to the linked Supabase project.
- Current implementation is on `feature/recorded-sessions-library`; the production website has not been updated from this branch.
- AI features require a Developer to save at least one provider API key before students can use them. No provider key is committed to this repository.
- AI homework output is a draft only. A teacher or authorized assistant must verify and save the final grade and feedback.
- In-app messaging is realtime within the website; WhatsApp, SMS and external email delivery are not connected.
- Online lessons use external meeting URLs (for example, Zoom or Google Meet); this is not a native video-conferencing service.
- AI token/latency/failure usage is recorded, but exact provider costs are not calculated until pricing data is configured.
- PDF/DOCX/XLSX question-bank extraction, payments, WhatsApp API, native live video, advanced proctoring beyond browser signals, disaster-recovery restore, full hosting/database cost controls and end-to-end acceptance testing remain incomplete. GitHub pull-request listing, diff inspection and review submission are implemented, but the Developer must still connect a fine-grained GitHub token before the integration can be used.
- A new Vercel build/deployment could not be run after the latest frontend changes because the deployment API daily limit was reached. The latest frontend branch therefore still needs a fresh CI/build verification before production release.

Do not treat the existing production URL as proof that the latest feature branch is deployed.


## Local backend development (no additional hosted database cost)

The branch `feature/shared-staff-dashboards` uses a local Supabase stack for backend development. Docker Desktop and the Supabase CLI are required. This runs Postgres, Auth, and the Supabase APIs on your own computer; it does not create or bill a second hosted Supabase project.

### One-time setup

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).
2. Start Docker Desktop.
3. In this repository, install dependencies and authenticate the Supabase CLI:
   ```bash
   npm install
   supabase login
   supabase link --project-ref lewxfskcxceuifrtczqz
   ```
4. Pull the existing database schema into local migration files:
   ```bash
   npm run db:pull
   ```
   This reads the existing schema to generate local migration files. It does not apply schema changes to the hosted database. The CLI may ask for the hosted database password; use the database password from the Supabase project settings. Never commit that password.
5. Start the local Supabase services and apply the pulled migrations to the local database:
   ```bash
   npm run db:start
   npm run db:reset
   npm run db:status
   ```
6. Copy the local `API_URL` and `ANON_KEY` values from `supabase status -o env` into a new `.env.local` file, using `.env.local.example` as the template. Do not use the hosted production URL or key.
7. In a second terminal, copy `supabase/.env.local.example` to `supabase/.env.local` and paste the local `API_URL` and `SERVICE_ROLE_KEY` from `supabase status -o env`. Start the local Edge Functions:
   ```bash
   npm run functions:serve
   ```
   Keep this terminal running while testing account creation and deletion.
8. Run the app:

   ```bash
   npm run dev
   ```

### Safety rules

- Hosted Vercel preview for this branch is set to `VITE_APP_MODE=preview-safe`, which disables Supabase initialization. It must not connect to the production database.
- Local dashboard development uses only `http://127.0.0.1:54321` and the local anon key.
- Use fake accounts and fictional student records only. Do not copy real student data into local development.
- Do not run `supabase db push` or `supabase db reset --linked` from your local machine. Those commands can modify or destroy the linked hosted database. Production schema changes must go through reviewed migrations; never reset the production database.
- Stop the local services when finished with `npm run db:stop`.


### AI provider management and learning services

The Developer Dashboard provider catalog is restricted in source to NVIDIA NIM (primary), Google Gemini (secondary), and OpenRouter (third fallback). Groq, Qwen, DeepSeek, OpenAI, Anthropic Claude, Meta Llama and custom endpoints are not supported by the current application routing allowlist.

- API keys are stored in Supabase Vault. The browser receives configuration metadata, never the secret key.
- The provider-settings Edge Function requires an active Developer profile.
- Providers can be enabled/disabled, assigned a model and priority, tested, and used in automatic failover order.
- The `ai-learning` Edge Function powers student tutoring, personal study-plan generation and AI homework-review drafts.
- AI homework feedback and scores remain drafts until a teacher or assistant verifies and saves them.
- AI usage logs include provider, model, success/failure, latency and token counts. Exact costs are not estimated without configured pricing data.
- At least one provider must be enabled and have a valid API key. No real API keys are stored in Git.
- GitHub PR review uses a separate fine-grained GitHub token stored in Supabase Vault. Grant repository Metadata read, Contents read and Pull requests read/write. The token is not committed to Git.
- NVIDIA NIM uses its OpenAI-compatible chat-completions endpoint; Gemini uses the Google Generative Language API; OpenRouter uses its OpenAI-compatible API. Provider account pricing, quotas and model availability must be verified before enabling each integration.
- For local development, complete the local Supabase setup above and run `npm run functions:serve` with local credentials.
