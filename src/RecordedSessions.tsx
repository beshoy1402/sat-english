import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileVideo, LoaderCircle, LockKeyhole, Play, Plus, RefreshCw, Trash2, UploadCloud, Video, X } from 'lucide-react';
import type { Profile } from './lib/supabase';
import './RecordedSessions.css';

type Recording = {
  id: string;
  course_id: string;
  title: string;
  description: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  recorded_at: string | null;
  is_published: boolean;
  created_by: string;
  created_at: string;
  courses?: { title?: string } | null;
};

type Course = { id: string; title: string };

const BUCKET = 'sat-session-recordings';
const MAX_FILE_BYTES = 500 * 1024 * 1024;
const formatSize = (bytes: number) => bytes >= 1024 ** 3 ? (bytes / 1024 ** 3).toFixed(2) + ' GB' : (bytes / 1024 ** 2).toFixed(1) + ' MB';
const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Date not specified';


async function uploadWithTus(
  client: any,
  bucket: string,
  objectPath: string,
  file: File,
  onProgress: (percentage: number) => void
) {
  const getBaseHeaders = async (): Promise<Record<string, string>> => {
    let { data, error } = await client.auth.getSession();
    if (error) throw new Error(error.message);
    let session = data?.session;
    if (!session) throw new Error('Your session expired. Sign in again before uploading.');

    // Refresh before a long upload if the current access token is close to expiry.
    if (session.expires_at && session.expires_at * 1000 <= Date.now() + 90_000) {
      const refreshed = await client.auth.refreshSession();
      if (refreshed.error || !refreshed.data?.session) {
        throw new Error(refreshed.error?.message || 'Your session expired. Sign in again before uploading.');
      }
      session = refreshed.data.session;
    }

    return {
      authorization: `Bearer ${session.access_token}`,
      apikey: client.supabaseKey,
      'Tus-Resumable': '1.0.0'
    };
  };

  const projectUrl = new URL(client.supabaseUrl);
  const storageHost = projectUrl.hostname.endsWith('.supabase.co')
    ? projectUrl.hostname.replace(/\.supabase\.co$/, '.storage.supabase.co')
    : projectUrl.host;
  const endpoint = `${projectUrl.protocol}//${storageHost}/storage/v1/upload/resumable`;
  const fingerprint = `${bucket}:${objectPath}:${file.size}:${file.lastModified}`;
  const storageKey = `supabase-tus:${fingerprint}`;
  const endpointOrigin = new URL(endpoint).origin;
  const isTrustedUploadUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      return parsed.origin === endpointOrigin
        && parsed.pathname.startsWith('/storage/v1/upload/resumable/');
    } catch {
      return false;
    }
  };
  const readStoredUploadUrl = () => {
    try { return localStorage.getItem(storageKey); }
    catch { throw new Error('Browser storage is unavailable. Enable site storage to resume this upload.'); }
  };
  const saveStoredUploadUrl = (value: string) => {
    try { localStorage.setItem(storageKey, value); }
    catch { throw new Error('Browser storage is full or blocked. Free some site storage and retry the upload.'); }
  };
  const clearStoredUploadUrl = () => {
    try { localStorage.removeItem(storageKey); } catch { /* Best-effort cleanup only. */ }
  };
  const encodeMetadata = (value: string) => btoa(unescape(encodeURIComponent(value)));
  const metadata = [
    ['bucketName', bucket],
    ['objectName', objectPath],
    ['contentType', file.type || 'application/octet-stream'],
    ['cacheControl', '3600'],
    ['metadata', JSON.stringify({ originalFilename: file.name })]
  ].map(([key, value]) => `${key} ${encodeMetadata(value)}`).join(',');

  const createUpload = async () => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...await getBaseHeaders(),
        'Upload-Length': String(file.size),
        'Upload-Metadata': metadata
      }
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(detail || `Could not start resumable upload (${response.status}).`);
    }
    const location = response.headers.get('Location');
    if (!location) throw new Error('Storage did not return a resumable upload URL.');
    const uploadUrl = new URL(location, endpoint).toString();
    if (!isTrustedUploadUrl(uploadUrl)) {
      throw new Error('Storage returned an untrusted resumable upload URL.');
    }
    saveStoredUploadUrl(uploadUrl);
    return uploadUrl;
  };

  let uploadUrl = readStoredUploadUrl();
  let offset = 0;
  if (uploadUrl && !isTrustedUploadUrl(uploadUrl)) {
    // Never send a bearer token or project key to an untrusted stored URL.
    clearStoredUploadUrl();
    uploadUrl = null;
  }
  if (uploadUrl) {
    let head: Response;
    try {
      head = await fetch(uploadUrl, { method: 'HEAD', headers: await getBaseHeaders() });
    } catch {
      throw new Error('Could not verify the saved upload session. Check your connection and retry; the existing upload has been preserved.');
    }
    if (head.status === 404 || head.status === 410) {
      clearStoredUploadUrl();
      uploadUrl = null;
    } else if (!head.ok) {
      throw new Error(`Could not resume the saved upload (HTTP ${head.status}). Retry after checking your connection and sign-in.`);
    } else {
      offset = Number(head.headers.get('Upload-Offset'));
      const remoteLength = Number(head.headers.get('Upload-Length') || file.size);
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > file.size || remoteLength !== file.size) {
        clearStoredUploadUrl();
        uploadUrl = null;
        offset = 0;
      }
    }
  }
  if (!uploadUrl) uploadUrl = await createUpload();

  onProgress(Math.min(100, Math.round((offset / file.size) * 100)));
  const chunkSize = 6 * 1024 * 1024;
  let retries = 0;

  while (offset < file.size) {
    const nextOffset = Math.min(offset + chunkSize, file.size);
    try {
      const response = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          ...await getBaseHeaders(),
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream'
        },
        body: file.slice(offset, nextOffset)
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        if (response.status >= 400 && response.status < 500 && response.status !== 409) {
          throw new Error(detail || `Upload stopped (${response.status}).`);
        }
        throw new Error(detail || `Temporary upload error (${response.status}).`);
      }
      const confirmedOffset = Number(response.headers.get('Upload-Offset'));
      if (!Number.isSafeInteger(confirmedOffset) || confirmedOffset <= offset || confirmedOffset > nextOffset || confirmedOffset > file.size) {
        throw new Error('Storage returned an invalid upload offset.');
      }
      offset = confirmedOffset;
      retries = 0;
      onProgress(Math.min(100, Math.round((offset / file.size) * 100)));
    } catch (error) {
      if (error instanceof Error && /Upload stopped|invalid upload offset/.test(error.message)) throw error;
      retries += 1;
      if (retries > 5) {
        throw new Error('Upload paused after repeated connection failures. Select the same file again to resume.');
      }
      await new Promise(resolve => window.setTimeout(resolve, [1000, 2000, 4000, 8000, 15000][retries - 1]));
      const head = await fetch(uploadUrl, { method: 'HEAD', headers: await getBaseHeaders() });
      if (!head.ok) throw new Error('The resumable upload session expired. Start the upload again.');
      offset = Number(head.headers.get('Upload-Offset'));
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > file.size) {
        throw new Error('Storage returned an invalid resumable upload offset.');
      }
      onProgress(Math.min(100, Math.round((offset / file.size) * 100)));
    }
  }

  // Keep the completed upload URL until its database row is saved. If the page reloads
  // between upload completion and metadata insertion, the next attempt can reuse it.
  onProgress(100);
}

