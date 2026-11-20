# English Platform Backend Foundation

Supabase project: `sat-english`
Project ref: `lewxfskcxceuifrtczqz`

## Applied database migrations

- `20261120104437_english_platform_core_schema`
- `20261120104443_tighten_student_write_permissions`
- `20261120104522_refine_rls_policies_and_indexes`

The database currently contains 16 public tables. Row Level Security is enabled on every public table created by these migrations.

## Core data model

- `profiles`: authenticated user profile and server-controlled role.
- `student_records`: student-specific record.
- `parent_student_links`: parent-to-child relationships.
- `courses`, `course_access`, `lessons`: course publication and student access.
- `assignments`, `assignment_targets`, `submissions`: homework workflow.
- `exams`, `questions`, `exam_assignments`, `exam_attempts`: exam and question foundation.
- `attendance_sessions`, `attendance_records`: attendance.
- `audit_events`: protected audit history.

## Security baseline

- New Auth users receive a default `student` profile. User-editable metadata is not used to assign roles.
- Profile role changes are not permitted through the browser client.
- Students can only read their own related records and assigned published learning content.
- Course access is checked server-side through RLS and active access dates.
- Student exam attempts cannot write score fields.
- Audit events cannot be inserted, updated or deleted by browser clients.
- No Supabase service-role key is stored in Vercel frontend environment variables.

## Vercel environment

Set for Development, Preview and Production:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (Supabase publishable key)

Never put a Supabase secret/service-role key in a `VITE_*` variable.

## Not yet implemented

This schema is the initial backend foundation, not the complete product. The frontend Supabase client, login/session flow, staff provisioning Edge Functions, complete per-role dashboards, MFA enforcement, storage buckets and policies, billing, messaging, AI services, live classroom, reports, monitoring and full test suite remain to be implemented and verified.

## Operational note

The migrations were applied directly to the dedicated Supabase project through the Supabase migration API. Before production data is introduced, establish a checked-in, reproducible migration workflow and run the complete RLS/security test suite against test accounts for every role.
