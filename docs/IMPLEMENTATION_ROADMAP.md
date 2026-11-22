# SAT English Platform — Implementation Roadmap

**Status:** Active implementation, phased delivery.  
**Repository:** `beshoy1402/sat-english`  
**Scope:** SAT English project only. Do not modify the separate SAT Math project.

## Product goal

Build an independently branded SAT learning platform inspired by OnePrep's student/teacher workflows, not a copy of its proprietary design or content. Support desktop, tablet, and mobile. Keep infrastructure compatible with the free-tier requirement; no paid upgrades, billing changes, production migrations, or production Edge Function deployments without explicit approval.

## Roles and access

- **Admin:** full platform administration, role assignment, student access grants/revocation, question-bank oversight, university formula management, point allocation, analytics, audit history.
- **Teacher:** assigned classes and students, lessons, assignments, exams, question-bank creation/import, review, study plans, performance analytics.
- **Assistant:** authorized student/parent support and educational operations only; no unrestricted admin or developer privileges.
- **Developer:** technical workspace, system health, AI provider configuration, code collaboration, website-wide design/content settings; no default unrestricted access to private student records.
- **Student:** access only after an authorized staff member grants it; personal learning workspace, practice, exams, feedback, AI tutor, points, progress and university calculator.
- **Parent:** access only to linked students and permitted reports.

Access grants must be auditable, revocable, and support individual and bulk provisioning. Public self-registration must not grant learning access unless explicitly enabled by Admin.

## Student learning workspace

- Personal dashboard with accuracy, questions completed, skill strengths/weaknesses, assignments, exams and study recommendations.
- SAT Reading and Writing skill practice, timed/untimed sessions, saved questions and explanations.
- Digital SAT simulator with two modules, timer, navigation, mark-for-review, submission, review and reports. Adaptive routing must only be enabled when a validated routing/scoring model exists.
- Mistake notebook with selected/correct answers, explanation, skill tags and retry tracking.
- Vocabulary flashcards, personal lists, quizzes and spaced repetition.
- Adaptive study planner using exam date, available study time, weaknesses and deadlines.

## Question bank and bulk import

Initial target: import the user's approximately 2,000 SAT questions.

Supported import formats: PDF, DOCX, XLSX, CSV and validated structured formats. Extract question text, passages, answer choices, answer keys, explanations, categories, metadata and embedded images when available.

Import workflow:
1. Upload file to a private staging area.
2. Detect file type and parse in bounded batches.
3. Preview extracted questions before publishing.
4. Validate required fields, choices, answer keys, duplicate candidates and image references.
5. Let an authorized user correct extraction errors.
6. Confirm import and publish selected valid records.
7. Show imported, skipped and failed counts with downloadable error details.
8. Support safe retry and rollback by import batch.

Never claim a PDF was imported accurately solely because text extraction completed. Preserve source attribution and require review where extraction or answer validation is uncertain. Question metadata includes program, section, domain, skill, difficulty, type, source, tags, status, creator and timestamps.

## AI Study Assistant

Provide a persistent right-side study chatbot on desktop and a collapsible/floating panel on mobile. It is strictly for SAT English learning.

The AI must:
- Review the student's submitted answer against the supplied question and answer key when available.
- Clearly state whether the answer is correct, identify exactly what is wrong, and explain why.
- Teach a repeatable step-by-step solving method.
- Show how the student's reasoning or written answer could be improved.
- Explain distractors and misconceptions.
- If the answer is correct, explain what was done well and how to be more efficient.
- Ask for missing passage, choices or answer key rather than inventing certainty.
- Offer hints and short follow-up practice.

It must not handle account administration, grade changes, private records, developer operations, unrelated requests or database actions. It must not expose prompts, secrets or internal configuration.

## AI point limits

- Student AI actions are charged using server-side point accounting, not a client-only counter.
- Initial configurable balance: **300 points** per student account.
- AI tutor / answer feedback: **5 points** per successful response.
- AI-generated study plan: **15 points** per successful response.
- Failed provider requests must refund the reserved points.
- Block requests when balance is insufficient and show the remaining balance.
- Maintain a transaction ledger for usage, grants, adjustments and refunds.
- Admin can grant or adjust points with a reason and audit record.
- Future work: Admin UI for point packages, limits, grants, usage reports and configurable per-action costs.
- Point values are initial defaults and must be configurable before wider rollout.

## University admission calculator

