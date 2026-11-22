import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://sat-english-one.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin'
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign in is required' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const accountId = Deno.env.get('ZOOM_ACCOUNT_ID');
    const clientId = Deno.env.get('ZOOM_CLIENT_ID');
    const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET');
    const hostUserId = Deno.env.get('ZOOM_HOST_USER_ID');
    if (!supabaseUrl || !anonKey || !accountId || !clientId || !clientSecret || !hostUserId) {
      return json({ error: 'Zoom integration is not configured. Ask the platform administrator.' }, 503);
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const token = authorization.slice('Bearer '.length);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData.user;
    if (authError || !user) return json({ error: 'Your sign-in session is invalid or expired' }, 401);

    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const action = body.action === 'host' ? 'host' : 'create';
    if (!sessionId) return json({ error: 'A live session ID is required' }, 400);

    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('id,role,is_active').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.is_active || !['admin', 'teacher', 'assistant'].includes(profile.role)) {
      return json({ error: 'Only authorized staff can manage Zoom lesson meetings' }, 403);
    }

    const { data: session, error: sessionError } = await supabase
      .from('live_sessions')
      .select('id,title,description,scheduled_at,created_by,course_id,room_type,provider,zoom_meeting_id')
      .eq('id', sessionId).maybeSingle();
    if (sessionError || !session) return json({ error: 'Live lesson not found or access denied' }, 404);
    if (session.room_type !== 'lesson' || session.provider !== 'zoom' || session.created_by !== user.id) {
      return json({ error: 'Only the staff member who scheduled this Zoom lesson can manage its host link' }, 403);
    }

    if (action === 'host' && !session.zoom_meeting_id) return json({ error: 'Create the Zoom meeting before starting it.' }, 409);

    const basic = btoa(clientId + ':' + clientSecret);
    const tokenResponse = await fetch('https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + encodeURIComponent(accountId), {
      method: 'POST',
      headers: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    if (!tokenResponse.ok) return json({ error: 'Zoom authentication failed. Check the administrator Zoom credentials and app scopes.' }, 502);
    const tokenData = await tokenResponse.json();
    const zoomToken = tokenData.access_token as string | undefined;
    if (!zoomToken) return json({ error: 'Zoom did not return an access token' }, 502);

    const apiHeaders = { Authorization: 'Bearer ' + zoomToken, 'Content-Type': 'application/json' };
    let meetingResponse: Response;
    if (session.zoom_meeting_id) {
      meetingResponse = await fetch('https://api.zoom.us/v2/meetings/' + encodeURIComponent(session.zoom_meeting_id), { headers: apiHeaders });
    } else {
      meetingResponse = await fetch('https://api.zoom.us/v2/users/' + encodeURIComponent(hostUserId) + '/meetings', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          topic: session.title,
          type: 2,
          start_time: session.scheduled_at,
          duration: 60,
          timezone: 'Africa/Cairo',
          agenda: session.description || 'SAT English live lesson',
          settings: {
            waiting_room: true,
            join_before_host: false,
            mute_upon_entry: true,
            host_video: true,
            participant_video: true,
            auto_recording: 'none'
          }
        })
      });
    }
    if (!meetingResponse.ok) return json({ error: session.zoom_meeting_id ? 'Could not refresh the Zoom host link.' : 'Zoom could not create the meeting. Check the Zoom host account and meeting:write:meeting:admin permission.' }, 502);
    const meeting = await meetingResponse.json();
    if (!meeting.id || !meeting.join_url || !meeting.start_url) return json({ error: 'Zoom returned incomplete meeting details' }, 502);

    const { error: updateError } = await supabase.from('live_sessions').update({
      zoom_meeting_id: String(meeting.id),
      zoom_join_url: meeting.join_url,
      zoom_password: meeting.password || null
    }).eq('id', sessionId);
    if (updateError) return json({ error: 'The Zoom meeting was created but could not be linked to the lesson. Contact an administrator before creating another meeting.' }, 500);

    const { error: hostLinkError } = await supabase.from('live_session_zoom_host_links').upsert({
      session_id: sessionId,
      host_profile_id: user.id,
      start_url: meeting.start_url,
      updated_at: new Date().toISOString()
    }, { onConflict: 'session_id' });
    if (hostLinkError) return json({ error: 'The Zoom meeting was created, but its private host link could not be saved.' }, 500);

    return json({ meeting_id: String(meeting.id), join_url: meeting.join_url, start_url: meeting.start_url, password: meeting.password || null });
  } catch {
    return json({ error: 'Unexpected Zoom integration error. Please try again or contact an administrator.' }, 500);
  }
});
