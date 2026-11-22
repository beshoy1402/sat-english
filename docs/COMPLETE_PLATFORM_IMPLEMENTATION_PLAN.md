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
- Do not use Claude or ChatGPT/OpenAI API. The user-confirmed AI provider order is NVIDIA NIM primary, Gemini secondary, and OpenRouter third fallback. Groq and Qwen are excluded.

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
- Source now supports XLSX first-sheet extraction, DOCX text extraction and text-based PDF extraction using numbered question blocks. Document imports are previewed and validated before confirmed saves. Remaining stages: OCR for scanned PDFs; embedded images/diagrams; multi-sheet/column mapping; editable preview; import-batch rollback and retry.
- Preserve source attribution. OCR or extraction output must be reviewed; never silently invent missing choices or answer keys.
- Keep imports bounded and memory-safe. Do not claim a large import is accurate until sample records and full database results are checked.
- Question-bank table access is RPC-only (no direct anon/authenticated table grants). Non-admin staff may update/delete only items they created; adding items to an exam is limited to its creator or an administrator and draft exams only.

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
- NVIDIA NIM primary, Gemini secondary and OpenRouter third fallback; no Claude or ChatGPT/OpenAI API. Groq and Qwen are excluded.
- Initial wallet: 300 points per student; tutor/answer feedback 5 points; study plan 15 points.
- Server-side atomic point consumption, transaction ledger, insufficient-balance handling and refunds on provider failure.
- Admin point grants/deductions with reason and audit history.
- Keep provider keys server-side; never request that users paste secrets into chat.

### F. University admission calculator
- Inputs: GPA, SAT I, Egyptian admission SAT II score/category, university, faculty/program and admission year.
- Source implementation now includes an administrator-managed, versioned rule registry. Only active administrators can create drafts, verify/publish rules or supersede old versions; students can read verified versions only.
- A published weighted-sum rule must include an HTTPS source, source title, verification timestamp, three explicit score scales and weights totaling 100. The calculator shows the source, date, component breakdown and configured minimum score.
- No Egyptian university/faculty formulas have been preloaded. Administrators must verify each exact year/program against official published material before publishing. The source migration remains unapplied.
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
- Participant list, hand raise and teacher moderation, including server-enforced temporary chat mute.
- In-room text chat with clear sender/time labels, persisted session history and server-side send limits.
- Lesson description, attached resources and shared question/poll area.
- Teacher controls for admitting/removing participants and muting participants.
- Student-created private study rooms: a student selects an enrolled course, opens a room for classmates, and hosts/moderates that room; room creation is limited to one active study room per student and six total participants.
- Teacher selects the delivery provider when scheduling each lesson: native website classroom or Zoom.
- Zoom sessions are created through a server-side Zoom API integration; students receive only the join URL, while the teacher's privileged start URL is stored separately and refreshed server-side before opening.
- Accessible keyboard controls, readable status messages and mobile layout.
- No silent recording: show a persistent recording indicator and explicit browser capture permission.

