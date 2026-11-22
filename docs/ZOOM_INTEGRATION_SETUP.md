# Zoom integration setup — SAT English

**Status:** Source implementation only. Do not configure production secrets, apply the migration, or deploy the function without explicit approval.

## Product behavior

- A teacher selects **Open inside this website** or **Use Zoom meeting** when scheduling a teacher-led lesson.
- Website sessions use the existing private WebRTC classroom.
- Zoom sessions are created through the Zoom Meetings REST API. Students use the meeting's participant join URL, which opens the Zoom desktop client or browser.
- The teacher uses a separately stored, privileged Zoom start URL. The browser never receives that URL for a student account.
- Student-led study rooms are website-only, private to students with active access to the selected course, limited to one active room per student, and capped at six participants.

## Zoom account model

This first integration uses one administrator-configured school Zoom host user. It does not yet connect each teacher's personal Zoom account. The configured host user must have permission and an appropriate Zoom license to schedule and host the meetings. Multiple simultaneous classes depend on the account's Zoom plan and host concurrency limits.

## Create the Zoom app

1. Sign in to the Zoom App Marketplace with the school Zoom account administrator.
2. Create a **Server-to-Server OAuth** app for backend-only access.
3. Grant the minimum granular meeting scopes required by the implementation:
   - `meeting:write:meeting:admin` — create scheduled meetings.
   - `meeting:read:meeting:admin` — retrieve the meeting and refresh the expiring host start URL.
   - `meeting:update:status:admin` — end a meeting when the teacher ends the lesson from the platform.
   - `meeting:delete:meeting:admin` — delete a scheduled Zoom meeting when the teacher cancels it.
   - `meeting:read:participant:admin` — receive participant identity fields for attendance events, subject to Zoom's account and participant privacy rules.
4. Copy the account ID, client ID and client secret.
5. Identify the Zoom user ID or email address that will host these lessons.

Zoom may require additional account permissions, licensing, or app approval. Verify those in the Zoom account before activation.

## Configure Edge Function secrets

Set these in the SAT English Supabase project's **Edge Function Secrets** settings, not in Git or browser environment variables:

- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_HOST_USER_ID`
- `ZOOM_WEBHOOK_SECRET_TOKEN` — the webhook secret token shown in the Zoom Marketplace app's Feature > Event Subscriptions settings.

The function also uses Supabase's built-in `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables and the caller's Supabase Auth JWT. It does not need the service-role key.

## Configure Zoom attendance webhooks

The source includes a separate `zoom-webhook` Edge Function. Configure an Event Subscription in the Zoom Marketplace app and set its Event Notification Endpoint URL to:

```
https://lewxfskcxceuifrtczqz.supabase.co/functions/v1/zoom-webhook
```

Subscribe to these meeting events:

- `meeting.started`
- `meeting.ended`
- `meeting.participant_joined`
- `meeting.participant_left`

Copy the Zoom app's webhook secret token into the Supabase Edge Function secret `ZOOM_WEBHOOK_SECRET_TOKEN`. The webhook function does not use Supabase JWT authentication because Zoom cannot provide a user JWT; it verifies Zoom's HMAC-SHA256 signature over the original request body, checks the request timestamp and expected Zoom account ID, and supports Zoom's endpoint URL validation challenge. It uses the Supabase service-role key only inside the server-side function after signature verification. Never expose that key to browser code.

Verified webhook events are deduplicated and stored with limited participant fields. When Zoom supplies an email address matching an active student account with current access to the session's course, the database updates that student's live-session attendance record. Zoom may omit email addresses for external or unauthenticated participants; those events are retained, but cannot be safely matched to a platform student automatically. The current code does not infer student identity from a display name.

This endpoint is source-only. Do not add the Zoom event subscription, configure the secret, apply the migration or deploy the function until the activation step is approved.

## Security design

- The `zoom-meeting` Edge Function requires a valid Supabase user JWT and verifies an active staff profile.
- It only manages a Zoom lesson created by the calling staff profile and marked with provider `zoom`.
- Zoom access tokens are obtained server-side and are never returned to the browser.
- The teacher's `start_url` is stored in a separate RLS-enabled table with all direct table grants revoked. An authenticated, owner-checked RPC stores meeting metadata and the host URL.
- Student-visible session data contains only the participant `join_url` and meeting passcode.
- The Zoom host URL is refreshed from Zoom before the teacher opens the meeting because Zoom host start URLs expire.
- Teacher end/cancel actions call Zoom's meeting status/delete API before the platform session status changes.
- Student study rooms cannot select the Zoom provider.

## Not included yet

- Per-teacher Zoom OAuth account connections.
- Runtime verification of Zoom webhook signature handling, duplicate delivery, participant matching and event ordering.
- Embedded Zoom Meeting SDK UI. The current implementation launches the Zoom desktop app or browser.
- Zoom cloud recording synchronization into the Recorded Sessions Library.
- Runtime tests against a real Zoom developer account.
- Zoom cloud recording synchronization into the Recorded Sessions Library.

Do not describe Zoom attendance as active in production until the webhook is deployed, configured and runtime-tested.
