import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Mic, MicOff, MonitorUp, Video, X } from 'lucide-react';
import type { Profile } from './lib/supabase';

type Member = { profile_id?: string; display_name?: string };
type Signal = { from: string; to: string; kind: 'offer' | 'answer' | 'ice'; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

export default function LiveMedia({ client, sessionId, profile, members }: { client: any; sessionId: string; profile: Profile; members: Member[] }) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const channelRef = useRef<any>(null);
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const membersRef = useRef(members);
  useEffect(() => { membersRef.current = members; }, [members]);

  useEffect(() => {
    const channel = client.channel('live-session-media:' + sessionId, { config: { private: true } });
    channelRef.current = channel;
    let disposed = false;
    const send = async (payload: Omit<Signal, 'from'>) => {
      const result = await channel.send({ type: 'broadcast', event: 'webrtc-signal', payload: { ...payload, from: profile.id } });
      if (result !== 'ok') setError('A media connection signal failed. Please reconnect.');
    };
    const makePeer = (peerId: string) => {
      const existing = peers.current.get(peerId);
      if (existing) return existing;
      if (peers.current.size >= 5) { setError('This prototype supports up to 6 participants including you.'); return null; }
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peers.current.set(peerId, pc);
      localRef.current?.getTracks().forEach(track => pc.addTrack(track, localRef.current!));
      pc.onicecandidate = event => { if (event.candidate && !disposed) void send({ to: peerId, kind: 'ice', candidate: event.candidate.toJSON() }); };
      pc.ontrack = event => {
        const stream = event.streams[0] || new MediaStream([event.track]);
        setRemoteStreams(current => ({ ...current, [peerId]: stream }));
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') setError('Peer connection failed. STUN-only connections may not work on restrictive networks.');
        if (pc.connectionState === 'closed') setRemoteStreams(current => { const next = { ...current }; delete next[peerId]; return next; });
      };
      return pc;
    };
    const offerPeer = async (peerId: string) => {
      const pc = makePeer(peerId);
      if (!pc || pc.signalingState !== 'stable' || pc.localDescription) return;
      try { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); await send({ to: peerId, kind: 'offer', description: pc.localDescription?.toJSON() }); }
      catch { setError('Could not negotiate a peer connection.'); }
    };
    channel.on('broadcast', { event: 'webrtc-signal' }, async ({ payload }: { payload: Signal }) => {
      if (!payload || payload.to !== profile.id || payload.from === profile.id) return;
      if (!membersRef.current.some(member => member.profile_id === payload.from)) return;
      const pc = makePeer(payload.from);
      if (!pc) return;
      try {
        if (payload.kind === 'offer' && payload.description) {
          await pc.setRemoteDescription(payload.description);
          for (const candidate of pendingIce.current.get(payload.from) || []) await pc.addIceCandidate(candidate);
          pendingIce.current.delete(payload.from);
          const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
          await send({ to: payload.from, kind: 'answer', description: pc.localDescription?.toJSON() });
        } else if (payload.kind === 'answer' && payload.description) {
          await pc.setRemoteDescription(payload.description);
          for (const candidate of pendingIce.current.get(payload.from) || []) await pc.addIceCandidate(candidate);
          pendingIce.current.delete(payload.from);
        } else if (payload.kind === 'ice' && payload.candidate) {
          if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate);
          else pendingIce.current.set(payload.from, [...(pendingIce.current.get(payload.from) || []), payload.candidate]);
        }
      } catch { setError('A peer negotiation step failed. Leave and rejoin the classroom.'); }
    });
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        const peersNow = [...new Set(membersRef.current.map(member => member.profile_id).filter((id): id is string => Boolean(id) && id !== profile.id))];
        if (peersNow.length > 5) setError('This prototype supports up to 6 participants.');
        peersNow.slice(0, 5).forEach(peerId => { makePeer(peerId); if (profile.id.localeCompare(peerId) < 0) void offerPeer(peerId); });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError('Private media signaling failed. Check the live classroom migration and Realtime policies.');
    });
    return () => {
      disposed = true; channelRef.current = null;
      peers.current.forEach(pc => pc.close()); peers.current.clear(); pendingIce.current.clear();
      setRemoteStreams({}); void client.removeChannel(channel);
    };
  }, [client, sessionId, profile.id]);

  useEffect(() => {
    const peersNow = [...new Set(members.map(member => member.profile_id).filter((id): id is string => Boolean(id) && id !== profile.id))];
    peersNow.slice(0, 5).forEach(peerId => {
      if (peers.current.has(peerId)) return;
      if (peers.current.size >= 5) return;
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peers.current.set(peerId, pc);
      localRef.current?.getTracks().forEach(track => pc.addTrack(track, localRef.current!));
      pc.onicecandidate = event => { if (event.candidate) void channelRef.current?.send({ type: 'broadcast', event: 'webrtc-signal', payload: { from: profile.id, to: peerId, kind: 'ice', candidate: event.candidate.toJSON() } }); };
      pc.ontrack = event => setRemoteStreams(current => ({ ...current, [peerId]: event.streams[0] || new MediaStream([event.track]) }));
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') setError('Peer connection failed. Try again or use the approved meeting fallback.'); };
      if (profile.id.localeCompare(peerId) < 0) void (async () => { try { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); await channelRef.current?.send({ type: 'broadcast', event: 'webrtc-signal', payload: { from: profile.id, to: peerId, kind: 'offer', description: pc.localDescription?.toJSON() } }); } catch { setError('Could not start a peer connection.'); } })();
    });
  }, [members, profile.id]);

  const enableMedia = async () => {
    setBusy(true); setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera and microphone require a supported browser over HTTPS.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } });
      localRef.current = stream; setLocalStream(stream);
      stream.getAudioTracks().forEach(track => { track.enabled = micOn; });
      stream.getVideoTracks().forEach(track => { track.enabled = cameraOn; });
      for (const pc of peers.current.values()) { for (const track of stream.getTracks()) { const sender = pc.getSenders().find(item => item.track?.kind === track.kind); if (sender) await sender.replaceTrack(track); else pc.addTrack(track, stream); } }
    } catch (e) { setError(e instanceof Error ? e.message : 'Camera or microphone permission was denied.'); }
    finally { setBusy(false); }
  };
  const toggleMic = () => { const next = !micOn; localRef.current?.getAudioTracks().forEach(track => { track.enabled = next; }); setMicOn(next); };
  const toggleCamera = () => { const next = !cameraOn; localRef.current?.getVideoTracks().forEach(track => { track.enabled = next; }); setCameraOn(next); };
  const toggleShare = async () => {
    if (!localRef.current || busy) return;
    setBusy(true); setError('');
    try {
      if (screenRef.current) {
        screenRef.current.getTracks().forEach(track => track.stop()); screenRef.current = null; setScreenStream(null);
        const cameraTrack = localRef.current.getVideoTracks()[0];
        if (cameraTrack) for (const pc of peers.current.values()) { const sender = pc.getSenders().find(item => item.track?.kind === 'video'); if (sender) await sender.replaceTrack(cameraTrack); }
      } else {
        if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Screen sharing is not supported by this browser.');
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const track = display.getVideoTracks()[0]; if (!track) throw new Error('No screen-share video track was provided.');
        screenRef.current = display; setScreenStream(display);
        for (const pc of peers.current.values()) { const sender = pc.getSenders().find(item => item.track?.kind === 'video'); if (sender) await sender.replaceTrack(track); else pc.addTrack(track, display); }
        track.onended = () => { if (screenRef.current) void toggleShare(); };
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Screen sharing could not start.'); }
    finally { setBusy(false); }
  };
  const stopMedia = () => { screenRef.current?.getTracks().forEach(track => track.stop()); localRef.current?.getTracks().forEach(track => track.stop()); for (const pc of peers.current.values()) { for (const sender of pc.getSenders()) { if (sender.track && (sender.track.kind === 'audio' || sender.track.kind === 'video')) void sender.replaceTrack(null); } } screenRef.current = null; localRef.current = null; setScreenStream(null); setLocalStream(null); };

  return <div className="live-media-section">
    <div className="live-media-heading"><div><b>Audio & video</b><span>Peer-to-peer prototype · maximum 6 participants</span></div>
      {!localStream ? <button className="live-primary" onClick={() => void enableMedia()} disabled={busy}><Video size={14}/>{busy ? 'Connecting…' : 'Enable camera & mic'}</button> : <div className="live-media-controls">
        <button className="live-secondary" onClick={toggleMic}>{micOn ? <Mic size={14}/> : <MicOff size={14}/>} {micOn ? 'Mute' : 'Unmute'}</button>
        <button className="live-secondary" onClick={toggleCamera}>{cameraOn ? <Camera size={14}/> : <CameraOff size={14}/>} {cameraOn ? 'Camera off' : 'Camera on'}</button>
        <button className="live-secondary" onClick={() => void toggleShare()} disabled={busy}><MonitorUp size={14}/>{screenStream ? 'Stop sharing' : 'Share screen'}</button>
      </div>}</div>
    {error && <div className="live-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss"><X size={14}/></button></div>}
    <div className="live-video-grid">
      {localStream && <MediaTile stream={screenStream || localStream} label={profile.display_name + ' (You)'} muted mirror={!screenStream}/>}
      {Object.entries(remoteStreams).map(([id, stream]) => <MediaTile key={id} stream={stream} label={members.find(member => member.profile_id === id)?.display_name || 'Participant'}/>)}
      {!localStream && Object.keys(remoteStreams).length === 0 && <div className="live-media-placeholder"><Video size={23}/><b>Camera and microphone are off</b><span>Enable them when ready. Your browser will ask for permission.</span></div>}
    </div>
    <div className="live-media-footnote">WebRTC uses free STUN discovery only. Restrictive networks may block connections; no TURN relay or large-classroom media server is configured.</div>
    <button className="live-media-stop" onClick={stopMedia} disabled={!localStream}><Video size={13}/> Stop camera and microphone</button>
  </div>;
}

function MediaTile({ stream, label, muted = false, mirror = false }: { stream: MediaStream; label: string; muted?: boolean; mirror?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = stream; return () => { if (videoRef.current) videoRef.current.srcObject = null; }; }, [stream]);
  return <div className="live-video-tile"><video ref={videoRef} autoPlay playsInline muted={muted} className={mirror ? 'live-video-mirror' : ''}/><span>{label}</span></div>;
}