### 4.3 Free-tier-compatible media architecture
- Use browser WebRTC for peer media and Supabase Realtime private channels for signaling/presence.
- Use authenticated private channel topics scoped to a specific lesson/session. Before activation, verify Supabase Realtime's project-level **Allow public access** setting is disabled; this setting has not been changed or verified.
- Use a narrowly scoped `realtime.messages` RLS policy; only active staff assigned to the course and students with current active course access may join that session topic.
- Do not use public signaling channels or broad `authenticated`-user policies.
- Use free STUN discovery for the initial small-room prototype. STUN-only connectivity is not guaranteed on restrictive networks; show a clear connection error and fallback to the approved external meeting link where one exists.
- Initial peer-to-peer mesh is limited to a small group (proposed maximum: 6 concurrent participants) to avoid excessive upload bandwidth and browser load. Do not market this as a large-classroom solution.
- A scalable SFU/TURN architecture requires a separate cost/security review. Do not add a paid provider or hosted relay without explicit approval.
- Student-created study rooms use the website WebRTC provider only; students cannot create Zoom meetings or access Zoom host controls.
- Teacher Zoom delivery uses an administrator-configured Zoom Server-to-Server OAuth app and the Zoom Meetings API. Store `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` and `ZOOM_HOST_USER_ID` only as Supabase Edge Function secrets. Never put Zoom credentials in browser code, database rows or Git.
- The Zoom function validates the caller's Supabase user JWT, active staff profile, session ownership and selected provider before creating or refreshing a Zoom meeting. The function returns the host start URL only to the authorized teacher. Student clients receive the participant join URL only.
- Required Zoom app permissions must include the granular meeting create/read/end/delete scopes (`meeting:write:meeting:admin`, `meeting:read:meeting:admin`, `meeting:update:status:admin` and `meeting:delete:meeting:admin`). Zoom account licensing, host scheduling permissions and account-level policies may limit availability; verify these on the connected Zoom account before launch.
- Current Zoom integration opens the official Zoom meeting in the Zoom desktop client or browser; it does not embed the Zoom Meeting SDK inside the website. A source-only Zoom webhook handler now processes meeting start/end and participant join/leave events. It verifies Zoom's HMAC signature and account ID, deduplicates events, and maps participant emails to active enrolled student attendance when Zoom supplies a matching email; external participants with no email remain unmatched.
- Use reconnect handling, stale-peer cleanup, bounded message payloads and explicit teardown of media tracks/channels. Attendance rows are refreshed by a 30-second authenticated heartbeat; a join attempt expires stale website/WebRTC participants whose heartbeat is older than two minutes before enforcing the six-person capacity limit; Zoom attendance instead relies on verified participant-left webhooks.

