import {useCallback,useEffect,useState} from 'react';
import {CalendarDays,CheckCircle2,Clock3,RefreshCw,Sparkles,Target,Users} from 'lucide-react';
import './study-plan.css';
type Row=Record<string,any>;
type Profile={id:string;role:string};
type Props={client:any;profile:Profile};
const programs=['SAT English','EST English','ACT English'];
export default function StudyPlanCenter({client,profile}:Props){
 const parent=profile.role==='parent';
 const [children,setChildren]=useState<Row[]>([]),[childId,setChildId]=useState('');
 const [plans,setPlans]=useState<Row[]>([]),[selected,setSelected]=useState<Row|null>(null);
 const [program,setProgram]=useState('SAT English'),[targetDate,setTargetDate]=useState(''),[currentScore,setCurrentScore]=useState(''),[targetScore,setTargetScore]=useState(''),[hours,setHours]=useState('5'),[weakTopics,setWeakTopics]=useState('');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  let id=profile.id;
  if(parent){
   const {data:l,error}=await client.from('parent_student_links').select('student_profile_id').eq('parent_profile_id',profile.id);
   if(error){setNotice(error.message);return;}
   const ids=(l??[]).map((x:any)=>x.student_profile_id);
   if(!ids.length){setChildren([]);setPlans([]);setSelected(null);return;}
   const {data:p,error:pe}=await client.from('profiles').select('id,display_name').in('id',ids).order('display_name');
   if(pe){setNotice(pe.message);return;}setChildren(p??[]);
   if(!childId&&p?.length)setChildId(p[0].id);id=childId||ids[0];
  }
  const {data,error}=await client.from('student_study_plans').select('*').eq('student_profile_id',id).order('created_at',{ascending:false});
  if(error){setNotice(error.message);return;}
  setPlans(data??[]);if(!selected&&data?.length)setSelected(data[0]);
  if(selected){const latest=data?.find((p:any)=>p.id===selected.id);if(latest)setSelected(latest);}
 },[client,parent,profile.id,childId,selected]);
 useEffect(()=>{void load();},[load]);
 const generate=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setNotice('');
  const {data,error}=await client.functions.invoke('ai-learning',{body:{action:'study_plan',exam_program:program,target_date:targetDate||null,current_score:currentScore===''?null:Number(currentScore),target_score:targetScore===''?null:Number(targetScore),weekly_hours:Number(hours),weak_topics:weakTopics.split(',').map(s=>s.trim()).filter(Boolean)}});
  if(error||data?.error)setNotice(data?.error||error?.message||'The study plan could not be generated.');
  else{setSelected(data.plan);setNotice('Your personal study plan has been generated and saved.');await load();}
  setBusy(false);
 };
 const updatePlan=async(next:Row)=>{
  if(parent||!selected)return;setBusy(true);
  const {data,error}=await client.from('student_study_plans').update({plan_json:next.plan_json,status:next.status,updated_at:new Date().toISOString()}).eq('id',next.id).select('*').single();
  setNotice(error?.message||'Study plan progress saved.');if(!error){setSelected(data);await load();}setBusy(false);
 };
 const toggleTask=(dayIndex:number,taskIndex:number,checked:boolean)=>{
  if(!selected)return;const next=JSON.parse(JSON.stringify(selected));next.plan_json.weekly_schedule[dayIndex].activities[taskIndex].completed=checked;void updatePlan(next);
 };
 const activePlan=selected&&plans.find(p=>p.id===selected.id)?selected:plans[0];
 const total=activePlan?.plan_json?.weekly_schedule?.reduce((n:number,d:any)=>n+(d.activities?.length??0),0)??0;
 const completed=activePlan?.plan_json?.weekly_schedule?.reduce((n:number,d:any)=>n+(d.activities??[]).filter((t:any)=>t.completed).length,0)??0;
 if(parent&&!children.length)return <section className="study-plan"><div className="study-empty"><Users/><b>No linked student</b><p>Ask the school team to link your parent account to a student profile.</p></div></section>;
 return <section className="study-plan"><div className="study-heading"><div><span>PERSONAL EXAM PREPARATION</span><h2>{parent?'Child study plan':'My study plan'}</h2><p>{parent?'Review the preparation schedule created for your child.':'Create a practical weekly plan for your English exam target.'}</p></div><button onClick={()=>void load()}><RefreshCw size={14}/> Refresh</button></div>
  {notice&&<div className="study-notice">{notice}</div>}
  {parent&&<label className="study-child">Child<select value={childId} onChange={e=>setChildId(e.target.value)}>{children.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label>}
  {!parent&&<form className="study-generator" onSubmit={generate}><h3><Sparkles size={16}/> Generate a personal study plan</h3><div className="study-form-grid"><label>Exam program<select value={program} onChange={e=>setProgram(e.target.value)}>{programs.map(p=><option key={p}>{p}</option>)}</select></label><label>Target exam date<input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)}/></label><label>Current score (optional)<input type="number" min="0" max="1600" value={currentScore} onChange={e=>setCurrentScore(e.target.value)}/></label><label>Target score (optional)<input type="number" min="0" max="1600" value={targetScore} onChange={e=>setTargetScore(e.target.value)}/></label><label>Study hours per week<input type="number" min="1" max="80" value={hours} onChange={e=>setHours(e.target.value)}/></label><label className="study-wide">Topics to improve (comma-separated)<input value={weakTopics} onChange={e=>setWeakTopics(e.target.value)} placeholder="Grammar, transitions, reading comprehension…"/></label></div><button className="study-primary" disabled={busy}>{busy?'Building your plan…':'Generate study plan with AI'}</button><small>Requires an enabled AI provider configured by the Developer. The plan is saved to your account.</small></form>}
  {activePlan?<div className="study-plan-content"><div className="study-plan-top"><div><span>{activePlan.exam_program}</span><h3>Preparation roadmap</h3><p>{activePlan.plan_json?.overview}</p></div><div className="study-plan-progress"><b>{total?Math.round(completed/total*100):0}%</b><small>{completed}/{total} tasks complete</small><div><i style={{width:(total?completed/total*100:0)+'%'}}/></div></div></div><div className="study-plan-meta"><span><Target size={13}/> Target: {activePlan.target_score??'Not set'}</span><span><CalendarDays size={13}/> {activePlan.target_date||'No exam date'}</span><span><Clock3 size={13}/> {activePlan.weekly_hours} hrs/week</span></div><div className="study-week-grid">{(activePlan.plan_json?.weekly_schedule??[]).map((day:any,di:number)=><article key={di}><div className="study-day-head"><b>{day.day||'Study day '+(di+1)}</b><span>{day.focus}</span></div>{(day.activities??[]).map((task:any,ti:number)=><label key={ti} className={task.completed?'completed':''}><input type="checkbox" checked={Boolean(task.completed)} disabled={parent||busy} onChange={e=>toggleTask(di,ti,e.target.checked)}/><div><b>{task.title}</b><small>{task.description}</small><span>{task.duration_minutes} minutes</span></div></label>)}</article>)}</div>{(activePlan.plan_json?.milestones?.length??0)>0&&<section className="study-milestones"><h4>Milestones</h4>{activePlan.plan_json.milestones.map((m:any,i:number)=><div key={i}><b>{m.title}</b><small>Week {m.due_in_weeks} · {m.description}</small></div>)}</section>}{(activePlan.plan_json?.tips?.length??0)>0&&<section className="study-milestones"><h4>Study tips</h4>{activePlan.plan_json.tips.map((tip:string,i:number)=><p key={i}>{tip}</p>)}</section>}</div>:<div className="study-empty"><Target/><b>No study plan yet</b><p>{parent?'A study plan will appear when one is created for your child.':'Generate a plan above after configuring an AI provider.'}</p></div>}
  {plans.length>1&&<div className="study-history"><b>Previous plans</b>{plans.map(p=><button key={p.id} className={activePlan?.id===p.id?'active':''} onClick={()=>setSelected(p)}>{p.exam_program} · {new Date(p.created_at).toLocaleDateString()}</button>)}</div>}
 </section>;
}