Support GPA + SAT 1 + SAT 2 inputs and calculate a combined estimate using a selected university, faculty/program and admission year.

Do not use one hardcoded formula for every institution. Maintain versioned, admin-managed rules containing:
- University and faculty/program.
- Admission year and source/verification date.
- GPA scale and conversion.
- SAT 1 and SAT 2 requirements, score scales and weights.
- Required subjects, minimums and eligibility conditions.
- Formula and rounding rules.

Display each component, formula, assumptions, missing requirements and result. Label unverified or incomplete results as estimates, not official admission scores. Preserve historical rules rather than overwriting them.

## Teacher/admin intelligence

- Student and class analytics, skill mastery and trends.
- Student risk indicators based on transparent attendance/performance signals.
- Question difficulty and quality analytics.
- Reusable assignment/exam templates.
- Learning goals and progress tracking.
- Parent progress reports and linked-student portal.

## Live learning

Continue planned live classroom, attendance, polls, shared question solving, teacher-uploaded recordings, session recordings, lesson attachments, access permissions and recorded-session library.

Student-led study rooms: students may open a private website room for classmates in a course they currently access. The room creator is host, can start/end and moderate the room, and each student may have one active room with a maximum of six participants. Student rooms do not create Zoom meetings.

Teacher-led live lessons: teachers choose the delivery mode per session — native website WebRTC room or Zoom. Zoom uses a server-side administrator-configured Server-to-Server OAuth app and the Zoom Meetings API. Students see only the join URL; the teacher's privileged start URL is stored separately and refreshed server-side. Zoom app credentials belong only in Supabase Edge Function secrets. Current integration opens Zoom externally (desktop client/browser), not embedded Meeting SDK. Zoom webhook attendance sync remains future work.

## Gamification

Configurable XP, achievements, streaks, weekly challenges, class leaderboards and milestone certificates. Admin/authorized teachers control whether these features are enabled.

## Technical and security requirements

- Keep SAT English repository, Supabase project, configuration and Vercel project separate from SAT Math.
- Enforce permissions in server-side functions and Supabase RLS; never rely on hidden UI controls alone.
- Use private storage and bounded, validated import processing.
- Audit sensitive actions and access grants.
- Keep AI usage and provider failover within the existing zero-cost allowlist policy.
- Add rate limits, backups, disaster recovery and monitoring.
- Do not deploy production migrations or Edge Functions without explicit approval.
- Do not upgrade plans, enable billing or add paid services without explicit approval.

## Delivery phases

1. Role/access model and student workspace foundation.
2. Question-bank import pipeline and 2,000-question onboarding.
3. Practice engine, exams, mistake notebook and analytics.
4. AI answer correction, point wallet and Admin point controls.
5. University calculator and versioned formula management.
6. Teacher analytics, parent reports and assignments.
7. Live classroom, recordings and gamification.
8. Security, accessibility, mobile, performance, backup and launch verification.

## Acceptance criteria

- Access can only be granted/revoked by authorized staff and every change is audited.
- Student permissions are isolated by role and assigned class/course.
- Import provides a reviewable preview, validation report and safe batch rollback.
- Questions preserve passages, choices, correct answers, explanations and images.
- AI feedback accurately identifies errors and explains how to improve; uncertainty is explicit.
- AI point charges are atomic, server-enforced, ledgered and refunded on failed provider requests.
- Admin can manage point balances and inspect usage.
- University results show the correct versioned formula and are not presented as official when unverified.
- Mobile and desktop workflows are usable.
- Security and recovery tests pass before production launch.

## Current implementation slice

- Added the initial student-facing Egyptian university admission calculator interface with GPA, SAT I, Egyptian admission SAT II, university, faculty and admission-year inputs. The component defines a versioned rule shape but intentionally does not calculate a score until an official formula for the exact university/faculty/year is verified and configured. No database migration or production deployment was made.

- Added source-controlled migration for student AI point accounts, transaction ledger, server-side consume/refund functions and Admin adjustment RPC.
- Updated the AI learning Edge Function to charge 5 points for tutor responses and 15 for study-plan generation, reject insufficient balances and refund failed provider attempts.
- Updated the student AI Tutor to emphasize answer checking, precise error explanations and improvement guidance, and to show the point balance.
- Added a structured answer-review form for the question, passage, answer choices, student response and optional answer key; it prepares a grounded review request without inventing missing answers.
- The points indicator now reports when the wallet cannot be loaded instead of displaying a misleading fallback balance.
- Added an Admin-only AI points dashboard to search student balances, grant/deduct points with a reason, and review the recent transaction ledger. The server-side adjustment RPC now rejects inactive/non-student targets and revokes public/anonymous execution.
- Admin point controls are UI/source changes only; the required migration still needs explicit approval before production use.
- These changes are on the existing feature branch. The database migration and Edge Function are **not deployed**. Production remains unchanged until explicit approval and successful verification.


