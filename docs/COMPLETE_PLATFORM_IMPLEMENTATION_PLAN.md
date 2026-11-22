# SAT English — Complete Platform Implementation Plan

**Status:** Active implementation; work is kept on the existing feature branch and is not published.
**Repository:** `beshoy1402/sat-english`
**Working branch:** `feature/recorded-sessions-library`
**Production site:** `https://sat-english-one.vercel.app/`
**Supabase project:** `lewxfskcxceuifrtczqz`
**Scope boundary:** SAT English only. SAT Math remains a separate project, repository, database, configuration and deployment.

## 1. Non-negotiable delivery rules

- Keep all changes on the existing feature branch unless explicitly instructed otherwise.
- Do not merge, publish, deploy to production, or trigger production releases without explicit approval.
- Do not apply production Supabase migrations or deploy Edge Functions without explicit approval.
- No paid services, paid plan upgrades, billing activation or surprise charges. Prefer free/open-source options and disclose any unavoidable free-tier limitations before implementation.
- Keep production stable and unchanged while development is in progress.
- Do not claim a feature is complete until code, schema prerequisites, permissions and actual runtime behavior have been verified.
- Preserve responsive desktop, tablet and mobile experiences and the existing platform design system.
- Do not use Claude or OpenAI models. The configured AI preference is Gemini primary, OpenRouter and Groq fallback; Qwen is disabled for now.

## 2. Product and role model

Build a complete SAT English learning platform inspired by modern education platforms, with original implementation and content.

### Roles
- **Admin:** platform administration, role/access management, question-bank oversight, AI point allocation, analytics, audit history and verified admission-rule management.
- **Teacher:** assigned classes, courses, lessons, homework, exams, question bank, live classrooms, attendance, review and student progress.
- **Assistant:** limited student/parent support and delegated academic operations; no unrestricted administrator or developer privileges.
- **Developer:** technical workspace, provider configuration, system health, code collaboration and website-wide technical/design controls; no default unrestricted access to private student records.
- **Student:** assigned learning workspace, lessons, practice, homework, exams, AI tutor, points, progress and admission calculator.
- **Parent:** access only to linked students and permitted reports; no live classroom participation unless a future explicit permission is approved.

Every role must be enforced server-side with Supabase RLS and Edge Function checks. Hiding a button is not authorization.

## 3. Platform workstreams

### A. Identity, access and account security
- Secure username/password authentication backed by Supabase Auth.
- Authorized staff account provisioning, deactivation, password reset and revocation.
- Mandatory staff multi-factor authentication before production launch.
- Audited individual and bulk student access grants and revocations.
- Parent-to-student linking with explicit authorization and scoped data access.
- Session expiry, recovery and disabled-account handling.

### B. Student workspace
- Personal dashboard with progress, accuracy, assignments, upcoming exams and recommended study.
- SAT Reading and Writing skill practice.
- Timed and untimed practice, review, saved questions and mistake notebook.
- Digital SAT exam simulation with two modules, timer, navigation, mark-for-review, submission and explanations.
- Vocabulary lists, flashcards, quizzes and spaced repetition.
- Personal study plans based on exam date, available study time, skill gaps and deadlines.

### C. Question bank and bulk import
- Target onboarding: approximately 2,000 existing SAT English questions.
- Manual question creation/editing, program/topic/skill/difficulty metadata, answer keys and explanations.
- CSV and structured JSON import with preview, row validation, duplicate detection and explicit confirmation.
- Downloadable import error report with original source row numbers.
- Next import stages: PDF, DOCX and XLSX extraction; embedded images/diagrams; column mapping; editable preview; safer retry and import-batch rollback.
- Preserve source attribution. OCR or extraction output must be reviewed; never silently invent missing choices or answer keys.
- Keep imports bounded and memory-safe. Do not claim a large import is accurate until sample records and full database results are checked.

### D. Practice, exams and assessment
- Reusable question bank and exam assembly.
- Draft/published/scheduled exam workflows.
- Timers, autosave, navigation, review flags and submission state.
- Hide answer keys and explanations until submission where required.
- Exam integrity events and rate-limited event capture.
- Student, class, skill and question-quality analytics.

### E. AI learning assistant and points
- Student-facing English tutor with grounded answer review.
- Explain correct/incorrect status, exact error, concept, step-by-step reasoning, better method and distractors.
- Ask for missing passage, choices or answer key; do not invent certainty.
- Gemini primary with configured OpenRouter/Groq fallback; no Claude/OpenAI.
- Initial wallet: 300 points per student; tutor/answer feedback 5 points; study plan 15 points.
- Server-side atomic point consumption, transaction ledger, insufficient-balance handling and refunds on provider failure.
- Admin point grants/deductions with reason and audit history.
- Keep provider keys server-side; never request that users paste secrets into chat.

### F. University admission calculator
- Inputs: GPA, SAT I, Egyptian admission SAT II score/category, university, faculty/program and admission year.
- Use versioned university/faculty/year rules, including score scales, conversions, weights, minimums, required subjects, rounding and eligibility.
- Display source, verification date, formula and assumptions.
- Do not present a result as official until the exact rule is verified from a current authoritative source.
- Preserve prior-year rules rather than overwriting them.

