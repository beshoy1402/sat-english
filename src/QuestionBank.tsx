import {useCallback,useEffect,useMemo,useState} from 'react';
import {BookOpen,Edit3,Plus,RefreshCw,Search,Trash2,UploadCloud} from 'lucide-react';
import './question-bank.css';
type Row=Record<string,any>;
type ImportRow={sourceRow:number;exam_program:string;topic:string;difficulty:string;passage:string;prompt:string;question_type:string;choices:string[];answer_key:string;explanation:string;points:number;errors:string[];duplicate:boolean};
const normalize=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function parseCsv(source:string):Record<string,string>[]{
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<source.length;i++){const c=source[i];if(quoted){if(c==='"'&&source[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&source[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('CSV contains an unterminated quoted field.');
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);if(!rows.length)return [];
 const headers=rows.shift()!.map(v=>v.trim().toLowerCase().replace(/[\s-]+/g,'_'));
 if(headers.some(h=>!h))throw new Error('CSV contains an empty column heading.');
 if(new Set(headers).size!==headers.length)throw new Error('CSV contains duplicate column headings. Rename each column so every heading is unique.');
 return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??''])));
}
function toImportRow(raw:Record<string,any>,sourceRow:number,existing:Set<string>):ImportRow{
 const choicesRaw=raw.choices??raw.options;
 const structuredChoices=['a','b','c','d'].map(letter=>raw['choice_'+letter]??raw['option_'+letter]??raw['choice'+letter.toUpperCase()]??raw['option'+letter.toUpperCase()]??raw['choice_'+(letter.charCodeAt(0)-96)]??raw['option_'+(letter.charCodeAt(0)-96)]).filter(v=>v!==undefined&&v!==null&&String(v).trim()!=='');
 const listedChoices=Array.isArray(choicesRaw)?choicesRaw.map(v=>typeof v==='string'?v:String(v?.text??v?.label??'')).filter(Boolean):choicesRaw!==undefined?String(choicesRaw).split(/\r?\n/).map(v=>v.trim()).filter(Boolean):[];
 const choices=listedChoices.length?listedChoices:structuredChoices.map(v=>String(v).trim());
 const prompt=String(raw.prompt??raw.question??raw.question_text??'').trim();
 const type=String(raw.question_type??raw.type??'multiple_choice').toLowerCase().replace(/[ -]/g,'_');
 const answer=String(raw.answer_key??raw.answer??raw.correct_answer??'').trim();
 const answerLetter=answer.match(/^([A-D])(?:[).:]|$)/i);
 const answerIndex=answerLetter?answerLetter[1].toUpperCase().charCodeAt(0)-65:-1;
 const normalizedAnswer=answerIndex>=0?(choices[answerIndex]??answer):answer;
 const row:ImportRow={sourceRow,exam_program:String(raw.exam_program??raw.program??'SAT English').trim(),topic:String(raw.topic??raw.skill??raw.domain??'General').trim(),difficulty:String(raw.difficulty??'medium').toLowerCase(),passage:String(raw.passage??raw.reading_passage??'').trim(),prompt,question_type:type,choices,answer_key:normalizedAnswer,explanation:String(raw.explanation??raw.rationale??'').trim(),points:Number(raw.points??1),errors:[],duplicate:false};
 if(!prompt)row.errors.push('Question prompt is required.');
 if(!['multiple_choice','short_answer','essay'].includes(type))row.errors.push('Unsupported question type.');
 if(!['easy','medium','hard'].includes(row.difficulty))row.errors.push('Difficulty must be easy, medium or hard.');
 if(type==='multiple_choice'&&(choices.length<2||!answer||!choices.includes(answer)))row.errors.push('Multiple-choice answer must exactly match one of at least two choices.');
 if(!Number.isFinite(row.points)||row.points<=0||row.points>100)row.errors.push('Points must be between 0 and 100.');
 const key=normalize(prompt);row.duplicate=!!key&&existing.has(key);if(row.duplicate)row.errors.push('Possible duplicate of an existing question.');
 return row;
}


