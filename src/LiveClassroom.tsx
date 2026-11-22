import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock3, DoorOpen, LoaderCircle, LockKeyhole, Plus, RefreshCw, Users, Video, X } from 'lucide-react';
import type { Profile } from './lib/supabase';
import './live-classroom.css';

type Course = { id: string; title: string; created_by?: string };
type Lesson = { id: string; course_id: string; title: string };
type LiveSession = {
  id: string;
  course_id: string;
  lesson_id: string | null;
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
type PresenceMember = { profile_id?: string; display_name?: string; role?: string; online_at?: string };

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
  const [courseId, setCourseId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState(localDateTime);
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [onlineMembers, setOnlineMembers] = useState<PresenceMember[]>([]);

  const load = useCallback(async () => {
    if (!client) { setLoading(false); setError('The learning database is not configured in this environment.'); return; }
    setLoading(true);
    setError('');
    try {
      const [sessionResult, courseResult, lessonResult] = await Promise.all([
        client.from('live_sessions').select('*, courses(title), lessons(title)').order('scheduled_at', { ascending: true }),
        staff ? client.from('courses').select('id,title,created_by').order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
        staff ? client.from('lessons').select('id,course_id,title').order('sort_order') : Promise.resolve({ data: [], error: null })
      ]);
      if (sessionResult.error) throw new Error(sessionResult.error.message);
      if (courseResult.error) throw new Error(courseResult.error.message);
      if (lessonResult.error) throw new Error(lessonResult.error.message);
      setSessions((sessionResult.data ?? []) as LiveSession[]);
      setCourses(courseResult.data ?? []);
      setLessons(lessonResult.data ?? []);
      if (!courseId && courseResult.data?.length) setCourseId(courseResult.data[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load live classroom sessions.');
    } finally {
      setLoading(false);
    }
  }, [client, staff, courseId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!activeSession || !client) return;
    const channel = client.channel('live-session:' + activeSession.id, {
      config: { private: true, presence: { key: profile.id } }
    });
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, PresenceMember[]>;
      setOnlineMembers(Object.values(state).flat());
    });
    channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        const trackStatus = await channel.track({
          profile_id: profile.id,
          display_name: profile.display_name,
          role: profile.role,
          online_at: new Date().toISOString()
        });
        if (trackStatus !== 'ok') setError('Connected to the room, but live presence could not start (' + trackStatus + ').');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setError('Private room connection failed. Refresh and verify that the live-classroom database migration has been applied in the test environment.');
      }
    });
    return () => { void client.removeChannel(channel); };
  }, [activeSession, client, profile.id, profile.display_name, profile.role]);

  const availableLessons = useMemo(() => lessons.filter(lesson => lesson.course_id === courseId), [lessons, courseId]);

  const createSession = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !courseId || title.trim().length < 2 || !scheduledAt) {
      setError('Choose a course, session title and scheduled start time.');
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: insertError } = await client.from('live_sessions').insert({
        course_id: courseId,
        lesson_id: lessonId || null,
        title: title.trim(),
        description: description.trim(),
        scheduled_at: new Date(scheduledAt).toISOString(),
        created_by: profile.id,
        status: 'scheduled'
      });
      if (insertError) throw new Error(insertError.message);
      setTitle(''); setDescription(''); setLessonId(''); setScheduledAt(localDateTime()); setShowForm(false);
      setNotice('Live lesson scheduled. Enrolled students will see it in their classroom.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not schedule the live lesson.');
    } finally { setBusy(false); }
  };

  const changeStatus = async (session: LiveSession, status: LiveSession['status']) => {
    if (!client || !staff || busy) return;
    const now = new Date().toISOString();
    const patch: Record<string, string | null> = { status, updated_at: now };
    if (status === 'live') patch.started_at = session.started_at || now;
    if (status === 'ended') { patch.started_at = session.started_at || now; patch.ended_at = now; }
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: updateError } = await client.from('live_sessions').update(patch).eq('id', session.id);
      if (updateError) throw new Error(updateError.message);
      setNotice(status === 'lobby' ? 'The classroom lobby is open.' : status === 'live' ? 'The live lesson has started.' : status === 'ended' ? 'The lesson has ended.' : 'The session was cancelled.');
      if (activeSession?.id === session.id && ['ended', 'cancelled'].includes(status)) setActiveSession(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the session.');
    } finally { setBusy(false); }
  };

  const joinRoom = async (session: LiveSession) => {
    if (!client || busy || !['lobby', 'live'].includes(session.status)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: joinError } = await client.from('live_session_participants').upsert({
        session_id: session.id,
        profile_id: profile.id,
        joined_at: new Date().toISOString(),
        left_at: null,
        last_seen_at: new Date().toISOString()
      }, { onConflict: 'session_id,profile_id' });
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
      const { error: leaveError } = await client.from('live_session_participants')
        .update({ left_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
        .eq('session_id', activeSession.id)
        .eq('profile_id', profile.id);
      if (leaveError) throw new Error(leaveError.message);
      setActiveSession(null); setOnlineMembers([]);
      setNotice('You left the classroom. Your attendance record was saved.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not leave the classroom cleanly.');
    } finally { setBusy(false); }
  };

  const statusLabel: Record<LiveSession['status'], string> = {
    scheduled: 'Scheduled', lobby: 'Lobby open', live: 'Live now', ended: 'Ended', cancelled: 'Cancelled'
  };

  return <section className="live-classroom">
    <header className="live-classroom-heading">
      <div><span className="live-classroom-eyebrow"><Video size={14}/> LIVE LEARNING</span><h2>Live classroom</h2>
        <p>{staff ? 'Schedule lessons, open the classroom and manage live-session attendance.' : 'Join live lessons scheduled for your enrolled courses.'}</p></div>
      <div className="live-classroom-actions">
        <button className="live-secondary" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={14}/> Refresh</button>
        {staff && <button className="live-primary" onClick={() => setShowForm(value => !value)}><Plus size={15}/> Schedule lesson</button>}
      </div>
    </header>

    {notice && <div className="live-notice"><CheckCircle2 size={15}/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14}/></button></div>}
    {error && <div className="live-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss"><X size={14}/></button></div>}

    {showForm && staff && <form className="live-schedule-card" onSubmit={createSession}>
      <div className="live-card-title"><CalendarClock size={18}/><div><b>Schedule a live lesson</b><small>Only students with active access to the selected course can see the session.</small></div></div>
      <div className="live-form-grid">
        <label>Course<select required value={courseId} onChange={e => { setCourseId(e.target.value); setLessonId(''); }}><option value="">Select a course</option>{courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        <label>Related lesson (optional)<select value={lessonId} onChange={e => setLessonId(e.target.value)}><option value="">No linked lesson</option>{availableLessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></label>
        <label className="live-form-wide">Session title<input required minLength={2} maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. SAT Reading: Evidence and Inference"/></label>
        <label>Scheduled start<input required type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}/></label>
        <label className="live-form-wide">Description<textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What students should prepare before joining."/></label>
      </div>
      <div className="live-form-footer"><span><LockKeyhole size={13}/> Private course access is enforced by database policies.</span><button className="live-primary" disabled={busy || !courseId}>{busy ? 'Saving…' : 'Save scheduled lesson'}</button></div>
    </form>}

    {activeSession && <section className="live-room-panel">
      <div className="live-room-top"><div><span className="live-room-kicker">SECURE CLASSROOM LOBBY</span><h3>{activeSession.title}</h3><p>{activeSession.courses?.title || 'Course'} · {statusLabel[activeSession.status]}</p></div><button className="live-secondary" onClick={() => void leaveRoom()} disabled={busy}><DoorOpen size={14}/> Leave room</button></div>
      <div className="live-room-notice"><Users size={17}/><div><b>{onlineMembers.length} online</b><span>Presence is shared only inside this private session channel.</span></div></div>
      <div className="live-presence-list">{onlineMembers.map((member, index) => <div key={member.profile_id || index}><span>{(member.display_name || 'Participant').slice(0,1).toUpperCase()}</span><b>{member.display_name || 'Participant'}{member.profile_id === profile.id ? ' (You)' : ''}</b><small>{member.role || 'Participant'}</small></div>)}{!onlineMembers.length && <small>Connecting to the private classroom…</small>}</div>
      <div className="live-coming-next"><Video size={16}/><span><b>Classroom connection established</b>Audio/video, screen sharing and in-room chat are the next implementation layer. This lobby does not claim to transmit media yet.</span></div>
    </section>}

    {loading ? <div className="live-empty"><LoaderCircle className="live-spin" size={22}/> Loading live lessons…</div> :
      sessions.length === 0 ? <div className="live-empty"><CalendarClock size={30}/><b>No live lessons scheduled</b><span>{staff ? 'Schedule the first live lesson for one of your courses.' : 'Your teachers will publish upcoming live lessons here.'}</span></div> :
      <div className="live-session-list">{sessions.map(session => <article className="live-session-card" key={session.id}>
        <div className="live-session-icon"><Video size={20}/></div>
        <div className="live-session-main"><div className="live-session-title"><h3>{session.title}</h3><span className={'live-status live-status-' + session.status}>{statusLabel[session.status]}</span></div>
          <p>{session.description || 'Live English lesson'} </p>
          <div className="live-session-meta"><span><BookOpenIcon/> {session.courses?.title || 'Course'}</span>{session.lessons?.title && <span>{session.lessons.title}</span>}<span><Clock3 size={13}/> {formatDate(session.scheduled_at)}</span></div>
        </div>
        <div className="live-session-controls">
          {staff && session.status === 'scheduled' && <button className="live-secondary" onClick={() => void changeStatus(session, 'lobby')} disabled={busy}>Open lobby</button>}
          {staff && ['scheduled','lobby'].includes(session.status) && <button className="live-primary" onClick={() => void changeStatus(session, 'live')} disabled={busy}>Start now</button>}
          {!staff && ['lobby','live'].includes(session.status) && <button className="live-primary" onClick={() => void joinRoom(session)} disabled={busy || activeSession?.id === session.id}>Join classroom</button>}
          {staff && session.status === 'live' && <button className="live-primary" onClick={() => void joinRoom(session)} disabled={busy || activeSession?.id === session.id}>Enter room</button>}
          {staff && ['lobby','live'].includes(session.status) && <button className="live-danger" onClick={() => void changeStatus(session, 'ended')} disabled={busy}>End lesson</button>}
          {staff && session.status === 'scheduled' && <button className="live-danger" onClick={() => void changeStatus(session, 'cancelled')} disabled={busy}>Cancel</button>}
        </div>
      </article>)}</div>
    }
    <footer className="live-security-note"><LockKeyhole size={14}/> Session visibility, joining and private Realtime presence are protected by active profile and course-access policies.</footer>
  </section>;
}

function BookOpenIcon() {
  return <CalendarClock size={13}/>;
}
