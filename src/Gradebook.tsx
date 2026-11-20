import {useCallback,useEffect,useMemo,useState} from 'react';
import {BookOpen,CalendarDays,Edit3,History,Plus,RefreshCw,Search,Trash2,X} from 'lucide-react';
import './gradebook.css';

type Student={id:string;display_name:string;username:string|null};
type Grade=Record<string,any>;
type Props={client:any;profile:{id:string}};
const categories=['participation','attendance','homework','quiz','exam','custom'];
const emptyForm={student_profile_id:'',category:'participation',entry_type:'score',title:'',value:'',max_value:'10',grade_date:new Date().toISOString().slice(0,10),notes:''};
const pretty=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function Gradebook({client,profile}:Props){
 const [students,setStudents]=useState<Student[]>([]),[grades,setGrades]=useState<Grade[]>([]),[history,setHistory]=useState<Grade[]>([]);
 const [form,setForm]=useState({...emptyForm}),[editing,setEditing]=useState<string|null>(null),[selectedStudent,setSelectedStudent]=useState('');
 const [search,setSearch]=useState(''),[categoryFilter,setCategoryFilter]=useState('all'),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  const [p,g]=await Promise.all([
   client.from('profiles').select('id,display_name,username').eq('role','student').eq('is_active',true).order('display_name'),
   client.from('grade_entries').select('*').order('grade_date',{ascending:false}).limit(500)
  ]);
  if(p.error||g.error){setNotice(p.error?.message||g.error?.message||'Unable to load gradebook.');return;}
  setStudents(p.data??[]);setGrades(g.data??[]);
  if(!selectedStudent&&p.data?.length)setSelectedStudent(p.data[0].id);
 },[client,selectedStudent]);
 useEffect(()=>{void load();},[load]);
 const loadHistory=useCallback(async()=>{
  if(!selectedStudent){setHistory([]);return;}
  const {data,error}=await client.from('grade_entry_history').select('*').eq('student_profile_id',selectedStudent).order('created_at',{ascending:false}).limit(100);
  if(error){setNotice(error.message);return;}setHistory(data??[]);
 },[client,selectedStudent]);
 useEffect(()=>{void loadHistory();},[loadHistory,grades]);
 const filtered=useMemo(()=>grades.filter(g=>(!selectedStudent||g.student_profile_id===selectedStudent)&&(categoryFilter==='all'||g.category===categoryFilter)&&JSON.stringify(g).toLowerCase().includes(search.toLowerCase())),[grades,selectedStudent,categoryFilter,search]);
 const summary=useMemo(()=>{const list=grades.filter(g=>g.student_profile_id===selectedStudent);const scores=list.filter(g=>g.entry_type==='score');return {count:list.length,adjustments:list.filter(g=>g.entry_type==='adjustment').reduce((n,g)=>n+Number(g.value),0),earned:scores.reduce((n,g)=>n+Number(g.value),0),possible:scores.reduce((n,g)=>n+Number(g.max_value),0)};},[grades,selectedStudent]);
 const reset=()=>{setForm({...emptyForm,student_profile_id:selectedStudent});setEditing(null);};
 const save=async(e:React.FormEvent)=>{
  e.preventDefault();if(!form.student_profile_id){setNotice('Select a student.');return;}
  const value=Number(form.value),max=form.entry_type==='score'?Number(form.max_value):null;
  if(!Number.isFinite(value)||form.value===''){setNotice('Enter a valid numeric value.');return;}
  if(form.entry_type==='score'&&(!Number.isFinite(max)||max===null||max<=0||value<0||value>max)){setNotice('Score must be between zero and the maximum score.');return;}
  setBusy(true);
  const payload={student_profile_id:form.student_profile_id,category:form.category,title:form.title.trim(),entry_type:form.entry_type,value,max_value:max,grade_date:form.grade_date,notes:form.notes,recorded_by:profile.id,updated_at:new Date().toISOString()};
  const {error}=editing?await client.from('grade_entries').update(payload).eq('id',editing):await client.from('grade_entries').insert(payload);
  setNotice(error?.message||(editing?'Grade updated. History recorded.':'Grade added. History recorded.'));
  if(!error){reset();await load();}
  setBusy(false);
 };
 const edit=(g:Grade)=>{setEditing(g.id);setSelectedStudent(g.student_profile_id);setForm({student_profile_id:g.student_profile_id,category:g.category,entry_type:g.entry_type,title:g.title,value:String(g.value),max_value:g.max_value===null?'':String(g.max_value),grade_date:g.grade_date,notes:g.notes||''});};
 const remove=async(g:Grade)=>{
  if(!window.confirm('Delete this grade entry? The deletion will remain in the grade history.'))return;
  setBusy(true);const {error}=await client.from('grade_entries').delete().eq('id',g.id);
  setNotice(error?.message||'Grade deleted. Deletion recorded in history.');if(!error)await load();setBusy(false);
 };
 const student=students.find(s=>s.id===selectedStudent);
 return <section className="gradebook">
  <div className="gradebook-heading"><div><span>ACADEMIC PERFORMANCE</span><h2>Gradebook</h2><p>Record daily participation, attendance, homework, quizzes and exam scores.</p></div><button onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div>
  {notice&&<div className="gradebook-notice">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
  <div className="gradebook-student-bar"><label>Student<select value={selectedStudent} onChange={e=>{setSelectedStudent(e.target.value);reset();}}><option value="">Choose student</option>{students.map(s=><option key={s.id} value={s.id}>{s.display_name} {s.username?'(@'+s.username+')':''}</option>)}</select></label><div className="gradebook-stats"><div><b>{summary.count}</b><span>Entries</span></div><div><b>{summary.adjustments>0?'+':''}{summary.adjustments}</b><span>Adjustments</span></div><div><b>{summary.possible?Math.round(summary.earned/summary.possible*100)+'%':'—'}</b><span>Score average</span></div></div></div>
  <div className="gradebook-layout">
   <form className="gradebook-form" onSubmit={save}><h3>{editing?<Edit3 size={16}/>:<Plus size={16}/>} {editing?'Edit grade entry':'Add grade entry'}</h3>
    <label>Student<select required value={form.student_profile_id} onChange={e=>setForm({...form,student_profile_id:e.target.value})}><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{s.display_name}</option>)}</select></label>
    <label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c} value={c}>{pretty(c)}</option>)}</select></label>
    <label>Entry type<select value={form.entry_type} onChange={e=>setForm({...form,entry_type:e.target.value})}><option value="score">Score</option><option value="adjustment">Points adjustment (+ / −)</option></select></label>
    <label>Title<input required maxLength={180} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Reading quiz 4"/></label>
    <div className="gradebook-number-row"><label>{form.entry_type==='adjustment'?'Points (+ / −)':'Score'}<input required type="number" step="0.25" value={form.value} onChange={e=>setForm({...form,value:e.target.value})}/></label>{form.entry_type==='score'&&<label>Out of<input required type="number" min="0.01" step="0.25" value={form.max_value} onChange={e=>setForm({...form,max_value:e.target.value})}/></label>}</div>
    <label>Date<input type="date" required value={form.grade_date} onChange={e=>setForm({...form,grade_date:e.target.value})}/></label>
    <label>Notes<textarea rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Optional feedback or context"/></label>
    <div className="gradebook-form-actions"><button disabled={busy||!students.length}>{busy?'Saving…':editing?'Save changes':'Add entry'}</button>{editing&&<button type="button" className="secondary" onClick={reset}>Cancel</button>}</div>
   </form>
   <div className="gradebook-records">
    <div className="gradebook-record-head"><div><h3><BookOpen size={16}/> {student?.display_name||'Student records'}</h3><small>Grades and adjustments</small></div><div className="gradebook-filters"><div><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search"/></div><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="all">All categories</option>{categories.map(c=><option key={c} value={c}>{pretty(c)}</option>)}</select></div></div>
    <div className="gradebook-table-wrap"><table className="gradebook-table"><thead><tr><th>Date</th><th>Category</th><th>Assessment</th><th>Result</th><th>Notes</th><th></th></tr></thead><tbody>{filtered.map(g=><tr key={g.id}><td>{new Date(g.grade_date+'T00:00:00').toLocaleDateString()}</td><td>{pretty(g.category)}</td><td>{g.title}</td><td className={g.entry_type==='adjustment'?'adjustment-value':''}>{g.entry_type==='adjustment'?(Number(g.value)>0?'+':'')+g.value:Number(g.value)+' / '+g.max_value}</td><td>{g.notes||'—'}</td><td><div className="gradebook-row-actions"><button onClick={()=>edit(g)} title="Edit"><Edit3 size={14}/></button><button onClick={()=>void remove(g)} title="Delete"><Trash2 size={14}/></button></div></td></tr>)}</tbody></table>{!filtered.length&&<div className="gradebook-empty">No grade entries for this student yet.</div>}</div>
    <div className="gradebook-history"><h4><History size={15}/> Grade history</h4>{history.slice(0,12).map(h=><div key={h.id}><span>{pretty(h.action)}</span><small>{new Date(h.created_at).toLocaleString()}</small><small>{h.actor_profile_id===profile.id?'You':'Staff member'}</small></div>)}{!history.length&&<p>Changes to this student's grades will appear here.</p>}</div>
   </div>
  </div>
 </section>;
}