### 4.4 Data and security prerequisites
Design and review the following source-controlled schema/policy changes before any production application:
- Live session records linked to a lesson/course, with scheduled/start/end timestamps, state and created-by/host profile.
- Participant attendance records with join/leave times, status and reconnect-safe uniqueness.
- Realtime private-channel authorization tied to the live session's lesson/course membership.
- Staff controls restricted to authorized course staff; students restricted to their active course access.
- Student study-room creation is limited to active students with current access to the selected published course; only the room creator can start/end and moderate their study room. Other enrolled students can join. One active study room per student; hard six-participant cap enforced by the join RPC.
- Delivery provider is immutable from student clients. Only staff-created lesson sessions can select Zoom; study rooms must use website media.
- Zoom host start URLs are stored in a separate RLS-protected table visible only to the meeting's host/authorized manager; student-facing session rows contain only the join URL and passcode.
- Verified Zoom webhook events are stored in a private, RLS-enabled table with direct client grants revoked. Participant join/leave events map to student attendance only through a matching auth email and current active course access.
- Parent accounts remain read-only and cannot join a live room by default.
- Server-validated chat sends with per-user rate limits, 1,000-character message limit, and a 10-minute teacher chat-mute control with moderation audit events.
- Hand raises now use a private, server-authorized database state plus an immutable event trail. Students can raise/lower their own hands; the classroom host/assigned staff can lower an active student's hand. Staff can review recent history. Leaving or being removed automatically lowers an active hand.
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
- Students can create one active website-only study room in a course they currently have access to; unrelated students and public users cannot discover it. A second active room by the same student is rejected, and the six-person limit is enforced server-side.
- A student cannot create a Zoom session, schedule a teacher lesson, or retrieve a Zoom host start URL.
- A teacher can select website or Zoom delivery when scheduling a lesson. Zoom join links are available only to enrolled course members; host start URLs are never returned to student clients.
- Zoom API secrets remain server-side; Zoom API failures do not expose credentials or host URLs.
- A removed student cannot rejoin the same session and their client closes the media/Realtime channels after verifying the server-side removal record.
- Revoked/expired course access blocks new room joins.
- Students cannot create rooms or use teacher moderation controls.
- Two or more authorized clients can join, exchange signaling and cleanly leave.
- Camera/microphone permission denial does not crash the room.
- Reconnect does not create duplicate participants or duplicate attendance.
- Chat/signaling is restricted to the authorized private topic; chat rows are readable only by active room participants and authorized session managers. Verify Realtime's project-level public-channel setting is disabled before enabling the feature.
- Muted users cannot send chat through the server RPC; chat sends are limited to one message per two seconds and 30 per minute per participant. Direct table writes are revoked; clients send through the authenticated RPC.
- Teachers can remove active student participants through a server RPC; removal is audited, marks attendance as left, blocks rejoining, and triggers the removed student's client to close the room and media.
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
- Server-side RPCs own session state transitions and attendance timestamps; authenticated clients cannot directly rewrite session status or participant join/leave timestamps.
- Attendance rows are readable only by the participant and authorized session managers; other enrolled students see presence only within the private room.
- The scheduling UI lists only courses the current staff member can manage under the present course-ownership model.
- The database validates that an optional linked lesson belongs to the selected course and is published.
- Session lifecycle values: scheduled, lobby, live, ended and cancelled.
- RLS limits session visibility to active course staff and students with current active course access. Session management is limited to an administrator or staff member who created the session / owns the course.
- Private Realtime topics use `live-session:<UUID>` for presence and `live-session-media:<UUID>` for media signaling. Receive/send policies authorize active course members only while the lobby is open or the session is live.
- `src/LiveClassroom.tsx` and `src/live-classroom.css`: staff scheduling, optional published-lesson association, open-lobby/start/end/cancel controls, teacher/student room entry, attendance, private Realtime presence, classroom chat, hand raise and teacher chat-mute controls.
- Session lifecycle audit columns record the staff profiles that started, ended or cancelled a session.
- `live_session_messages` stores plain-text chat with a 1,000-character bound; the `live_session_send_message` RPC verifies room membership, active attendance and mute state, and enforces per-user rate limits.
- `live_session_moderation_events` records teacher chat-mute/unmute actions. `live_session_set_chat_mute` limits this action to active student participants and applies a 10-minute mute.
- Hand raise state and history are persisted in RLS-protected tables and changed only through an authorization-checked RPC. Private Realtime broadcasts carry only the affected profile ID; each receiver reloads the state through RLS. Chat notification broadcasts contain only a message ID; each receiver fetches the persisted message through RLS before rendering it.
- Staff and student navigation now includes **Live classroom**.

**Current media prototype:** `src/LiveMedia.tsx` adds browser camera/microphone capture, peer-to-peer WebRTC audio/video, participant video tiles, mute/camera controls and screen sharing. It uses a separate private `live-session-media:<UUID>` signaling topic, STUN discovery only, and a six-participant cap. Media transceivers are prepared before device permission is granted so later track attachment can use the negotiated audio/video sections.

