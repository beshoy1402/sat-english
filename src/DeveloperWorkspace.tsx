import {useCallback,useEffect,useMemo,useState} from 'react';
import './developer-workspace.css';
import {AlertCircle,ArrowUpRight,ClipboardList,ExternalLink,FileText,MessageSquare,Paperclip,Plus,RefreshCw,Search,Send,ShieldCheck,Upload,X} from 'lucide-react';

type Profile={id:string;display_name:string;username:string|null;role:string};
type Row=Record<string,any>;
type Props={client:any;profile:Profile};
const taskStatuses=['backlog','todo','in_progress','blocked','review','done'];
const bugStatuses=['open','triaged','in_progress','fixed','wont_fix'];
const prStatuses=['draft','review_requested','approved','changes_requested','merged','closed'];
const pretty=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const date=(s?:string)=>s?new Date(s).toLocaleString(): '—';

export default function DeveloperWorkspace({client,profile}:Props){
 const [tab,setTab]=useState<'tasks'|'bugs'|'reviews'>('tasks');
 const [tasks,setTasks]=useState<Row[]>([]),[bugs,setBugs]=useState<Row[]>([]),[prs,setPrs]=useState<Row[]>([]),[people,setPeople]=useState<Profile[]>([]);
 const [selected,setSelected]=useState<Row|null>(null),[comments,setComments]=useState<Row[]>([]),[attachments,setAttachments]=useState<Row[]>([]);
 const [search,setSearch]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [taskForm,setTaskForm]=useState({title:'',description:'',feature_area:'General',priority:'medium',assignee_profile_id:'',due_at:''});
 const [comment,setComment]=useState('');
 const [bugForm,setBugForm]=useState({title:'',description:'',severity:'medium',page_url:'',steps_to_reproduce:'',expected_result:'',actual_result:''});
 const [prForm,setPrForm]=useState({repository_full_name:'beshoy1402/sat-english',pr_number:'',pr_url:'',title:''});
 const load=useCallback(async()=>{
   if(!client)return;
   const [t,b,p,u]=await Promise.all([
    client.from('developer_tasks').select('*').order('updated_at',{ascending:false}),
    client.from('developer_bug_reports').select('*').order('created_at',{ascending:false}),
    client.from('developer_pull_requests').select('*').order('created_at',{ascending:false}),
    client.from('profiles').select('id,display_name,username,role').eq('is_active',true).in('role',['developer','admin','teacher','assistant']).order('display_name')
   ]);
   if(t.error||b.error||p.error||u.error){setNotice(t.error?.message||b.error?.message||p.error?.message||u.error?.message||'Could not load workspace data.');return;}
   setTasks(t.data??[]);setBugs(b.data??[]);setPrs(p.data??[]);setPeople(u.data??[]);
 },[client]);
 useEffect(()=>{void load();},[load]);
 const loadTask=async(task:Row)=>{
   setSelected(task);
   const [c,a]=await Promise.all([
    client.from('developer_task_comments').select('*').eq('task_id',task.id).order('created_at'),
    client.from('developer_task_attachments').select('*').eq('task_id',task.id).order('created_at')
   ]);
   if(c.error||a.error){setNotice(c.error?.message||a.error?.message||'Unable to load task details.');return;}
   setComments(c.data??[]);setAttachments(a.data??[]);
 };
 const createTask=async(e:React.FormEvent)=>{
   e.preventDefault();setBusy(true);
   const {error}=await client.from('developer_tasks').insert({...taskForm,assignee_profile_id:taskForm.assignee_profile_id||null,due_at:taskForm.due_at||null,created_by:profile.id});
   setNotice(error?.message||'Task created.');if(!error){setTaskForm({title:'',description:'',feature_area:'General',priority:'medium',assignee_profile_id:'',due_at:''});await load();}setBusy(false);
 };
 const updateTask=async(id:string,patch:Row)=>{
   setBusy(true);const {error}=await client.from('developer_tasks').update({...patch,updated_at:new Date().toISOString()}).eq('id',id);
   setNotice(error?.message||'Task updated.');if(!error){await load();if(selected?.id===id)await loadTask({...selected,...patch});}setBusy(false);
 };
 const addComment=async(e:React.FormEvent)=>{
   e.preventDefault();if(!selected||!comment.trim())return;setBusy(true);
   const {error}=await client.from('developer_task_comments').insert({task_id:selected.id,author_profile_id:profile.id,body:comment.trim()});
   setNotice(error?.message||'Comment added.');if(!error){setComment('');await loadTask(selected);}setBusy(false);
 };
 const upload=async(e:React.ChangeEvent<HTMLInputElement>)=>{
   const file=e.target.files?.[0];if(!file||!selected)return;
   if(file.size>10*1024*1024){setNotice('Files must be 10 MB or smaller.');e.target.value='';return;}
   setBusy(true);const path=selected.id+'/'+crypto.randomUUID()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
   const up=await client.storage.from('developer-workspace').upload(path,file,{upsert:false});
   if(up.error){setNotice(up.error.message);setBusy(false);return;}
   const {error}=await client.from('developer_task_attachments').insert({task_id:selected.id,uploaded_by:profile.id,file_name:file.name,storage_path:path,mime_type:file.type||null,file_size:file.size});
   if(error){await client.storage.from('developer-workspace').remove([path]);setNotice(error.message);}else{setNotice('Attachment uploaded.');await loadTask(selected);}
   setBusy(false);e.target.value='';
 };
 const openAttachment=async(path:string)=>{
   const popup=window.open('about:blank','_blank');
   if(!popup){setNotice('Allow pop-ups to open attachments, then try again.');return;}
   popup.opener=null;
   const {data,error}=await client.storage.from('developer-workspace').createSignedUrl(path,60);
   if(error||!data?.signedUrl){popup.close();setNotice(error?.message||'Could not create a secure attachment link.');return;}
   popup.location.href=data.signedUrl;
 };
 const createBug=async(e:React.FormEvent)=>{
   e.preventDefault();setBusy(true);const {error}=await client.from('developer_bug_reports').insert({...bugForm,reported_by:profile.id});
   setNotice(error?.message||'Bug report created.');if(!error){setBugForm({title:'',description:'',severity:'medium',page_url:'',steps_to_reproduce:'',expected_result:'',actual_result:''});await load();}setBusy(false);
 };
 const createPr=async(e:React.FormEvent)=>{
   e.preventDefault();setBusy(true);const {error}=await client.from('developer_pull_requests').insert({...prForm,pr_number:Number(prForm.pr_number),submitted_by:profile.id});
   setNotice(error?.message||'Pull request added to review tracker.');if(!error){setPrForm({...prForm,pr_number:'',pr_url:'',title:''});await load();}setBusy(false);
 };
 const filtered=useMemo(()=>{const q=search.toLowerCase();const source=tab==='tasks'?tasks:tab==='bugs'?bugs:prs;return source.filter(r=>JSON.stringify(r).toLowerCase().includes(q));},[tab,tasks,bugs,prs,search]);
 const counts={openTasks:tasks.filter(t=>!['done'].includes(t.status)).length,blocked:tasks.filter(t=>t.status==='blocked').length,openBugs:bugs.filter(b=>!['fixed','wont_fix'].includes(b.status)).length,waiting:prs.filter(p=>['draft','review_requested'].includes(p.status)).length};
 return <section className="dev-workspace">
  <div className="dev-heading"><div><span className="dev-eyebrow">ENGINEERING OPERATIONS</span><h2>Developer workspace</h2><p>Plan work, collaborate on implementation, track bugs and coordinate code reviews.</p></div><button className="dev-refresh" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div>
  <div className="dev-stats"><div><span>Active tasks</span><b>{counts.openTasks}</b></div><div><span>Blocked</span><b>{counts.blocked}</b></div><div><span>Open bugs</span><b>{counts.openBugs}</b></div><div><span>PRs awaiting review</span><b>{counts.waiting}</b></div></div>
  {notice&&<div className="dev-notice">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
  <div className="dev-tabs">{(['tasks','bugs','reviews'] as const).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>{setTab(t);setSearch('');setSelected(null);}}>{t==='tasks'?<ClipboardList size={16}/>:t==='bugs'?<AlertCircle size={16}/>:<ShieldCheck size={16}/>} {t==='tasks'?'Tasks':t==='bugs'?'Bug reports':'Pull requests'}</button>)}</div>
  <div className="dev-grid">
   <div className="dev-main-panel">
    <div className="dev-toolbar"><div className="dev-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={'Search '+tab}/></div><span>{filtered.length} records</span></div>
    {tab==='tasks'&&<form className="dev-create-form" onSubmit={createTask}><h3><Plus size={17}/> Create technical task</h3><div className="dev-form-grid"><label>Task title<input required minLength={3} maxLength={180} value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} placeholder="e.g. Build exam attempt review"/></label><label>Feature area<input value={taskForm.feature_area} onChange={e=>setTaskForm({...taskForm,feature_area:e.target.value})} placeholder="Question bank, Auth…"/></label><label>Assign to<select value={taskForm.assignee_profile_id} onChange={e=>setTaskForm({...taskForm,assignee_profile_id:e.target.value})}><option value="">Unassigned</option>{people.map(p=><option key={p.id} value={p.id}>{p.display_name} · {pretty(p.role)}</option>)}</select></label><label>Priority<select value={taskForm.priority} onChange={e=>setTaskForm({...taskForm,priority:e.target.value})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label>Due date<input type="date" value={taskForm.due_at} onChange={e=>setTaskForm({...taskForm,due_at:e.target.value})}/></label></div><label>Description<textarea rows={2} value={taskForm.description} onChange={e=>setTaskForm({...taskForm,description:e.target.value})} placeholder="Acceptance criteria, implementation notes…"/></label><button className="dev-primary" disabled={busy}>{busy?'Saving…':'Create task'}</button></form>}
    {tab==='bugs'&&<form className="dev-create-form" onSubmit={createBug}><h3><Plus size={17}/> Report a bug</h3><div className="dev-form-grid"><label>Bug title<input required minLength={3} value={bugForm.title} onChange={e=>setBugForm({...bugForm,title:e.target.value})}/></label><label>Severity<select value={bugForm.severity} onChange={e=>setBugForm({...bugForm,severity:e.target.value})}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label><label>Page URL<input type="url" value={bugForm.page_url} onChange={e=>setBugForm({...bugForm,page_url:e.target.value})} placeholder="https://…"/></label></div><label>Description<input required value={bugForm.description} onChange={e=>setBugForm({...bugForm,description:e.target.value})}/></label><div className="dev-form-grid"><label>Steps to reproduce<textarea rows={2} value={bugForm.steps_to_reproduce} onChange={e=>setBugForm({...bugForm,steps_to_reproduce:e.target.value})}/></label><label>Expected result<textarea rows={2} value={bugForm.expected_result} onChange={e=>setBugForm({...bugForm,expected_result:e.target.value})}/></label><label>Actual result<textarea rows={2} value={bugForm.actual_result} onChange={e=>setBugForm({...bugForm,actual_result:e.target.value})}/></label></div><button className="dev-primary" disabled={busy}>Submit bug report</button></form>}
    {tab==='reviews'&&<form className="dev-create-form" onSubmit={createPr}><h3><Plus size={17}/> Track a pull request</h3><div className="dev-form-grid"><label>Repository<input required value={prForm.repository_full_name} onChange={e=>setPrForm({...prForm,repository_full_name:e.target.value})}/></label><label>PR number<input required type="number" min="1" value={prForm.pr_number} onChange={e=>setPrForm({...prForm,pr_number:e.target.value})}/></label><label>Pull request title<input required value={prForm.title} onChange={e=>setPrForm({...prForm,title:e.target.value})}/></label><label>PR URL<input required type="url" value={prForm.pr_url} onChange={e=>setPrForm({...prForm,pr_url:e.target.value})}/></label></div><button className="dev-primary" disabled={busy}>Add to review tracker</button><p className="dev-hint">This tracker records your review workflow. GitHub approval or change-request actions will be connected separately; changing a status here does not submit a GitHub review.</p></form>}
    <div className="dev-record-list">{filtered.map(r=><article className={'dev-record '+(selected?.id===r.id?'selected':'')} key={r.id} onClick={()=>tab==='tasks'&&void loadTask(r)}><div className="dev-record-icon">{tab==='tasks'?<ClipboardList/>:tab==='bugs'?<AlertCircle/>:<FileText/>}</div><div className="dev-record-copy"><b>{r.title}</b><p>{r.description||r.feature_area||r.repository_full_name||r.page_url||''}</p><small>{date(r.updated_at||r.created_at)} {r.priority&&' · '+pretty(r.priority)} {r.assignee_profile_id&&' · '+(people.find(p=>p.id===r.assignee_profile_id)?.display_name||'Assigned')}</small></div><div className="dev-record-actions">{tab==='tasks'?<select aria-label="Task status" value={r.status} onClick={e=>e.stopPropagation()} onChange={e=>void updateTask(r.id,{status:e.target.value})}>{taskStatuses.map(s=><option key={s} value={s}>{pretty(s)}</option>)}</select>:tab==='bugs'?<select aria-label="Bug status" value={r.status} onClick={e=>e.stopPropagation()} onChange={async e=>{setBusy(true);const {error}=await client.from('developer_bug_reports').update({status:e.target.value,updated_at:new Date().toISOString()}).eq('id',r.id);setNotice(error?.message||'Bug status updated.');await load();setBusy(false);}}>{bugStatuses.map(s=><option key={s} value={s}>{pretty(s)}</option>)}</select>:<><a href={r.pr_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}><ExternalLink size={15}/></a><select aria-label="Pull request status" value={r.status} onClick={e=>e.stopPropagation()} onChange={async e=>{setBusy(true);const {error}=await client.from('developer_pull_requests').update({status:e.target.value,reviewer_profile_id:profile.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',r.id);setNotice(error?.message||'Review tracker updated.');await load();setBusy(false);}}>{prStatuses.map(s=><option key={s} value={s}>{pretty(s)}</option>)}</select></>}</div></article>)}
     {filtered.length===0&&<div className="dev-empty">No {tab} found yet.</div>}</div>
   </div>
   {tab==='tasks'&&<aside className="dev-detail-panel">{selected?<><div className="dev-detail-head"><div><span className="dev-eyebrow">TASK DETAILS</span><h3>{selected.title}</h3></div><button onClick={()=>setSelected(null)}><X size={16}/></button></div><div className="dev-detail-meta"><label>Status<select value={selected.status} onChange={e=>void updateTask(selected.id,{status:e.target.value})}>{taskStatuses.map(s=><option key={s} value={s}>{pretty(s)}</option>)}</select></label><label>Assigned to<select value={selected.assignee_profile_id||''} onChange={e=>void updateTask(selected.id,{assignee_profile_id:e.target.value||null})}><option value="">Unassigned</option>{people.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label></div><p className="dev-detail-description">{selected.description||'No description provided.'}</p><div className="dev-subsection"><h4><Paperclip size={15}/> Attachments</h4><label className="dev-upload"><Upload size={15}/> Upload screenshot or file<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/markdown,application/zip" onChange={upload}/></label>{attachments.map(a=><button className="dev-attachment" key={a.id} onClick={()=>void openAttachment(a.storage_path)}><FileText size={14}/>{a.file_name}<ArrowUpRight size={13}/></button>)}</div><div className="dev-subsection"><h4><MessageSquare size={15}/> Comments ({comments.length})</h4><div className="dev-comments">{comments.map(c=><div className="dev-comment" key={c.id}><b>{people.find(p=>p.id===c.author_profile_id)?.display_name||'Developer'}</b><p>{c.body}</p><small>{date(c.created_at)}</small></div>)}</div><form className="dev-comment-form" onSubmit={addComment}><textarea required rows={2} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add a technical update…"/><button className="dev-primary" disabled={busy}><Send size={14}/> Send</button></form></div></>:<div className="dev-select-empty"><ClipboardList size={25}/><b>Select a task</b><p>Open a task to assign ownership, update progress, attach files and discuss implementation.</p></div>}</aside>}
  </div>
 </section>;
}