- Added a downloadable CSV error report for the latest Question Bank import. It records source file, source row, skipped validation reasons, and database save failures; CSV and JSON source row numbering is preserved. This remains a browser-side workflow using the existing save RPC and does not add import-batch rollback or persistent staging.
- Implemented an initial browser-side bulk import workflow for CSV and structured JSON question files in the Question Bank. It previews rows, validates required prompts, supported question types, difficulty, points and exact multiple-choice answer matching, and flags prompt duplicates against the existing bank and within the file. Staff explicitly confirm before valid rows are saved through the existing question-save RPC; writes are grouped in small concurrent batches and failed rows are reported. This first slice supports CSV/JSON only; PDF, DOCX and XLSX extraction, image extraction, downloadable error files, and batch rollback remain future work. No database migration, Edge Function deployment or production deployment was made.

- Hardened CSV import parsing to reject unterminated quoted fields, empty headings and duplicate headings. The preview now displays the original source row number, matching the downloadable report. Source-only change; no deployment or database changes.


For the maintained, full product scope, implementation stages, acceptance criteria and current status, see [Complete Platform Implementation Plan](./COMPLETE_PLATFORM_IMPLEMENTATION_PLAN.md). This is the master plan; this roadmap remains the concise delivery summary.


### Live Classroom foundation (source only)
- Added staff/student Live classroom navigation, session scheduling, lifecycle controls, student join/leave and private Realtime presence roster.
- Added source-only migration for session records, participant attendance, course-scoped RLS and private topic authorization.
- Server-side RPCs own lifecycle transitions and attendance timestamps; direct client writes to those fields are revoked.
- Not yet implemented: WebRTC audio/video, TURN/SFU, screen sharing, chat, moderation and live recording.
- Migration not applied; build and runtime tests pending; no production deployment.

- Added `src/LiveMedia.tsx`: WebRTC audio/video, participant tiles, camera/microphone controls and screen sharing. Private signaling uses a separate session-scoped topic; STUN-only and six-participant cap are explicit limitations. Runtime/build tests pending.

- Live session records now store the staff actor for start/end/cancel actions; optional linked lessons must be published and belong to the selected course.
- Realtime broadcast send and receive authorization both require the session lobby/live state.

- Added persistent classroom chat with database-enforced membership checks, 1,000-character bound, send rate limits and 10-minute teacher chat mute/unmute controls with audit events.
- Added student hand raise through private Realtime presence. Persistent hand-raise history and participant removal remain outstanding.
- Chat notifications broadcast only a persisted message ID; receiving clients re-fetch the message through table RLS before displaying it.

- Before activating the live room, verify Supabase Realtime's project-level **Allow public access** setting is disabled. The setting has not been checked or changed.

- Added teacher removal of active student participants. The server records the action, closes attendance, and blocks the removed student from rejoining the same live session.

- Master plan status corrected: teacher removal is now in source; remaining classroom gaps include reconnection validation, TURN/SFU, recording and end-to-end tests.

- Added source-only student-created study rooms and teacher-selected Zoom/website delivery. Added a 30-second authenticated attendance heartbeat and a two-minute stale-participant expiry check before capacity enforcement. Student rooms are course-scoped, one active room per host, and capped at six participants by the database join RPC. Zoom API integration source creates scheduled meetings server-side and separates teacher host URLs from student join URLs. No credentials, migration, or deployment have been applied.

- Teacher Zoom delivery now includes server-side create/refresh, start, end and cancel actions. Required Zoom scopes include create/read/end/delete meeting permissions. Webhook attendance sync and per-teacher Zoom OAuth remain future work.
- See `docs/ZOOM_INTEGRATION_SETUP.md` for the source-only configuration and security guide.

- Current Live Classroom source includes student-created study rooms and teacher-selected website/Zoom delivery. Zoom API Edge Function and database migration are source-only; no secrets configured or production deployment performed. Build/runtime tests and Zoom webhook attendance remain outstanding.