**Still not included:** TURN relay, SFU/scalable classrooms, Zoom webhook runtime verification and activation, per-teacher Zoom account OAuth connections, embedded Zoom Meeting SDK, automated browser/network acceptance tests and verified multi-device connectivity. Live recording is now source-implemented but still needs runtime verification. Hand raise now uses persisted state and an event history, with server-side student self-service and staff lowering; classroom chat is persisted in the source schema with server-side rate limits and teacher chat-mute RPCs. STUN-only connectivity is not guaranteed on restrictive networks. This is an unverified prototype, not a production-ready video classroom. The migration has not been applied to any Supabase project.

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
- Live Classroom scheduling/lobby, WebRTC audio/video, screen sharing, persisted chat, persistent hand-raise state/history, teacher hand lowering, chat-mute, audited participant removal, student study-room source and Zoom delivery integration source are committed to the feature branch but have not been browser/network runtime-tested or applied to Supabase. TURN/SFU and end-to-end tests remain outstanding; live recording is now implemented in source but still requires browser/runtime verification. The Vercel check still reports the previously encountered free deployment-rate limit; it is not a successful build result.
- GitHub Actions verification for commit `1cd88c054d334f2594b419d2fd51da91900a67f9` completed successfully: dependency installation, project safety policy checks, TypeScript type-check and Vite production build. This is a source/build verification only, not a browser, database-migration, media, AI-provider or end-to-end runtime test.
- Vercel deployment attempts were blocked by the free daily deployment API limit; do not upgrade the plan to bypass it.
- AI points migration and AI learning Edge Function changes are source-only and not deployed.
- Admission rules are not yet populated with verified university/faculty/year formulas.
- Recorded Sessions Library schema/storage migration must be checked against the actual environment before production use.
- Integrated live classroom, student study-room and Zoom delivery implementation are source-only; schema and private Realtime authorization need review before activation. Zoom secrets and the Edge Function are not configured/deployed.
- XLSX, DOCX and text-based PDF extraction are now implemented in source. Scanned-PDF OCR, embedded-image extraction, editable preview, multi-sheet mapping, import-batch rollback/retry, document-format fixture tests, full E2E coverage, final security audit and launch verification remain outstanding.

## 7. Delivery order from here

1. **Integrated Live Classroom:** scheduling, secure lobby, attendance, private Realtime presence, six-person WebRTC audio/video + screen-share prototype, persisted chat, hand raise, teacher chat mute, audited student removal, student-created study rooms and teacher-selected Zoom/website delivery are in source; next verify the database and media flows, configure the school Zoom account and webhook subscription, and runtime-test attendance synchronization.
2. **Live Recording:** explicit browser capture, draft upload, lesson linkage and permission/size/error handling.
3. **Question Import Expansion:** XLSX, DOCX and PDF extraction, image handling, editable preview and safe batch retry/rollback.
4. **Practice and Exam Completion:** validate end-to-end student workflows, timer/autosave and score/report accuracy.
5. **AI Points Activation Readiness:** verify migration, Edge Function, refunds, admin adjustments and provider failover in a non-production environment.
6. **Admission Rule Verification:** research and populate authoritative, versioned rules for each supported university/faculty/year.
7. **Platform-wide Audit:** role permissions, mobile usability, performance, backup/recovery, accessibility and monitoring.
8. **Launch Review:** present a complete test report and wait for explicit approval before production changes.

## 8. Change log
- **2026-11-22:** Continued Question Bank CSV parser hardening on `feature/recorded-sessions-library`; no deployment, production migration or Edge Function deployment.
- **Next milestone:** Complete Live Classroom verification, configure and test the school Zoom host account, activate and runtime-test Zoom webhook attendance synchronization, and continue the explicit recording workflow.

- **2026-11-23:** Added source-only live classroom scheduling, session lifecycle, attendance and private Realtime presence. Added staff/student navigation. Hardened state changes and attendance timestamps behind server-side RPCs, restricted attendance visibility to self/managers, filtered staff course choices to manageable courses, and validated lesson/course linkage. No migration applied and no deployment.

- **2026-11-23 (continued):** Added a six-person WebRTC audio/video and screen-sharing prototype using private Realtime signaling and STUN-only ICE discovery. No deployment or database application.

- **Security follow-up:** the media signaling topic uses the same open-session authorization check for both sending and receiving; ended/cancelled/scheduled sessions cannot use the signaling topic.

- **2026-11-23 (continued):** Added persisted live-session chat with server-side membership/mute checks, per-user rate limits, private-channel ID notifications, persistent hand-raise state/history, student self-service, teacher/staff hand lowering, and audited teacher chat mute/unmute controls. Extended the existing un-applied classroom migration source; no production database changes.

- **Activation prerequisite:** the current Supabase Realtime project setting `Allow public access` has not been verified or changed. Confirm it is disabled before activating private classroom topics; do not infer this from the SQL policies alone.

