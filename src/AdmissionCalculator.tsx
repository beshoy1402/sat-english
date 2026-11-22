import {useCallback,useEffect,useMemo,useState} from 'react';
import {AlertCircle,Calculator,GraduationCap,Info,Plus,ShieldCheck,CheckCircle2,ExternalLink} from 'lucide-react';
import './admission-calculator.css';

type Inputs={gpa:string;sat1:string;sat2:string;university:string;faculty:string;year:string};
type Rule=Record<string,any>;
type Profile={id:string;role:string};
const blankRule={university:'',faculty:'',admission_year:'2027',source_url:'',source_title:'',gpa_max:'4',sat1_max:'1600',sat2_max:'800',gpa_weight:'20',sat1_weight:'40',sat2_weight:'40',minimum_score:'',assumptions:'',notes:''};
const round=(value:number,rule:string)=>rule==='integer'?Math.round(value):rule==='one_decimal'?Math.round(value*10)/10:rule==='two_decimals'?Math.round(value*100)/100:value;

export default function AdmissionCalculator({client,profile}:{client:any;profile:Profile}){
 const admin=profile.role==='admin';
 const [values,setValues]=useState<Inputs>({gpa:'',sat1:'',sat2:'',university:'',faculty:'',year:'2027'});
 const [rules,setRules]=useState<Rule[]>([]);
 const [attempted,setAttempted]=useState(false);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [draft,setDraft]=useState({...blankRule});
 const [showEditor,setShowEditor]=useState(false);
 const update=(key:keyof Inputs,value:string)=>setValues(current=>({...current,[key]:value}));
 const load=useCallback(async()=>{
  if(!client)return;
  setBusy(true);setNotice('');
  const query=client.from('admission_rule_versions').select('*').order('admission_year',{ascending:false}).order('updated_at',{ascending:false});
  const {data,error}=admin?await query:await query.eq('status','verified');
  if(error)setNotice(error.message);else setRules(data??[]);
  setBusy(false);
 },[client,admin]);
 useEffect(()=>{void load();},[load]);
 const matching=useMemo(()=>rules.filter(r=>r.status==='verified'&&r.university.trim().toLowerCase()===values.university.trim().toLowerCase()&&r.faculty.trim().toLowerCase()===values.faculty.trim().toLowerCase()&&Number(r.admission_year)===Number(values.year)).sort((a,b)=>new Date(b.verified_at??0).getTime()-new Date(a.verified_at??0).getTime())[0]??null,[rules,values]);
 const numbers={gpa:Number(values.gpa),sat1:Number(values.sat1),sat2:Number(values.sat2)};
 const valid=Object.values(numbers).every(Number.isFinite)&&values.gpa!==''&&values.sat1!==''&&values.sat2!==''&&numbers.gpa>=0&&numbers.sat1>=0&&numbers.sat2>=0;
 const result=useMemo(()=>{
  if(!matching||!valid)return null;
  const scales=matching.score_scales??{},weights=matching.formula?.weights??{};
  const max={gpa:Number(scales.gpa_max),sat1:Number(scales.sat1_max),sat2:Number(scales.sat2_max)};
  const w={gpa:Number(weights.gpa),sat1:Number(weights.sat1),sat2:Number(weights.sat2)};
  if(Object.values(max).some(v=>!Number.isFinite(v)||v<=0)||Object.values(w).some(v=>!Number.isFinite(v)||v<0)||Math.abs(w.gpa+w.sat1+w.sat2-100)>0.001)return null;
  if(numbers.gpa>max.gpa||numbers.sat1>max.sat1||numbers.sat2>max.sat2)return null;
  const parts={gpa:numbers.gpa/max.gpa*w.gpa,sat1:numbers.sat1/max.sat1*w.sat1,sat2:numbers.sat2/max.sat2*w.sat2};
  const raw=parts.gpa+parts.sat1+parts.sat2;
  const score=round(raw,matching.rounding_rule??'none');
  const min=Number(matching.minimum_requirements?.minimum_score);
  return {parts,score,minimum:Number.isFinite(min)&&min>0?min:null,eligible:!(Number.isFinite(min)&&min>0)||score>=min};
 },[matching,valid,numbers.gpa,numbers.sat1,numbers.sat2]);
 const saveDraft=async()=>{
  setBusy(true);setNotice('');
  const weights={gpa:Number(draft.gpa_weight),sat1:Number(draft.sat1_weight),sat2:Number(draft.sat2_weight)};
  const max={gpa_max:Number(draft.gpa_max),sat1_max:Number(draft.sat1_max),sat2_max:Number(draft.sat2_max)};
  if(!draft.university.trim()||!draft.faculty.trim()||!draft.source_url.startsWith('https://')||!draft.source_title.trim()||Object.values(max).some(v=>!Number.isFinite(v)||v<=0)||Object.values(weights).some(v=>!Number.isFinite(v)||v<0)||Math.abs(weights.gpa+weights.sat1+weights.sat2-100)>0.001){setNotice('Complete all rule details. Weights must total exactly 100 and source URL must use HTTPS.');setBusy(false);return;}
  const {error}=await client.from('admission_rule_versions').insert({university:draft.university.trim(),faculty:draft.faculty.trim(),admission_year:Number(draft.admission_year),status:'draft',source_url:draft.source_url.trim(),source_title:draft.source_title.trim(),formula:{kind:'weighted_sum',weights},score_scales:max,minimum_requirements:draft.minimum_score.trim()?{minimum_score:Number(draft.minimum_score)}:{},rounding_rule:'two_decimals',assumptions:draft.assumptions,notes:draft.notes,created_by:profile.id});
  if(error)setNotice(error.message);else{setNotice('Draft rule saved. It is not visible to students until an administrator verifies and publishes it.');setDraft({...blankRule});setShowEditor(false);await load();}
  setBusy(false);
 };
 const publish=async(rule:Rule)=>{
  const confirmed=window.confirm('Confirm that you personally checked this exact university, faculty and admission year against the linked official source, including score scales, weights, minimums and rounding?');
  if(!confirmed)return;
  setBusy(true);const {error}=await client.from('admission_rule_versions').update({status:'verified',verified_at:new Date().toISOString(),verified_by:profile.id}).eq('id',rule.id).eq('status','draft');
  setNotice(error?.message??'Rule published as verified.');await load();setBusy(false);
 };
 const supersede=async(rule:Rule)=>{if(!window.confirm('Supersede this rule version? Students will no longer see it.'))return;setBusy(true);const {error}=await client.from('admission_rule_versions').update({status:'superseded'}).eq('id',rule.id);setNotice(error?.message??'Rule version superseded.');await load();setBusy(false);};
 return <section className="admission-shell">
  <div className="admission-intro"><span className="admission-kicker"><GraduationCap size={15}/> UNIVERSITY PLANNING</span><h2>Egyptian university admission calculator</h2><p>Calculations use only a verified rule matching the exact university, faculty and admission year. No unofficial formula is guessed.</p></div>
  <div className="admission-grid">
   <div className="admission-card"><div className="admission-card-title"><Calculator size={18}/><div><b>Your results</b><small>Use the scores on your official records</small></div></div><div className="admission-fields">
    <label>GPA<input inputMode="decimal" type="number" min="0" step="0.01" placeholder="e.g. 3.75" value={values.gpa} onChange={e=>update('gpa',e.target.value)}/></label>
    <label>SAT I score<input inputMode="numeric" type="number" min="0" step="1" value={values.sat1} onChange={e=>update('sat1',e.target.value)} placeholder="SAT I score"/></label>
    <label>SAT II admission score<input inputMode="numeric" type="number" min="0" step="1" value={values.sat2} onChange={e=>update('sat2',e.target.value)} placeholder="Admission-system value"/></label>
   </div></div>
   <div className="admission-card"><div className="admission-card-title"><ShieldCheck size={18}/><div><b>Admission target</b><small>Rules differ by institution and year</small></div></div><div className="admission-fields">
    <label>Admission year<select value={values.year} onChange={e=>update('year',e.target.value)}>{['2026','2027','2028'].map(y=><option key={y}>{y}</option>)}</select></label>
    <label>University<input value={values.university} onChange={e=>update('university',e.target.value)} placeholder="University name"/></label>
    <label>Faculty / program<input value={values.faculty} onChange={e=>update('faculty',e.target.value)} placeholder="Faculty or program"/></label>
   </div><button className="admission-check" disabled={busy} onClick={()=>setAttempted(true)}>Check verified admission rule</button></div>
  </div>
  {attempted&&(!valid||!values.university.trim()||!values.faculty.trim())&&<p className="admission-validation"><AlertCircle size={15}/> Enter all three scores, university and faculty.</p>}
  {attempted&&valid&&values.university.trim()&&values.faculty.trim()&&!matching&&<div className="admission-not-ready"><AlertCircle size={19}/><div><b>No verified rule for this selection</b><p>No published rule matches {values.university}, {values.faculty} and {values.year}. Ask the administration to add and verify the official rule before calculating.</p></div></div>}
  {attempted&&valid&&matching&&!result&&<div className="admission-not-ready"><AlertCircle size={19}/><div><b>Score does not match this rule's configured scales</b><p>One or more inputs exceed the maximum configured score, or the published rule is incomplete. Contact the administrator.</p></div></div>}
  {attempted&&result&&matching&&<div className="admission-not-ready"><CheckCircle2 size={19}/><div><b>Estimated admission score: {result.score.toFixed(matching.rounding_rule==='integer'?0:matching.rounding_rule==='one_decimal'?1:2)} / 100</b><p>GPA contribution {result.parts.gpa.toFixed(2)} · SAT I contribution {result.parts.sat1.toFixed(2)} · SAT II contribution {result.parts.sat2.toFixed(2)}. {result.minimum!==null?'Configured minimum: '+result.minimum+'. ':''}{result.eligible?'Meets the configured minimum score.':'Below the configured minimum score.'}</p><p>Rule verified {new Date(matching.verified_at).toLocaleDateString()} · {matching.source_title}</p><a href={matching.source_url} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Official source</a><p><small>This is an estimate based on the displayed published rule, not a university admission decision.</small></p></div></div>}
  <div className="admission-footnote"><Info size={16}/><span>Each published version stores its source URL, verification timestamp, score scales, component weights, minimum score and rounding method. Historical versions are retained.</span></div>
  {admin&&<div className="admission-card"><div className="admission-card-title"><ShieldCheck size={18}/><div><b>Administrator rule registry</b><small>Only administrators can create, verify or supersede rules.</small></div></div><button className="admission-check" onClick={()=>setShowEditor(v=>!v)}><Plus size={15}/> {showEditor?'Close rule editor':'Create rule draft'}</button>
   {showEditor&&<div className="admission-fields">
    <label>University<input value={draft.university} onChange={e=>setDraft({...draft,university:e.target.value})}/></label><label>Faculty / program<input value={draft.faculty} onChange={e=>setDraft({...draft,faculty:e.target.value})}/></label><label>Admission year<input type="number" min="2020" max="2100" value={draft.admission_year} onChange={e=>setDraft({...draft,admission_year:e.target.value})}/></label>
    <label>Official source URL<input type="url" placeholder="https://..." value={draft.source_url} onChange={e=>setDraft({...draft,source_url:e.target.value})}/></label><label>Source title / document<input value={draft.source_title} onChange={e=>setDraft({...draft,source_title:e.target.value})}/></label>
    <label>GPA maximum<input type="number" min="0.01" step="0.01" value={draft.gpa_max} onChange={e=>setDraft({...draft,gpa_max:e.target.value})}/></label><label>SAT I maximum<input type="number" min="1" value={draft.sat1_max} onChange={e=>setDraft({...draft,sat1_max:e.target.value})}/></label><label>SAT II maximum<input type="number" min="1" value={draft.sat2_max} onChange={e=>setDraft({...draft,sat2_max:e.target.value})}/></label>
    <label>GPA weight (%)<input type="number" min="0" max="100" step="0.01" value={draft.gpa_weight} onChange={e=>setDraft({...draft,gpa_weight:e.target.value})}/></label><label>SAT I weight (%)<input type="number" min="0" max="100" step="0.01" value={draft.sat1_weight} onChange={e=>setDraft({...draft,sat1_weight:e.target.value})}/></label><label>SAT II weight (%)<input type="number" min="0" max="100" step="0.01" value={draft.sat2_weight} onChange={e=>setDraft({...draft,sat2_weight:e.target.value})}/></label><label>Minimum overall score (optional)<input type="number" min="0" max="100" step="0.01" value={draft.minimum_score} onChange={e=>setDraft({...draft,minimum_score:e.target.value})}/></label>
    <label>Assumptions<input value={draft.assumptions} onChange={e=>setDraft({...draft,assumptions:e.target.value})}/></label><label>Notes<textarea value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
    <button className="admission-check" disabled={busy} onClick={()=>void saveDraft()}>Save draft rule</button>
   </div>}
   {rules.map(rule=><div key={rule.id} className="admission-not-ready"><div><b>{rule.university} · {rule.faculty} · {rule.admission_year}</b><p>{rule.status.toUpperCase()} · {rule.source_title}</p><a href={rule.source_url} target="_blank" rel="noreferrer">{rule.source_url}</a>{rule.status==='draft'&&<button onClick={()=>void publish(rule)} disabled={busy}>Verify and publish</button>}{rule.status==='verified'&&<button onClick={()=>void supersede(rule)} disabled={busy}>Supersede version</button>}</div></div>)}
  </div>}
  {notice&&<p className="admission-validation">{notice}</p>}
 </section>;
}
