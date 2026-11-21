import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,ChevronLeft,ChevronRight,Clock3,FileCheck2,Play,Plus,RefreshCw,Send,ShieldCheck,Users} from 'lucide-react';
import './exam-center.css';

type Person={id:string;display_name:string;username:string|null};
type Exam=Record<string,any>;
type Question=Record<string,any>;
type Attempt=Record<string,any>;
type Profile={id:string;display_name?:string;role:string};
type Props={client:any;profile:Profile};
type Result=Record<string,any>;
const programs=['SAT English','EST English','ACT English'];
const pretty=(v:string)=>v.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const choiceValue=(choice:any)=>typeof choice==='string'?choice:String(choice?.value??choice?.id??choice?.label??choice?.text??'');
const choiceLabel=(choice:any)=>typeof choice==='string'?choice:String(choice?.label??choice?.text??choice?.value??choice?.id??'');
const fmt=(ms:number)=>{const sec=Math.max(0,Math.floor(ms/1000));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')};

export default function ExamCenter({client,profile}:Props){
 const staff=['admin','teacher','assistant'].includes(profile.role);
 const [exams,setExams]=useState<Exam[]>([]),[students,setStudents]=useState<Person[]>([]),[assignments,setAssignments]=useState<Record<string,string[]>>({});
 const [attempts,setAttempts]=useState<Attempt[]>([]),[questions,setQuestions]=useState<Question[]>([]);
 const [activeAttempt,setActiveAttempt]=useState<Attempt|null>(null),[answers,setAnswers]=useState<Record<string,any>>({});
 const [result,setResult]=useState<Result|null>(null),[reviewAttempt,setReviewAttempt]=useState<Attempt|null>(null),[reviewResult,setReviewResult]=useState<Result|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[now,setNow]=useState(Date.now());
 const [selectedExam,setSelectedExam]=useState(''),[selectedStudents,setSelectedStudents]=useState<string[]>([]);
 const [form,setForm]=useState({title:'',description:'',exam_program:'SAT English',duration_minutes:45,mode:'practice',status:'draft',starts_at:'',ends_at:''});
 const [manualScore,setManualScore]=useState(''),[feedback,setFeedback]=useState(''),[integrityEvents,setIntegrityEvents]=useState<Attempt[]>([]);
 const integrityCooldown=useRef<Record<string,number>>({});
 const load=useCallback(async()=>{
  const examQuery=client.from('exams').select('*').order('created_at',{ascending:false});
  const [e,a,t,p]=await Promise.all([
   examQuery,
   client.from('exam_assignments').select('exam_id,student_profile_id,available_from,available_until'),
   client.from('exam_attempts').select('id,exam_id,student_profile_id,status,score,auto_score,max_score,manual_review_required,started_at,submitted_at').order('started_at',{ascending:false}).limit(250),
   staff?client.from('profiles').select('id,display_name,username').eq('role','student').eq('is_active',true).order('display_name'):Promise.resolve({data:[],error:null})
  ]);
  const err=e.error||a.error||t.error||p.error;if(err){setNotice(err.message);return;}
  setExams(e.data??[]);setAttempts(t.data??[]);setStudents(p.data??[]);
  const grouped:Record<string,string[]>={};(a.data??[]).forEach((r:any)=>{(grouped[r.exam_id]??=[]).push(r.student_profile_id);});setAssignments(grouped);
  if(!selectedExam&&e.data?.length)setSelectedExam(e.data[0].id);
 },[client,staff,selectedExam]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(id);},[]);
 useEffect(()=>{
  if(!activeAttempt||profile.role!=='student')return;
  const record=(type:string)=>{
   const time=Date.now();if(time-(integrityCooldown.current[type]??0)<15000)return;integrityCooldown.current[type]=time;
   void client.rpc('exam_record_integrity_event',{p_attempt_id:activeAttempt.id,p_event_type:type}).then(({error}:any)=>{if(error)setNotice(error.message);});
  };
  const visibility=()=>{if(document.visibilityState==='hidden')record('visibility_hidden');};
  const blur=()=>record('window_blur');
  const copy=()=>record('copy');
  const paste=()=>record('paste');
  const context=()=>record('context_menu');
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('blur',blur);
  document.addEventListener('copy',copy);
  document.addEventListener('paste',paste);
  document.addEventListener('contextmenu',context);
  return()=>{
   document.removeEventListener('visibilitychange',visibility);
   window.removeEventListener('blur',blur);
   document.removeEventListener('copy',copy);
   document.removeEventListener('paste',paste);
   document.removeEventListener('contextmenu',context);
  };
 },[client,activeAttempt?.id,profile.role]);
 const pending=useMemo(()=>attempts.filter(a=>a.manual_review_required&&a.status==='submitted'),[attempts]);
 const remaining=activeAttempt?Math.max(0,new Date(activeAttempt.started_at).getTime()+Number(activeAttempt.duration_minutes)*60000-now):0;
 const [questionIndex,setQuestionIndex]=useState(0);
 const currentExam=exams.find(e=>e.id===activeAttempt?.exam_id);
 const loadQuestions=async(examId:string)=>{
  const {data,error}=await client.rpc('exam_get_questions',{p_exam_id:examId});
  if(error){setNotice(error.message);return null;}return (data??[]) as Question[];
 };
 const startExam=async(exam:Exam)=>{
  setBusy(true);setNotice('');setResult(null);
  try{
   // Check the published exam actually contains questions before creating a timed attempt.
   const qs=await loadQuestions(exam.id);
   if(!qs){setBusy(false);return;}
   if(!qs.length){setNotice('This exam has no questions yet. Ask your teacher to add questions before starting.');setBusy(false);return;}
   const {data,error}=await client.rpc('exam_start_attempt',{p_exam_id:exam.id});
   if(error){setNotice(error.message);setBusy(false);return;}
   setQuestions(qs);setAnswers(data.answers??{});setActiveAttempt({id:data.attempt_id,exam_id:exam.id,started_at:data.started_at,duration_minutes:data.duration_minutes});
   setQuestionIndex(0);
  }catch(error){setNotice(error instanceof Error?error.message:'Could not start this exam.');}
  finally{setBusy(false);}
 };
 const saveAnswer=async(q:Question,value:any)=>{
  if(!activeAttempt)return;
  setAnswers(old=>({...old,[q.id]:value}));
  const {error}=await client.rpc('exam_save_answer',{p_attempt_id:activeAttempt.id,p_question_id:q.id,p_answer:value===null?null:value});
  if(error)setNotice(error.message);
 };
 const viewResult=async(attempt:Attempt)=>{
  setBusy(true);const {data,error}=await client.rpc('exam_get_result',{p_attempt_id:attempt.id});
  if(error)setNotice(error.message);else setResult(data);setBusy(false);
 };
 const submitExam=async()=>{
  if(!activeAttempt)return;
  setBusy(true);
  for(const [questionId,value] of Object.entries(answers)){
   const {error:answerError}=await client.rpc('exam_save_answer',{p_attempt_id:activeAttempt.id,p_question_id:questionId,p_answer:value===null?null:value});
   if(answerError){setNotice('Your latest answer could not be saved: '+answerError.message);setBusy(false);return;}
  }
  const {data,error}=await client.rpc('exam_submit_attempt',{p_attempt_id:activeAttempt.id});
  if(error){setNotice(error.message);setBusy(false);return;}
  if(data?.manual_review_required){setNotice('Your exam was submitted. Some questions require teacher review.');setResult({pending:true,...data});}
  else{const {data:r,error:re}=await client.rpc('exam_get_result',{p_attempt_id:activeAttempt.id});if(re)setNotice(re.message);else setResult(r);}
  setActiveAttempt(null);await load();setBusy(false);
 };
 useEffect(()=>{if(activeAttempt&&remaining<=0&&!busy)void submitExam();},[activeAttempt,remaining,busy]);
 const createExam=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);
  const payload={...form,duration_minutes:Number(form.duration_minutes),starts_at:form.starts_at?new Date(form.starts_at).toISOString():null,ends_at:form.ends_at?new Date(form.ends_at).toISOString():null,created_by:profile.id};
  const {data,error}=await client.from('exams').insert(payload).select('*').single();
  setNotice(error?.message||'Exam created. Add questions in Question bank, then assign students.');if(!error){setForm({title:'',description:'',exam_program:'SAT English',duration_minutes:45,mode:'practice',status:'draft',starts_at:'',ends_at:''});await load();setSelectedExam(data.id);}setBusy(false);
 };
 const publishExam=async(exam:Exam,status:string)=>{
  setBusy(true);const {error}=await client.from('exams').update({status,updated_at:new Date().toISOString()}).eq('id',exam.id);
  setNotice(error?.message||'Exam status updated.');if(!error)await load();setBusy(false);
 };
 const assignExam=async(e:React.FormEvent)=>{
  e.preventDefault();if(!selectedExam||!selectedStudents.length){setNotice('Choose an exam and at least one student.');return;}
  setBusy(true);const payload=selectedStudents.map(student_profile_id=>({exam_id:selectedExam,student_profile_id,assigned_by:profile.id}));
  const {error}=await client.from('exam_assignments').upsert(payload,{onConflict:'exam_id,student_profile_id'});
  setNotice(error?.message||'Exam assigned to selected students.');if(!error){setSelectedStudents([]);await load();}setBusy(false);
 };
 const openReview=async(a:Attempt)=>{
  setReviewAttempt(a);setReviewResult(null);setManualScore('');setFeedback('');setIntegrityEvents([]);
  const [resultResponse,eventResponse]=await Promise.all([
   client.rpc('exam_get_result',{p_attempt_id:a.id}),
   client.from('exam_attempt_events').select('*').eq('attempt_id',a.id).order('created_at',{ascending:false})
  ]);
  if(resultResponse.error||eventResponse.error){setNotice(resultResponse.error?.message||eventResponse.error?.message||'Unable to load review details.');return;}
  setReviewResult(resultResponse.data);setIntegrityEvents(eventResponse.data??[]);
 };
 const submitReview=async(e:React.FormEvent)=>{
  e.preventDefault();if(!reviewAttempt)return;setBusy(true);
  const {error}=await client.rpc('exam_review_attempt',{p_attempt_id:reviewAttempt.id,p_manual_score:Number(manualScore),p_feedback:feedback});
  setNotice(error?.message||'Manual review saved and final result calculated.');if(!error){setReviewAttempt(null);setReviewResult(null);setIntegrityEvents([]);await load();}setBusy(false);
 };
 const studentName=(id:string)=>students.find(s=>s.id===id)?.display_name||'Student';
 const q=questions[questionIndex];
 const choiceList=Array.isArray(q?.choices)?q.choices:[];
 if(!staff){
  if(result)return <section className="exam-center"><div className="exam-result"><span className="exam-eyebrow">EXAM RESULT</span><h2>{(result.pending||result.manual_review_required)?'Submission received':'Your exam is complete'}</h2>{(result.pending||result.manual_review_required)?<p>Your written or manually graded responses are waiting for your teacher. You will see the final result after review.</p>:<><strong>{result.score} / {result.max_score}</strong><p>{result.max_score?Math.round(Number(result.score)/Number(result.max_score)*100)+'%':'Result saved'}</p>{result.review_feedback&&<blockquote>{result.review_feedback}</blockquote>}<div className="exam-review-list">{(result.questions??[]).map((item:any,i:number)=><article key={item.id}><b>Question {i+1}</b><p>{item.prompt}</p><small>Your answer: {JSON.stringify(item.student_answer??'No answer')}</small><small>Correct answer: {JSON.stringify(item.correct_answer)}</small>{item.explanation&&<p>{item.explanation}</p>}</article>)}</div></>}</div><button className="exam-primary" onClick={()=>setResult(null)}>Back to exams</button></section>;
  if(activeAttempt&&q)return <section className="exam-center exam-taking"><header className="exam-taking-head"><div><span className="exam-eyebrow">{currentExam?.exam_program||'ENGLISH EXAM'}</span><h2>{currentExam?.title||'Exam in progress'}</h2><small>Question {questionIndex+1} of {questions.length}</small></div><div className={'exam-clock '+(remaining<30000?'urgent':'')}><Clock3 size={16}/>{fmt(remaining)}</div></header><div className="exam-progress"><span style={{width:((questionIndex+1)/questions.length*100)+'%'}}/></div><div className="exam-question"><div className="exam-question-meta"><span>QUESTION {questionIndex+1}</span><span>{q.points} {Number(q.points)===1?'point':'points'}</span></div>{q.passage&&<div className="exam-passage">{q.passage}</div>}<h3>{q.prompt}</h3>{q.question_type==='multiple_choice'?<div className="exam-choices">{choiceList.map((choice:any,i:number)=>{const val=choiceValue(choice);return <button key={i} className={answers[q.id]===val?'chosen':''} onClick={()=>void saveAnswer(q,val)}><span>{String.fromCharCode(65+i)}</span>{choiceLabel(choice)}</button>;})}</div>:q.question_type==='short_answer'?<input className="exam-short-answer" value={answers[q.id]??''} onChange={e=>setAnswers(old=>({...old,[q.id]:e.target.value}))} onBlur={()=>void saveAnswer(q,answers[q.id]??'')} placeholder="Type your answer"/>:<textarea className="exam-essay-answer" rows={7} value={answers[q.id]??''} onChange={e=>setAnswers(old=>({...old,[q.id]:e.target.value}))} onBlur={()=>void saveAnswer(q,answers[q.id]??'')} placeholder="Write your response here"/>}</div><footer className="exam-question-footer"><button className="exam-secondary" disabled={questionIndex===0} onClick={()=>setQuestionIndex(i=>Math.max(0,i-1))}><ChevronLeft size={16}/> Previous</button><span>{questions.filter(x=>answers[x.id]!==undefined&&answers[x.id]!==null&&answers[x.id]!=='').length} answered</span>{questionIndex<questions.length-1?<button className="exam-primary" onClick={()=>setQuestionIndex(i=>Math.min(questions.length-1,i+1))}>Next <ChevronRight size={16}/></button>:<button className="exam-primary" disabled={busy} onClick={()=>{if(window.confirm('Submit your exam now? You cannot change answers after submission.'))void submitExam();}}><Send size={15}/> Submit exam</button>}</footer></section>;
  return <section className="exam-center"><div className="exam-center-heading"><div><span className="exam-eyebrow">YOUR ASSESSMENTS</span><h2>Practice & Exams</h2><p>Assigned English exams, timed attempts and detailed results.</p></div><button className="exam-refresh" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div>{notice&&<div className="exam-notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}<div className="exam-student-grid">{exams.filter(e=>e.status==='published').map(e=>{const previous=attempts.filter(a=>a.exam_id===e.id&&a.student_profile_id===profile.id);const inProgress=previous.find(a=>a.status==='in_progress');const last=previous.find(a=>a.status==='submitted');return <article className="exam-student-card" key={e.id}><div className="exam-card-icon"><FileCheck2/></div><span className="exam-program">{e.exam_program}</span><h3>{e.title}</h3><p>{e.description||'Timed English assessment'}</p><div className="exam-card-meta"><span><Clock3 size={13}/>{e.duration_minutes} min</span><span><BookOpen size={13}/>{e.mode}</span></div>{last&&<><small className="exam-last-score">Latest result: {last.manual_review_required?'Awaiting review':last.score!==null?last.score+'/'+last.max_score:'Submitted'}</small>{last.status==='submitted'&&<button className="exam-secondary" disabled={busy} onClick={()=>void viewResult(last)}>View detailed corrections</button>}</>}<button className="exam-primary" disabled={busy} onClick={()=>void startExam(e)}><Play size={15}/>{inProgress?'Resume attempt':'Start exam'}</button></article>;})}{!exams.some(e=>e.status==='published')&&<div className="exam-empty"><BookOpen/><b>No exams assigned yet</b><p>Your teacher's published exams will appear here when they are assigned to your account.</p></div>}</div></section>;
 }
 return <section className="exam-center"><div className="exam-center-heading"><div><span className="exam-eyebrow">ASSESSMENT MANAGEMENT</span><h2>Exams</h2><p>Create timed exams, assign students and review submitted attempts.</p></div><button className="exam-refresh" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div>{notice&&<div className="exam-notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
  <div className="exam-staff-grid"><form className="exam-form" onSubmit={createExam}><h3><Plus size={16}/> Create exam</h3><label>Exam title<input required maxLength={180} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Description<textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><div className="exam-form-row"><label>Program<select value={form.exam_program} onChange={e=>setForm({...form,exam_program:e.target.value})}>{programs.map(p=><option key={p}>{p}</option>)}</select></label><label>Duration (minutes)<input type="number" min="1" max="300" value={form.duration_minutes} onChange={e=>setForm({...form,duration_minutes:Number(e.target.value)})}/></label></div><div className="exam-form-row"><label>Mode<select value={form.mode} onChange={e=>setForm({...form,mode:e.target.value})}><option value="practice">Practice</option><option value="exam">Exam</option></select></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option></select></label></div><label>Opens at (optional)<input type="datetime-local" value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})}/></label><label>Closes at (optional)<input type="datetime-local" value={form.ends_at} onChange={e=>setForm({...form,ends_at:e.target.value})}/></label><button className="exam-primary" disabled={busy}>Create exam</button></form>
   <div className="exam-admin-main"><section className="exam-panel"><h3><BookOpen size={16}/> Exam library ({exams.length})</h3>{exams.map(e=><article className="exam-admin-card" key={e.id}><div><b>{e.title}</b><small>{e.exam_program} · {e.duration_minutes} minutes · {assignments[e.id]?.length??0} students assigned</small></div><div><span className={'exam-status '+e.status}>{pretty(e.status)}</span><button onClick={()=>void publishExam(e,e.status==='published'?'closed':'published')} disabled={busy}>{e.status==='published'?'Close':'Publish'}</button></div></article>)}{!exams.length&&<p className="exam-muted">Create your first exam above.</p>}</section>
    <form className="exam-panel exam-assign-form" onSubmit={assignExam}><h3><Users size={16}/> Assign an exam</h3><label>Exam<select required value={selectedExam} onChange={e=>setSelectedExam(e.target.value)}><option value="">Choose exam</option>{exams.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label><div className="exam-student-picker"><div className="exam-picker-head"><span>Students</span><button type="button" onClick={()=>setSelectedStudents(students.map(s=>s.id))}>Select all</button><button type="button" onClick={()=>setSelectedStudents([])}>Clear</button></div>{students.map(s=><label key={s.id}><input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={e=>setSelectedStudents(old=>e.target.checked?[...old,s.id]:old.filter(id=>id!==s.id))}/><span>{s.display_name}</span><small>@{s.username}</small></label>)}{!students.length&&<p className="exam-muted">No active student accounts.</p>}</div><button className="exam-primary" disabled={busy||!selectedExam||!selectedStudents.length}>Assign to {selectedStudents.length} students</button></form>
   </div>
  </div>
  <section className="exam-panel exam-pending"><h3><ShieldCheck size={16}/> Manual review queue ({pending.length})</h3>{pending.map(a=><article key={a.id}><div><b>{studentName(a.student_profile_id)}</b><small>{exams.find(e=>e.id===a.exam_id)?.title||'Exam'} · Submitted {a.submitted_at?new Date(a.submitted_at).toLocaleString():'—'}</small></div><button onClick={()=>void openReview(a)}>Review attempt</button></article>)}{!pending.length&&<p className="exam-muted">No written responses are waiting for review.</p>}</section>
  {reviewAttempt&&reviewResult&&<div className="exam-review-modal"><div className="exam-review-card"><div className="exam-review-head"><div><span className="exam-eyebrow">MANUAL GRADING</span><h3>{studentName(reviewAttempt.student_profile_id)} · {exams.find(e=>e.id===reviewAttempt.exam_id)?.title}</h3></div><button onClick={()=>{setReviewAttempt(null);setReviewResult(null);setIntegrityEvents([]);}}>×</button></div><div className="exam-integrity-events"><b>Exam integrity signals ({integrityEvents.length})</b><small>These browser events are review signals, not proof of misconduct.</small>{integrityEvents.map((event:any)=><span key={event.id}>{pretty(event.event_type)} · {new Date(event.created_at).toLocaleString()}</span>)}{!integrityEvents.length&&<span>No browser signals were recorded.</span>}</div><div className="exam-review-questions">{(reviewResult.questions??[]).map((item:any,i:number)=><article key={item.id}><b>Question {i+1}</b><p>{item.prompt}</p><small>Student response: {JSON.stringify(item.student_answer??'No answer')}</small><small>Answer key: {JSON.stringify(item.correct_answer)}</small><small>Available marks: {item.points}</small></article>)}</div><form onSubmit={submitReview}><label>Manual marks (maximum {Math.max(0,Number(reviewResult.max_score)-Number(reviewResult.auto_score))})<input required type="number" min="0" step="0.25" max={Math.max(0,Number(reviewResult.max_score)-Number(reviewResult.auto_score))} value={manualScore} onChange={e=>setManualScore(e.target.value)}/></label><label>Feedback<textarea rows={3} value={feedback} onChange={e=>setFeedback(e.target.value)}/></label><button className="exam-primary" disabled={busy||manualScore===''}>Save review and finalize result</button></form></div></div>}
 </section>;
}
