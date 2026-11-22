import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock3, DoorOpen, Hand, LoaderCircle, LockKeyhole, MessageCircle, Plus, RefreshCw, Send, UserX, Users, Video, Volume2, VolumeX, X } from 'lucide-react';
import type { Profile } from './lib/supabase';
import LiveMedia from './LiveMedia';
import './live-classroom.css';

type Course = { id: string; title: string; created_by?: string };
type Lesson = { id: string; course_id: string; title: string };
type LiveSession = {
  id: string;
  course_id: string;
  lesson_id: string | null;
  room_type: 'lesson' | 'study';
  provider: 'website' | 'zoom';
  zoom_meeting_id?: string | null;
  zoom_join_url?: string | null;
  zoom_password?: string | null;
  title: string;
  description: string;
  scheduled_at: string;
  started_at: string | null;
  ended_at: string | null;
  status: 'scheduled' | 'lobby' | 'live' | 'ended' | 'cancelled';
  created_by: string;
  courses?: { title?: string } | null;
  lessons?: { title?: string } | null;
};
type PresenceMember = { profile_id?: string; display_name?: string; role?: string; online_at?: string; hand_raised?: boolean; hand_raised_at?: string | null };
type LiveMessage = { id: string; session_id: string; sender_profile_id: string; sender_display_name: string; body: string; created_at: string };

