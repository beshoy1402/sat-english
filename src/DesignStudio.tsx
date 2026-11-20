import {useCallback,useEffect,useMemo,useState} from 'react';
import {ArrowDown,ArrowUp,CheckCircle2,Clock3,Eye,FileImage,History,Monitor,Palette,Plus,RefreshCw,Send,Smartphone,Tablet,Upload,X} from 'lucide-react';
import './design-studio.css';

type Row=Record<string,any>;
type Profile={id:string;display_name?:string;role:string};
type Props={client:any;profile:Profile};
const defaults=()=>({theme:{primary:'#102944',accent:'#a9caff',background:'#071426',surface:'#102239',text:'#f2f6ff'},typography:{heading:'Manrope',body:'DM Sans'},hero:{eyebrow:'SAT · EST · ACT ENGLISH',title:'Your next score starts here.',subtitle:'Expert English preparation, guided practice and a clear path to your target score.',cta:'Explore programs',image_path:'',image_url:'',show_illustration:true},motion:{parallax:true,scroll_reveal:true,animated_buttons:true,respect_reduced_motion:true},locale:{default:'en',arabic_rtl:true},sections:[{id:'programs',title:'Our programs',visible:true},{id:'approach',title:'Teaching approach',visible:true},{id:'results',title:'Student results',visible:true},{id:'faq',title:'Frequently asked questions',visible:true},{id:'contact',title:'Contact and enrollment',visible:true}]});
const pretty=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const clone=(v:any)=>JSON.parse(JSON.stringify(v));

