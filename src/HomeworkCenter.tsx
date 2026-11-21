import {useCallback,useEffect,useMemo,useState} from 'react';
import {ClipboardList,Clock3,Download,MessageSquare,Plus,RefreshCw,Send,Upload,X} from 'lucide-react';
import './homework-center.css';

type Row=Record<string,any>;
type Profile={id:string;display_name?:string;role:string};
type Props={client:any;profile:Profile;view?:'assignments'|'submissions'};
const programs=['SAT English','EST English','ACT English'];
const date=(v?:string)=>v?new Date(v).toLocaleString():'No deadline';
const pretty=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function HomeworkCenter({client,profile,view='assignments'}:Props){
 const staff=['admin','teacher','assistant'].includes(profile.role),parent=profile.role==='parent';
 const [assignments,setAssignments]=useState<Row[]>([]),[students,setStudents]=useState<Row[]>([]),[children,setChildren]=useState<Row[]>([]),[submissions,setSubmissions]=useState<Row[]>([]);
 const [selectedChild,setSelectedChild]=useState(''),[selectedStudents,setSelectedStudents]=useState<string[]>([]);
 const [title,setTitle]=useState(''),[instructions,setInstructions]=useState(''),[program,setProgram]=useState('SAT English'),[dueAt,setDueAt]=useState(''),[published,setPublished]=useState(true),[late,setLate]=useState(false);
 const [answer,setAnswer]=useState(''),[files,setFiles]=useState<File[]>([]),[activeAssignment,setActiveAssignment]=useState<Row|null>(null);
 const [reviewing,setReviewing]=useState<Row|null>(null),[score,setScore]=useState(''),[feedback,setFeedback]=useState(''),[aiDraft,setAiDraft]=useState<Row|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  if(staff){
   const [a,s,t]=await Promise.all([
    client.from('assignments').select('*').order('created_at',{ascending:false}),
    client.from('profiles').select('id,display_name,username').eq('role','student').eq('is_active',true).order('display_name'),
    client.from('submissions').select('*').order('submitted_at',{ascending:false}).limit(500)
   ]);
   const err=a.error||s.error||t.error;if(err){setNotice(err.message);return;}
   setAssignments(a.data??[]);setStudents(s.data??[]);setSubmissions(t.data??[]);
  }else if(parent){
   const {data:l,error:le}=await client.from('parent_student_links').select('student_profile_id,relationship').eq('parent_profile_id',profile.id);
   if(le){setNotice(le.message);return;}
   const ids=(l??[]).map((x:any)=>x.student_profile_id);
   if(!ids.length){setChildren([]);setAssignments([]);setSubmissions([]);return;}
   const [p,t]=await Promise.all([
    client.from('profiles').select('id,display_name,username').in('id',ids).order('display_name'),
    client.from('assignment_targets').select('assignment_id,student_profile_id').in('student_profile_id',ids)
   ]);
   if(p.error||t.error){setNotice(p.error?.message||t.error?.message);return;}
   setChildren(p.data??[]);if(!selectedChild&&p.data?.length)setSelectedChild(p.data[0].id);
   const targetRows=t.data??[];const childTargets=selectedChild?targetRows.filter((x:any)=>x.student_profile_id===selectedChild):targetRows;
   const assignmentIds=[...new Set(childTargets.map((x:any)=>x.assignment_id))];
   if(!assignmentIds.length){setAssignments([]);setSubmissions([]);return;}
   const [a,sub]=await Promise.all([
    client.from('assignments').select('*').in('id',assignmentIds).order('created_at',{ascending:false}),
    client.from('submissions').select('*').in('student_profile_id',selectedChild?[selectedChild]:ids).order('submitted_at',{ascending:false})
   ]);
   if(a.error||sub.error){setNotice(a.error?.message||sub.error?.message);return;}
   setAssignments(a.data??[]);setSubmissions(sub.data??[]);
  }else{
   const [t,a]=await Promise.all([
    client.from('assignment_targets').select('assignment_id').eq('student_profile_id',profile.id),
    client.from('submissions').select('*').eq('student_profile_id',profile.id).order('submitted_at',{ascending:false})
   ]);
   if(t.error||a.error){setNotice(t.error?.message||a.error?.message);return;}
   const ids=(t.data??[]).map((x:any)=>x.assignment_id);
   const {data,error}=ids.length?await client.from('assignments').select('*').in('id',ids).order('created_at',{ascending:false}):{data:[],error:null};
   if(error){setNotice(error.message);return;}setAssignments(data??[]);setSubmissions(a.data??[]);
  }
 },[client,staff,parent,profile.id,selectedChild]);
 useEffect(()=>{void load();},[load]);
 const submissionByAssignment=useMemo(()=>Object.fromEntries(submissions.map(s=>[s.assignment_id,s])),[submissions]);
 const create=async(e:React.FormEvent)=>{
  e.preventDefault();if(!selectedStudents.length){setNotice('Select at least one student.');return;}
  setBusy(true);
  const {data,error}=await client.from('assignments').insert({title:title.trim(),instructions,exam_program:program,status:published?'published':'draft',due_at:dueAt?new Date(dueAt).toISOString():null,allow_late_submission:late,created_by:profile.id}).select('*').single();
  if(error){setNotice(error.message);setBusy(false);return;}
  const targets=selectedStudents.map(student_profile_id=>({assignment_id:data.id,student_profile_id,assigned_by:profile.id}));
  const {error:te}=await client.from('assignment_targets').insert(targets);
  if(te){await client.from('assignments').delete().eq('id',data.id);setNotice(te.message);}else{setNotice('Homework created and assigned to '+selectedStudents.length+' students.');setTitle('');setInstructions('');setDueAt('');setSelectedStudents([]);await load();}
  setBusy(false);
 };
 const changeStatus=async(a:Row,status:string)=>{
  setBusy(true);const {error}=await client.from('assignments').update({status,updated_at:new Date().toISOString()}).eq('id',a.id);
  setNotice(error?.message||'Homework status updated.');if(!error)await load();setBusy(false);
 };
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(!activeAssignment)return;
  setBusy(true);const paths:string[]=[];
  for(const file of files){
   if(file.size>25*1024*1024){setNotice('Each file must be 25 MB or smaller.');setBusy(false);return;}
   const path=profile.id+'/'+activeAssignment.id+'/'+crypto.randomUUID()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
   const {error}=await client.storage.from('homework-submissions').upload(path,file,{upsert:false});
   if(error){setNotice(error.message);setBusy(false);return;}paths.push(path);
  }
  const old=submissionByAssignment[activeAssignment.id];
  const {error}=await client.from('submissions').upsert({assignment_id:activeAssignment.id,student_profile_id:profile.id,answer_text:answer.trim()||null,file_paths:[...(old?.file_paths??[]),...paths],submitted_at:new Date().toISOString(),score:null,feedback:null,reviewed_by:null,reviewed_at:null},{onConflict:'assignment_id,student_profile_id'});
  setNotice(error?.message||'Homework submitted successfully.');if(!error){setActiveAssignment(null);setAnswer('');setFiles([]);await load();}setBusy(false);
 };
 const generateAiDraft=async()=>{
  if(!reviewing)return;
  setBusy(true);setAiDraft(null);
  const {data,error}=await client.functions.invoke('ai-learning',{body:{action:'homework_review',submission_id:reviewing.id}});
  if(error||data?.error)setNotice(data?.error||error?.message||'AI review could not be generated.');
  else{
   setAiDraft(data.draft);
   setScore(data.draft?.score_suggestion===null?'':String(data.draft.score_suggestion));
   setFeedback([data.draft?.feedback_suggestion||'',...(data.draft?.strengths?.length?['Strengths: '+data.draft.strengths.join('; ')]:[]),...(data.draft?.improvements?.length?['Improvements: '+data.draft.improvements.join('; ')]:[])].filter(Boolean).join('\n\n'));
   setNotice('AI review draft generated. Check it carefully before saving a final grade.');
  }
  setBusy(false);
 };
 const review=async(e:React.FormEvent)=>{
  e.preventDefault();if(!reviewing)return;const n=Number(score);if(!Number.isFinite(n)||n<0){setNotice('Enter a valid non-negative score.');return;}
  setBusy(true);const {error}=await client.from('submissions').update({score:n,feedback,reviewed_by:profile.id,reviewed_at:new Date().toISOString()}).eq('id',reviewing.id);
  setNotice(error?.message||'Submission reviewed and feedback saved.');if(!error){setReviewing(null);setScore('');setFeedback('');setAiDraft(null);await load();}setBusy(false);
 };
 const openFile=async(path:string)=>{
  const popup=window.open('about:blank','_blank');
  if(!popup){setNotice('Allow pop-ups to open submitted files, then try again.');return;}
  popup.opener=null;
  const {data,error}=await client.storage.from('homework-submissions').createSignedUrl(path,60);
  if(error||!data?.signedUrl){popup.close();setNotice(error?.message||'Could not create a secure file link.');return;}
  popup.location.href=data.signedUrl;
 };
 const studentName=(id:string)=>students.find(s=>s.id===id)?.display_name||children.find(s=>s.id===id)?.display_name||'Student';
 const isLate=(a:Row)=>a.due_at&&new Date(a.due_at).getTime()<Date.now();
 const canSubmit=(a:Row)=>a.status==='published'&&(!isLate(a)||a.allow_late_submission)&&(!submissionByAssignment[a.id]?.reviewed_at);
 return <section className="homework-center">
  <div className="homework-heading"><div><span>LEARNING OPERATIONS</span><h2>{staff?(view==='submissions'?'Homework review':'Homework'):parent?'Homework monitoring':'My homework'}</h2><p>{staff?'Assign work, track submissions and provide feedback.':parent?'Follow your linked child’s assignments and teacher feedback.':'View assigned tasks, submit your work and check teacher feedback.'}</p></div><button onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div>
  {notice&&<div className="homework-notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
  {parent&&children.length>0&&<label className="homework-child-select">Child<select value={selectedChild} onChange={e=>setSelectedChild(e.target.value)}>{children.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label>}
  {staff&&view==='assignments'&&<div className="homework-staff-grid"><form className="homework-create" onSubmit={create}><h3><Plus size={16}/> Create homework</h3><label>Title<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Instructions<textarea rows={4} value={instructions} onChange={e=>setInstructions(e.target.value)}/></label><div className="homework-form-row"><label>Program<select value={program} onChange={e=>setProgram(e.target.value)}>{programs.map(p=><option key={p}>{p}</option>)}</select></label><label>Due date<input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label></div><label className="homework-check"><input type="checkbox" checked={late} onChange={e=>setLate(e.target.checked)}/> Allow late submissions</label><label className="homework-check"><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/> Publish immediately</label><div className="homework-student-select"><div><b>Assign students</b><button type="button" onClick={()=>setSelectedStudents(students.map(s=>s.id))}>Select all</button><button type="button" onClick={()=>setSelectedStudents([])}>Clear</button></div>{students.map(s=><label key={s.id}><input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={e=>setSelectedStudents(old=>e.target.checked?[...old,s.id]:old.filter(id=>id!==s.id))}/>{s.display_name}</label>)}</div><button className="homework-primary" disabled={busy||!selectedStudents.length}>Create and assign</button></form>
   <div className="homework-list"><h3><ClipboardList size={16}/> Assignment list ({assignments.length})</h3>{assignments.map(a=><article key={a.id}><div><b>{a.title}</b><small>{a.exam_program} · Due {date(a.due_at)} · {submissions.filter(s=>s.assignment_id===a.id).length} submissions</small></div><div><span className={'homework-status '+a.status}>{pretty(a.status)}</span><button onClick={()=>void changeStatus(a,a.status==='published'?'closed':'published')}>{a.status==='published'?'Close':'Publish'}</button></div></article>)}{!assignments.length&&<p>No homework created yet.</p>}</div>
  </div>}
  {staff&&view==='submissions'&&<div className="homework-review-list"><h3><MessageSquare size={16}/> Student submissions ({submissions.length})</h3>{submissions.map(s=><article key={s.id}><div><b>{studentName(s.student_profile_id)}</b><small>{assignments.find(a=>a.id===s.assignment_id)?.title||'Homework'} · Submitted {date(s.submitted_at)}</small><p>{s.answer_text||'File submission'}</p>{(s.file_paths??[]).map((path:string)=><button className="homework-file" key={path} onClick={()=>void openFile(path)}><Download size={13}/>{path.split('/').at(-1)}</button>)}</div><div className="homework-review-side">{s.reviewed_at?<span className="homework-reviewed">Reviewed · {s.score??'—'}</span>:<span className="homework-pending">Needs review</span>}<button onClick={()=>{setReviewing(s);setScore(s.score===null?'':String(s.score));setFeedback(s.feedback||'');setAiDraft(null);}}>Review</button></div></article>)}{!submissions.length&&<p>No submissions received yet.</p>}</div>}
  {!staff&&<div className="homework-student-list">{assignments.map(a=>{const sub=submissionByAssignment[a.id];return <article key={a.id}><div className="homework-card-head"><span className="homework-program">{a.exam_program}</span><span className={'homework-status '+(sub?.reviewed_at?'reviewed':sub?'submitted':isLate(a)?'late':'published')}>{sub?.reviewed_at?'Reviewed':sub?'Submitted':isLate(a)?'Past due':'Assigned'}</span></div><h3>{a.title}</h3><p>{a.instructions||'Complete the assigned work and submit your response.'}</p><small><Clock3 size={13}/> Due {date(a.due_at)}</small>{sub?.reviewed_at&&<div className="homework-feedback"><b>Score: {sub.score??'—'}</b><p>{sub.feedback||'Your teacher has reviewed this submission.'}</p></div>}{sub&&!sub.reviewed_at&&<p className="homework-submitted-note">Submitted {date(sub.submitted_at)} · Waiting for teacher review</p>}{!parent&&canSubmit(a)&&<button className="homework-primary" onClick={()=>{setActiveAssignment(a);setAnswer(sub?.answer_text||'');setFiles([]);}}>{sub?'Update submission':'Submit homework'}</button>}{!parent&&!canSubmit(a)&&!sub&&<small className="homework-locked">This homework is not currently accepting submissions.</small>}</article>;})}{!assignments.length&&<div className="homework-empty"><ClipboardList/><b>No homework assigned</b><p>New assignments from your teaching team will appear here.</p></div>}</div>}
  {reviewing&&<div className="homework-modal"><form onSubmit={review}><button type="button" className="homework-close" onClick={()=>setReviewing(null)}><X/></button><span>TEACHER REVIEW</span><h3>{studentName(reviewing.student_profile_id)} · {assignments.find(a=>a.id===reviewing.assignment_id)?.title}</h3><p>{reviewing.answer_text||'File submission only'}</p>{(reviewing.file_paths??[]).map((path:string)=><button type="button" className="homework-file" key={path} onClick={()=>void openFile(path)}><Download size={13}/>{path.split('/').at(-1)}</button>)}<button type="button" className="homework-secondary" onClick={()=>void generateAiDraft()} disabled={busy}>Generate AI feedback draft</button>{aiDraft&&<div className="homework-ai-draft"><b>AI suggestion · {aiDraft.provider} / {aiDraft.model}</b><p>Suggested percentage: {aiDraft.score_suggestion??'Not available'}%</p><small>This is an unapproved suggestion. Review the response and edit the score and feedback before saving.</small></div>}<label>Score<input type="number" min="0" step="0.25" required value={score} onChange={e=>setScore(e.target.value)}/></label><label>Feedback<textarea rows={4} value={feedback} onChange={e=>setFeedback(e.target.value)}/></label><button className="homework-primary" disabled={busy}>Save feedback</button></form></div>}
  {activeAssignment&&!staff&&!parent&&<div className="homework-modal"><form onSubmit={submit}><button type="button" className="homework-close" onClick={()=>setActiveAssignment(null)}><X/></button><span>SUBMIT HOMEWORK</span><h3>{activeAssignment.title}</h3><p>{activeAssignment.instructions}</p><label>Your answer<textarea rows={7} value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Write your response here…"/></label><label className="homework-file-upload"><Upload size={14}/> Attach files (PDF, images, Word)<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt,.zip" onChange={e=>setFiles(Array.from(e.target.files??[]))}/></label>{files.map(f=><small key={f.name}>{f.name} · {(f.size/1024).toFixed(0)} KB</small>)}<button className="homework-primary" disabled={busy||(!answer.trim()&&!files.length)}><Send size={14}/> Submit response</button></form></div>}
 </section>;
}
