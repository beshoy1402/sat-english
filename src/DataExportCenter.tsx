import {useState} from 'react';
import {Download,FileSpreadsheet,Printer,RefreshCw} from 'lucide-react';
import './data-export.css';
type Row=Record<string,any>;
const datasets=[
 {id:'students',label:'Student directory',description:'Active student account details'},
 {id:'grades',label:'Gradebook records',description:'Scores, adjustments and grade dates'},
 {id:'attendance',label:'Attendance records',description:'Session attendance and status'},
 {id:'homework',label:'Homework submissions',description:'Assignments, student submissions and teacher review'},
 {id:'exams',label:'Exam attempts',description:'Exam attempts, grades and review status'},
 {id:'courses',label:'Course access',description:'Courses and student enrollment access'},
];
const csv=(value:any)=>{const s=value===null||value===undefined?'':typeof value==='object'?JSON.stringify(value):String(value);return '"'+s.replaceAll('"','""')+'"';};
export default function DataExportCenter({client}:{client:any}){
 const [dataset,setDataset]=useState('students'),[rows,setRows]=useState<Row[]>([]),[columns,setColumns]=useState<string[]>([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const load=async()=>{
  setBusy(true);setNotice('');
  try{
   let data:Row[]=[];
   if(dataset==='students'){
    const r=await client.from('profiles').select('id,display_name,username,role,is_active,created_at').eq('role','student').order('display_name');if(r.error)throw r.error;data=r.data??[];
   }else if(dataset==='grades'){
    const [g,p]=await Promise.all([client.from('grade_entries').select('*').order('grade_date',{ascending:false}).limit(10000),client.from('profiles').select('id,display_name,username').eq('role','student')]);if(g.error||p.error)throw g.error||p.error;data=(g.data??[]).map((r:Row)=>({...r,student_name:p.data?.find((x:Row)=>x.id===r.student_profile_id)?.display_name||''}));
   }else if(dataset==='attendance'){
    const [a,s,p]=await Promise.all([client.from('attendance_records').select('*').order('marked_at',{ascending:false}).limit(10000),client.from('attendance_sessions').select('id,title,starts_at'),client.from('profiles').select('id,display_name').eq('role','student')]);if(a.error||s.error||p.error)throw a.error||s.error||p.error;data=(a.data??[]).map((r:Row)=>({...r,session_title:s.data?.find((x:Row)=>x.id===r.session_id)?.title||'',session_date:s.data?.find((x:Row)=>x.id===r.session_id)?.starts_at||'',student_name:p.data?.find((x:Row)=>x.id===r.student_profile_id)?.display_name||''}));
   }else if(dataset==='homework'){
    const [a,s,p]=await Promise.all([client.from('assignments').select('*'),client.from('submissions').select('*').order('submitted_at',{ascending:false}).limit(10000),client.from('profiles').select('id,display_name').eq('role','student')]);if(a.error||s.error||p.error)throw a.error||s.error||p.error;data=(s.data??[]).map((r:Row)=>({...r,assignment_title:a.data?.find((x:Row)=>x.id===r.assignment_id)?.title||'',student_name:p.data?.find((x:Row)=>x.id===r.student_profile_id)?.display_name||''}));
   }else if(dataset==='exams'){
    const [a,e,p]=await Promise.all([client.from('exam_attempts').select('*').order('started_at',{ascending:false}).limit(10000),client.from('exams').select('id,title,exam_program'),client.from('profiles').select('id,display_name').eq('role','student')]);if(a.error||e.error||p.error)throw a.error||e.error||p.error;data=(a.data??[]).map((r:Row)=>({...r,exam_title:e.data?.find((x:Row)=>x.id===r.exam_id)?.title||'',student_name:p.data?.find((x:Row)=>x.id===r.student_profile_id)?.display_name||''}));
   }else{
    const [a,c,p]=await Promise.all([client.from('course_access').select('*').order('created_at',{ascending:false}),client.from('courses').select('id,title,exam_program'),client.from('profiles').select('id,display_name').eq('role','student')]);if(a.error||c.error||p.error)throw a.error||c.error||p.error;data=(a.data??[]).map((r:Row)=>({...r,course_title:c.data?.find((x:Row)=>x.id===r.course_id)?.title||'',student_name:p.data?.find((x:Row)=>x.id===r.student_profile_id)?.display_name||''}));
   }
   const cols=[...new Set(data.flatMap(r=>Object.keys(r)))];setRows(data);setColumns(cols);setLoaded(true);setNotice('Loaded '+data.length.toLocaleString()+' records.');
  }catch(e){setNotice(e instanceof Error?e.message:'Could not load export data.');setRows([]);setColumns([]);setLoaded(false);}
  setBusy(false);
 };
 const download=()=>{
  if(!loaded||!rows.length){setNotice('Load records before exporting.');return;}
  const content=[columns.map(csv).join(','),...rows.map(r=>columns.map(k=>csv(r[k])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='sat-english-'+dataset+'-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);
 };
 return <section className="data-export"><div className="data-export-head"><div><span>DATA MANAGEMENT</span><h2>Data Export Center</h2><p>Prepare structured reports for authorized academic and administrative use.</p></div><button onClick={()=>void load()} disabled={busy}><RefreshCw size={14}/> Load data</button></div>{notice&&<div className="data-export-notice">{notice}</div>}<div className="data-export-options"><label>Dataset<select value={dataset} onChange={e=>{setDataset(e.target.value);setLoaded(false);setRows([]);}}>{datasets.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label><p>{datasets.find(d=>d.id===dataset)?.description}</p><div><button onClick={download} disabled={!loaded||!rows.length}><Download size={14}/> Export CSV for Excel</button><button onClick={()=>window.print()} disabled={!loaded||!rows.length}><Printer size={14}/> Print / Save PDF</button></div></div><div className="data-export-preview"><header><h3><FileSpreadsheet size={16}/> Report preview</h3><span>{rows.length.toLocaleString()} rows · {columns.length} columns</span></header>{loaded&&rows.length?<div className="data-export-table"><table><thead><tr>{columns.slice(0,8).map(k=><th key={k}>{k.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.slice(0,50).map((r,i)=><tr key={i}>{columns.slice(0,8).map(k=><td key={k}>{r[k]===null||r[k]===undefined?'—':typeof r[k]==='object'?JSON.stringify(r[k]):String(r[k])}</td>)}</tr>)}</tbody></table>{rows.length>50&&<small>Preview shows the first 50 records. CSV export includes all loaded records.</small>}</div>:<div className="data-export-empty">Choose a dataset and load records to preview the report.</div>}</div><small className="data-export-footnote">CSV files open in Excel. Print / Save PDF uses your browser's print dialog. Exports contain sensitive student information and should only be shared with authorized people.</small></section>;
}