export default function RecordedSessions({ client, profile }: { client: any; profile: Profile }) {
  const isStaff = ['admin', 'teacher', 'assistant', 'developer'].includes(profile.role);
  const canManage = ['admin', 'teacher', 'assistant'].includes(profile.role);
  const canDelete = ['admin', 'teacher'].includes(profile.role);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState('');
  const [recordedAt, setRecordedAt] = useState('');
  const [published, setPublished] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [activeVideo, setActiveVideo] = useState<{ id: string; title: string; url: string } | null>(null);

  const load = useCallback(async () => {
    if (!client) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [courseResult, recordingResult] = await Promise.all([
        client.from('courses').select('id,title').order('created_at', { ascending: false }),
        client.from('session_recordings').select('*, courses(title)').order('created_at', { ascending: false })
      ]);
      if (courseResult.error) setError(courseResult.error.message);
      else setCourses(courseResult.data ?? []);
      if (recordingResult.error) setError(recordingResult.error.message);
      else setRecordings(recordingResult.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the session library.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { void load(); }, [load]);

  const selectedCourse = useMemo(() => courses.find(course => course.id === courseId), [courses, courseId]);

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice('');
    setError('');
    if (!client || !file || !courseId || title.trim().length < 2) {
      setError('Choose a course, a video and a title before uploading.');
      return;
    }
    if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) {
      setError('Use an MP4, MOV or WebM video file.');
      return;
    }
    if (file.size === 0) {
      setError('The selected video file is empty. Choose a valid recording.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('This file exceeds the 500 MB limit for this upload. Compress it or split the recording.');
      return;
    }
    setBusy(true);
    const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
    const resumeFingerprint = [profile.id, courseId, file.name, file.size, file.lastModified].join(':');
    const pathStorageKey = `sat-recording-path:${resumeFingerprint}`;
    let path: string | null = null;
    try {
      path = localStorage.getItem(pathStorageKey);
      if (!path) {
        path = profile.id + '/' + crypto.randomUUID() + '-' + safeName;
        localStorage.setItem(pathStorageKey, path);
      }
    } catch {
      setError('Your browser could not save the upload recovery information. Check available site storage and try again.');
      setBusy(false);
      return;
    }
    const tusStorageKey = `supabase-tus:${BUCKET}:${path}:${file.size}:${file.lastModified}`;
    setUploadProgress(0);
    try {
      await uploadWithTus(client, BUCKET, path, file, setUploadProgress);

      // Make metadata insertion idempotent: a lost response must not create duplicate
      // library rows when the user retries a completed upload.
      const { data: existing, error: lookupError } = await client
        .from('session_recordings')
        .select('id')
        .eq('storage_path', path)
        .maybeSingle();
      if (lookupError) throw new Error(lookupError.message);

      if (!existing) {
        const { error: insertError } = await client.from('session_recordings').insert({
          course_id: courseId,
          title: title.trim(),
          description: description.trim(),
          storage_path: path,
          original_filename: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          recorded_at: recordedAt ? new Date(recordedAt).toISOString() : null,
          is_published: published,
          created_by: profile.id
        });
        if (insertError) throw new Error(insertError.message);
      }

      // Clear recovery data only after the metadata row is confirmed to exist.
      try {
        localStorage.removeItem(tusStorageKey);
        localStorage.removeItem(pathStorageKey);
      } catch { /* The saved recording is safe; stale recovery keys are harmless. */ }
      setNotice(existing ? 'This recording was already saved. The library has been refreshed.' : 'Recording uploaded and saved to the session library.');
      setTitle('');
      setDescription('');
      setRecordedAt('');
      setFile(null);
      setPublished(false);
      setUploadProgress(0);
      setShowForm(false);
      await load();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'The recording could not be saved. Your uploaded video has been kept so you can retry with the same file.');
    } finally {
      setBusy(false);
    }
  };

  const play = async (recording: Recording) => {
    if (!client || busy) return;
    setError('');
    setBusy(true);
    try {
      const { data, error: urlError } = await client.storage.from(BUCKET).createSignedUrl(recording.storage_path, 60 * 60);
      if (urlError || !data?.signedUrl) setError(urlError?.message || 'Could not create a secure playback link.');
      else setActiveVideo({ id: recording.id, title: recording.title, url: data.signedUrl });
    } catch (playError) {
      setError(playError instanceof Error ? playError.message : 'Could not open this recording.');
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async (recording: Recording) => {
    if (!client || !canManage || busy) return;
    setBusy(true);
    setError('');
    try {
      const { error: updateError } = await client.from('session_recordings').update({ is_published: !recording.is_published, updated_at: new Date().toISOString() }).eq('id', recording.id);
      if (updateError) setError(updateError.message);
      else { setNotice(recording.is_published ? 'Recording moved back to drafts.' : 'Recording published to students with course access.'); await load(); }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update recording visibility.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (recording: Recording) => {
    if (!client || !canDelete || busy || !window.confirm('Delete this recording and its stored video permanently?')) return;
    setBusy(true);
    setError('');
    try {
      const { error: storageError } = await client.storage.from(BUCKET).remove([recording.storage_path]);
      if (storageError) {
        setError('The video file could not be deleted, so its library record was kept. ' + storageError.message);
        return;
      }
      const { error: rowError } = await client.from('session_recordings').delete().eq('id', recording.id);
      if (rowError) {
        setError('The video file was deleted, but its library record could not be removed. Refresh and contact an administrator if it remains visible. ' + rowError.message);
      } else {
        setNotice('Recording deleted.');
        if (activeVideo?.id === recording.id) setActiveVideo(null);
        await load();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this recording.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="recordings-page">
    <div className="recordings-heading">
      <div>
        <span className="recordings-eyebrow"><Video size={14}/> SESSION LIBRARY</span>
        <h2>Recorded sessions</h2>
        <p>{isStaff ? 'Upload lesson recordings and publish them to the right classes.' : 'Watch the lessons your teacher has shared with your classes.'}</p>
      </div>
      <div className="recordings-heading-actions">
        <button className="recordings-quiet" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={15}/> Refresh</button>
        {canManage && <button className="recordings-primary" onClick={() => setShowForm(v => !v)}><Plus size={16}/> Upload recording</button>}
      </div>
    </div>

    {notice && <div className="recordings-notice"><CheckCircle2 size={16}/>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14}/></button></div>}
    {error && <div className="recordings-error">{error}<button onClick={() => setError('')} aria-label="Dismiss"><X size={14}/></button></div>}

    {showForm && canManage && <form className="recordings-upload-card" onSubmit={upload}>
      <div className="recordings-form-title"><span><UploadCloud size={18}/></span><div><b>Upload a recorded lesson</b><small>Private video storage · only assigned students can watch published recordings</small></div></div>
      <div className="recordings-form-grid">
        <label>Session title<input required minLength={2} maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Transitions and logical flow"/></label>
        <label>Course<select required value={courseId} onChange={e => setCourseId(e.target.value)}><option value="">Choose a course</option>{courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        <label className="recordings-span">Description<textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What will students learn in this session?"/></label>
        <label>Session date<input type="datetime-local" value={recordedAt} onChange={e => setRecordedAt(e.target.value)}/></label>
        <label className="recordings-file-label"><span>Video file</span><input required type="file" accept="video/mp4,video/quicktime,video/webm" onChange={e => setFile(e.target.files?.[0] ?? null)}/><small>{file ? file.name + ' · ' + formatSize(file.size) : 'MP4, MOV or WebM · up to 500 MB'}</small></label>
      </div>
      <div className="recordings-form-footer">
        <label className="recordings-check"><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)}/> Publish immediately for students with course access</label>
        <button className="recordings-primary" disabled={busy || !file}>{busy ? <><LoaderCircle className="recordings-spin" size={15}/> Uploading…</> : <><UploadCloud size={15}/> Upload session</>}</button>
      </div>
      {busy && <div className="recordings-upload-progress" role="status" aria-live="polite"><div><span>Upload progress</span><b>{uploadProgress}%</b></div><progress max={100} value={uploadProgress}/><small>You can retry with the same file if your connection drops; completed chunks are resumed.</small></div>}
      {selectedCourse && <small className="recordings-hint">This recording will be linked to {selectedCourse.title}.</small>}
    </form>}

    {activeVideo && <div className="recordings-player">
      <div className="recordings-player-top"><div><span>NOW PLAYING</span><b>{activeVideo.title}</b></div><button onClick={() => setActiveVideo(null)} aria-label="Close player"><X size={17}/></button></div>
      <video controls playsInline preload="metadata" src={activeVideo.url}/>
      <div className="recordings-player-foot"><LockKeyhole size={13}/> Secure playback link expires in 60 minutes.</div>
    </div>}

    {loading ? <div className="recordings-empty"><LoaderCircle className="recordings-spin" size={24}/>Loading session library…</div> : recordings.length === 0 ? <div className="recordings-empty"><FileVideo size={32}/><b>No recordings yet</b><span>{isStaff ? 'Upload your first recorded lesson to begin building the library.' : 'Published recordings will appear here when your teacher shares them.'}</span></div> :
      <div className="recordings-grid">{recordings.map(recording => <article className="recording-card" key={recording.id}>
        <div className="recording-card-art"><span><FileVideo size={25}/></span><small>{recording.courses?.title || 'Course recording'}</small><i>{recording.is_published ? 'PUBLISHED' : 'DRAFT'}</i></div>
        <div className="recording-card-body"><h3>{recording.title}</h3><p>{recording.description || 'Recorded learning session'}</p><div className="recording-card-meta"><span><Clock3 size={13}/>{formatDate(recording.recorded_at || recording.created_at)}</span><span>{formatSize(recording.file_size_bytes)}</span></div>
          <div className="recording-card-actions"><button className="recordings-primary" onClick={() => void play(recording)} disabled={busy}><Play size={14}/> Watch</button>{canManage && <button className="recordings-quiet" onClick={() => void togglePublish(recording)} disabled={busy}>{recording.is_published ? 'Unpublish' : 'Publish'}</button>}{canDelete && <button className="recordings-icon-danger" onClick={() => void remove(recording)} disabled={busy} aria-label="Delete recording"><Trash2 size={15}/></button>}</div>
        </div>
      </article>)}</div>
    }
    <div className="recordings-security-note"><LockKeyhole size={15}/><span>Recordings are stored privately. Student playback is authorized by course enrollment and published status.</span></div>
  </section>;
}