- **2026-11-23 (continued):** Added teacher participant removal with an audited server-side action, attendance closure, reconnect blocking and client-side room/media teardown after the removed participant verifies the database state. No migration applied.

- **2026-11-23 (continued):** Added student-created website study rooms scoped to active course access, one active room per student and a six-participant database-enforced cap. Student room owners can start/end and moderate their own rooms. Teachers can select website or Zoom delivery when scheduling. Added source-only Zoom Server-to-Server OAuth meeting creation/host-link Edge Function and a separate RLS-protected host URL table. No Zoom secrets configured, no migration applied, and no Edge Function deployed.

- **2026-11-23 (continued):** Added Zoom meeting end/cancel API calls and updated platform session status. Added a dedicated Zoom setup guide documenting the central school Zoom host account, required scopes, secret configuration and known integration limits. No Zoom secrets configured and no Edge Function deployed.


## Live recording implementation — source only (2026-11-22)

- Added teacher-initiated browser recording inside an active website-delivered teacher lesson. Only the lesson creator or an administrator can access the recording controls; student study rooms and Zoom-delivered lessons are excluded.
- The browser asks for display/tab capture permission and microphone permission only after the teacher presses **Start recording**. The capture picker can supply tab/system audio; microphone audio is mixed into the recording when granted.
- A persistent red REC indicator and elapsed timer remain visible while recording. The teacher can stop, preview, rename, describe, save, or discard the result.
- The result uploads through the existing authenticated resumable TUS workflow to the private `sat-session-recordings` bucket, with a 500 MB limit, then creates an unpublished `session_recordings` row linked to the course and source live session.
- The recording is never auto-published. The teacher must explicitly publish it from Recorded Sessions Library.
- Browser capture records only the selected screen/tab and audio tracks supplied by the browser capture picker, plus the teacher microphone. It does not guarantee a separate clean recording of each remote participant. Teachers should choose the classroom tab and enable tab audio in the browser picker where supported.
- Zoom cloud recording import, embedded Zoom recording and server-side recording are not part of this implementation.
- New source migration: `supabase/migrations/20261123120000_link_live_recordings.sql`. It adds the nullable live-session foreign key and index only; it does not create or alter the existing private bucket or recording policies.
- No migration applied, no storage configuration changed and no deployment performed. Browser compatibility, recording interruption behavior, file-size handling, upload recovery and private-storage authorization still require runtime tests.


## 9. Read-only environment audit and current work checkpoint

### Branch source correction
- **2026-11-22:** Corrected `src/LiveRecording.tsx` so its session type includes the `provider` field used to exclude Zoom sessions. Removed unused icon imports under the repository's strict `noUnusedLocals` TypeScript setting.
- Replaced repeated summation of every recorded media chunk with an incremental byte counter, avoiding quadratic work as a recording grows.
- This is a source-only correction on `feature/recorded-sessions-library`. It has not yet been validated by a local TypeScript build or browser recording test.

### Connected Supabase environment — read only
- The connected SAT English project reports `ACTIVE_HEALTHY`; the read-only inventory returned 41 public tables and all 41 had RLS enabled.
- The hosted database reports 47 applied migrations, latest `20261121222000 add_nvidia_nim_provider`. The current feature branch contains 51 migration files, but none of the 47 applied migration version IDs have matching files in the branch. The histories are not reproducible from this branch as checked out.
- The feature branch has 51 source migration files that are not applied to the hosted database. This includes feature work for role hardening, recording policies, homework attachments, assistant scope/live support, AI points, provider restrictions, Live Classroom, live-recording linkage and admission rules.
- **Blocking prerequisite:** recover the exact source for the 47 already-applied migrations (or create and review a schema baseline/squash strategy from an authoritative schema snapshot), reconcile the migration history, and only then run a clean local Supabase reset plus pgTAP/RLS tests. Do not use `migration repair`, `db push`, or apply anything to production to paper over the mismatch.
- Security Advisor currently reports: one RLS-enabled table without a direct policy (`question_bank_items`, which is currently accessed through staff RPCs); 16 authenticated-callable `SECURITY DEFINER` functions; and leaked-password protection disabled. These are audit findings, not proof that every flagged RPC is exploitable. Review each function's authorization checks and the Auth setting before any activation decision.
- Performance Advisor reports repeated per-row auth-function evaluation in several policies, multiple permissive policies on three tables, and unused-index notices. Do not drop indexes based only on an unused-index notice from a low-traffic project.
- No production database changes, migrations, Edge Function deployments, secrets, storage settings, Auth settings or Vercel deployments were changed during this audit.