### G. Teacher, parent and administration workspaces
- Course and lesson management, assignments, homework review and exams.
- Attendance and academic history.
- Student groups, class comparisons and random picker.
- Teacher analytics and transparent student risk indicators.
- Parent reports limited to linked students.
- Notifications, announcements, internal messages and live support.
- Activity/audit history, CSV/Excel/PDF exports and data recovery workflows.

### H. Recorded Sessions Library — existing implementation
- Staff can upload lesson recordings to private storage.
- Upload uses resumable TUS chunks and a 500 MB application limit.
- Recording metadata is associated with a course.
- Staff can keep recordings as drafts or publish to students with active course access.
- Students receive authorized playback links; storage is private.
- Current work is source-controlled. Production schema/storage configuration must be separately approved before it can be used in production.
- Follow-up: test interrupted uploads, retry/idempotency, storage cleanup, signed URL expiry and role-based access in a controlled environment.

## 4. Next major milestone: Integrated Live Classroom

The live classroom is the next major implementation milestone after the Recorded Sessions Library.

### 4.1 Session lifecycle
1. Teacher creates or selects a published lesson and schedules a live session.
2. Students with active course access see the session and its start time.
3. Teacher opens the room; students enter a waiting/lobby state.
4. Teacher admits participants and starts the lesson.
5. Participants can leave/rejoin without losing the session record.
6. Teacher ends the session; attendance and recording metadata are finalized.

Session states: scheduled, lobby, live, ended, cancelled. Store timestamps and the acting staff profile for auditability.

### 4.2 Classroom experience
- Responsive classroom page with teacher and participant video tiles.
- Camera and microphone permission prompts with device status.
- Mute/unmute, camera on/off, leave room and connection status.
- Teacher screen sharing and presentation mode.
- Participant list, hand raise and teacher moderation.
- In-room text chat with clear sender/time labels.
- Lesson description, attached resources and shared question/poll area.
- Teacher controls for admitting/removing participants and muting participants.
- Accessible keyboard controls, readable status messages and mobile layout.
- No silent recording: show a persistent recording indicator and explicit browser capture permission.

### 4.3 Free-tier-compatible media architecture
- Use browser WebRTC for peer media and Supabase Realtime private channels for signaling/presence.
- Use authenticated private channel topics scoped to a specific lesson/session.
- Use a narrowly scoped `realtime.messages` RLS policy; only active staff assigned to the course and students with current active course access may join that session topic.
- Do not use public signaling channels or broad `authenticated`-user policies.
- Use free STUN discovery for the initial small-room prototype. STUN-only connectivity is not guaranteed on restrictive networks; show a clear connection error and fallback to the approved external meeting link where one exists.
- Initial peer-to-peer mesh is limited to a small group (proposed maximum: 6 concurrent participants) to avoid excessive upload bandwidth and browser load. Do not market this as a large-classroom solution.
- A scalable SFU/TURN architecture requires a separate cost/security review. Do not add a paid provider or hosted relay without explicit approval.
- Use reconnect handling, stale-peer cleanup, bounded message payloads and explicit teardown of media tracks/channels.

### 4.4 Data and security prerequisites
Design and review the following source-controlled schema/policy changes before any production application:
- Live session records linked to a lesson/course, with scheduled/start/end timestamps, state and created-by/host profile.
- Participant attendance records with join/leave times, status and reconnect-safe uniqueness.
- Realtime private-channel authorization tied to the live session's lesson/course membership.
- Staff controls restricted to authorized course staff; students restricted to their active course access.
- Parent accounts remain read-only and cannot join a live room by default.
- Rate limits and validation for chat, signaling and hand-raise events.
- Recording metadata linked to the live session while retaining the private storage access model.

No live-classroom schema or policy change is to be applied to production without explicit approval. Do not deploy an Edge Function for this milestone unless a concrete server-side requirement is established and approved.

### 4.5 Live recording and uploaded recording
Support both accepted recording methods:
- **Uploaded recording:** teacher uploads an existing MP4/MOV/WebM file through the Recorded Sessions Library's resumable upload workflow.
- **Live recording:** teacher explicitly starts browser capture/recording, grants required screen/tab and audio permissions, sees a persistent recording indicator, and explicitly stops recording. The resulting file is reviewed and uploaded to private storage as a draft recording linked to the lesson/course. The teacher can publish it later.
- Handle unsupported browsers, missing audio capture, permission denial, interrupted recording, file-size limits and upload retry.
- Never imply that the platform can record every participant's remote media unless the chosen capture implementation actually captures it. Clearly identify what is included in the recording.

### 4.6 Classroom acceptance tests
- Unauthorized users cannot discover or join a room by guessing a lesson/session ID.
- Revoked/expired course access blocks new room joins.
- Students cannot create rooms or use teacher moderation controls.
- Two or more authorized clients can join, exchange signaling and cleanly leave.
- Camera/microphone permission denial does not crash the room.
- Reconnect does not create duplicate participants or duplicate attendance.
- Chat/signaling is restricted to the authorized private topic.
- Recording starts/stops only after explicit teacher action and permission.
- A finished recording is stored privately, linked to the right lesson and remains draft until published.
- Test mobile, desktop, slow network and unsupported browser behavior.
- Verify RLS and Realtime authorization before calling the feature production-ready.

