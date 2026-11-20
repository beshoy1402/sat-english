import {useCallback,useEffect,useState} from 'react';
import {Link2,Plus,RefreshCw,Trash2,Users} from 'lucide-react';
import './parent-link-manager.css';
type Row=Record<string,any>;
type Props={client:any};
export default function ParentLinkManager({client}:Props){
 const [parents,setParents]=useState<Row[]>([]),[students,setStudents]=useState<Row[]>([]),[links,setLinks]=useState<Row[]>([]);
 const [parentId,setParentId]=useState(''),[studentId,setStudentId]=useState(''),[relationship,setRelationship]=useState('parent');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  const [p,s,l]=await Promise.all([
   client.from('profiles').select('id,display_name,username').eq('role','parent').eq('is_active',true).order('display_name'),
   client.from('profiles').select('id,display_name,username').eq('role','student').eq('is_active',true).order('display_name'),
   client.from('parent_student_links').select('*').order('created_at',{ascending:false})
  ]);
  const err=p.error||s.error||l.error;if(err){setNotice(err.message);return;}
  setParents(p.data??[]);setStudents(s.data??[]);setLinks(l.data??[]);
  if(!parentId&&p.data?.length)setParentId(p.data[0].id);if(!studentId&&s.data?.length)setStudentId(s.data[0].id);
 },[client,parentId,studentId]);
 useEffect(()=>{void load();},[load]);
 const add=async(e:React.FormEvent)=>{
  e.preventDefault();if(!parentId||!studentId){setNotice('Choose a parent and a student.');return;}
  setBusy(true);const {error}=await client.from('parent_student_links').upsert({parent_profile_id:parentId,student_profile_id:studentId,relationship},{onConflict:'parent_profile_id,student_profile_id'});
  setNotice(error?.message||'Parent and student linked.');if(!error)await load();setBusy(false);
 };
 const remove=async(id:string)=>{
  if(!window.confirm('Remove this parent-child link?'))return;setBusy(true);
  const {error}=await client.from('parent_student_links').delete().eq('id',id);
  setNotice(error?.message||'Parent-child link removed.');if(!error)await load();setBusy(false);
 };
 const name=(id:string,list:Row[])=>list.find(r=>r.id===id)?.display_name||id;
 return <section className="parent-links"><div className="parent-links-head"><div><h3><Link2 size={16}/> Parent and student links</h3><p>Connect parent accounts to one or more student profiles.</p></div><button onClick={()=>void load()}><RefreshCw size={14}/></button></div>{notice&&<div className="parent-links-notice">{notice}</div>}
  <form onSubmit={add}><label>Parent account<select required value={parentId} onChange={e=>setParentId(e.target.value)}><option value="">Select parent</option>{parents.map(p=><option key={p.id} value={p.id}>{p.display_name} (@{p.username})</option>)}</select></label><label>Student account<select required value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{s.display_name} (@{s.username})</option>)}</select></label><label>Relationship<select value={relationship} onChange={e=>setRelationship(e.target.value)}><option value="parent">Parent</option><option value="guardian">Guardian</option><option value="other">Other</option></select></label><button disabled={busy||!parents.length||!students.length}><Plus size={14}/> Link accounts</button></form>
  <div className="parent-links-list"><b>Current links ({links.length})</b>{links.map(l=><article key={l.id}><span><Users size={14}/></span><div><b>{name(l.parent_profile_id,parents)}</b><small>{pretty(l.relationship||'parent')} of {name(l.student_profile_id,students)}</small></div><button onClick={()=>void remove(l.id)} disabled={busy} title="Remove link"><Trash2 size={14}/></button></article>)}{!links.length&&<p>No parent-child links yet.</p>}</div>
 </section>;
}
function pretty(s:string){return s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}