### Verification state
- Source inspection and read-only environment inventory are complete for this checkpoint.
- A successful TypeScript build, browser/device tests, RLS adversarial tests, Realtime tests, storage upload/recovery tests and AI provider/refund tests have **not** been demonstrated.
- The platform must not be called launch-ready until those tests pass and the production activation prerequisites are explicitly approved.


## Provider-order correction — user-confirmed configuration (2026-11-22)

**This section supersedes the earlier Gemini-primary provider notes in this document. The user's confirmed order is:**

1. NVIDIA NIM — primary (priority 1), model `nvidia/nemotron-3.5-super-vl-120b-a12b`.
2. Google Gemini — secondary (priority 2), model `gemini-3.8-flash`.
3. OpenRouter — third fallback (priority 3), model `openrouter/free`.

- Removed Groq from the application provider catalog and execution allowlist. Claude/Anthropic and ChatGPT/OpenAI API remain unsupported.
- Restored NVIDIA NIM to the provider settings UI and server-side provider management allowlist; provider execution uses NVIDIA's OpenAI-compatible chat-completions endpoint.
- Corrected source migration `20261122210000_restrict_ai_provider_catalog.sql` to disable providers outside NVIDIA/Gemini/OpenRouter and set the requested 1/2/3 priorities. It does not enable providers or replace keys.
- Updated source safety checks to enforce the requested provider set and order.
- All changes remain source-only on `feature/recorded-sessions-library`. The migration is not applied, Edge Functions are not deployed, and no production database or secrets were changed. Provider billing/quotas depend on the actual provider account and must be confirmed before treating any endpoint as free.


## Admission rule registry implementation — source only (2026-11-22)

- Added `admission_rule_versions` migration with versioned university/faculty/year records, source attribution, verification metadata, score scales, explicit weighted-sum configuration, minimum score and rounding rule.
- RLS restricts rule management to active administrators; students can select only records with `status='verified'`. Insert/update policies require the publishing administrator to be the recorded verifier.
- The Admission Calculator now loads the exact matching verified version, validates input scales, shows component contributions and source information, and refuses to calculate when no matching verified rule exists.
- Added an administrator-only Admission Rules area to create draft rules, verify/publish after checking the official source, and supersede old versions.
- No university formulas were invented or preloaded. The supported formula type is a configurable weighted sum; more complex official rule structures must be implemented explicitly rather than approximated.
- New migration: `supabase/migrations/20261123130000_admission_rule_registry.sql`. It is source-only and has not been applied to any hosted database. The registry now assigns monotonic versions per university/faculty/year, allows only one current verified version, automatically supersedes the previous verified version when a new draft is published, and prevents edits/deletion of published history. CI passed for the source/UI changes; SQL execution remains unverified.


## Verification update — admission registry and branch build (2026-11-22)

- GitHub Actions run `44995760523` passed on `1cd88c054d334f2594b419d2fd51da91900a67f9`.
- Confirmed steps: dependency installation, `npm run test:policy`, `npm run typecheck` and `npm run build`.
- Added static safety assertions for admission registry RLS, admin-only publishing, verified-only student reads, source attribution and UI routing.
- This does not verify SQL execution, hosted Supabase migration compatibility, browser rendering, storage, WebRTC, Zoom, provider API calls or end-to-end workflows.
- The branch remains unpublished. No migration applied, Edge Function deployed, secrets changed or production deployment performed.