const staffRoles = ['admin', 'teacher', 'assistant'];
const formatDate = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const localDateTime = () => {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function LiveClassroom({ client, profile }: { client: any; profile: Profile }) {
  const staff = staffRoles.includes(profile.role);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showStudyRoomForm, setShowStudyRoomForm] = useState(false);
  const [deliveryProvider, setDeliveryProvider] = useState<'website' | 'zoom'>('website');
  const [studyRoomTitle, setStudyRoomTitle] = useState('Group study room');
  const [courseId, setCourseId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState(localDateTime);
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [onlineMembers, setOnlineMembers] = useState<PresenceMember[]>([]);
  const [chatMessages, setChatMessages] = useState<LiveMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [handRaiseBusy, setHandRaiseBusy] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<Record<string, string | null>>({});
  const [muteClock, setMuteClock] = useState(0);
  const roomChannelRef = useRef<any>(null);
  const lastChatSentAt = useRef(0);

  const load = useCallback(async () => {
    if (!client) { setLoading(false); setError('The learning database is not configured in this environment.'); return; }
    setLoading(true);
    setError('');
    try {
      const [sessionResult, courseResult, lessonResult] = await Promise.all([
        client.from('live_sessions').select('*, courses(title), lessons(title)').order('scheduled_at', { ascending: true }),
        staff
          ? client.from('courses').select('id,title,created_by').order('created_at', { ascending: false })
          : client.from('course_access').select('course_id').eq('student_profile_id', profile.id).eq('status', 'active'),
        staff ? client.from('lessons').select('id,course_id,title').eq('is_published', true).order('sort_order') : Promise.resolve({ data: [], error: null })
      ]);
      if (sessionResult.error) throw new Error(sessionResult.error.message);
      if (courseResult.error) throw new Error(courseResult.error.message);
      if (lessonResult.error) throw new Error(lessonResult.error.message);
      setSessions((sessionResult.data ?? []) as LiveSession[]);
      let courseRows: Course[] = [];
      if (staff) {
        courseRows = (courseResult.data ?? []) as Course[];
      } else {
        const ids = [...new Set((courseResult.data ?? []).map((row: { course_id: string }) => row.course_id))];
        if (ids.length) {
          const { data, error: enrolledError } = await client.from('courses').select('id,title').in('id', ids).eq('status', 'published');
          if (enrolledError) throw new Error(enrolledError.message);
          courseRows = (data ?? []) as Course[];
        }
      }
      const availableCourses = staff
        ? (profile.role === 'admin' ? courseRows : courseRows.filter(course => course.created_by === profile.id))
        : courseRows;
      setCourses(availableCourses);
      setLessons(lessonResult.data ?? []);
      if ((!courseId || !availableCourses.some(course => course.id === courseId)) && availableCourses.length) setCourseId(availableCourses[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load live classroom sessions.');
    } finally {
      setLoading(false);
    }
  }, [client, staff, profile.id, profile.role, courseId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!activeSession || !client) return;
    setChatMessages([]);
    setMutedUntil({});
    setChatDraft('');
    const channel = client.channel('live-session:' + activeSession.id, {
      config: { private: true, presence: { key: profile.id } }
    });
    roomChannelRef.current = channel;
    let disposed = false;

    void (async () => {
      const [messageResult, participantResult] = await Promise.all([
        client.from('live_session_messages')
          .select('id,session_id,sender_profile_id,sender_display_name,body,created_at')
          .eq('session_id', activeSession.id)
          .order('created_at', { ascending: false })
          .limit(60),
        client.from('live_session_participants')
          .select('profile_id,chat_muted_until')
          .eq('session_id', activeSession.id)
          .is('left_at', null)
      ]);
      if (disposed) return;
      if (messageResult.error) setError('Classroom chat is unavailable until its database migration is applied.');
      else setChatMessages(current => {
        const combined = [...((messageResult.data ?? []) as LiveMessage[]).reverse(), ...current];
        const unique = Array.from(new Map(combined.map(message => [message.id, message])).values());
        return unique.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).slice(-100);
      });
      if (!participantResult.error) {
        const next: Record<string, string | null> = {};
        (participantResult.data ?? []).forEach((row: { profile_id: string; chat_muted_until: string | null }) => { next[row.profile_id] = row.chat_muted_until; });
        setMutedUntil(next);
      }
    })();

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, PresenceMember[]>;
      const members = Object.entries(state).flatMap(([profileId, entries]) => entries.map(member => ({ ...member, profile_id: profileId })));
      setOnlineMembers(members);
    });
    channel.on('broadcast', { event: 'chat-message' }, async ({ payload }: { payload: { message_id?: string } }) => {
      if (disposed || !payload || typeof payload.message_id !== 'string') return;
      const { data, error: messageError } = await client.from('live_session_messages')
        .select('id,session_id,sender_profile_id,sender_display_name,body,created_at')
        .eq('id', payload.message_id)
        .eq('session_id', activeSession.id)
        .maybeSingle();
      if (!disposed && !messageError && data) {
        setChatMessages(current => current.some(message => message.id === data.id) ? current : [...current, data as LiveMessage].slice(-100));
      }
    });
    channel.on('broadcast', { event: 'chat-moderation-changed' }, async ({ payload }: { payload: { profile_id?: string } }) => {
      if (disposed || payload?.profile_id !== profile.id) return;
      const { data } = await client.from('live_session_participants')
        .select('profile_id,chat_muted_until')
        .eq('session_id', activeSession.id)
        .eq('profile_id', profile.id)
        .maybeSingle();
      if (!disposed && data) setMutedUntil(current => ({ ...current, [profile.id]: data.chat_muted_until }));
    });
    channel.on('broadcast', { event: 'participant-removed' }, async ({ payload }: { payload: { profile_id?: string } }) => {
      if (disposed || payload?.profile_id !== profile.id) return;
      const { data } = await client.from('live_session_participants')
        .select('removed_at')
        .eq('session_id', activeSession.id)
        .eq('profile_id', profile.id)
        .maybeSingle();
      if (!disposed && data?.removed_at) {
        setError('The teacher removed you from this classroom. You cannot rejoin this session.');
        setActiveSession(null);
        setOnlineMembers([]);
      }
    });
    channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        const trackStatus = await channel.track({
          profile_id: profile.id,
          display_name: profile.display_name,
          role: profile.role,
          online_at: new Date().toISOString(),
          hand_raised: false,
          hand_raised_at: null
        });
        if (trackStatus !== 'ok') setError('Connected to the room, but live presence could not start (' + trackStatus + ').');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setError('Private room connection failed. Refresh and verify that the live-classroom database migration has been applied in the test environment.');
      }
    });
    return () => {
      disposed = true;
      roomChannelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [activeSession, client, profile.id, profile.display_name, profile.role]);

  useEffect(() => {
    const expiries = Object.values(mutedUntil)
      .filter((value): value is string => Boolean(value))
      .map(value => new Date(value).getTime())
      .filter(value => value > Date.now());
    if (!expiries.length) return;
    const nextExpiry = Math.min(...expiries);
    const timer = window.setTimeout(() => setMuteClock(value => value + 1), Math.max(50, nextExpiry - Date.now() + 50));
    return () => window.clearTimeout(timer);
  }, [mutedUntil, muteClock]);

  const sendChatMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = chatDraft.trim();
    if (!client || !activeSession || !body || chatBusy) return;
    if (Date.now() - lastChatSentAt.current < 2200) {
      setError('Please wait a moment before sending another message.');
      return;
    }
    setChatBusy(true); setError('');
    try {
      const { data, error: sendError } = await client.rpc('live_session_send_message', {
        p_session_id: activeSession.id,
        p_body: body
      });
      if (sendError) throw new Error(sendError.message);
      const message = (Array.isArray(data) ? data[0] : data) as LiveMessage | null;
      if (!message?.id) throw new Error('The message was not saved. Please try again.');
      lastChatSentAt.current = Date.now();
      setChatMessages(current => current.some(item => item.id === message.id) ? current : [...current, message].slice(-100));
      setChatDraft('');
      const broadcastStatus = await roomChannelRef.current?.send({
        type: 'broadcast',
        event: 'chat-message',
        payload: { message_id: message.id }
      });
      if (broadcastStatus !== 'ok') setNotice('Your message was saved. Other participants may need to refresh to see it.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the classroom message.');
    } finally { setChatBusy(false); }
  };

  const toggleHandRaise = async () => {
    if (!activeSession || !roomChannelRef.current || handRaiseBusy) return;
    const raised = Boolean(onlineMembers.find(member => member.profile_id === profile.id)?.hand_raised);
    const next = !raised;
    setHandRaiseBusy(true);
    try {
      const result = await roomChannelRef.current.track({
        profile_id: profile.id,
        display_name: profile.display_name,
        role: profile.role,
        online_at: new Date().toISOString(),
        hand_raised: next,
        hand_raised_at: next ? new Date().toISOString() : null
      });
      if (result !== 'ok') throw new Error('Could not update your hand-raise status.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update hand raise.');
    } finally { setHandRaiseBusy(false); }
  };

  const toggleChatMute = async (member: PresenceMember) => {
    if (!client || !activeSession || !canModerateActiveSession || !member.profile_id || member.role !== 'student') return;
    const currentUntil = mutedUntil[member.profile_id];
    const currentlyMuted = Boolean(currentUntil && new Date(currentUntil).getTime() > Date.now());
    const nextMuted = !currentlyMuted;
    setBusy(true); setError('');
    try {
      const { data, error: muteError } = await client.rpc('live_session_set_chat_mute', {
        p_session_id: activeSession.id,
        p_profile_id: member.profile_id,
        p_muted: nextMuted
      });
      if (muteError) throw new Error(muteError.message);
      setMutedUntil(current => ({ ...current, [member.profile_id!]: data || null }));
      await roomChannelRef.current?.send({
        type: 'broadcast',
        event: 'chat-moderation-changed',
        payload: { profile_id: member.profile_id }
      });
      setNotice(nextMuted ? member.display_name + ' is muted in chat for 10 minutes.' : member.display_name + ' can chat again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update chat moderation.');
    } finally { setBusy(false); }
  };

  const removeParticipant = async (member: PresenceMember) => {
    if (!client || !activeSession || !canModerateActiveSession || !member.profile_id || member.role !== 'student' || busy) return;
    const name = member.display_name || 'This student';
    if (!window.confirm('Remove ' + name + ' from this live classroom? They will not be able to rejoin this session.')) return;
    setBusy(true); setError('');
    try {
      const { error: removeError } = await client.rpc('live_session_remove_participant', {
        p_session_id: activeSession.id,
        p_profile_id: member.profile_id
      });
      if (removeError) throw new Error(removeError.message);
      await roomChannelRef.current?.send({
        type: 'broadcast',
        event: 'participant-removed',
        payload: { profile_id: member.profile_id }
      });
      setNotice(name + ' was removed from the classroom.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the participant.');
    } finally { setBusy(false); }
  };

  const availableLessons = useMemo(() => lessons.filter(lesson => lesson.course_id === courseId), [lessons, courseId]);

  const createSession = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !courseId || title.trim().length < 2 || !scheduledAt) {
      setError('Choose a course, session title and scheduled start time.');
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const { data: created, error: insertError } = await client.from('live_sessions').insert({
        course_id: courseId,
        lesson_id: lessonId || null,
        room_type: 'lesson',
        provider: deliveryProvider,
        title: title.trim(),
        description: description.trim(),
        scheduled_at: new Date(scheduledAt).toISOString(),
        created_by: profile.id,
        status: 'scheduled'
      }).select('id').single();
      if (insertError || !created) throw new Error(insertError?.message || 'Could not create the live lesson.');
      if (deliveryProvider === 'zoom') {
        const { error: zoomError } = await client.functions.invoke('zoom-meeting', { body: { action: 'create', session_id: created.id } });
        if (zoomError) throw new Error('The lesson was saved, but Zoom could not create its meeting: ' + zoomError.message);
      }
      setTitle(''); setDescription(''); setLessonId(''); setScheduledAt(localDateTime()); setShowForm(false); setDeliveryProvider('website');
      setNotice(deliveryProvider === 'zoom' ? 'Zoom lesson scheduled. Students can join from this classroom page.' : 'Live lesson scheduled. Enrolled students will see it in their classroom.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not schedule the live lesson.');
    } finally { setBusy(false); }
  };

  const changeStatus = async (session: LiveSession, status: LiveSession['status']) => {
    const canManage = staff || (session.room_type === 'study' && session.created_by === profile.id);
    if (!client || !canManage || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: updateError } = await client.rpc('live_session_set_status', {
        p_session_id: session.id,
        p_status: status
      });
      if (updateError) throw new Error(updateError.message);
      setNotice(status === 'lobby' ? 'The classroom lobby is open.' : status === 'live' ? 'The live lesson has started.' : status === 'ended' ? 'The lesson has ended.' : 'The session was cancelled.');
      if (activeSession?.id === session.id && ['ended', 'cancelled'].includes(status)) {
        await client.rpc('live_session_leave', { p_session_id: session.id });
        setActiveSession(null);
        setOnlineMembers([]);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the session.');
    } finally { setBusy(false); }
  };

  const createStudyRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || staff || !courseId || studyRoomTitle.trim().length < 2 || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data, error: createError } = await client.from('live_sessions').insert({
        course_id: courseId,
        lesson_id: null,
        room_type: 'study',
        provider: 'website',
        title: studyRoomTitle.trim(),
        description: 'Student-led group study room',
        scheduled_at: new Date().toISOString(),
        created_by: profile.id,
        status: 'lobby'
      }).select('id').single();
      if (createError || !data) throw new Error(createError?.message || 'Could not open your study room.');
      setStudyRoomTitle('Group study room');
      setShowStudyRoomForm(false);
      setNotice('Your study room is open. Classmates with active access to this course can join.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the study room.');
    } finally { setBusy(false); }
  };

  const openZoomMeeting = async (session: LiveSession, host: boolean) => {
    if (!session.zoom_join_url && !host) {
      setError('The Zoom join link is not available yet. Ask the teacher to finish setting up the meeting.');
      return;
    }
    if (!host) {
      window.open(session.zoom_join_url!, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!client || busy) return;
    const zoomWindow = window.open('about:blank', '_blank');
    if (!zoomWindow) { setError('Your browser blocked the Zoom window. Allow pop-ups and try again.'); return; }
    setBusy(true); setError('');
    try {
      const { data, error: hostError } = await client.functions.invoke('zoom-meeting', {
        body: { action: session.zoom_meeting_id ? 'host' : 'create', session_id: session.id }
      });
      if (hostError || !data?.start_url) throw new Error(hostError?.message || data?.error || 'The Zoom host link is unavailable.');
      zoomWindow.opener = null;
      zoomWindow.location.href = data.start_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open Zoom as the host.');
    } finally { setBusy(false); }
  };

  const joinRoom = async (session: LiveSession) => {
    if (!client || busy || !['lobby', 'live'].includes(session.status)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: joinError } = await client.rpc('live_session_join', {
        p_session_id: session.id
      });
      if (joinError) throw new Error(joinError.message);
      setActiveSession(session);
      setNotice('You joined the classroom lobby.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join this classroom.');
    } finally { setBusy(false); }
  };

  const leaveRoom = async () => {
    if (!activeSession || !client) return;
    setBusy(true);
    try {
      const { error: leaveError } = await client.rpc('live_session_leave', {
        p_session_id: activeSession.id
      });
      if (leaveError) throw new Error(leaveError.message);
      setActiveSession(null); setOnlineMembers([]);
      setNotice('You left the classroom. Your attendance record was saved.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not leave the classroom cleanly.');
    } finally { setBusy(false); }
  };

  const ownHandRaised = Boolean(onlineMembers.find(member => member.profile_id === profile.id)?.hand_raised);
  const activeSessionHost = Boolean(activeSession && activeSession.created_by === profile.id);
  const canModerateActiveSession = staff || (activeSession?.room_type === 'study' && activeSessionHost);

  const statusLabel: Record<LiveSession['status'], string> = {
    scheduled: 'Scheduled', lobby: 'Lobby open', live: 'Live now', ended: 'Ended', cancelled: 'Cancelled'
  };

  return <section className="live-classroom">
    <header className="live-classroom-heading">
      <div><span className="live-classroom-eyebrow"><Video size={14}/> LIVE LEARNING</span><h2>Live classroom</h2>
        <p>{staff ? 'Schedule lessons, open the classroom and manage live-session attendance.' : 'Join live lessons scheduled for your enrolled courses.'}</p></div>
      <div className="live-classroom-actions">
        <button className="live-secondary" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={14}/> Refresh</button>
        {staff && <button className="live-primary" onClick={() => setShowForm(value => !value)}><Plus size={15}/> Schedule lesson</button>}{!staff && profile.role === 'student' && <button className="live-primary" onClick={() => setShowStudyRoomForm(value => !value)}><Plus size={15}/> Start study room</button>}
      </div>
    </header>

    {notice && <div className="live-notice"><CheckCircle2 size={15}/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14}/></button></div>}
    {error && <div className="live-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss"><X size={14}/></button></div>}

    {showStudyRoomForm && !staff && <form className="live-schedule-card" onSubmit={createStudyRoom}><div className="live-card-title"><Users size={18}/><div><b>Open a student study room</b><small>Invite classmates from your enrolled course. The room is private to active course members and supports up to six participants.</small></div></div><div className="live-form-grid"><label>Course<select required value={courseId} onChange={e => setCourseId(e.target.value)}><option value="">Select an enrolled course</option>{courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label className="live-form-wide">Room name<input required minLength={2} maxLength={180} value={studyRoomTitle} onChange={e => setStudyRoomTitle(e.target.value)} placeholder="e.g. SAT Reading group practice"/></label></div><div className="live-form-footer"><span><LockKeyhole size={13}/> Website room · classmates only</span><button className="live-primary" disabled={busy || !courseId}>{busy ? 'Opening…' : 'Open study room'}</button></div></form>}

    {showForm && staff && <form className="live-schedule-card" onSubmit={createSession}>
      <div className="live-card-title"><CalendarClock size={18}/><div><b>Schedule a live lesson</b><small>Only students with active access to the selected course can see the session.</small></div></div>
      <div className="live-form-grid">
        <label>Course<select required value={courseId} onChange={e => { setCourseId(e.target.value); setLessonId(''); }}><option value="">Select a course</option>{courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        <label>Related lesson (optional)<select value={lessonId} onChange={e => setLessonId(e.target.value)}><option value="">No linked lesson</option>{availableLessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></label>
        <label className="live-form-wide">Session title<input required minLength={2} maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. SAT Reading: Evidence and Inference"/></label>
        <label>Scheduled start<input required type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}/></label>
        <label>Where should students meet?<select value={deliveryProvider} onChange={e => setDeliveryProvider(e.target.value as 'website' | 'zoom')}><option value="website">Open inside this website</option><option value="zoom">Use Zoom meeting</option></select></label>
        <label className="live-form-wide">Description<textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What students should prepare before joining."/></label>
      </div>
      <div className="live-form-footer"><span><LockKeyhole size={13}/> {deliveryProvider === 'zoom' ? 'Zoom is created securely using the school Zoom account.' : 'Private course access is enforced by database policies.'}</span><button className="live-primary" disabled={busy || !courseId}>{busy ? 'Saving…' : 'Save scheduled lesson'}</button></div>
    </form>}

    {activeSession && <section className="live-room-panel">
      <div className="live-room-top"><div><span className="live-room-kicker">SECURE CLASSROOM LOBBY</span><h3>{activeSession.title}</h3><p>{activeSession.courses?.title || 'Course'} · {statusLabel[activeSession.status]}</p></div><div className="live-room-top-actions">{!staff && <button className={ownHandRaised ? 'live-secondary live-hand-raised' : 'live-secondary'} onClick={() => void toggleHandRaise()} disabled={handRaiseBusy}><Hand size={14}/>{ownHandRaised ? 'Lower hand' : 'Raise hand'}</button>}<button className="live-secondary" onClick={() => void leaveRoom()} disabled={busy}><DoorOpen size={14}/> Leave room</button></div></div>
      <div className="live-room-notice"><Users size={17}/><div><b>{onlineMembers.length} online</b><span>Presence is shared only inside this private session channel.</span></div></div>
      <div className="live-presence-list">{onlineMembers.map((member, index) => {
        const until = member.profile_id ? mutedUntil[member.profile_id] : null;
        const isMuted = Boolean(until && new Date(until).getTime() > Date.now());
        return <div key={member.profile_id || index}>
          <span>{(member.display_name || 'Participant').slice(0,1).toUpperCase()}</span>
          <b>{member.display_name || 'Participant'}{member.profile_id === profile.id ? ' (You)' : ''}</b>
          <small>{member.role || 'Participant'}</small>
          {member.hand_raised && <em className="live-hand-indicator"><Hand size={11}/> Hand raised</em>}
          {canModerateActiveSession && member.role === 'student' && member.profile_id && member.profile_id !== profile.id && <button className="live-chat-moderate" onClick={() => void toggleChatMute(member)} disabled={busy}>{isMuted ? <Volume2 size={12}/> : <VolumeX size={12}/>} {isMuted ? 'Unmute chat' : 'Mute 10m'}</button>}
          {canModerateActiveSession && member.role === 'student' && member.profile_id && member.profile_id !== profile.id && <button className="live-chat-moderate live-remove-participant" onClick={() => void removeParticipant(member)} disabled={busy}><UserX size={12}/> Remove</button>}
        </div>;
      })}{!onlineMembers.length && <small>Connecting to the private classroom…</small>}</div>
      <LiveMedia client={client} sessionId={activeSession.id} profile={profile} members={onlineMembers}/>
      <section className="live-chat-panel">
        <div className="live-chat-heading"><div><MessageCircle size={15}/><b>Classroom chat</b></div><span>Saved messages · 1,000 characters max</span></div>
        <div className="live-chat-messages" aria-live="polite">
          {chatMessages.map(message => <article className={message.sender_profile_id === profile.id ? 'live-chat-message live-chat-message-own' : 'live-chat-message'} key={message.id}>
            <div><b>{message.sender_display_name || 'Participant'}</b><time>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
            <p>{message.body}</p>
          </article>)}
          {!chatMessages.length && <div className="live-chat-empty">No messages yet. Say hello to your class.</div>}
        </div>
        <form className="live-chat-compose" onSubmit={sendChatMessage}>
          <input value={chatDraft} onChange={event => setChatDraft(event.target.value.slice(0,1000))} maxLength={1000} aria-label="Classroom message" placeholder={mutedUntil[profile.id] && new Date(mutedUntil[profile.id]!).getTime() > Date.now() ? 'Your chat is temporarily muted' : 'Write a message…'} disabled={chatBusy || Boolean(mutedUntil[profile.id] && new Date(mutedUntil[profile.id]!).getTime() > Date.now())}/>
          <button className="live-primary" type="submit" disabled={chatBusy || !chatDraft.trim() || Boolean(mutedUntil[profile.id] && new Date(mutedUntil[profile.id]!).getTime() > Date.now())}><Send size={14}/>{chatBusy ? 'Sending…' : 'Send'}</button>
        </form>
        {mutedUntil[profile.id] && new Date(mutedUntil[profile.id]!).getTime() > Date.now() && <small className="live-chat-muted-note">A teacher temporarily muted your classroom chat.</small>}
      </section>

      <div className="live-coming-next"><Video size={16}/><span><b>Live media prototype</b>Audio/video and screen sharing are available through browser WebRTC. This small-room prototype is limited to six participants and does not include a TURN relay or scalable media server.</span></div>
    </section>}

    {loading ? <div className="live-empty"><LoaderCircle className="live-spin" size={22}/> Loading live lessons…</div> :
      sessions.length === 0 ? <div className="live-empty"><CalendarClock size={30}/><b>No live lessons scheduled</b><span>{staff ? 'Schedule the first live lesson for one of your courses.' : 'Start a study room with classmates or join a teacher-led lesson.'}</span></div> :
      <div className="live-session-list">{sessions.map(session => <article className="live-session-card" key={session.id}>
        <div className="live-session-icon"><Video size={20}/></div>
        <div className="live-session-main"><div className="live-session-title"><h3>{session.title}</h3><span className={'live-status live-status-' + session.status}>{statusLabel[session.status]}</span></div>
          <p>{session.description || (session.room_type === 'study' ? 'Student-led study room' : 'Live English lesson')} · {session.room_type === 'study' ? 'Student study room' : session.provider === 'zoom' ? 'Zoom session' : 'Website classroom'}</p>
          <div className="live-session-meta"><span><BookOpenIcon/> {session.courses?.title || 'Course'}</span>{session.lessons?.title && <span>{session.lessons.title}</span>}<span><Clock3 size={13}/> {formatDate(session.scheduled_at)}</span></div>
        </div>
        <div className="live-session-controls">
          {session.provider === 'zoom' && session.status !== 'ended' && session.status !== 'cancelled' && (staff && session.created_by === profile.id
            ? <button className="live-primary" onClick={() => void openZoomMeeting(session, true)} disabled={busy}>{session.zoom_meeting_id ? 'Start in Zoom' : 'Set up Zoom'}</button>
            : !staff && ['lobby','live','scheduled'].includes(session.status) && <button className="live-primary" onClick={() => void openZoomMeeting(session, false)} disabled={!session.zoom_join_url}>Join on Zoom</button>)}
          {session.provider === 'website' && (staff || (session.room_type === 'study' && session.created_by === profile.id)) && session.status === 'scheduled' && <button className="live-secondary" onClick={() => void changeStatus(session, 'lobby')} disabled={busy}>Open lobby</button>}
          {session.provider === 'website' && (staff || (session.room_type === 'study' && session.created_by === profile.id)) && ['scheduled','lobby'].includes(session.status) && <button className="live-primary" onClick={() => void changeStatus(session, 'live')} disabled={busy}>Start now</button>}
          {session.provider === 'website' && !staff && !(session.room_type === 'study' && session.created_by === profile.id) && ['lobby','live'].includes(session.status) && <button className="live-primary" onClick={() => void joinRoom(session)} disabled={busy || activeSession?.id === session.id}>Join room</button>}
          {session.provider === 'website' && (staff || (session.room_type === 'study' && session.created_by === profile.id)) && ['lobby','live'].includes(session.status) && <button className="live-primary" onClick={() => void joinRoom(session)} disabled={busy || activeSession?.id === session.id}>Enter room</button>}
          {session.provider === 'website' && (staff || (session.room_type === 'study' && session.created_by === profile.id)) && ['lobby','live'].includes(session.status) && <button className="live-danger" onClick={() => void changeStatus(session, 'ended')} disabled={busy}>End room</button>}
          {session.provider === 'website' && staff && session.status === 'scheduled' && <button className="live-danger" onClick={() => void changeStatus(session, 'cancelled')} disabled={busy}>Cancel</button>}
        </div>
      </article>)}</div>
    }
    <footer className="live-security-note"><LockKeyhole size={14}/> Session visibility, joining and private Realtime presence are protected by active profile and course-access policies.</footer>
  </section>;
}

function BookOpenIcon() {
  return <CalendarClock size={13}/>;
}
