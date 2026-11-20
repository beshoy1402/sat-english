# SAT English platform — backend and first login

Repository: https://github.com/beshoy1402/sat-english
Supabase project: `sat-english` (`lewxfskcxceuifrtczqz`)
Vercel project: `sat-english`

## Current backend foundation

The database includes profiles, student records, parent links, courses, course access, lessons, assignments, assignment targets, submissions, exams, questions, exam assignments, exam attempts, attendance sessions and records, audit events, announcements, learning resources and calendar events.

Row Level Security is enabled on all application tables. The staff profile-list policy uses a private SECURITY DEFINER role lookup to avoid recursive RLS. The helper has a fixed empty search path and execute is restricted to authenticated users. Security advisor was checked after the policy changes.

## Authentication and accounts

The browser login accepts a username and password. The username is mapped to a non-deliverable internal Auth address of the form `<username>@accounts.northstar.invalid`. This is intentional: staff create and manage accounts, and the platform does not offer public self-registration.

The `provision-account` Supabase Edge Function is deployed with JWT verification enabled. It:
- validates the caller's active profile and role;
- allows Admin to create student, parent, teacher, assistant, developer and designer accounts;
- allows Assistant to create student accounts only;
- creates confirmed Supabase Auth users and assigns the profile role server-side;
- writes an audit event;
- requires passwords of at least 12 characters.

Never expose the Supabase service-role key in the browser or a VITE_ environment variable.

## First Admin account — one-time manual bootstrap

The first Admin must be created manually in Supabase Dashboard because there is no existing authenticated Admin who can safely authorize account provisioning.

1. Open Supabase Dashboard for project `lewxfskcxceuifrtczqz`.
2. Open **Authentication → Users → Add user**.
3. Create this exact email: `admin@accounts.northstar.invalid`.
4. Set a strong password of at least 12 characters and confirm the user.
5. Open **SQL Editor** and run the contents of `supabase/bootstrap-first-admin.sql`.
6. Confirm the query returns username `admin` and role `admin`.
7. Sign in to the website using username `admin` and the password chosen in step 4.

The SQL file only changes the role of that exact initial user. Do not use it for other accounts.

## Creating the requested accounts

After the first Admin signs in:
1. Open **Team accounts → Create account**.
2. Create a Student account (suggested username: `student`).
3. Create a Developer account (suggested username: `developer`).
4. Create a Designer account (suggested username: `designer`).
5. Create an Assistant account (suggested username: `assistant`).

Leave the temporary-password field blank to generate a cryptographically random password. The platform displays each password once; copy it and deliver it securely to its owner. Ask each person to change their password through a future password-management flow before production use.

## Vercel configuration

The browser requires:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (publishable key)

Both are configured for the Vercel project from the earlier setup. Do not add service-role or secret keys as VITE_ variables.

## Implemented in this milestone

- Username/password login UI.
- Role-based navigation for Admin, Teacher, Assistant, Developer, Designer, Student and Parent.
- Admin team-account creation interface and server-side provisioning function.
- Course, homework, exam, attendance-session, resource, calendar and announcement foundations.
- Role-aware data access through RLS.
- Mobile-responsive portal shell.
- Security audit baseline.

## Not complete yet

This is a working foundation, not the entire originally planned platform. Remaining work includes exam-taking UI and grading, question-bank editor/imports, file storage and upload policies, student-to-parent linking UI, course lesson editor and access assignment UI, attendance marking UI, homework submissions and AI correction, Gemini tutor, staff MFA enforcement, password reset/change flows, notifications, live classroom, payments, subscriptions, messaging, support tickets, developer monitoring tools, full designer editor, backup/restore automation and comprehensive end-to-end/RLS tests.

Do not onboard real students or process payments until the remaining security and workflow testing is completed.
