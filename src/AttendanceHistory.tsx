import {useCallback,useEffect,useMemo,useState} from 'react';
import {CalendarCheck,RefreshCw,Users} from 'lucide-react';
import './attendance-history.css';
type Row=Record<string,any>;
type Profile={id:string;role:string};
export default function AttendanceHistory({client,profile}:{client:any;profile:Profile}){
 const parent=profile.role==='parent';
 const [children,setChildren]=useState<Row[]>([]),[childId,setChildId]=useState('');
 const [records,setRecords]=useState<Row[]>([]),[sessions,setSessions]=useState<Row[]>([]),[filter,setFilter]=useState('all'),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  let studentId=profile.id;
  if(parent){
   const {data:l,error}=await client.from('parent_student_links').select('student_profile_id').eq('parent_profile_id',profile.id);
   if(error){setNotice(error.message);return;}
   const ids=(l??[]).map((x:any)=>x.student_profile_id);
   if(!ids.length){setChildren([]);setRecords([]);setSessions([]);return;}
   const {data:p,error:pe}=await client.from('profiles').select('id,display_name').in('id',ids).order('display_name');
   if(pe){setNotice(pe.message);return;}setChildren(p??[]);
   if(!childId&&p?.length)setChildId(p[0].id);
   studentId=childId||ids[0];
  }
  const {data,error}=await client.from('attendance_records').select('*').eq('student_profile_id',studentId).order('marked_at',{ascending:false}).limit(200);
  if(error){setNotice(error.message);return;}
  setRecords(data??[]);const ids=[...new Set((data??[]).map((r:any)=>r.session_id))];
  const {data:s,error:se}=ids.length?await client.from('attendance_sessions').select('*').in('id',ids):{data:[],error:null};
  if(se){setNotice(se.message);return;}setSessions(s??[]);
 },[client,parent,profile.id,childId]);
 useEffect(()=>{void load();},[load]);
 const sessionMap=useMemo(()=>Object.fromEntries(sessions.map(s=>[s.id,s])),[sessions]);
 const shown=records.filter(r=>filter==='all'||r.status===filter);
 const count=(status:string)=>records.filter(r=>r.status===status).length;
 if(parent&&!children.length)return <section className="attendance-history"><div className="attendance-history-empty"><Users/><b>No linked student account</b><p>Your child's attendance will appear after the school links their profile to your parent account.</p></div></section>;
 return <section className="attendance-history"><div className="attendance-history-head"><div><span>STUDENT RECORD</span><h2>Attendance history</h2><p>Review attendance by session and date.</p></div><button onClick={()=>void load()}><RefreshCw size={14}/> Refresh</button></div>{notice&&<div className="attendance-history-notice">{notice}</div>}
  {parent&&<label className="attendance-history-child">Child<select value={childId} onChange={e=>setChildId(e.target.value)}>{children.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label>}
  <div className="attendance-history-stats">{['present','absent','late','excused'].map(s=><div key={s}><b>{count(s)}</b><span>{s}</span></div>)}</div>
  <div className="attendance-history-filters">{['all','present','absent','late','excused'].map(s=><button key={s} className={filter===s?'active':''} onClick={()=>setFilter(s)}>{s==='all'?'All':s[0].toUpperCase()+s.slice(1)}</button>)}</div>
  <div className="attendance-history-list">{shown.map(r=>{const session=sessionMap[r.session_id];return <article key={r.id}><div className="attendance-history-icon"><CalendarCheck size={16}/></div><div><b>{session?.title||'Class session'}</b><small>{session?.starts_at?new Date(session.starts_at).toLocaleString():new Date(r.marked_at).toLocaleString()}</small></div><span className={'attendance-history-status '+r.status}>{r.status}</span></article>;})}{!shown.length&&<div className="attendance-history-empty"><b>No attendance records</b><p>Records will appear after your teaching team marks a session.</p></div>}</div>
 </section>;
}
