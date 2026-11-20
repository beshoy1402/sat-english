import {useCallback,useEffect,useMemo,useState} from 'react';
import {Plus,RefreshCw,Users,X} from 'lucide-react';
import './group-center.css';
type Row=Record<string,any>;
type Profile={id:string;role:string};
export default function GroupCenter({client,profile}:{client:any;profile:Profile}){
 const staff=['admin','teacher','assistant'].includes(profile.role),parent=profile.role==='parent';
 const [groups,setGroups]=useState<Row[]>([]),[members,setMembers]=useState<Row[]>([]),[students,setStudents]=useState<Row[]>([]),[courses,setCourses]=useState<Row[]>([]),[children,setChildren]=useState<Row[]>([]);
 const [childId,setChildId]=useState(''),[selectedGroup,setSelectedGroup]=useState(''),[selectedStudents,setSelectedStudents]=useState<string[]>([]);
 const [name,setName]=useState(''),[description,setDescription]=useState(''),[courseId,setCourseId]=useState('');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  if(staff){
   const [g,m,s,c]=await Promise.all([
    client.from('student_groups').select('*').order('created_at',{ascending:false}),
    client.from('student_group_members').select('*'),
    client.from('profiles').select('id,display_name,username').eq('role','student').eq('is_active',true).order('display_name'),
    client.from('courses').select('id,title').order('title')
   ]);
   const err=g.error||m.error||s.error||c.error;if(err){setNotice(err.message);return;}
   setGroups(g.data??[]);setMembers(m.data??[]);setStudents(s.data??[]);setCourses(c.data??[]);
   if(!selectedGroup&&g.data?.length)setSelectedGroup(g.data[0].id);
  }else{
   let id=profile.id;
   if(parent){
    const {data:l,error}=await client.from('parent_student_links').select('student_profile_id').eq('parent_profile_id',profile.id);
    if(error){setNotice(error.message);return;}const ids=(l??[]).map((x:any)=>x.student_profile_id);
    if(!ids.length){setChildren([]);setGroups([]);setMembers([]);return;}
    const {data:p,error:pe}=await client.from('profiles').select('id,display_name').in('id',ids).order('display_name');
    if(pe){setNotice(pe.message);return;}setChildren(p??[]);if(!childId&&p?.length)setChildId(p[0].id);id=childId||ids[0];
   }
   const {data:m,error}=await client.from('student_group_members').select('*').eq('student_profile_id',id);
   if(error){setNotice(error.message);return;}setMembers(m??[]);
   const ids=[...new Set((m??[]).map((x:any)=>x.group_id))];
   const {data:g,error:ge}=ids.length?await client.from('student_groups').select('*').in('id',ids):{data:[],error:null};
   if(ge){setNotice(ge.message);return;}setGroups(g??[]);
  }
 },[client,staff,parent,profile.id,childId,selectedGroup]);
 useEffect(()=>{void load();},[load]);
 const current=groups.find(g=>g.id===selectedGroup);
 const currentMembers=useMemo(()=>members.filter(m=>m.group_id===selectedGroup),[members,selectedGroup]);
 const create=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);const {data,error}=await client.from('student_groups').insert({name:name.trim(),description:description.trim(),course_id:courseId||null,created_by:profile.id}).select('*').single();
  setNotice(error?.message||'Student group created.');if(!error){setName('');setDescription('');setCourseId('');await load();setSelectedGroup(data.id);}setBusy(false);
 };
 const addMembers=async(e:React.FormEvent)=>{
  e.preventDefault();if(!selectedGroup||!selectedStudents.length){setNotice('Select a group and at least one student.');return;}
  setBusy(true);const payload=selectedStudents.map(student_profile_id=>({group_id:selectedGroup,student_profile_id,added_by:profile.id}));
  const {error}=await client.from('student_group_members').upsert(payload,{onConflict:'group_id,student_profile_id'});
  setNotice(error?.message||'Students added to group.');if(!error){setSelectedStudents([]);await load();}setBusy(false);
 };
 const remove=async(id:string)=>{
  if(!window.confirm('Remove this student from the group?'))return;setBusy(true);
  const {error}=await client.from('student_group_members').delete().eq('id',id);
  setNotice(error?.message||'Student removed from group.');if(!error)await load();setBusy(false);
 };
 if(!staff&&parent&&!children.length)return <section className="group-center"><div className="group-empty"><Users/><b>No linked student account</b><p>Ask the school team to link your parent account.</p></div></section>;
 return <section className="group-center"><div className="group-heading"><div><span>CLASS ORGANIZATION</span><h2>{staff?'Classes and groups':'My class groups'}</h2><p>{staff?'Organize students into teaching groups and course cohorts.':'See the groups your account belongs to.'}</p></div><button onClick={()=>void load()}><RefreshCw size={14}/> Refresh</button></div>{notice&&<div className="group-notice">{notice}<button onClick={()=>setNotice('')}><X size={13}/></button></div>}
  {parent&&<label className="group-child">Child<select value={childId} onChange={e=>setChildId(e.target.value)}>{children.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label>}
  {staff?<div className="group-layout"><form className="group-form" onSubmit={create}><h3><Plus size={15}/> Create a group</h3><label>Group name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. SAT English - Evening A"/></label><label>Description<textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Related course<select value={courseId} onChange={e=>setCourseId(e.target.value)}><option value="">No course linked</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><button className="group-primary" disabled={busy}>Create group</button></form><div className="group-list"><h3>Groups ({groups.length})</h3>{groups.map(g=><button key={g.id} className={selectedGroup===g.id?'active':''} onClick={()=>setSelectedGroup(g.id)}><b>{g.name}</b><small>{g.description||'No description'} · {members.filter(m=>m.group_id===g.id).length} students</small></button>)}{!groups.length&&<p>No groups created yet.</p>}</div><div className="group-members"><h3>{current?.name||'Group members'} ({currentMembers.length})</h3>{current&&<><form onSubmit={addMembers}><div className="group-student-pick">{students.filter(s=>!currentMembers.some(m=>m.student_profile_id===s.id)).map(s=><label key={s.id}><input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={e=>setSelectedStudents(old=>e.target.checked?[...old,s.id]:old.filter(id=>id!==s.id))}/>{s.display_name}</label>)}</div><button className="group-primary" disabled={busy||!selectedStudents.length}>Add {selectedStudents.length} students</button></form><div className="group-member-list">{currentMembers.map(m=><article key={m.id}><div><b>{students.find(s=>s.id===m.student_profile_id)?.display_name||m.student_profile_id}</b><small>{students.find(s=>s.id===m.student_profile_id)?.username||''}</small></div><button onClick={()=>void remove(m.id)} disabled={busy}><X size={13}/></button></article>)}{!currentMembers.length&&<p>No students in this group.</p>}</div></>}</div></div>:<div className="group-card-grid">{groups.map(g=><article key={g.id}><span><Users size={16}/></span><div><b>{g.name}</b><p>{g.description||'Class group'}</p><small>{courses.find(c=>c.id===g.course_id)?.title||'Course group'}</small></div></article>)}{!groups.length&&<div className="group-empty"><Users/><b>No groups yet</b><p>Your class groups will appear here when the teaching team adds your account.</p></div>}</div>}
 </section>;
}
