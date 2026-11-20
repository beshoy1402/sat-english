# Northstar English — SAT English Platform

Independent English exam-preparation platform for SAT English, EST English and ACT English. This repository is intentionally separate from the SAT Math repository.

## Current milestone

- Premium navy-blue responsive landing page.
- Animated 3D-inspired hero illustration and scroll-reveal sections.
- English and Arabic language switch with RTL layout.
- Program overview, teaching approach, FAQ and contact call-to-action.
- Student login entry modal placeholder.
- Reduced-motion accessibility support.
- React + TypeScript + Vite foundation.

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

## Status

This is the initial frontend foundation only. Authentication, student and parent portals, staff dashboards, exam engine, AI workflows, payments, messaging, monitoring and production deployment remain future milestones.


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
- Do not run `supabase db push`, hosted migrations, or production deploys during this development phase.
- Stop the local services when finished with `npm run db:stop`.