## Question-bank document import expansion — source only (2026-11-22)

- Added browser-side XLSX parsing (first worksheet, header-based rows), DOCX raw-text extraction and PDF.js text extraction.
- DOCX/PDF extraction expects numbered question blocks and labelled A)–D) options, Answer: and optional Explanation: lines. Extracted rows enter the same existing preview, validation, duplicate detection and confirmed batch-save workflow as CSV/JSON.
- Added 25 MB file limit, 2,500-question cap and 80-page PDF cap. Scanned/image-only PDFs return a clear unsupported-OCR message rather than being treated as imported questions.
- Added PDF text line reconstruction so question numbering and option labels are more likely to survive extraction.
- This is not image/diagram OCR, does not support multi-sheet XLSX mapping, and does not make the preview editable. Complex documents must be reviewed carefully; use CSV/JSON for precise control.
- Added dependencies: `read-excel-file`, `mammoth`, and `pdfjs-dist`. Build/policy verification for the import parser passed on commit `602f83235ff19e0f0f6f4c9fdcaa9422a0f4b1db`; additional static import assertions have been added in the next CI run.
- No database migration, deployment or production change was made.


## Persistent hand raise implementation — source only (2026-11-22)

- Added `live_session_hand_raises` for current state and `live_session_hand_raise_events` for an immutable audit trail.
- Added `live_session_set_hand_raise` RPC. Active students may raise/lower their own hand; the authorized classroom host/assigned staff may lower a student's hand. Direct table writes are revoked and reads are scoped to users authorized for the session.
- Classroom UI loads persisted state, refreshes it on private Realtime notifications, shows a staff history panel, and exposes a Lower hand control to moderators.
- Leaving or being removed from the room automatically lowers the participant's hand and records the action.
- Migration remains source-only. It has not been executed against a local database or applied to the hosted project; browser, multi-user and role-boundary tests remain required.

## Migration-history reconciliation blocker — read-only audit (2026-11-22)

- The connected Supabase project reports 47 applied migrations, latest `20261121222000`.
- The checked-out feature branch contains 51 migration files, and none of the applied remote version IDs have corresponding source files in this branch.
- This prevents a trustworthy clean local database reset from the current repository state and means database migration/E2E testing cannot be claimed.
- Recover the original applied migration source or generate a reviewed, authoritative baseline/squash from a schema snapshot before attempting local migration tests. Do not repair migration history or apply migrations to production as a shortcut.


## Question bank permission hardening — source only (2026-11-22)

- Kept `question_bank_items` inaccessible through direct anon/authenticated table grants; staff use the server-side RPCs.
- Non-admin staff can edit or delete only question-bank items they created. Administrators retain platform-wide management.
- Question-bank assembly locks the target exam row, requires the caller to be its creator unless administrator, and refuses changes unless the exam is still a draft.
- The migration is source-only and not applied to the hosted database. SQL permission tests remain blocked by the migration-history mismatch documented above.


## Frontend and import follow-up (2026-11-22)

- Refined authenticated workspace styling across navigation, dashboard hero, quick-access controls, cards, panels, forms and responsive mobile layouts.
- Added regression checks for the responsive navigation and dashboard style hooks.
- Corrected PDF extracted-line joining and added early XLSX header validation for a recognized question prompt column.
- Verified with GitHub Actions run [45001655711](https://github.com/beshoy1402/sat-english/actions/runs/45001655711): install, policy checks, TypeScript and Vite build all passed.
- Remaining verification: browser/device visual QA, interactive end-to-end tests, real PDF/XLSX import fixtures, SQL execution, Supabase authorization tests, WebRTC/Zoom activation and launch readiness. No deployment or production changes.
