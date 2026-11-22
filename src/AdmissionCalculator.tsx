import {useMemo,useState} from 'react';
import {AlertCircle,Calculator,GraduationCap,Info,ShieldCheck} from 'lucide-react';
import './admission-calculator.css';

type AdmissionInputs={gpa:string;sat1:string;sat2:string;university:string;faculty:string;year:string};

/**
 * Rules are intentionally data-driven and versioned. Do not add a formula until
 * it has been verified against an official source for the exact admission year.
 */
export type AdmissionRuleVersion={
  id:string;
  university:string;
  faculty:string;
  admissionYear:number;
  sourceUrl:string;
  verifiedAt:string;
  status:'verified'|'draft'|'superseded';
  formula:{kind:string;parameters:Record<string,number|string>};
};

export default function AdmissionCalculator(){
 const [values,setValues]=useState<AdmissionInputs>({gpa:'',sat1:'',sat2:'',university:'',faculty:'',year:'2026'});
 const [attempted,setAttempted]=useState(false);
 const numeric=useMemo(()=>({gpa:Number(values.gpa),sat1:Number(values.sat1),sat2:Number(values.sat2)}),[values]);
 const hasScores=values.gpa!==''&&values.sat1!==''&&values.sat2!==''&&Object.values(numeric).every(Number.isFinite);
 const valid=hasScores&&numeric.gpa>=0&&numeric.gpa<=4&&numeric.sat1>=0&&numeric.sat2>=0;
 const update=(key:keyof AdmissionInputs,value:string)=>setValues(current=>({...current,[key]:value}));
 return <section className="admission-shell">
  <div className="admission-intro">
   <span className="admission-kicker"><GraduationCap size={15}/> UNIVERSITY PLANNING</span>
   <h2>Egyptian university admission calculator</h2>
   <p>Enter your American Diploma results and choose the university, faculty and admission year. The calculator will use the matching official rule version once it has been verified and added.</p>
  </div>
  <div className="admission-grid">
   <div className="admission-card">
    <div className="admission-card-title"><Calculator size={18}/><div><b>Your results</b><small>Use the scores shown on your official records</small></div></div>
    <div className="admission-fields">
     <label>GPA<input inputMode="decimal" type="number" min="0" max="4" step="0.01" placeholder="e.g. 3.75" value={values.gpa} onChange={e=>update('gpa',e.target.value)}/><small>Enter GPA on a 4.0 scale. If your transcript uses another scale, wait for the correct conversion rule.</small></label>
     <label>SAT I score<input inputMode="numeric" type="number" min="0" step="1" placeholder="SAT I score" value={values.sat1} onChange={e=>update('sat1',e.target.value)}/></label>
     <label>SAT II score / category<input inputMode="numeric" type="number" min="0" step="1" placeholder="Egyptian admission SAT II value" value={values.sat2} onChange={e=>update('sat2',e.target.value)}/><small>This field refers to the Egyptian admission-system SAT II component, not the discontinued SAT Subject Tests.</small></label>
    </div>
    {attempted&&(!valid||!values.university.trim()||!values.faculty.trim())&&<p className="admission-validation"><AlertCircle size={15}/> Enter valid scores, university and faculty to continue.</p>}
   </div>
   <div className="admission-card">
    <div className="admission-card-title"><ShieldCheck size={18}/><div><b>Admission target</b><small>Rules can vary by institution, faculty and year</small></div></div>
    <div className="admission-fields">
     <label>Admission year<select value={values.year} onChange={e=>update('year',e.target.value)}>{['2026','2027'].map(y=><option key={y}>{y}</option>)}</select></label>
     <label>University<input value={values.university} onChange={e=>update('university',e.target.value)} placeholder="Enter university name"/></label>
     <label>Faculty / program<input value={values.faculty} onChange={e=>update('faculty',e.target.value)} placeholder="Enter faculty or program"/></label>
    </div>
    <button className="admission-check" onClick={()=>setAttempted(true)}>Check admission rule</button>
   </div>
  </div>
  {attempted&&valid&&values.university.trim()&&values.faculty.trim()&&<div className="admission-not-ready"><AlertCircle size={19}/><div><b>No verified formula is available yet</b><p>Your inputs are captured, but no admission score or eligibility result will be guessed. The official rule for {values.university}, {values.faculty} and {values.year} must be verified before a calculation can be shown.</p></div></div>}
  <div className="admission-footnote"><Info size={16}/><span>Results will be labelled as estimates unless an official authority publishes a definitive calculation. Each rule version will retain its source, verification date, score scales, minimum requirements and rounding method.</span></div>
 </section>;
}
