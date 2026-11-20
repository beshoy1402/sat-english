import {useCallback,useEffect,useMemo,useState} from 'react';
import {BookOpen,CalendarCheck,Download,FileCheck2,GraduationCap,RefreshCw,Users} from 'lucide-react';
import './parent-dashboard.css';

type Row=Record<string,any>;
type Profile={id:string;display_name?:string};
type Props={client:any;profile:Profile};
export default function ParentDashboard({client,profile}:Props){
 const [children,setChildren]=useState<Row[]>([]),[childId,setChildId]=useState('');
 const [grades,setGrades]=useState<Row[]>([]),[attendance,setAttendance]=useState<Row[]>([]),[sessions,setSessions]=useState<Row[]>([]);
 const [courses,setCourses]=useState<Row[]>([]),[lessons,setLessons]=useState<Row[]>([]),[attempts,setAttempts]=useState<Row[]>([]);
 const [exams,setExams]=useState<Row[]>([]),[assignments,setAssignments]=useState<Row[]>([]),[submissions,setSubmissions]=useState<Row[]>([]);
 const [loading,setLoading]=useState(false),[notice,setNotice]=useState('');
 const loadChildren=useCallback(async()=>{
  const {data,error}=await client.from('parent_student_links').select('student_profile_id,relationship').eq('parent_profile_id',profile.id);
  if(error){setNotice(error.message);return;}
  const ids=(data??[]).map((r:any)=>r.student_profile_id);
  if(!ids.length){setChildren([]);setChildId('');return;}
  const {data:p,error:pe}=await client.from('profiles').select('id,display_name,username,created_at').in('id',ids).order('display_name');
  if(pe){setNotice(pe.message);return;}setChildren(p??[]);
  if(!childId&&p?.length)setChildId(p[0].id);
 },[client,profile.id,childId]);
 useEffect(()=>{void loadChildren();},[loadChildren]);
 const load=useCallback(async()=>{
  if(!childId)return;setLoading(true);setNotice('');
  const [g,a,ca,at,t]=await Promise.all([
   client.from('grade_entries').select('*').eq('student_profile_id',childId).order('grade_date',{ascending:false}).limit(100),
   client.from('attendance_records').select('*').eq('student_profile_id',childId).order('marked_at',{ascending:false}).limit(100),
   client.from('course_access').select('*').eq('student_profile_id',childId),
   client.from('exam_attempts').select('*').eq('student_profile_id',childId).order('started_at',{ascending:false}).limit(50),
   client.from('assignment_targets').select('assignment_id').eq('student_profile_id',childId)
  ]);
  const err=g.error||a.error||ca.error||at.error||t.error;if(err){setNotice(err.message);setLoading(false);return;}
  setGrades(g.data??[]);setAttendance(a.data??[]);setAttempts(at.data??[]);
  const sessionIds=[...new Set((a.data??[]).map((r:any)=>r.session_id))];
  const courseIds=[...new Set((ca.data??[]).map((r:any)=>r.course_id))];
  const assignmentIds=[...new Set((t.data??[]).map((r:any)=>r.assignment_id))];
  const [ss,cs,ls,es,as,subs]=await Promise.all([
   sessionIds.length?client.from('attendance_sessions').select('*').in('id',sessionIds):Promise.resolve({data:[],error:null}),
   courseIds.length?client.from('courses').select('*').in('id',courseIds):Promise.resolve({data:[],error:null}),
   courseIds.length?client.from('lessons').select('id,course_id,is_published').in('course_id',courseIds):Promise.resolve({data:[],error:null}),
   at.data?.length?client.from('exams').select('id,title,exam_program').in('id',[...new Set(at.data.map((r:any)=>r.exam_id))]):Promise.resolve({data:[],error:null}),
   assignmentIds.length?client.from('assignments').select('*').in('id',assignmentIds):Promise.resolve({data:[],error:null}),
   client.from('submissions').select('*').eq('student_profile_id',childId).order('submitted_at',{ascending:false}).limit(100)
  ]);
  const secondError=ss.error||cs.error||ls.error||es.error||as.error||subs.error;if(secondError){setNotice(secondError.message);setLoading(false);return;}
  setSessions(ss.data??[]);setCourses(cs.data??[]);setLessons(ls.data??[]);setExams(es.data??[]);setAssignments(as.data??[]);setSubmissions(subs.data??[]);
  setLoading(false);
 },[client,childId]);
 useEffect(()=>{void load();},[load]);
 const child=children.find(c=>c.id===childId);
 const scoreGrades=grades.filter(g=>g.entry_type==='score');
 const average=scoreGrades.reduce((n,g)=>n+Number(g.value),0),possible=scoreGrades.reduce((n,g)=>n+Number(g.max_value),0);
 const attendanceRate=attendance.length?Math.round(attendance.filter(a=>a.status==='present'||a.status==='late').length/attendance.length*100):0;
 const sessionMap=useMemo(()=>Object.fromEntries(sessions.map(s=>[s.id,s])),[sessions]);
 const examMap=useMemo(()=>Object.fromEntries(exams.map(e=>[e.id,e])),[exams]);
 const courseLessons=(id:string)=>lessons.filter(l=>l.course_id===id&&l.is_published).length;
 const exportCsv=()=>{
  const rows=[['Report for',child?.display_name||'Student'],['Generated',new Date().toLocaleString()],[],['Grades'],['Date','Category','Title','Score','Maximum','Notes'],...grades.map(g=>[g.grade_date,g.category,g.title,g.value,g.max_value??'',g.notes??'']),[],['Attendance'],['Session','Date','Status'],...attendance.map(a=>[sessionMap[a.session_id]?.title??'Class',sessionMap[a.session_id]?.starts_at??a.marked_at,a.status]),[],['Courses'],['Course','Status','Published lessons'],...courses.map(c=>[c.title,c.status,courseLessons(c.id)]),[],['Exams'],['Exam','Status','Score','Maximum','Submitted'],...attempts.map(a=>[examMap[a.exam_id]?.title??'Exam',a.status,a.score??'Awaiting review',a.max_score??'',a.submitted_at??'']),[],['Homework'],['Assignment','Submitted','Score','Feedback'],...assignments.map(a=>{const s=submissions.find(x=>x.assignment_id===a.id);return[a.title,s?.submitted_at??'Not submitted',s?.score??'',s?.feedback??''];})];
  const csv=rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const link=document.createElement('a');link.href=url;link.download=(child?.display_name||'student').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-academic-report.csv';link.click();URL.revokeObjectURL(url);
 };
 if(!children.length)return <section className="parent-dashboard"><div className="parent-empty"><Users/><h2>No linked students yet</h2><p>Your child's account must be linked to your parent account by the school administrator or teaching team. Once linked, their grades, attendance and progress will appear here.</p></div></section>;
 return <section className="parent-dashboard"><div className="parent-heading"><div><span>FAMILY PORTAL</span><h2>Learning overview</h2><p>Monitor your child's academic progress, attendance, exams and homework.</p></div><div><button onClick={()=>void load()}><RefreshCw size={14}/> Refresh</button><button onClick={exportCsv} disabled={!child}><Download size={14}/> Export report</button><button onClick={()=>window.print()}>Print / PDF</button></div></div>
  {notice&&<div className="parent-notice">{notice}</div>}
  <label className="parent-child-picker">Student<select value={childId} onChange={e=>setChildId(e.target.value)}>{children.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label>
  {child&&<><div className="parent-student-banner"><div className="parent-avatar">{(child.display_name||'S')[0].toUpperCase()}</div><div><span>STUDENT PROFILE</span><h3>{child.display_name}</h3><small>@{child.username}</small></div><div className="parent-student-meta"><span>{courses.length} courses</span><span>{attempts.length} exam attempts</span><span>{assignments.length} assignments</span></div></div>
   <div className="parent-stats"><article><span>Grade average</span><b>{possible?Math.round(average/possible*100)+'%':'—'}</b><small>{scoreGrades.length} graded entries</small></article><article><span>Attendance</span><b>{attendance.length?attendanceRate+'%':'—'}</b><small>{attendance.length} recorded sessions</small></article><article><span>Exam attempts</span><b>{attempts.length}</b><small>{attempts.filter(a=>a.status==='submitted').length} submitted</small></article><article><span>Homework</span><b>{submissions.length}/{assignments.length}</b><small>submitted assignments</small></article></div>
   <div className="parent-content-grid"><section className="parent-panel"><h3><GraduationCap size={16}/> Course progress</h3>{courses.map(c=><article key={c.id}><div><b>{c.title}</b><small>{c.exam_program} · {c.status}</small></div><span>{courseLessons(c.id)} lessons</span></article>)}{!courses.length&&<p>No active course access has been granted yet.</p>}</section>
    <section className="parent-panel"><h3><CalendarCheck size={16}/> Recent attendance</h3>{attendance.slice(0,8).map(a=><article key={a.id}><div><b>{sessionMap[a.session_id]?.title||'Class session'}</b><small>{dateFmt(sessionMap[a.session_id]?.starts_at||a.marked_at)}</small></div><span className={'parent-status '+a.status}>{a.status}</span></article>)}{!attendance.length&&<p>No attendance records yet.</p>}</section>
    <section className="parent-panel"><h3><FileCheck2 size={16}/> Exam results</h3>{attempts.slice(0,8).map(a=><article key={a.id}><div><b>{examMap[a.exam_id]?.title||'English exam'}</b><small>{a.submitted_at?dateFmt(a.submitted_at):'In progress'}</small></div><span>{a.manual_review_required?'Awaiting review':a.score!==null?a.score+'/'+a.max_score:pretty(a.status)}</span></article>)}{!attempts.length&&<p>No exam attempts yet.</p>}</section>
    <section className="parent-panel"><h3><BookOpen size={16}/> Homework and teacher feedback</h3>{assignments.map(a=>{const s=submissions.find(x=>x.assignment_id===a.id);return <article key={a.id}><div><b>{a.title}</b><small>{s?.submitted_at?'Submitted '+dateFmt(s.submitted_at):'Not submitted'}</small>{s?.feedback&&<p>{s.feedback}</p>}</div><span>{s?.reviewed_at?'Reviewed':s?'Submitted':'Assigned'}</span></article>;})}{!assignments.length&&<p>No assignments yet.</p>}</section>
    <section className="parent-panel parent-wide"><h3>Recent grades</h3><div className="parent-table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Assessment</th><th>Result</th><th>Notes</th></tr></thead><tbody>{grades.slice(0,12).map(g=><tr key={g.id}><td>{g.grade_date}</td><td>{pretty(g.category)}</td><td>{g.title}</td><td>{g.entry_type==='adjustment'?(g.value>0?'+':'')+g.value:g.value+'/'+g.max_value}</td><td>{g.notes||'—'}</td></tr>)}</tbody></table></div>{!grades.length&&<p>No grades recorded yet.</p>}</section>
   </div>
  </>}
 </section>;
}
function dateFmt(v:string){return v?new Date(v).toLocaleString():'—';}
function pretty(s:string){return s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}
