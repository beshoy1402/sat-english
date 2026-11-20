import {useCallback,useEffect,useMemo,useState} from 'react';
import {BookOpen,CalendarClock,CheckCircle2,ExternalLink,FileText,MapPin,Play,Plus,RefreshCw,Upload,Users} from 'lucide-react';
import './course-center.css';

type Row=Record<string,any>;
type Profile={id:string;display_name?:string;role:string};
type Props={client:any;profile:Profile;view:'courses'|'lessons'|'courseAccess'};
const programs=['SAT English','EST English','ACT English'];
const pretty=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const dt=(v?:string)=>v?new Date(v).toLocaleString():'Not scheduled';

export default function CourseCenter({client,profile,view}:Props){
 const staff=['admin','teacher','assistant'].includes(profile.role),parent=profile.role==='parent';
 const [courses,setCourses]=useState<Row[]>([]),[lessons,setLessons]=useState<Row[]>([]),[access,setAccess]=useState<Row[]>([]),[progress,setProgress]=useState<Row[]>([]);
 const [students,setStudents]=useState<Row[]>([]),[children,setChildren]=useState<Row[]>([]),[childId,setChildId]=useState('');
 const [selectedCourse,setSelectedCourse]=useState(''),[selectedStudents,setSelectedStudents]=useState<string[]>([]);
 const [courseForm,setCourseForm]=useState({title:'',description:'',exam_program:'SAT English',status:'locked'});
 const [lessonForm,setLessonForm]=useState({course_id:'',title:'',description:'',content_type:'text',delivery_mode:'self_paced',live_provider:'google_meet',live_url:'',content_url:'',location:'',starts_at:'',ends_at:'',duration_minutes:'',is_published:true});
 const [contentFile,setContentFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  if(staff){
   const [c,l,a,p]=await Promise.all([
    client.from('courses').select('*').order('created_at',{ascending:false}),
    client.from('lessons').select('*').order('sort_order'),
    client.from('course_access').select('*').order('created_at',{ascending:false}),
    client.from('profiles').select('id,display_name,username').eq('role','student').eq('is_active',true).order('display_name')
   ]);
   const err=c.error||l.error||a.error||p.error;if(err){setNotice(err.message);return;}
   setCourses(c.data??[]);setLessons(l.data??[]);setAccess(a.data??[]);setStudents(p.data??[]);
   if(!lessonForm.course_id&&c.data?.length)setLessonForm(old=>({...old,course_id:c.data![0].id}));
  }else{
   let target=profile.id;
   if(parent){
    const {data:links,error}=await client.from('parent_student_links').select('student_profile_id').eq('parent_profile_id',profile.id);
    if(error){setNotice(error.message);return;}
    const ids=(links??[]).map((x:any)=>x.student_profile_id);
    if(!ids.length){setChildren([]);setCourses([]);setLessons([]);setProgress([]);return;}
    const {data:p,error:pe}=await client.from('profiles').select('id,display_name,username').in('id',ids).order('display_name');
    if(pe){setNotice(pe.message);return;}setChildren(p??[]);
    if(!childId&&p?.length)setChildId(p[0].id);
    target=childId||ids[0];
   }
   const {data:a,error:ae}=await client.from('course_access').select('*').eq('student_profile_id',target);
   if(ae){setNotice(ae.message);return;}setAccess(a??[]);
   const ids=[...new Set((a??[]).filter((x:any)=>x.status==='active').map((x:any)=>x.course_id))];
   if(!ids.length){setCourses([]);setLessons([]);setProgress([]);return;}
   const [c,l,p]=await Promise.all([
    client.from('courses').select('*').in('id',ids),
    client.from('lessons').select('*').in('course_id',ids).eq('is_published',true).order('sort_order'),
    client.from('lesson_progress').select('*').eq('student_profile_id',target)
   ]);
   const err=c.error||l.error||p.error;if(err){setNotice(err.message);return;}
   setCourses(c.data??[]);setLessons(l.data??[]);setProgress(p.data??[]);
  }
 },[client,staff,parent,profile.id,childId,lessonForm.course_id]);
 useEffect(()=>{void load();},[load]);
 const progressMap=useMemo(()=>Object.fromEntries(progress.map(p=>[p.lesson_id,p])),[progress]);
 const createCourse=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);
  const {error}=await client.from('courses').insert({...courseForm,created_by:profile.id}).select().single();
  setNotice(error?.message||'Course created. Grant course access to students when ready.');if(!error){setCourseForm({title:'',description:'',exam_program:'SAT English',status:'locked'});await load();}setBusy(false);
 };
 const updateCourse=async(c:Row,status:string)=>{
  setBusy(true);const {error}=await client.from('courses').update({status,updated_at:new Date().toISOString()}).eq('id',c.id);
  setNotice(error?.message||'Course status updated.');if(!error)await load();setBusy(false);
 };
 const createLesson=async(e:React.FormEvent)=>{
  e.preventDefault();if(!lessonForm.course_id){setNotice('Select a course first.');return;}
  setBusy(true);let path:string|null=null;
  if(contentFile){const ext=contentFile.name.split('.').pop()||'file';path=lessonForm.course_id+'/'+crypto.randomUUID()+'.'+ext;const {error}=await client.storage.from('lesson-content').upload(path,contentFile,{upsert:false});if(error){setNotice(error.message);setBusy(false);return;}}
  const payload={...lessonForm,content_path:path,starts_at:lessonForm.starts_at?new Date(lessonForm.starts_at).toISOString():null,ends_at:lessonForm.ends_at?new Date(lessonForm.ends_at).toISOString():null,duration_minutes:lessonForm.duration_minutes?Number(lessonForm.duration_minutes):null,is_published:lessonForm.is_published,created_by:profile.id};
  const {error}=await client.from('lessons').insert(payload);
  setNotice(error?.message||'Lesson created.');if(!error){setLessonForm(old=>({...old,title:'',description:'',live_url:'',content_url:'',location:'',starts_at:'',ends_at:'',duration_minutes:''}));setContentFile(null);await load();}setBusy(false);
 };
 const grantAccess=async(e:React.FormEvent)=>{
  e.preventDefault();if(!selectedCourse||!selectedStudents.length){setNotice('Choose a course and at least one student.');return;}
  setBusy(true);const rows=selectedStudents.map(student_profile_id=>({course_id:selectedCourse,student_profile_id,status:'active',granted_by:profile.id}));
  const {error}=await client.from('course_access').upsert(rows,{onConflict:'course_id,student_profile_id'});
  setNotice(error?.message||'Course access granted.');if(!error){setSelectedStudents([]);await load();}setBusy(false);
 };
 const revoke=async(row:Row)=>{
  setBusy(true);const {error}=await client.from('course_access').update({status:'revoked'}).eq('id',row.id);
  setNotice(error?.message||'Course access revoked.');if(!error)await load();setBusy(false);
 };
 const setLessonStatus=async(lesson:Row,status:string)=>{
  if(parent||staff)return;
  const existing=progressMap[lesson.id];const target=profile.id;
  const payload={lesson_id:lesson.id,student_profile_id:target,status,progress_seconds:existing?.progress_seconds??0,last_position_seconds:existing?.last_position_seconds??0,completed_at:status==='completed'?new Date().toISOString():null,updated_at:new Date().toISOString()};
  const {error}=await client.from('lesson_progress').upsert(payload,{onConflict:'lesson_id,student_profile_id'});
  setNotice(error?.message||'Lesson progress updated.');if(!error)await load();
 };
 const openLesson=async(lesson:Row)=>{
  if(lesson.content_path){const {data,error}=await client.storage.from('lesson-content').createSignedUrl(lesson.content_path,3600);if(error){setNotice(error.message);return;}window.open(data.signedUrl,'_blank','noopener,noreferrer');}
  else if(lesson.live_url||lesson.content_url){window.open(lesson.live_url||lesson.content_url,'_blank','noopener,noreferrer');}
  else setNotice('No lesson link or file has been added yet.');
 };
 const childName=children.find(c=>c.id===childId)?.display_name;
 if(!staff&&parent&&!children.length)return <section className="course-center"><div className="course-empty"><Users/><b>No linked student account</b><p>Ask the school team to link your parent account to your child's student profile.</p></div></section>;
 return <section className="course-center"><div className="course-heading"><div><span>COURSE MANAGEMENT</span><h2>{staff?view==='courseAccess'?'Course access':view==='lessons'?'Lessons':'Courses':parent?'Child course progress':view==='lessons'?'My lessons':'My courses'}</h2><p>{staff?'Manage programs, lessons and student access.':parent?'Review the courses and lessons assigned to your child.':'Open your courses and track lesson completion.'}</p></div><button onClick={()=>void load()} disabled={busy}><RefreshCw size={14}/> Refresh</button></div>
  {notice&&<div className="course-notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
  {parent&&<label className="course-child-picker">Child<select value={childId} onChange={e=>setChildId(e.target.value)}>{children.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label>}
  {staff&&view==='courses'&&<div className="course-staff-grid"><form className="course-form" onSubmit={createCourse}><h3><Plus size={16}/> Create course</h3><label>Course title<input required value={courseForm.title} onChange={e=>setCourseForm({...courseForm,title:e.target.value})}/></label><label>Description<textarea rows={4} value={courseForm.description} onChange={e=>setCourseForm({...courseForm,description:e.target.value})}/></label><label>Exam program<select value={courseForm.exam_program} onChange={e=>setCourseForm({...courseForm,exam_program:e.target.value})}>{programs.map(p=><option key={p}>{p}</option>)}</select></label><label>Status<select value={courseForm.status} onChange={e=>setCourseForm({...courseForm,status:e.target.value})}><option value="locked">Locked</option><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option><option value="archived">Archived</option></select></label><button className="course-primary" disabled={busy}>Create course</button></form><div className="course-list"><h3><BookOpen size={16}/> Course library ({courses.length})</h3>{courses.map(c=><article key={c.id}><div><b>{c.title}</b><small>{c.exam_program} · {c.description}</small></div><div><span className={'course-status '+c.status}>{pretty(c.status)}</span><button onClick={()=>void updateCourse(c,c.status==='published'?'locked':'published')}>{c.status==='published'?'Lock':'Publish'}</button></div></article>)}{!courses.length&&<p>No courses yet.</p>}</div></div>}
  {staff&&view==='lessons'&&<div className="course-staff-grid"><form className="course-form" onSubmit={createLesson}><h3><Plus size={16}/> Add lesson</h3><label>Course<select required value={lessonForm.course_id} onChange={e=>setLessonForm({...lessonForm,course_id:e.target.value})}><option value="">Select course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Lesson title<input required value={lessonForm.title} onChange={e=>setLessonForm({...lessonForm,title:e.target.value})}/></label><label>Description<textarea rows={3} value={lessonForm.description} onChange={e=>setLessonForm({...lessonForm,description:e.target.value})}/></label><div className="course-form-row"><label>Content type<select value={lessonForm.content_type} onChange={e=>setLessonForm({...lessonForm,content_type:e.target.value})}><option value="text">Text</option><option value="video">Video</option><option value="live">Live class</option><option value="pdf">PDF</option><option value="worksheet">Worksheet</option><option value="link">External link</option></select></label><label>Delivery<select value={lessonForm.delivery_mode} onChange={e=>setLessonForm({...lessonForm,delivery_mode:e.target.value})}><option value="self_paced">Self paced</option><option value="online">Online</option><option value="in_person">In person</option></select></label></div>{lessonForm.delivery_mode==='online'&&<><label>Live provider<select value={lessonForm.live_provider} onChange={e=>setLessonForm({...lessonForm,live_provider:e.target.value})}><option value="google_meet">Google Meet</option><option value="zoom">Zoom</option><option value="built_in">Built-in classroom</option></select></label><label>Live meeting URL<input type="url" value={lessonForm.live_url} onChange={e=>setLessonForm({...lessonForm,live_url:e.target.value})} placeholder="https://…"/></label></>}{(lessonForm.content_type==='link'||lessonForm.content_type==='video')&&<label>External content URL<input type="url" value={lessonForm.content_url} onChange={e=>setLessonForm({...lessonForm,content_url:e.target.value})} placeholder="https://…"/></label>}{lessonForm.delivery_mode==='in_person'&&<><label>Location<input value={lessonForm.location} onChange={e=>setLessonForm({...lessonForm,location:e.target.value})} placeholder="Classroom / venue"/></label><label>Session starts<input type="datetime-local" value={lessonForm.starts_at} onChange={e=>setLessonForm({...lessonForm,starts_at:e.target.value})}/></label><label>Session ends<input type="datetime-local" value={lessonForm.ends_at} onChange={e=>setLessonForm({...lessonForm,ends_at:e.target.value})}/></label></>}{['pdf','video','worksheet'].includes(lessonForm.content_type)&&<label className="course-upload"><Upload size={14}/> Upload lesson file<input type="file" onChange={e=>setContentFile(e.target.files?.[0]??null)}/></label>}<label>Duration (minutes)<input type="number" min="1" max="600" value={lessonForm.duration_minutes} onChange={e=>setLessonForm({...lessonForm,duration_minutes:e.target.value})}/></label><label className="course-check"><input type="checkbox" checked={lessonForm.is_published} onChange={e=>setLessonForm({...lessonForm,is_published:e.target.checked})}/> Publish lesson</label><button className="course-primary" disabled={busy||!courses.length}>Save lesson</button></form><div className="course-list"><h3><CalendarClock size={16}/> Lessons ({lessons.length})</h3>{lessons.map(l=><article key={l.id}><div><b>{l.title}</b><small>{courses.find(c=>c.id===l.course_id)?.title||'Course'} · {pretty(l.delivery_mode||'self_paced')} · {dt(l.starts_at)}</small></div><span className={'course-status '+(l.is_published?'published':'draft')}>{l.is_published?'Published':'Draft'}</span></article>)}{!lessons.length&&<p>No lessons created yet.</p>}</div></div>}
  {staff&&view==='courseAccess'&&<div className="course-staff-grid"><form className="course-form" onSubmit={grantAccess}><h3><Users size={16}/> Grant course access</h3><label>Course<select required value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)}><option value="">Select course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><div className="course-student-picker">{students.map(s=><label key={s.id}><input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={e=>setSelectedStudents(old=>e.target.checked?[...old,s.id]:old.filter(id=>id!==s.id))}/>{s.display_name}</label>)}</div><button type="button" className="course-text-button" onClick={()=>setSelectedStudents(students.map(s=>s.id))}>Select all students</button><button className="course-primary" disabled={busy||!selectedStudents.length}>Grant access to {selectedStudents.length}</button></form><div className="course-list"><h3>Current access ({access.length})</h3>{access.map(a=><article key={a.id}><div><b>{courses.find(c=>c.id===a.course_id)?.title||'Course'}</b><small>{students.find(s=>s.id===a.student_profile_id)?.display_name||a.student_profile_id}</small></div><div><span className={'course-status '+a.status}>{pretty(a.status)}</span>{a.status==='active'&&<button onClick={()=>void revoke(a)}>Revoke</button>}</div></article>)}</div></div>}
  {!staff&&<><div className="course-card-grid">{courses.map(c=>{const courseLessons=lessons.filter(l=>l.course_id===c.id);const done=courseLessons.filter(l=>progressMap[l.id]?.status==='completed').length;return <article key={c.id} className="course-card"><span className="course-program">{c.exam_program}</span><h3>{c.title}</h3><p>{c.description}</p><div className="course-progress"><span>{done}/{courseLessons.length} lessons completed</span><div><i style={{width:(courseLessons.length?done/courseLessons.length*100:0)+'%'}}/></div></div><button className="course-primary" onClick={()=>setSelectedCourse(selectedCourse===c.id?'':c.id)}>{selectedCourse===c.id?'Hide lessons':'View lessons'}</button></article>;})}{!courses.length&&<div className="course-empty"><BookOpen/><b>No course access yet</b><p>Your teaching team will grant course access when your enrollment is ready.</p></div>}</div>{(view==='lessons'||Boolean(selectedCourse))&&<div className="course-lessons"><h3>Lessons {childName?'for '+childName:''}</h3>{lessons.filter(l=>!selectedCourse||l.course_id===selectedCourse).map(l=>{const p=progressMap[l.id];return <article key={l.id}><div className="course-lesson-icon">{l.delivery_mode==='in_person'?<MapPin/>:l.content_type==='video'?<Play/>:<FileText/>}</div><div className="course-lesson-main"><b>{l.title}</b><small>{courses.find(c=>c.id===l.course_id)?.title} · {pretty(l.delivery_mode||'self_paced')}</small><p>{l.description}</p>{l.starts_at&&<small>{dt(l.starts_at)} {l.location?'· '+l.location:''}</small>}</div><div className="course-lesson-actions">{l.live_url&&<button onClick={()=>openLesson(l)}><ExternalLink size={13}/> Join</button>}{(l.content_path||l.content_url)&&<button onClick={()=>openLesson(l)}><ExternalLink size={13}/> Open</button>}{!parent&&<button className={p?.status==='completed'?'completed':''} onClick={()=>void setLessonStatus(l,p?.status==='completed'?'in_progress':'completed')}><CheckCircle2 size={13}/>{p?.status==='completed'?'Completed':'Mark complete'}</button>}{parent&&<span>{pretty(p?.status||'not_started')}</span>}</div></article>;})}{!lessons.length&&<p>No published lessons yet.</p>}</div>}</>}
 </section>;
}
