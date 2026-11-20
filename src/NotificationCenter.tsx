import {useCallback,useEffect,useMemo,useState} from 'react';
import {Bell,Check,ExternalLink,RefreshCw,Send} from 'lucide-react';
import './notification-center.css';

type Row=Record<string,any>;
type Profile={id:string;role:string};
type Props={client:any;profile:Profile};
const types=['general','homework','exam','grade','attendance','course','account','system'];
export default function NotificationCenter({client,profile}:Props){
 const staff=['admin','teacher','assistant'].includes(profile.role);
 const [rows,setRows]=useState<Row[]>([]),[people,setPeople]=useState<Row[]>([]),[selected,setSelected]=useState<string[]>([]);
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[type,setType]=useState('general'),[audience,setAudience]=useState('students'),[search,setSearch]=useState('');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  const [n,p]=await Promise.all([
   client.from('notifications').select('*').order('created_at',{ascending:false}).limit(300),
   staff?client.from('profiles').select('id,display_name,username,role').in('role',['student','parent']).eq('is_active',true).order('display_name'):Promise.resolve({data:[],error:null})
  ]);
  const err=n.error||p.error;if(err){setNotice(err.message);return;}setRows(n.data??[]);setPeople(p.data??[]);
 },[client,staff]);
 useEffect(()=>{void load();},[load]);
 const recipientMap=useMemo(()=>Object.fromEntries(people.map(p=>[p.id,p])),[people]);
 const unread=rows.filter(r=>!r.read_at&&r.recipient_profile_id===profile.id).length;
 const filtered=rows.filter(r=>(!staff?r.recipient_profile_id===profile.id:true)&&JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
 const send=async(e:React.FormEvent)=>{
  e.preventDefault();const recipients=audience==='selected'?selected:people.filter(p=>audience==='students'?p.role==='student':audience==='parents'?p.role==='parent':true).map(p=>p.id);
  if(!recipients.length){setNotice('Choose at least one recipient.');return;}
  setBusy(true);const payload=recipients.map(recipient_profile_id=>({recipient_profile_id,title:title.trim(),body:body.trim(),notification_type:type,created_by:profile.id,channel:'in_app',delivery_status:'delivered'}));
  const {error}=await client.from('notifications').insert(payload);
  setNotice(error?.message||'In-app notification delivered to '+recipients.length+' account(s).');if(!error){setTitle('');setBody('');setSelected([]);await load();}setBusy(false);
 };
 const markRead=async(n:Row)=>{
  const {error}=await client.from('notifications').update({read_at:new Date().toISOString()}).eq('id',n.id);
  if(error)setNotice(error.message);else await load();
 };
 return <section className="notification-center"><div className="notification-heading"><div><span>MESSAGING AND ALERTS</span><h2>Notifications</h2><p>{staff?'Send in-app updates and monitor delivery records.':'Important updates from your teaching team.'}</p></div><button onClick={()=>void load()}><RefreshCw size={14}/> Refresh</button></div>
  {notice&&<div className="notification-notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
  {staff&&<div className="notification-layout"><form className="notification-compose" onSubmit={send}><h3><Send size={15}/> Send notification</h3><label>Title<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Message<textarea required rows={4} value={body} onChange={e=>setBody(e.target.value)}/></label><label>Category<select value={type} onChange={e=>setType(e.target.value)}>{types.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></label><label>Recipients<select value={audience} onChange={e=>setAudience(e.target.value)}><option value="students">All active students</option><option value="parents">All active parents</option><option value="all">All students and parents</option><option value="selected">Select individual accounts</option></select></label>{audience==='selected'&&<div className="notification-recipient-list">{people.map(p=><label key={p.id}><input type="checkbox" checked={selected.includes(p.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/>{p.display_name}<small>{p.role}</small></label>)}</div>}<button className="notification-primary" disabled={busy}>{busy?'Sending…':'Send in-app notification'}</button><small>Delivery channel: in-app only. Email and WhatsApp delivery are not connected yet.</small></form><div className="notification-delivery"><h3><Bell size={15}/> Delivery history</h3><div className="notification-delivery-stats"><span>{rows.length} records</span><span>{rows.filter(r=>r.delivery_status==='delivered').length} delivered</span><span>{rows.filter(r=>r.delivery_status==='failed').length} failed</span></div><p>Each row is stored as a notification for the recipient. Read status is updated when the recipient opens it.</p></div></div>}
  <div className="notification-list-panel"><div className="notification-list-head"><div><h3><Bell size={15}/> {staff?'Recent notifications':'Your notifications'}</h3>{!staff&&<small>{unread} unread</small>}</div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notifications"/></div>
   {filtered.map(n=><article key={n.id} className={!n.read_at&&n.recipient_profile_id===profile.id?'unread':''}><span className="notification-type">{n.notification_type}</span><div className="notification-content"><b>{n.title}</b><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString()} {staff?'· '+(recipientMap[n.recipient_profile_id]?.display_name||n.recipient_profile_id):''}</small></div><div className="notification-actions"><span className={'notification-delivery-status '+n.delivery_status}>{n.delivery_status}</span>{!staff&&!n.read_at&&<button onClick={()=>void markRead(n)} title="Mark as read"><Check size={14}/></button>}{n.action_url&&<button onClick={()=>window.open(n.action_url,'_blank','noopener,noreferrer')} title="Open related page"><ExternalLink size={14}/></button>}</div></article>)}
   {!filtered.length&&<div className="notification-empty"><Bell/><b>No notifications yet</b><p>New updates will appear here.</p></div>}
  </div>
 </section>;
}