function parseDocumentQuestions(source:string):Record<string,any>[] {
 const lines=source.replace(/\r/g,'').split('\n').map(v=>v.trim()).filter(Boolean);
 const starts:number[]=[];
 lines.forEach((line,index)=>{if(/^(?:(?:question|q)\s*)?\d{1,3}[.)\s:-]+/i.test(line))starts.push(index);});
 if(!starts.length)throw new Error('No numbered question blocks were detected. Use numbered questions with A)–D) choices and Answer: labels, or import CSV/JSON for full control.');
 const prefix=lines.slice(0,starts[0]).join('\n');
 const sharedPassage=/\b(passage|read the following|based on the text below)\b/i.test(prefix)?prefix:'';
 return starts.map((start,index)=>{
  const block=lines.slice(start,starts[index+1]??lines.length);
  const choices:string[]=[];let answer='';let explanation='';const prompt:string[]=[];
  for(const line of block){
   const choice=line.match(/^([A-D])[).:]\s*(.+)$/i);
   const answerMatch=line.match(/^(?:correct\s+)?answer(?:\s+key)?\s*[:\-]\s*(.+)$/i);
   const explanationMatch=line.match(/^(?:explanation|rationale)\s*[:\-]\s*(.+)$/i);
   if(choice){choices.push(choice[2].trim());continue;}
   if(answerMatch){answer=answerMatch[1].trim();continue;}
   if(explanationMatch){explanation=explanationMatch[1].trim();continue;}
   prompt.push(line.replace(/^(?:(?:question|q)\s*)?\d{1,3}[.)\s:-]+/i,'').trim());
  }
  const answerIndex=/^[A-D]$/i.test(answer)?answer.toUpperCase().charCodeAt(0)-65:-1;
  const normalizedAnswer=answerIndex>=0?(choices[answerIndex]??answer):answer;
  return {__sourceRow:start+1,exam_program:'SAT English',topic:'General',difficulty:'medium',passage:sharedPassage,prompt:prompt.filter(Boolean).join(' '),question_type:choices.length>=2?'multiple_choice':'short_answer',choices,answer_key:normalizedAnswer,explanation,points:1};
 });
}
async function readXlsxRows(file:File):Promise<Record<string,any>[]> {
 const {readSheet}=await import('read-excel-file/browser');
 const sheet:any=await readSheet(file);
 const rows:any[][]=Array.isArray(sheet)?sheet:Array.isArray(sheet?.rows)?sheet.rows:Array.isArray(sheet?.data)?sheet.data:[];
 if(!rows.length)throw new Error('The first worksheet is empty.');
 const headers=rows[0].map((v:any)=>String(v??'').trim().toLowerCase().replace(/[\s-]+/g,'_'));
 if(headers.some((h:string)=>!h)||new Set(headers).size!==headers.length)throw new Error('The first worksheet must have unique, non-empty column headings.');
 if(!headers.some((h:string)=>['prompt','question','question_text'].includes(h)))throw new Error('The first worksheet must include a question column named prompt, question or question_text.');
 return rows.slice(1).map((cells:any[],index:number)=>({...Object.fromEntries(headers.map((h:string,i:number)=>[h,cells[i]??''])),__sourceRow:index+2}));
}
async function readDocxText(file:File):Promise<string> {
 const module:any=await import('mammoth');
 const parser=module.default??module;
 const result=await parser.extractRawText({arrayBuffer:await file.arrayBuffer()});
 return String(result.value??'');
}
async function readPdfText(file:File):Promise<string> {
 const pdfjs:any=await import('pdfjs-dist');
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.mjs',import.meta.url).toString();
 const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
 if(pdf.numPages>80)throw new Error('PDF import is limited to 80 pages per file. Split the document into smaller files.');
 const pages:string[]=[];
 for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
  const page=await pdf.getPage(pageNo);const content=await page.getTextContent();
  const lineGroups:{y:number;text:string}[]=[];
  for(const item of content.items as any[]){
   if(typeof item.str!=='string'||!item.str.trim())continue;
   const y=Math.round(Number(item.transform?.[5]??0));
   let group=lineGroups.find(entry=>Math.abs(entry.y-y)<=2);
   if(!group){group={y,text:''};lineGroups.push(group);}
   group.text+=item.str;
  }
  pages.push(lineGroups.sort((a,b)=>b.y-a.y).map(entry=>entry.text.trim()).filter(Boolean).join('\n'));
 }
 const text=pages.join('\n');
 if(!text.trim())throw new Error('No selectable text was found. This PDF may be scanned or image-only; OCR and embedded-image extraction are not enabled yet.');
 return text;
}

