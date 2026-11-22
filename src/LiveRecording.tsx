import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock3, LoaderCircle, MonitorUp, Pause, Play, Square, UploadCloud, X } from 'lucide-react';
import type { Profile } from './lib/supabase';
import { uploadWithTus } from './RecordedSessions';

type Session = { id: string; course_id: string; title: string; scheduled_at: string; status: string };

const MAX_RECORDING_BYTES = 500 * 1024 * 1024;
const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(value => String(value).padStart(2, '0')).join(':');
};

export default function LiveRecording({ client, profile, session, canRecord }: {
  client: any; profile: Profile; session: Session; canRecord: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [title, setTitle] = useState(session.title);
  const [description, setDescription] = useState('Recorded from the live classroom.');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const displayRef = useRef<MediaStream | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    displayRef.current?.getTracks().forEach(track => track.stop());
    micRef.current?.getTracks().forEach(track => track.stop());
    void audioContextRef.current?.close();
  }, [previewUrl]);

  const releaseCapture = () => {
    displayRef.current?.getTracks().forEach(track => track.stop());
    micRef.current?.getTracks().forEach(track => track.stop());
    displayRef.current = null;
    micRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  };

  const finishRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const startRecording = async () => {
    setError(''); setNotice(''); setVideoFile(null);
    if (!canRecord || session.status !== 'live') {
      setError('Only the teacher who owns this active website lesson can record it.');
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser does not support screen capture recording. Try a current desktop version of Chrome, Edge or Firefox.');
      return;
    }
    let display: MediaStream | null = null;
    let microphone: MediaStream | null = null;
    try {
      // The browser permission picker is intentionally opened only after this teacher action.
      display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        audio: true
      });
      microphone = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const videoTrack = display.getVideoTracks()[0];
      if (!videoTrack) throw new Error('The browser did not provide a screen or tab video track.');

      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      const displayAudio = display.getAudioTracks();
      if (displayAudio.length) {
        const displayAudioStream = new MediaStream(displayAudio);
        audioContext.createMediaStreamSource(displayAudioStream).connect(destination);
      }
      audioContext.createMediaStreamSource(microphone).connect(destination);
      const capture = new MediaStream([videoTrack, ...destination.stream.getAudioTracks()]);
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
        .find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('This browser does not expose a supported MP4 or WebM recording format.');

      displayRef.current = display;
      micRef.current = microphone;
      audioContextRef.current = audioContext;
      chunksRef.current = [];
      stopRequestedRef.current = false;
      const recorder = new MediaRecorder(capture, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = event => {
        if (event.data.size) chunksRef.current.push(event.data);
        const size = chunksRef.current.reduce((total, chunk) => total + (chunk instanceof Blob ? chunk.size : 0), 0);
        if (size >= MAX_RECORDING_BYTES && recorder.state === 'recording') {
          setError('The 500 MB recording limit was reached. The recording has been stopped; review and save the captured video.');
          recorder.stop();
        }
      };
      recorder.onerror = () => setError('The browser reported a recording error. Stop or retry the capture.');
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType.split(';')[0] });
        if (blob.size > 0) {
          const extension = blob.type === 'video/mp4' ? 'mp4' : 'webm';
          const file = new File([blob], 'live-session-' + session.id + '.' + extension, { type: blob.type, lastModified: Date.now() });
          setVideoFile(file);
          setPreviewUrl(URL.createObjectURL(blob));
          setNotice('Recording stopped. Preview it before saving; it will remain a private draft.');
        } else if (!stopRequestedRef.current) setError('The browser did not produce a video file.');
        setRecording(false);
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
        releaseCapture();
        recorderRef.current = null;
      };
      videoTrack.addEventListener('ended', finishRecording, { once: true });
      recorder.start(1000);
      startedAtRef.current = Date.now();
      setSeconds(0);
      setRecording(true);
    } catch (captureError) {
      display?.getTracks().forEach(track => track.stop());
      microphone?.getTracks().forEach(track => track.stop());
      await audioContextRef.current?.close().catch(() => undefined);
      displayRef.current = null; micRef.current = null; audioContextRef.current = null;
      setError(captureError instanceof Error ? captureError.message : 'Screen, tab or microphone permission was not granted.');
    }
  };

  const discard = () => {
    if (recording) { stopRequestedRef.current = true; finishRecording(); }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(''); setVideoFile(null); setSeconds(0); setNotice('Recording discarded.');
  };

  const saveDraft = async () => {
    if (!client || !videoFile || !canRecord || busy) return;
    if (videoFile.size > MAX_RECORDING_BYTES) {
      setError('This recording exceeds the 500 MB private-storage limit. Shorten or compress it before saving.');
      return;
    }
    if (title.trim().length < 2) { setError('Enter a recording title with at least two characters.'); return; }
    setBusy(true); setError(''); setNotice(''); setProgress(0);
    const path = profile.id + '/' + crypto.randomUUID() + '-' + videoFile.name;
    try {
      await uploadWithTus(client, 'sat-session-recordings', path, videoFile, setProgress);
      const { error: insertError } = await client.from('session_recordings').insert({
        course_id: session.course_id,
        live_session_id: session.id,
        title: title.trim(),
        description: description.trim(),
        storage_path: path,
        original_filename: videoFile.name,
        mime_type: videoFile.type,
        file_size_bytes: videoFile.size,
        recorded_at: new Date(startedAtRef.current || Date.now()).toISOString(),
        is_published: false,
        created_by: profile.id
      });
      if (insertError) throw new Error(insertError.message);
      setNotice('Saved to Recorded Sessions as a private draft. Publish it later from the library.');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(''); setVideoFile(null); setSeconds(0);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The recording could not be saved. Keep this page open and retry.');
    } finally { setBusy(false); }
  };

  if (!canRecord || session.provider === 'zoom') return null;

  return <section className="live-recording-card" aria-label="Lesson recording">
    <div className="live-recording-head">
      <div><b>Lesson recording</b><span>Capture this browser tab or screen and your microphone. Zoom lessons are recorded separately in Zoom.</span></div>
      {recording && <span className="live-recording-indicator"><i/> REC · {formatTime(seconds)}</span>}
    </div>
    {!recording && !videoFile && <div className="live-recording-actions">
      <button className="live-primary" onClick={() => void startRecording()} disabled={busy || session.status !== 'live'}><MonitorUp size={14}/> Start recording</button>
      <small>Browser permission is required. Choose the classroom tab and enable tab audio in the browser picker if available.</small>
    </div>}
    {recording && <div className="live-recording-actions">
      <span className="live-recording-time"><Clock3 size={15}/> {formatTime(seconds)} · Recording in progress</span>
      <button className="live-danger" onClick={() => { stopRequestedRef.current = true; finishRecording(); }}><Square size={13}/> Stop recording</button>
    </div>}
    {videoFile && !recording && <div className="live-recording-review">
      <video controls playsInline src={previewUrl}/>
      <label>Draft title<input value={title} onChange={event => setTitle(event.target.value)} maxLength={180}/></label>
      <label>Description<textarea rows={2} value={description} onChange={event => setDescription(event.target.value)} maxLength={2000}/></label>
      <div className="live-recording-actions">
        <small>{videoFile.name} · {(videoFile.size / 1024 / 1024).toFixed(1)} MB · {formatTime(seconds)}</small>
        <button className="live-primary" onClick={() => void saveDraft()} disabled={busy}>{busy ? <><LoaderCircle size={14}/> Uploading {progress}%</> : <><UploadCloud size={14}/> Save private draft</>}</button>
        <button className="live-secondary" onClick={discard} disabled={busy}><X size={14}/> Discard</button>
      </div>
      {busy && <progress max={100} value={progress}/>}
    </div>}
    {notice && <p className="live-recording-notice"><CheckCircle2 size={14}/>{notice}</p>}
    {error && <p className="live-recording-error" role="alert">{error}</p>}
    <p className="live-recording-footnote">The recording contains the selected screen/tab video, audio supplied by the browser's capture picker, and your microphone. It does not guarantee a separate clean recording of every remote participant. Recordings are uploaded privately and saved unpublished.</p>
  </section>;
}
