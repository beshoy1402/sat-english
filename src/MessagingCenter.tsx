import {useCallback,useEffect,useState} from 'react';
import {MessageCircle,Paperclip,RefreshCw,Send,X,Download,Plus} from 'lucide-react';
import './messaging-center.css';
type Row=Record<string,any>;
type Profile={id:string;role:string;display_name?:string};
type Props={client:any;profile:Profile};
export default function MessagingCenter({client,profile}:Props){
 const staff=['admin','teacher','assistant'].includes(profile.role);
 const [conversations,setConversations]=useState<Row[]>([]),[people,setPeople]=useState<Row[]>([]),[messages,setMessages]=useState<Row[]>([]);
 const [selected,setSelected]=useState<Row|null>(null),[subject,setSubject]=useState(''),[firstMessage,setFirstMessage]=useState(''),[recipient,setRecipient]=useState('');
 const [draft,setDraft]=useState(''),[file,setFile]=useState<File|null>(null),[showNew,setShowNew]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  const [c,p]=await Promise.all([
   client.from('conversations').select('*').order('updated_at',{ascending:false}),
   staff?client.from('profiles').select('id,display_name,username,role').in('role',['student','parent']).eq('is_active',true).order('display_name'):Promise.resolve({data:[],error:null})
  ]);
  if(c.error||p.error){setNotice(c.error?.message||p.error?.message||'Unable to load conversations.');return;}
  setConversations(c.data??[]);setPeople(p.data??[]);
  if(!selected&&c.data?.length)setSelected(c.data[0]);
 },[client,staff,selected]);
 useEffect(()=>{void load();},[load]);
 const loadMessages=useCallback(async(id:string)=>{
  const {data,error}=await client.from('messages').select('*').eq('conversation_id',id).order('created_at',{ascending:true}).limit(300);
  if(error){setNotice(error.message);return;}setMessages(data??[]);
 },[client]);
 useEffect(()=>{if(!selected){setMessages([]);return;}void loadMessages(selected.id);
  const channel=client.channel('conversation-'+selected.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'conversation_id=eq.'+selected.id},(payload:any)=>{
   setMessages(old=>old.some(m=>m.id===payload.new.id)?old:[...old,payload.new]);
  }).subscribe();
  return()=>{void client.removeChannel(channel);};
 },[client,selected,loadMessages]);
 const create=async(e:React.FormEvent)=>{
  e.preventDefault();if(!subject.trim()||!firstMessage.trim()||(staff&&!recipient)){setNotice('Complete the subject, first message and recipient.');return;}
  setBusy(true);
  const type=staff?'support':profile.role==='parent'?'parent_teacher':'student_teacher';
  const {data,error}=await client.from('conversations').insert({subject:subject.trim(),conversation_type:type,created_by:profile.id,assigned_to:staff?profile.id:null}).select('*').single();
  if(error){setNotice(error.message);setBusy(false);return;}
  const participants=[{conversation_id:data.id,profile_id:profile.id},{...(staff?{conversation_id:data.id,profile_id:recipient}: {})}].filter(x=>x.profile_id);
  const {error:pe}=await client.from('conversation_participants').insert(participants);
  if(pe){setNotice(pe.message);setBusy(false);return;}
  const {error:me}=await client.from('messages').insert({conversation_id:data.id,sender_profile_id:profile.id,body:firstMessage.trim()});
  if(me){setNotice(me.message);setBusy(false);return;}
  setSubject('');setFirstMessage('');setRecipient('');setShowNew(false);await load();setSelected(data);setBusy(false);
 };
 const send=async(e:React.FormEvent)=>{
  e.preventDefault();if(!selected||(!draft.trim()&&!file))return;setBusy(true);let path:string|null=null;
  if(file){if(file.size>10*1024*1024){setNotice('Attachments must be 10 MB or smaller.');setBusy(false);return;}
   path=selected.id+'/'+profile.id+'/'+crypto.randomUUID()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
   const {error}=await client.storage.from('message-attachments').upload(path,file,{upsert:false});if(error){setNotice(error.message);setBusy(false);return;}
  }
  const {error}=await client.from('messages').insert({conversation_id:selected.id,sender_profile_id:profile.id,body:draft.trim()||'Attachment',attachment_path:path});
  if(error)setNotice(error.message);else{setDraft('');setFile(null);await loadMessages(selected.id);await load();}
  setBusy(false);
 };
 const openAttachment=async(path:string)=>{
  const popup=window.open('about:blank','_blank');
  if(!popup){setNotice('Allow pop-ups to open message attachments, then try again.');return;}
  popup.opener=null;
  const {data,error}=await client.storage.from('message-attachments').createSignedUrl(path,60);
  if(error||!data?.signedUrl){popup.close();setNotice(error?.message||'Could not create a secure attachment link.');return;}
  popup.location.href=data.signedUrl;
 };
 const setStatus=async(status:string)=>{
  if(!selected)return;const {error}=await client.from('conversations').update({status,updated_at:new Date().toISOString()}).eq('id',selected.id);
  if(error)setNotice(error.message);else{setSelected({...selected,status});await load();}
 };
 const sender=(id:string)=>id===profile.id?'You':staff?(people.find(p=>p.id===id)?.display_name||'Team member'):'Teaching team';
 return <section className="messaging-center"><div className="messaging-heading"><div><span>MESSAGING AND SUPPORT</span><h2>Messages</h2><p>{staff?'Manage student and parent conversations.':'Contact your teaching team and follow replies.'}</p></div><div><button onClick={()=>void load()}><RefreshCw size={14}/> Refresh</button><button className="messaging-new" onClick={()=>setShowNew(true)}><Plus size={14}/> New conversation</button></div></div>{notice&&<div className="messaging-notice">{notice}<button onClick={()=>setNotice('')}><X size={13}/></button></div>}
  <div className="messaging-layout"><aside className="messaging-conversations"><b>Conversations ({conversations.length})</b>{conversations.map(c=><button key={c.id} onClick={()=>setSelected(c)} className={selected?.id===c.id?'active':''}><span>{c.subject}</span><small>{new Date(c.updated_at).toLocaleString()} · {c.status}</small></button>)}{!conversations.length&&<p>No conversations yet.</p>}</aside>
   <div className="messaging-thread">{selected?<><header><div><b>{selected.subject}</b><small>{selected.conversation_type.replaceAll('_',' ')} · {selected.status}</small></div>{staff&&<select value={selected.status} onChange={e=>void setStatus(e.target.value)}><option value="open">Open</option><option value="pending">Pending</option><option value="closed">Closed</option></select>}</header><div className="messaging-messages">{messages.map(m=><article key={m.id} className={m.sender_profile_id===profile.id?'mine':''}><span>{sender(m.sender_profile_id)}</span><p>{m.body}</p>{m.attachment_path&&<button onClick={()=>void openAttachment(m.attachment_path)}><Download size={13}/>{m.attachment_path.split('/').at(-1)}</button>}<small>{new Date(m.created_at).toLocaleString()}</small></article>)}{!messages.length&&<div className="messaging-empty">Start the conversation with a message.</div>}</div><form className="messaging-compose" onSubmit={send}><label title="Attach file"><Paperclip size={17}/><input type="file" onChange={e=>setFile(e.target.files?.[0]??null)}/></label><textarea rows={2} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write a message…"/><button disabled={busy||(!draft.trim()&&!file)}><Send size={15}/></button></form>{file&&<small className="messaging-file-selected">{file.name}</small>}</>:<div className="messaging-empty"><MessageCircle/><b>Select a conversation</b><p>Choose a conversation or start a new one.</p><button onClick={()=>setShowNew(true)}>New conversation</button></div>}</div>
  </div>
  {showNew&&<div className="messaging-modal"><form onSubmit={create}><button type="button" className="messaging-close" onClick={()=>setShowNew(false)}><X/></button><span>NEW CONVERSATION</span><h3>Start a conversation</h3><label>Subject<input required maxLength={180} value={subject} onChange={e=>setSubject(e.target.value)}/></label>{staff&&<label>Recipient<select required value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">Choose student or parent</option>{people.map(p=><option key={p.id} value={p.id}>{p.display_name} · {p.role}</option>)}</select></label>}<label>Message<textarea required rows={5} value={firstMessage} onChange={e=>setFirstMessage(e.target.value)}/></label><button className="messaging-send" disabled={busy}>Create conversation</button></form></div>}
 </section>;
}
