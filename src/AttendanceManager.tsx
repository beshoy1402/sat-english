import {useCallback,useEffect,useMemo,useState} from 'react';
import {CalendarDays,Check,Clock3,RefreshCw,Search,Users} from 'lucide-react';
import './attendance-manager.css';

type Person={id:string;display_name:string;username:string|null};
type Session=Record<string,any>;
type Mark='present'|'absent'|'late'|'excused';
type Props={client:any;profile:{id:string}};
const statusLabel:Record<Mark,string>={present:'Present',absent:'Absent',late:'Late',excused:'Excused'};

export default function AttendanceManager({client,profile}:Props){
 const [sessions,setSessions]=useState<Session[]>([]),[students,setStudents]=useState<Person[]>([]);
 const [selected,setSelected]=useState<string>(''),[marks,setMarks]=useState<Record<string,Mark>>({});
 const [search,setSearch]=useState(''),[title,setTitle]=useState(''),[startsAt,setStartsAt]=useState(new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16));
 const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);
  const [s,p]=await Promise.all([
   client.from('attendance_sessions').select('*').order('starts_at',{ascending:false}).limit(100),
   client.from('profiles').select('id,display_name,username').eq('role','student').eq('is_active',true).order('display_name')
  ]);
  if(s.error||p.error){setNotice(s.error?.message||p.error?.message||'Unable to load attendance.');setLoading(false);return;}
  setSessions(s.data??[]);setStudents(p.data??[]);
  if(!selected&&s.data?.length)setSelected(s.data[0].id);
  setLoading(false);
 },[client,selected]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  let active=true;
  const fetchMarks=async()=>{
   if(!selected){setMarks({});return;}
   const {data,error}=await client.from('attendance_records').select('student_profile_id,status').eq('session_id',selected);
   if(!active)return;
   if(error){setNotice(error.message);return;}
   const next:Record<string,Mark>={};(data??[]).forEach((r:Row)=>next[r.student_profile_id]=r.status as Mark);setMarks(next);
  };
  void fetchMarks();return()=>{active=false;};
 },[client,selected]);
 const filtered=useMemo(()=>students.filter(s=>(s.display_name+' '+(s.username||'')).toLowerCase().includes(search.toLowerCase())),[students,search]);
 const totals=useMemo(()=>{const values=Object.values(marks);return {marked:values.length,present:values.filter(v=>v==='present').length,absent:values.filter(v=>v==='absent').length,late:values.filter(v=>v==='late').length,excused:values.filter(v=>v==='excused').length};},[marks]);
 const createSession=async(e:React.FormEvent)=>{
  e.preventDefault();setSaving(true);
  const {data,error}=await client.from('attendance_sessions').insert({title:title.trim(),starts_at:new Date(startsAt).toISOString(),method:'manual',created_by:profile.id}).select('*').single();
  if(error)setNotice(error.message);else{setNotice('Attendance session created.');setTitle('');await load();setSelected(data.id);}
  setSaving(false);
 };
 const saveMarks=async()=>{
  if(!selected){setNotice('Choose an attendance session first.');return;}
  const records=Object.entries(marks).map(([student_profile_id,status])=>({session_id:selected,student_profile_id,status,marked_by:profile.id,marked_at:new Date().toISOString()}));
  if(!records.length){setNotice('Mark at least one student before saving.');return;}
  setSaving(true);const {error}=await client.from('attendance_records').upsert(records,{onConflict:'session_id,student_profile_id'});
  setNotice(error?.message||'Attendance saved successfully.');setSaving(false);
 };
 const setAll=(status:Mark)=>setMarks(Object.fromEntries(students.map(s=>[s.id,status])));
 const current=sessions.find(s=>s.id===selected);
 return <section className="attendance-manager">
  <div className="attendance-heading"><div><span className="attendance-eyebrow">CLASS OPERATIONS</span><h2>Attendance</h2><p>Create class sessions and record each student's attendance.</p></div><button onClick={()=>void load()} className="attendance-refresh"><RefreshCw size={15}/> Refresh</button></div>
  {notice&&<div className="attendance-notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
  <div className="attendance-layout">
   <aside className="attendance-sessions">
    <h3><CalendarDays size={16}/> Sessions</h3>
    <form onSubmit={createSession} className="attendance-create">
     <label>Session title<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. SAT English — Reading"/></label>
     <label>Date and time<input required type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)}/></label>
     <button disabled={saving}>{saving?'Creating…':'Create session'}</button>
    </form>
    <div className="attendance-session-list">{sessions.map(s=><button key={s.id} onClick={()=>setSelected(s.id)} className={selected===s.id?'selected':''}><b>{s.title}</b><small>{new Date(s.starts_at).toLocaleString()}</small></button>)}{!sessions.length&&<p>No sessions created yet.</p>}</div>
   </aside>
   <div className="attendance-roster">
    {current?<><div className="attendance-roster-head"><div><span>SELECTED SESSION</span><h3>{current.title}</h3><small>{new Date(current.starts_at).toLocaleString()}</small></div><button onClick={saveMarks} disabled={saving||totals.marked===0}><Check size={15}/>{saving?'Saving…':'Save attendance'}</button></div>
     <div className="attendance-summary"><div><b>{totals.marked}/{students.length}</b><span>Marked</span></div><div><b>{totals.present}</b><span>Present</span></div><div><b>{totals.absent}</b><span>Absent</span></div><div><b>{totals.late}</b><span>Late</span></div><div><b>{totals.excused}</b><span>Excused</span></div></div>
     <div className="attendance-tools"><div><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search students"/></div><span>Quick mark:</span><button onClick={()=>setAll('present')}>All present</button><button onClick={()=>setAll('absent')}>All absent</button></div>
     <div className="attendance-student-list">{filtered.map(s=><article key={s.id}><div className="attendance-person"><span>{(s.display_name||s.username||'S')[0].toUpperCase()}</span><div><b>{s.display_name||'Unnamed student'}</b><small>@{s.username||'student'}</small></div></div><div className="attendance-statuses">{(['present','absent','late','excused'] as Mark[]).map(status=><button key={status} onClick={()=>setMarks(old=>({...old,[s.id]:status}))} className={marks[s.id]===status?'active '+status:''}>{statusLabel[status]}</button>)}</div></article>)}{!filtered.length&&<div className="attendance-empty"><Users/><p>No students match your search.</p></div>}</div>
    </>:<div className="attendance-empty attendance-no-session"><Clock3/><b>Select or create a session</b><p>Choose a session to see its student roster and record attendance.</p></div>}
   </div>
  </div>
 </section>;
}
type Row=Record<string,any>;
