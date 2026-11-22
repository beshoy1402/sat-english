import { withSupabase } from 'npm:@supabase/server@1';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');

const hmacSha256 = async (secret: string, message: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
};

const sha256 = async (message: string) =>
  hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message)));

const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const asIso = (value: unknown, fallbackMs: unknown) => {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  const milliseconds = typeof fallbackMs === 'number' ? fallbackMs : Number(fallbackMs);
  return Number.isFinite(milliseconds) && milliseconds > 0
    ? new Date(milliseconds).toISOString()
    : new Date().toISOString();
};

export default {
  fetch: withSupabase({ auth: 'none' }, async (req: Request, ctx) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('ZOOM_WEBHOOK_SECRET_TOKEN');
  if (!secret) return json({ error: 'Zoom webhook is not configured' }, 503);

  const rawBody = await req.text();
  if (rawBody.length > 256_000) return json({ error: 'Webhook payload is too large' }, 413);
  let event: Record<string, any>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // Zoom sends this challenge when validating the Event Notification Endpoint URL.
  if (event.event === 'endpoint.url_validation') {
    const plainToken = event.payload?.plainToken;
    if (typeof plainToken !== 'string' || !plainToken) return json({ error: 'Missing validation token' }, 400);
    const encryptedToken = await hmacSha256(secret, plainToken);
    return json({ plainToken, encryptedToken });
  }

  const requestTimestamp = req.headers.get('x-zm-request-timestamp') || '';
  const suppliedSignature = req.headers.get('x-zm-signature') || '';
  const timestampSeconds = Number(requestTimestamp);
  if (!Number.isFinite(timestampSeconds) || !suppliedSignature.startsWith('v0=')) {
    return json({ error: 'Missing Zoom webhook signature headers' }, 401);
  }

  // Reject stale signed requests while allowing normal Zoom delivery retries.
  if (Math.abs(Date.now() - timestampSeconds * 1000) > 5 * 60 * 1000) {
    return json({ error: 'Zoom webhook timestamp is outside the accepted window' }, 401);
  }

  const signedMessage = 'v0:' + requestTimestamp + ':' + rawBody;
  const expectedSignature = 'v0=' + await hmacSha256(secret, signedMessage);
  if (!constantTimeEqual(expectedSignature, suppliedSignature)) {
    return json({ error: 'Zoom webhook signature verification failed' }, 401);
  }

  const expectedAccountId = Deno.env.get('ZOOM_ACCOUNT_ID');
  if (!expectedAccountId) return json({ error: 'Zoom account validation is not configured' }, 503);

  const payload = event.payload;
  const meeting = payload?.object;
  const meetingId = meeting?.id == null ? '' : String(meeting.id);
  if (!meetingId || payload?.account_id !== expectedAccountId) {
    return json({ error: 'Zoom account or meeting could not be verified' }, 403);
  }

  const supportedEvents = new Set([
    'meeting.started',
    'meeting.ended',
    'meeting.participant_joined',
    'meeting.participant_left'
  ]);
  if (!supportedEvents.has(event.event)) return json({ received: true, ignored: true });

  const supabase = ctx.supabaseAdmin;

  const { data: session, error: sessionError } = await supabase
    .from('live_sessions')
    .select('id,status,started_at,room_type,provider')
    .eq('zoom_meeting_id', meetingId)
    .eq('room_type', 'lesson')
    .eq('provider', 'zoom')
    .maybeSingle();

  if (sessionError) return json({ error: 'Could not resolve the Zoom lesson' }, 500);
  if (!session) return json({ received: true, ignored: true });

  const participant = meeting?.participant ?? {};
  const occurredAt = asIso(
    event.event === 'meeting.participant_joined'
      ? participant.join_time || participant.date_time
      : event.event === 'meeting.participant_left'
        ? participant.leave_time || participant.date_time
        : event.event === 'meeting.started'
          ? meeting.start_time
          : meeting.end_time,
    event.event_ts
  );
  const eventId = await sha256(rawBody);

  const { error: insertError } = await supabase.from('live_session_zoom_events').insert({
    session_id: session.id,
    event_id: eventId,
    event_type: event.event,
    meeting_id: meetingId,
    meeting_uuid: typeof meeting.uuid === 'string' ? meeting.uuid : null,
    participant_user_id: participant.user_id == null ? null : String(participant.user_id),
    participant_uuid: (participant.participant_uuid ?? participant.participant_user_id ?? participant.id) == null
      ? null
      : String(participant.participant_uuid ?? participant.participant_user_id ?? participant.id),
    participant_name: typeof (participant.user_name || participant.name) === 'string'
      ? (participant.user_name || participant.name)
      : null,
    participant_email: typeof participant.email === 'string' && participant.email.trim()
      ? participant.email.trim().toLowerCase()
      : null,
    occurred_at: occurredAt
  });

  const duplicate = insertError?.code === '23505';
  if (insertError && !duplicate) return json({ error: 'Could not store the verified Zoom event' }, 500);

  if (event.event === 'meeting.started' && ['scheduled', 'lobby'].includes(session.status)) {
    const { error } = await supabase.from('live_sessions')
      .update({ status: 'live', started_at: occurredAt, updated_at: new Date().toISOString() })
      .eq('id', session.id)
      .in('status', ['scheduled', 'lobby']);
    if (error) return json({ error: 'Zoom event stored, but lesson status could not be updated' }, 500);
  }

  if (event.event === 'meeting.ended' && ['scheduled', 'lobby', 'live'].includes(session.status)) {
    const { error } = await supabase.from('live_sessions')
      .update({
        status: 'ended',
        started_at: session.started_at || occurredAt,
        ended_at: occurredAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id)
      .in('status', ['scheduled', 'lobby', 'live']);
    if (error) return json({ error: 'Zoom event stored, but lesson status could not be updated' }, 500);
  }

  return json({ received: true, duplicate });
  })
};