type ImportFailure={row:number;prompt:string;error:string};
const empty={exam_program:'SAT English',topic:'Grammar',difficulty:'medium',passage:'',prompt:'',question_type:'multiple_choice',choices:'',answer_key:'',explanation:'',points:'1'};
export default function QuestionBank({client}:{client:any}){
 const [items,setItems]=useState<Row[]>([]),[exams,setExams]=useState<Row[]>([]),[form,setForm]=useState({...empty}),[editing,setEditing]=useState<string|null>(null);
 const [programFilter,setProgramFilter]=useState('all'),[search,setSearch]=useState(''),[selected,setSelected]=useState<string[]>([]),[examId,setExamId]=useState('');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [importRows,setImportRows]=useState<ImportRow[]>([]),[importName,setImportName]=useState(''),[importReport,setImportReport]=useState<{fileName:string;imported:number;skipped:ImportRow[];failures:ImportFailure[]}|null>(null);
 const load=useCallback(async()=>{
  setBusy(true);const [q,e]=await Promise.all([
   client.rpc('staff_list_question_bank_items',{p_exam_program:programFilter==='all'?null:programFilter}),
   client.from('exams').select('id,title,exam_program,status').eq('status','draft').order('created_at',{ascending:false})
  ]);
  if(q.error||e.error){setNotice(q.error?.message||e.error?.message||'Unable to load question bank.');setBusy(false);return;}
  setItems(q.data??[]);setExams(e.data??[]);if(!examId&&e.data?.length)setExamId(e.data[0].id);setBusy(false);
 },[client,programFilter,examId]);
 useEffect(()=>{void load();},[load]);
 const filtered=useMemo(()=>items.filter(q=>[q.prompt,q.topic,q.passage,q.explanation].join(' ').toLowerCase().includes(search.toLowerCase())),[items,search]);

 const readImport=async(file:File)=>{
  setNotice('');setImportRows([]);setImportName(file.name);
  try{
   if(file.size>25*1024*1024)throw new Error('Import files are limited to 25 MB.');
   const name=file.name.toLowerCase();let raw:Record<string,any>[];
   if(name.endsWith('.csv'))raw=parseCsv((await file.text()).replace(new RegExp('^'+String.fromCharCode(0xfeff)), ''));
   else if(name.endsWith('.json')){const parsed=JSON.parse(await file.text());raw=Array.isArray(parsed)?parsed:parsed.questions;if(!Array.isArray(raw))throw new Error('JSON must be an array or an object containing a questions array.');}
   else if(name.endsWith('.xlsx'))raw=await readXlsxRows(file);
   else if(name.endsWith('.docx'))raw=parseDocumentQuestions(await readDocxText(file));
   else if(name.endsWith('.pdf'))raw=parseDocumentQuestions(await readPdfText(file));
   else throw new Error('Choose CSV, JSON, XLSX, DOCX or a text-based PDF file.');
   if(!raw.length)throw new Error('The file contains no question rows.');
   if(name.endsWith('.csv')&&!Object.keys(raw[0]).some(key=>['prompt','question','question_text'].includes(key)))throw new Error('CSV header must include a question column named prompt, question or question_text.');
   if(raw.length>2500)throw new Error('Import is limited to 2,500 questions per file. Split larger files into smaller batches.');
   const existing=new Set(items.map(q=>normalize(String(q.prompt??''))));
   const seen=new Set<string>();
   const rowOffset=name.endsWith('.csv')?2:1;
   const mapped=raw.map((r,i)=>{const item=toImportRow(r,Number(r.__sourceRow??i+rowOffset),existing);const key=normalize(item.prompt);if(key&&seen.has(key)){item.duplicate=true;item.errors.push('Duplicate prompt within this file.');}if(key)seen.add(key);return item;});
   setImportRows(mapped);
   setNotice('Preview ready: '+mapped.length+' rows, '+mapped.filter(r=>!r.errors.length).length+' valid, '+mapped.filter(r=>r.errors.length).length+' need attention. Document extraction may need manual review; scanned PDF images are not OCR-processed.');
  }catch(error){setNotice(error instanceof Error?error.message:'Could not read this import file.');}
 };
 const runImport=async()=>{
  const ready=importRows.filter(r=>!r.errors.length);if(!ready.length){setNotice('There are no valid rows to import.');return;}
  if(!window.confirm(`Import ${ready.length} validated questions into the reusable bank?`))return;
  setBusy(true);let imported=0;const failures:ImportFailure[]=[];
  for(let i=0;i<ready.length;i+=5){
   const batch=ready.slice(i,i+5);
   const results=await Promise.all(batch.map(async q=>{try{const {error}=await client.rpc('staff_save_question_bank_item',{p_id:null,p_exam_program:q.exam_program,p_topic:q.topic,p_difficulty:q.difficulty,p_passage:q.passage,p_prompt:q.prompt,p_question_type:q.question_type,p_choices:q.choices,p_answer_key:q.answer_key||null,p_explanation:q.explanation,p_points:q.points});return {row:q.sourceRow,error:error?.message??'',prompt:q.prompt};}catch(e){return {row:q.sourceRow,error:e instanceof Error?e.message:'Unknown error',prompt:q.prompt};}}));
   results.forEach(r=>{if(r.error)failures.push({row:r.row,prompt:r.prompt,error:r.error});else imported++;});
  }
  const skipped=importRows.filter(r=>r.errors.length>0);setImportReport({fileName:importName,imported,skipped,failures});
  setNotice(`Import finished: ${imported} added, ${skipped.length} skipped during validation, ${failures.length} failed while saving.`);
  setImportRows([]);await load();setBusy(false);
 };
 const downloadImportReport=()=>{
  if(!importReport)return;
  const cells=[['Source file','Row','Status','Question','Details'],...importReport.skipped.map(r=>[importReport.fileName,String(r.sourceRow),'Skipped',r.prompt,r.errors.join('; ')]),...importReport.failures.map(r=>[importReport.fileName,String(r.row),'Save failed',r.prompt,r.error])];
  const csv=cells.map(row=>row.map(value=>{const s=String(value??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='question-import-report.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
 };
 const reset=()=>{setForm({...empty});setEditing(null);};
 const save=async(e:React.FormEvent)=>{
  e.preventDefault();const choices=form.choices.split('\n').map(s=>s.trim()).filter(Boolean);
  if(form.question_type==='multiple_choice'&&(choices.length<2||!choices.includes(form.answer_key.trim()))){setNotice('Multiple-choice questions need at least two options and an answer key that matches one option.');return;}
  const pts=Number(form.points);if(!Number.isFinite(pts)||pts<=0||pts>100){setNotice('Points must be between 0 and 100.');return;}
  setBusy(true);
  try{
   const {error}=await client.rpc('staff_save_question_bank_item',{p_id:editing,p_exam_program:form.exam_program,p_topic:form.topic,p_difficulty:form.difficulty,p_passage:form.passage,p_prompt:form.prompt,p_question_type:form.question_type,p_choices:choices,p_answer_key:form.answer_key.trim()?form.answer_key.trim():null,p_explanation:form.explanation,p_points:pts});
   setNotice(error?.message||(editing?'Question updated.':'Question added to the bank.'));
   if(!error){reset();await load();}
  }catch(error){setNotice(error instanceof Error?error.message:'Could not save this question.');}
  finally{setBusy(false);}
 };
 const edit=(q:Row)=>{
  setEditing(q.id);setForm({exam_program:q.exam_program,topic:q.topic,difficulty:q.difficulty,passage:q.passage||'',prompt:q.prompt,question_type:q.question_type,choices:(q.choices??[]).map((v:any)=>typeof v==='string'?v:JSON.stringify(v)).join('\n'),answer_key:typeof q.answer_key==='string'?q.answer_key:q.answer_key===null?'':JSON.stringify(q.answer_key),explanation:q.explanation||'',points:String(q.points)});
 };
 const remove=async(id:string)=>{
  if(!window.confirm('Delete this question from the reusable question bank?'))return;setBusy(true);
  try{
   const {error}=await client.rpc('staff_delete_question_bank_item',{p_id:id});setNotice(error?.message||'Question removed.');if(!error)await load();
  }catch(error){setNotice(error instanceof Error?error.message:'Could not delete this question.');}
  finally{setBusy(false);}
 };
 const addToExam=async()=>{
  if(!examId||!selected.length){setNotice('Select an exam and at least one question.');return;}
  setBusy(true);
  try{
   const {data,error}=await client.rpc('staff_add_bank_items_to_exam',{p_exam_id:examId,p_item_ids:selected});
   setNotice(error?.message||(data+' question(s) added to the exam.'));if(!error){setSelected([]);await load();}
  }catch(error){setNotice(error instanceof Error?error.message:'Could not add questions to this exam.');}
  finally{setBusy(false);}
 };
 return <section className="question-bank"><div className="question-bank-head"><div><span>ACADEMIC CONTENT LIBRARY</span><h2>Question bank</h2><p>Create reusable SAT, EST and ACT English questions and assemble exams.</p></div><button onClick={()=>void load()} disabled={busy}><RefreshCw size={14}/> Refresh</button></div>{notice&&<div className="question-bank-notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
  <div className="question-bank-layout"><form className="question-bank-form" onSubmit={save}><h3>{editing?<Edit3 size={15}/>:<Plus size={15}/>} {editing?'Edit question':'Create question'}</h3><label>Exam program<select value={form.exam_program} onChange={e=>setForm({...form,exam_program:e.target.value})}><option>SAT English</option><option>EST English</option><option>ACT English</option></select></label><div className="question-bank-two"><label>Topic<input value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})}/></label><label>Difficulty<select value={form.difficulty} onChange={e=>setForm({...form,difficulty:e.target.value})}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label></div><label>Question type<select value={form.question_type} onChange={e=>setForm({...form,question_type:e.target.value})}><option value="multiple_choice">Multiple choice</option><option value="short_answer">Short answer</option><option value="essay">Written response</option></select></label><label>Reading passage (optional)<textarea rows={4} value={form.passage} onChange={e=>setForm({...form,passage:e.target.value})} placeholder="Paste the passage here…"/></label><label>Question prompt<textarea required rows={4} value={form.prompt} onChange={e=>setForm({...form,prompt:e.target.value})} placeholder="Write the question…"/></label>{form.question_type==='multiple_choice'&&<label>Answer choices (one per line)<textarea required rows={4} value={form.choices} onChange={e=>setForm({...form,choices:e.target.value})} placeholder={'A. ...\nB. ...\nC. ...\nD. ...'}/></label>}<label>Correct answer / answer key<input value={form.answer_key} onChange={e=>setForm({...form,answer_key:e.target.value})} placeholder={form.question_type==='essay'?'Optional manual rubric':'Copy the exact correct choice from above'}/></label><label>Explanation<textarea rows={3} value={form.explanation} onChange={e=>setForm({...form,explanation:e.target.value})}/></label><label>Points<input type="number" min="0.25" max="100" step="0.25" value={form.points} onChange={e=>setForm({...form,points:e.target.value})}/></label><div className="question-bank-form-actions"><button disabled={busy}>{busy?'Saving…':editing?'Save changes':'Add question'}</button>{editing&&<button type="button" className="secondary" onClick={reset}>Cancel</button>}</div></form>
   <div className="question-bank-library"><div className="question-bank-import"><div><b>Bulk import</b><small>CSV · JSON · XLSX · DOCX · text PDF · preview and validate · 25 MB / 2,500 rows</small></div><label className="question-bank-file">Choose file<input type="file" accept=".csv,.json,.xlsx,.docx,.pdf,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" onChange={e=>{const file=e.target.files?.[0];if(file)void readImport(file);e.currentTarget.value='';}}/></label></div>
    {importRows.length>0&&<div className="question-bank-preview"><div className="question-bank-preview-head"><div><b>Preview: {importName}</b><small>{importRows.filter(r=>!r.errors.length).length} valid · {importRows.filter(r=>r.errors.length).length} need attention</small></div><div><button className="secondary" onClick={()=>setImportRows([])}>Discard</button><button onClick={()=>void runImport()} disabled={busy||!importRows.some(r=>!r.errors.length)}>Import valid rows</button></div></div><div className="question-bank-preview-list">{importRows.slice(0,100).map((r,i)=><article key={`${r.sourceRow}-${i}`}><div><b>Row {r.sourceRow}: {r.prompt||'(missing prompt)'}</b><small>{r.exam_program} · {r.topic} · {r.question_type}</small>{r.errors.map((e,j)=><em key={j}>{e}</em>)}</div><span className={r.errors.length?'invalid':'valid'}>{r.errors.length?'Review':'Valid'}</span></article>)}</div>{importRows.length>100&&<small>Showing first 100 rows. Validation covers all {importRows.length} rows.</small>}</div>}
   {importReport&&<div className="question-bank-import-report"><div><b>Last import report</b><small>{importReport.fileName} · {importReport.imported} imported · {importReport.skipped.length} skipped · {importReport.failures.length} save failures</small></div><button type="button" onClick={downloadImportReport}>Download error report CSV</button></div>}
   <div className="question-bank-toolbar"><div><h3><BookOpen size={15}/> Reusable questions ({items.length})</h3><small>Search by topic, passage or prompt.</small></div><div className="question-bank-filters"><div><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search"/></div><select value={programFilter} onChange={e=>{setProgramFilter(e.target.value);setSelected([]);}}><option value="all">All programs</option><option>SAT English</option><option>EST English</option><option>ACT English</option></select></div></div>
    <div className="question-bank-add"><select value={examId} onChange={e=>setExamId(e.target.value)}><option value="">Choose exam to assemble</option>{exams.map(e=><option key={e.id} value={e.id}>{e.title} · {e.exam_program}</option>)}</select><button onClick={()=>void addToExam()} disabled={busy||!selected.length}><UploadCloud size={14}/> Add {selected.length} selected to exam</button></div>
    <div className="question-bank-items">{filtered.map(q=><article key={q.id}><label><input type="checkbox" checked={selected.includes(q.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,q.id]:old.filter(id=>id!==q.id))}/><div><span>{q.exam_program} · {q.topic} · {q.difficulty}</span><b>{q.prompt}</b><small>{q.question_type.replaceAll('_',' ')} · {q.points} points · {q.choices?.length??0} choices</small></div></label><div><button onClick={()=>edit(q)} title="Edit"><Edit3 size={13}/></button><button onClick={()=>void remove(q.id)} title="Delete"><Trash2 size={13}/></button></div></article>)}{!filtered.length&&<div className="question-bank-empty">No questions match this filter.</div>}</div>
   </div>
  </div>
 </section>;
}