export default function DesignStudio({client,profile}:Props){
 const developer=['developer','admin'].includes(profile.role);
 const [drafts,setDrafts]=useState<Row[]>([]),[selected,setSelected]=useState<Row|null>(null),[name,setName]=useState('Homepage concept');
 const [content,setContent]=useState<any>(defaults()),[versions,setVersions]=useState<Row[]>([]);
 const [preview,setPreview]=useState<'desktop'|'tablet'|'mobile'>('desktop'),[language,setLanguage]=useState<'en'|'ar'>('en');
 const [imagePreview,setImagePreview]=useState(''),[reviewNotes,setReviewNotes]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  const {data,error}=await client.from('site_design_drafts').select('*').order('updated_at',{ascending:false});
  if(error){setNotice(error.message);return;}setDrafts(data??[]);
 },[client]);
 useEffect(()=>{void load();},[load]);
 const loadVersions=useCallback(async(id:string)=>{
  const {data,error}=await client.from('site_design_versions').select('*').eq('draft_id',id).order('version',{ascending:false}).limit(30);
  if(error){setNotice(error.message);return;}setVersions(data??[]);
 },[client]);
 const selectDraft=async(d:Row)=>{
  setSelected(d);setName(d.name);setContent({...defaults(),...(d.content??{})});setReviewNotes(d.review_notes||'');setImagePreview('');
  await loadVersions(d.id);
  if(d.content?.hero?.image_path){const {data}=await client.storage.from('site-design-assets').createSignedUrl(d.content.hero.image_path,3600);if(data?.signedUrl)setImagePreview(data.signedUrl);}
 };
 const update=(path:string,value:any)=>{
  setContent((old:any)=>{const next=clone(old);const parts=path.split('.');let node=next;for(const part of parts.slice(0,-1))node=node[part]??(node[part]={});node[parts.at(-1)]=value;return next;});
 };
 const createDraft=async()=>{
  setBusy(true);const {data,error}=await client.from('site_design_drafts').insert({name:'New homepage concept',content:defaults(),created_by:profile.id}).select('*').single();
  setNotice(error?.message||'Draft created.');if(!error){await load();await selectDraft(data);}setBusy(false);
 };
 const save=async()=>{
  if(!selected){setNotice('Create a draft first.');return;}
  setBusy(true);const {data,error}=await client.from('site_design_drafts').update({name:name.trim(),content,updated_at:new Date().toISOString()}).eq('id',selected.id).select('*').single();
  setNotice(error?.message||'Draft saved and version history updated.');if(!error){setSelected(data);await load();await loadVersions(data.id);}setBusy(false);
 };
 const submit=async()=>{
  if(!selected){setNotice('Select a draft first.');return;}
  setBusy(true);const {error}=await client.rpc('submit_site_design',{p_draft_id:selected.id});
  setNotice(error?.message||'Design submitted to the Developer for review.');if(!error){await load();const {data}=await client.from('site_design_drafts').select('*').eq('id',selected.id).single();if(data)setSelected(data);}setBusy(false);
 };
 const review=async(decision:'approved'|'rejected')=>{
  if(!selected)return;setBusy(true);const {error}=await client.rpc('review_site_design',{p_draft_id:selected.id,p_decision:decision,p_notes:reviewNotes});
  setNotice(error?.message||'Design review saved.');if(!error){await load();const {data}=await client.from('site_design_drafts').select('*').eq('id',selected.id).single();if(data)setSelected(data);}setBusy(false);
 };
 const implemented=async()=>{
  if(!selected)return;setBusy(true);const {error}=await client.rpc('mark_site_design_implemented',{p_draft_id:selected.id});
  setNotice(error?.message||'Design marked as implemented.');if(!error){await load();const {data}=await client.from('site_design_drafts').select('*').eq('id',selected.id).single();if(data)setSelected(data);}setBusy(false);
 };
 const uploadImage=async(e:React.ChangeEvent<HTMLInputElement>)=>{
  const file=e.target.files?.[0];if(!file||!selected)return;
  if(!['image/png','image/jpeg','image/webp','image/svg+xml'].includes(file.type)){setNotice('Use PNG, JPG, WebP or SVG images.');return;}
  if(file.size>10*1024*1024){setNotice('Image must be 10 MB or smaller.');return;}
  setBusy(true);const path=profile.id+'/'+selected.id+'/'+crypto.randomUUID()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const {error}=await client.storage.from('site-design-assets').upload(path,file,{upsert:false,contentType:file.type});
  if(error)setNotice(error.message);else{update('hero.image_path',path);const {data}=await client.storage.from('site-design-assets').createSignedUrl(path,3600);setImagePreview(data?.signedUrl||'');setNotice('Image uploaded. Save the draft to keep this change.');}
  setBusy(false);e.target.value='';
 };
 const moveSection=(index:number,delta:number)=>{
  const next=clone(content);const target=index+delta;if(target<0||target>=next.sections.length)return;
  [next.sections[index],next.sections[target]]=[next.sections[target],next.sections[index]];setContent(next);
 };
 const editable=profile.role==='designer'&&selected&&['draft','rejected'].includes(selected.status);
 const visibleDrafts=useMemo(()=>developer?drafts:drafts.filter(d=>d.created_by===profile.id),[developer,drafts,profile.id]);
 const width=preview==='desktop'? '100%':preview==='tablet'?'760px':'390px';
 return <section className="design-studio">
  <div className="design-heading"><div><span>WEBSITE EXPERIENCE</span><h2>{developer?'Design review':'Design Studio'}</h2><p>{developer?'Review submitted concepts and approve the design handoff.':'Create, preview, version and submit website design concepts.'}</p></div><button onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div>
  {notice&&<div className="design-notice">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
  <div className="design-layout">
   <aside className="design-drafts"><div className="design-drafts-head"><b>{developer?'Submitted and past reviews':'My design drafts'}</b>{!developer&&<button onClick={()=>void createDraft()} disabled={busy}><Plus size={14}/> New</button>}</div>
    {visibleDrafts.map(d=><button key={d.id} onClick={()=>void selectDraft(d)} className={selected?.id===d.id?'active':''}><span>{d.name}</span><small><i className={'status-dot '+d.status}/>{pretty(d.status)} · v{d.version}</small></button>)}
    {!visibleDrafts.length&&<p className="design-empty">No design drafts yet.</p>}
   </aside>
   {selected?<div className="design-main">
    <div className="design-editor-top"><div><span className={'design-status '+selected.status}>{pretty(selected.status)}</span><h3>{selected.name}</h3><small>Version {selected.version} · Updated {new Date(selected.updated_at).toLocaleString()}</small></div><div className="design-actions">{!developer&&editable&&<><button onClick={()=>void save()} disabled={busy}>Save draft</button><button className="primary" onClick={()=>void submit()} disabled={busy||selected.status==='submitted'}><Send size={14}/> Submit for review</button></>}</div></div>
    {!developer&&editable&&<label className="design-name">Draft name<input value={name} onChange={e=>setName(e.target.value)} maxLength={120}/></label>}
    {developer&&<div className="design-review-banner"><b>Designer handoff</b><span>{selected.status==='submitted'?'Review this concept before implementation.':selected.status==='approved'?'Approved. Mark implemented only after the design is applied in code.':selected.status==='implemented'?'This design is marked as implemented.':'This design is not currently awaiting review.'}</span></div>}
    <div className="design-editor-grid">
     {!developer&&<div className="design-controls">
      <section><h4><Palette size={15}/> Brand colors</h4><div className="design-colors">{Object.entries(content.theme).map(([key,value]:any)=><label key={key}><span>{pretty(key)}</span><input type="color" value={value} onChange={e=>update('theme.'+key,e.target.value)}/><code>{value}</code></label>)}</div></section>
      <section><h4>Hero content</h4><label>Eyebrow<input value={content.hero.eyebrow} onChange={e=>update('hero.eyebrow',e.target.value)}/></label><label>Headline<textarea rows={2} value={content.hero.title} onChange={e=>update('hero.title',e.target.value)}/></label><label>Subtitle<textarea rows={3} value={content.hero.subtitle} onChange={e=>update('hero.subtitle',e.target.value)}/></label><label>Button text<input value={content.hero.cta} onChange={e=>update('hero.cta',e.target.value)}/></label><label>Heading font<select value={content.typography.heading} onChange={e=>update('typography.heading',e.target.value)}><option>Manrope</option><option>DM Sans</option><option>Inter</option><option>Georgia</option></select></label><label>Body font<select value={content.typography.body} onChange={e=>update('typography.body',e.target.value)}><option>DM Sans</option><option>Manrope</option><option>Inter</option><option>Arial</option></select></label><label className="design-upload"><Upload size={14}/> Upload hero image<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={uploadImage}/></label>{imagePreview&&<img className="design-upload-preview" src={imagePreview} alt="Uploaded hero preview"/>}</section>
      <section><h4>Motion and accessibility</h4>{[['parallax','Parallax depth'],['scroll_reveal','Scroll reveal'],['animated_buttons','Animated buttons'],['respect_reduced_motion','Respect reduced-motion preference']].map(([key,label])=><label className="design-toggle" key={key}><span>{label}</span><input type="checkbox" checked={Boolean(content.motion[key])} onChange={e=>update('motion.'+key,e.target.checked)}/></label>)}</section>
      <section><h4>Language and direction</h4><label>Default language<select value={content.locale.default} onChange={e=>update('locale.default',e.target.value)}><option value="en">English</option><option value="ar">Arabic</option></select></label><label className="design-toggle"><span>Enable Arabic RTL layout</span><input type="checkbox" checked={content.locale.arabic_rtl} onChange={e=>update('locale.arabic_rtl',e.target.checked)}/></label></section>
      <section><h4>Page sections</h4>{content.sections.map((section:any,i:number)=><div className="design-section-row" key={section.id}><input value={section.title} onChange={e=>{const next=clone(content);next.sections[i].title=e.target.value;setContent(next);}}/><label><input type="checkbox" checked={section.visible} onChange={e=>{const next=clone(content);next.sections[i].visible=e.target.checked;setContent(next);}}/> Visible</label><button disabled={i===0} onClick={()=>moveSection(i,-1)}><ArrowUp size={13}/></button><button disabled={i===content.sections.length-1} onClick={()=>moveSection(i,1)}><ArrowDown size={13}/></button></div>)}</section>
     </div>}
     <div className="design-preview-area"><div className="design-preview-toolbar"><b><Eye size={14}/> Live concept preview</b><div><button className={preview==='desktop'?'active':''} onClick={()=>setPreview('desktop')}><Monitor size={14}/></button><button className={preview==='tablet'?'active':''} onClick={()=>setPreview('tablet')}><Tablet size={14}/></button><button className={preview==='mobile'?'active':''} onClick={()=>setPreview('mobile')}><Smartphone size={14}/></button><select value={language} onChange={e=>setLanguage(e.target.value as 'en'|'ar')}><option value="en">EN</option><option value="ar">AR</option></select></div></div>
      <div className="design-canvas-shell"><div className="design-canvas" style={{width,maxWidth:'100%',background:content.theme.background,color:content.theme.text,fontFamily:content.typography.body,direction:language==='ar'&&content.locale.arabic_rtl?'rtl':'ltr'}}><header style={{borderColor:content.theme.surface}}><b>✳ NORTHSTAR</b><span>{language==='ar'?'البرامج':'Programs'}　{language==='ar'?'عن الأكاديمية':'About'}　{language==='ar'?'تواصل معنا':'Contact'}</span></header><div className="design-hero-preview" style={{background:'linear-gradient(140deg,'+content.theme.background+','+content.theme.primary+')'}}><div><small style={{color:content.theme.accent}}>{content.hero.eyebrow}</small><h1 style={{fontFamily:content.typography.heading}}>{language==='ar'?'درجتك القادمة تبدأ من هنا':content.hero.title}</h1><p>{language==='ar'?'استعد لاختبارات اللغة الإنجليزية بخطة واضحة وتدريب موجه.':content.hero.subtitle}</p><button style={{background:content.theme.accent,color:content.theme.background}}>{language==='ar'?'استكشف البرامج':content.hero.cta}</button></div>{content.hero.show_illustration&&<div className="design-orb" style={{background:'radial-gradient(circle at 35% 30%,'+content.theme.accent+','+content.theme.primary+')'}}>{imagePreview?<img src={imagePreview} alt="Hero"/>:<span>✳</span>}</div>}</div>{content.sections.filter((s:any)=>s.visible).map((s:any,i:number)=><section className="design-preview-section" key={s.id} style={{background:i%2===0?content.theme.surface:'transparent'}}><small>0{i+1} / NORTHSTAR</small><h2>{s.title}</h2><p>{language==='ar'?'تعلم بخطة واضحة وتقدم قابل للقياس.':'A focused learning experience built around your goals.'}</p></section>)}<footer>© NORTHSTAR ENGLISH ACADEMY</footer></div></div>
     </div>
    </div>
    {developer&&selected.status==='submitted'&&<div className="design-review-actions"><label>Review notes<textarea rows={3} value={reviewNotes} onChange={e=>setReviewNotes(e.target.value)} placeholder="Feedback for the designer…"/></label><div><button onClick={()=>void review('rejected')} disabled={busy}>Request changes</button><button className="primary" onClick={()=>void review('approved')} disabled={busy}><CheckCircle2 size={14}/> Approve design</button></div></div>}
    {developer&&selected.status==='approved'&&<div className="design-review-actions"><p>After implementing this approved concept in the actual website code, mark it as implemented.</p><button className="primary" onClick={()=>void implemented()} disabled={busy}>Mark implemented</button></div>}
    <section className="design-version-history"><h4><History size={15}/> Version history</h4>{versions.map(v=><div key={v.id}><span>Version {v.version}</span><small>{new Date(v.created_at).toLocaleString()}</small><button onClick={()=>{setName(v.name);setContent({...defaults(),...v.content});}}>Load into editor</button></div>)}{!versions.length&&<p>No saved versions yet.</p>}</section>
   </div>:<div className="design-no-selection"><Palette size={28}/><b>{developer?'Select a submitted concept':'Create or select a design draft'}</b><p>{developer?'Choose a design from the list to preview and review it.':'Start with a homepage concept, then edit colors, typography, content and layout.'}</p>{!developer&&<button onClick={()=>void createDraft()} disabled={busy}><Plus size={14}/> Create first draft</button>}</div>}
  </div>
 </section>;
}