## 5. Testing, reliability and launch readiness
- TypeScript and production build checks after each source milestone.
- Unit tests for parsers, validation, point calculations and state transitions.
- Permission tests for every role and sensitive data boundary.
- Controlled integration tests for Supabase RPCs, storage and Realtime.
- Mobile/desktop usability and accessibility checks.
- AI provider failure, timeout, quota and refund tests.
- Backups, disaster recovery, monitoring and audit review.
- Production launch checklist and explicit user approval before deployment.

## 4.7 First implementation slice — secure scheduling and lobby (source only)

The first Live Classroom code slice is now committed to the working feature branch:
- `supabase/migrations/20261123100000_live_classroom_foundation.sql`: source-only schema for live sessions and reconnect-safe participant attendance.
- Session lifecycle values: scheduled, lobby, live, ended and cancelled.
- RLS limits session visibility to active course staff and students with current active course access. Session management is limited to an administrator or staff member who created the session / owns the course.
- Private Realtime topics use the exact `live-session:<UUID>` format. Receive/send policies authorize only active participants for sessions whose lobby is open or live.
- `src/LiveClassroom.tsx` and `src/live-classroom.css`: staff scheduling, optional lesson association, open-lobby/start/end/cancel controls, student join/leave, and private Realtime presence roster.
- Staff and student navigation now includes **Live classroom**.

**Not included yet:** actual WebRTC audio/video transport, TURN/SFU, screen sharing, classroom chat, moderation, and live browser recording. The UI explicitly states that the current room is a lobby/presence layer and does not transmit media. The migration has not been applied to any Supabase project; this source is not production-ready until the migration and permission tests pass.

## 6. Current implementation status

### Implemented in source on the feature branch
- Role-scoped dashboards and platform workspaces across the existing application.
- Course/lesson management, course access, attendance, gradebook/history, homework, exams and integrity events.
- Messaging, notifications, parent links/dashboard and student groups.
- Developer workspace, AI provider settings and design studio.
- Recorded Sessions Library with private-storage/resumable-upload implementation.
- AI tutor answer-review UI and server-side point-accounting source.
- Admin AI points dashboard source.
- Egyptian university admission calculator interface with versioned rule structure; it intentionally refuses to calculate until exact rules are verified/configured.
- CSV/JSON question-bank bulk import preview, validation, duplicate detection, confirmed batched saves and downloadable error report.
- Latest question-bank parser hardening rejects unterminated quoted fields, empty headings and duplicate headings; preview displays original source row numbers.

### Not yet verified or activated
- Live Classroom scheduling/lobby code and migration are committed to the feature branch but have not been built, runtime-tested or applied to Supabase. Audio/video, screen sharing, chat and live recording are still outstanding.
- The latest branch changes have not been verified by a successful build/runtime test.
- Vercel deployment attempts were blocked by the free daily deployment API limit; do not upgrade the plan to bypass it.
- AI points migration and AI learning Edge Function changes are source-only and not deployed.
- Admission rules are not yet populated with verified university/faculty/year formulas.
- Recorded Sessions Library schema/storage migration must be checked against the actual environment before production use.
- Integrated live classroom implementation is the next major milestone; its schema and private Realtime authorization need review before activation.
- PDF/DOCX/XLSX/image extraction, import batch rollback/retry, complete test coverage, final security audit and launch verification remain outstanding.

## 7. Delivery order from here

1. **Integrated Live Classroom:** scheduling, secure lobby, attendance and private Realtime presence source are in place; next implement and test WebRTC media, moderation, chat and reconnect behavior.
2. **Live Recording:** explicit browser capture, draft upload, lesson linkage and permission/size/error handling.
3. **Question Import Expansion:** XLSX, DOCX and PDF extraction, image handling, editable preview and safe batch retry/rollback.
4. **Practice and Exam Completion:** validate end-to-end student workflows, timer/autosave and score/report accuracy.
5. **AI Points Activation Readiness:** verify migration, Edge Function, refunds, admin adjustments and provider failover in a non-production environment.
6. **Admission Rule Verification:** research and populate authoritative, versioned rules for each supported university/faculty/year.
7. **Platform-wide Audit:** role permissions, mobile usability, performance, backup/recovery, accessibility and monitoring.
8. **Launch Review:** present a complete test report and wait for explicit approval before production changes.

## 8. Change log
- **2026-11-22:** Continued Question Bank CSV parser hardening on `feature/recorded-sessions-library`; no deployment, production migration or Edge Function deployment.
- **Next milestone:** Integrated Live Classroom design and implementation, followed by explicit recording workflow.

- **2026-11-23:** Added source-only live classroom scheduling, session lifecycle, attendance and private Realtime presence. Added staff/student navigation. No migration applied and no deployment.
