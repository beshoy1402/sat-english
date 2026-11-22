import {useState} from 'react';
import {motion,AnimatePresence} from 'framer-motion';
import {ArrowRight,ArrowUpRight,BookOpen,BrainCircuit,ChartNoAxesCombined,Check,ChevronDown,GraduationCap,Globe2,Menu,ShieldCheck,Sparkles,Target,X,Zap,Clock3,Layers,FileText,Users} from 'lucide-react';

type Props={onLogin:()=>void};
const ease=[.22,1,.36,1] as const;
const rise={hidden:{opacity:0,y:28},show:{opacity:1,y:0,transition:{duration:.7,ease}}};
const exams=[
 {number:'01',name:'SAT English',label:'DIGITAL SAT',desc:'Master Reading and Writing with focused practice, clear explanations and realistic exam preparation.',icon:BookOpen,topics:['Reading & Writing','Grammar','Rhetorical skills']},
 {number:'02',name:'EST English',label:'EGYPTIAN EXAMS',desc:'Build confidence with structured lessons and practice designed around your exam goals.',icon:Target,topics:['Exam practice','Core skills','Progress tracking']},
 {number:'03',name:'ACT English',label:'INTERNATIONAL',desc:'Improve editing, language conventions and rhetorical analysis with purposeful training.',icon:GraduationCap,topics:['Usage & mechanics','Rhetorical skills','Timed practice']}
];
const faqs=[
 ['How do I get an account?','Accounts are created by authorized staff. There is no public registration.'],
 ['Which exams are supported?','The platform supports SAT, EST and ACT English preparation.'],
 ['Can I practise with an AI tutor?','Students can use the AI English tutor when the feature is enabled for their account.'],
 ['Can teachers manage classes and assignments?','Authorized teachers and assistants can manage learning content, assignments, attendance and student progress according to their permissions.']
];
function Reveal({children,className='',delay=0}:{children:React.ReactNode,className?:string,delay?:number}) {
 return <motion.div className={className} variants={rise} initial="hidden" whileInView="show" viewport={{once:true,amount:.18}} transition={{delay}}>{children}</motion.div>;
}
export default function LandingPage({onLogin}:Props){
 const [lang,setLang]=useState<'en'|'ar'>('en');
 const [menu,setMenu]=useState(false);
 const [faq,setFaq]=useState<number|null>(0);
 const rtl=lang==='ar';
 const copy=rtl?{
  nav:['البرامج','المميزات','الأسئلة الشائعة'],login:'تسجيل الدخول',tag:'منصة تعليمية متكاملة',title:'استعد بذكاء.\nوتقدّم بثقة.',sub:'كل ما تحتاجه للاستعداد لاختبارات SAT وEST وACT English، من الدروس والتدريب إلى المساعد الذكي ومتابعة تقدمك.',explore:'استكشف البرامج',access:'افتح مساحة التعلم',path:'اختر مسارك',pathSub:'تدريب منظم حسب الاختبار الذي تستعد له.',tools:'كل أدواتك التعليمية في مكان واحد',toolsSub:'تجربة مترابطة للطلاب والمعلمين وفريق العمل.',faqTitle:'أسئلة شائعة',cta:'ابدأ خطوتك القادمة',ctaSub:'سجّل الدخول للوصول إلى مساحة التعلم الخاصة بك.'
 }:{
  nav:['Exams','Platform','FAQ'],login:'Sign in',tag:'A smarter way to prepare',title:'Prepare with purpose.\nPerform with confidence.',sub:'A focused English learning platform for SAT, EST and ACT. Learn the concepts, practise with direction and understand exactly what to work on next.',explore:'Explore exam paths',access:'Open your workspace',path:'Choose your exam path',pathSub:'Focused preparation, organised around the exam you are taking.',tools:'Everything you need to move forward',toolsSub:'A connected experience for students, teachers and the people who support them.',faqTitle:'Frequently asked questions',cta:'Make your next session count',ctaSub:'Sign in to continue in your personal learning workspace.'
 };
 return <main className="nova-site" dir={rtl?'rtl':'ltr'}>
  <header className="nova-header">
   <a className="nova-brand" href="#home"><span className="nova-brand-mark">S<span>.</span></span><span><b>SAT ENGLISH</b><small>LEARNING PLATFORM</small></span></a>
   <nav className={menu?'nova-nav open':'nova-nav'}>{copy.nav.map((n,i)=><a key={n} href={['#paths','#platform','#faq'][i]} onClick={()=>setMenu(false)}>{n}</a>)}</nav>
   <div className="nova-header-actions"><button className="nova-language" onClick={()=>setLang(rtl?'en':'ar')}><Globe2 size={15}/>{rtl?'EN':'عربي'}</button><button className="nova-signin" onClick={onLogin}>{copy.login}<ArrowUpRight size={16}/></button><button className="nova-menu" aria-label="Toggle navigation" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></div>
  </header>
  <section className="nova-hero" id="home">
   <div className="nova-hero-grid"/>
   <div className="nova-hero-copy">
    <motion.div className="nova-kicker" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}><span/><b>{copy.tag}</b><i/> SAT · EST · ACT</motion.div>
    <motion.h1 initial={{opacity:0,y:22}} animate={{opacity:1,y:0}} transition={{duration:.8,ease,delay:.08}}>{rtl?<>استعد بذكاء.<br/><em>وتقدّم بثقة.</em></>:<>Prepare with<br/><em>purpose.</em></>}</motion.h1>
    <motion.p initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:.8,ease,delay:.16}}>{copy.sub}</motion.p>
    <motion.div className="nova-hero-actions" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.7,ease,delay:.24}}><a className="nova-primary" href="#paths">{copy.explore}<ArrowRight size={17}/></a><button className="nova-secondary" onClick={onLogin}>{copy.access}<ArrowUpRight size={16}/></button></motion.div>
    <motion.div className="nova-trust" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.55}}><span><ShieldCheck size={15}/> Secure role-based access</span><span><Zap size={15}/> AI-assisted learning</span></motion.div>
   </div>
   <motion.div className="nova-visual" initial={{opacity:0,scale:.94,y:24}} animate={{opacity:1,scale:1,y:0}} transition={{duration:1,ease,delay:.18}}>
    <div className="nova-orbit nova-orbit-one"/><div className="nova-orbit nova-orbit-two"/>
    <div className="nova-glass">
     <div className="nova-glass-top"><div className="nova-window-dots"><i/><i/><i/></div><span>YOUR LEARNING SPACE</span><span className="nova-live"><i/> INTERFACE PREVIEW</span></div>
     <div className="nova-dashboard">
      <aside className="nova-mini-nav"><div className="nova-mini-logo">S.</div><span className="selected"><Layers size={15}/></span><span><BrainCircuit size={15}/></span><span><BookOpen size={15}/></span><span><ChartNoAxesCombined size={15}/></span><div className="nova-mini-nav-bottom"><ShieldCheck size={15}/></div></aside>
      <div className="nova-dash-main">
       <div className="nova-dash-greeting"><div><small>ILLUSTRATIVE STUDENT WORKSPACE</small><h3>Good morning, Student.</h3><p>Keep your momentum going. You're making progress.</p></div><div className="nova-avatar">B</div></div>
       <div className="nova-dash-stats"><div><small>SAMPLE STREAK</small><b>07 <em>days</em></b><div className="nova-streak">{[1,1,1,1,1,1,1].map((_,i)=><i key={i}/>)}</div></div><div><small>SAMPLE MASTERY</small><b>76<em>%</em></b><div className="nova-progress"><i/></div></div></div>
       <div className="nova-next-label">PICK UP WHERE YOU LEFT OFF <ArrowUpRight size={13}/></div>
       <div className="nova-lesson"><span className="nova-lesson-icon"><BookOpen size={18}/></span><div><b>Subject–verb agreement</b><small>Grammar foundations · 12 min</small></div><button onClick={onLogin}><ArrowRight size={16}/></button></div>
       <div className="nova-dash-bottom"><span><i/> AI tutor ready</span><span><Clock3 size={13}/> Illustrative activity</span></div>
      </div>
     </div>
    </div>
    <motion.div className="nova-float nova-float-ai" animate={{y:[0,-9,0]}} transition={{duration:5,repeat:Infinity,ease:'easeInOut'}}><span><BrainCircuit size={17}/></span><div><small>AI STUDY ASSISTANT</small><b>Let's solve it together.</b></div><i/></motion.div>
    <motion.div className="nova-float nova-float-score" animate={{y:[0,8,0]}} transition={{duration:6,repeat:Infinity,ease:'easeInOut',delay:.4}}><span><ChartNoAxesCombined size={17}/></span><div><small>WEEKLY PROGRESS</small><b>Consistency is adding up</b></div></motion.div>
   </motion.div>
   <div className="nova-hero-foot"><span>LEARN WITH CLARITY. PRACTISE WITH PURPOSE.</span><span>SCROLL TO EXPLORE <span className="nova-scroll-line"/></span></div>
  </section>
  <section className="nova-proof"><div><strong>03</strong><span>Exam pathways</span></div><i/><div><strong>01</strong><span>Connected workspace</span></div><i/><div><strong>AI</strong><span>Learning assistance</span></div><i/><div><strong>360°</strong><span>Progress visibility</span></div></section>
  <section className="nova-section nova-paths" id="paths">
   <div className="nova-section-head"><div><span className="nova-index">01 / EXAM PATHWAYS</span><h2>{copy.path}</h2></div><p>{copy.pathSub}</p></div>
   <div className="nova-path-grid">{exams.map((exam,i)=><motion.article className="nova-path-card" key={exam.name} initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.2}} transition={{delay:i*.12,duration:.65,ease}}><div className="nova-path-top"><span>{exam.number} / {exam.label}</span><exam.icon size={21}/></div><h3>{exam.name}</h3><p>{exam.desc}</p><div className="nova-topic-list">{exam.topics.map(t=><span key={t}>{t}</span>)}</div><button onClick={onLogin} aria-label={'Open '+exam.name}>Explore pathway <ArrowUpRight size={16}/></button></motion.article>)}</div>
  </section>
  <section className="nova-platform" id="platform">
   <div className="nova-section nova-platform-inner"><div className="nova-section-head"><div><span className="nova-index">02 / THE PLATFORM</span><h2>{copy.tools}</h2></div><p>{copy.toolsSub}</p></div>
    <div className="nova-platform-grid">
     <Reveal className="nova-platform-copy"><div className="nova-feature-row"><span><BrainCircuit size={20}/></span><div><small>01 / AI LEARNING</small><h3>Understand the why, not just the answer.</h3><p>Ask questions, get clear step-by-step explanations and practise until concepts click.</p></div></div><div className="nova-feature-row"><span><FileText size={20}/></span><div><small>02 / STRUCTURED PRACTICE</small><h3>Make every practice session count.</h3><p>Lessons, question banks, homework and exams organised in one place.</p></div></div><div className="nova-feature-row"><span><ChartNoAxesCombined size={20}/></span><div><small>03 / PROGRESS INSIGHTS</small><h3>Know what to focus on next.</h3><p>Follow your learning activity and identify the skills that need more attention.</p></div></div></Reveal>
     <Reveal className="nova-ai-card" delay={.12}><div className="nova-ai-card-head"><span><Sparkles size={15}/> AI ENGLISH TUTOR</span><span className="nova-available"><i/> READY TO HELP</span></div><div className="nova-ai-conversation"><div className="nova-user-bubble">I keep confusing singular and plural verbs.</div><div className="nova-ai-response"><span className="nova-ai-icon"><BrainCircuit size={17}/></span><div><small>SAT ENGLISH ASSISTANT</small><p>Let's make it simple. Find the subject first, then match the verb to it. A singular subject takes a singular verb.</p><div className="nova-example"><b>QUICK EXAMPLE</b><span>The student <em>practises</em> every day.</span><span>The students <em>practise</em> every day.</span></div></div></div></div><div className="nova-ai-input"><span>Ask a question about English...</span><button onClick={onLogin}><ArrowUpRight size={16}/></button></div><div className="nova-ai-foot"><ShieldCheck size={13}/> Guided explanations · Practice support</div></Reveal>
    </div>
   </div>
  </section>
  <section className="nova-section nova-roles"><div className="nova-roles-copy"><span className="nova-index">03 / BUILT FOR THE CLASSROOM</span><h2>One platform.<br/><em>Every role in sync.</em></h2><p>Students, teachers and administrators get focused tools and the right level of access, all inside one connected learning environment.</p><div className="nova-role-points"><span><Check size={15}/> Secure sign-in</span><span><Check size={15}/> Role-based tools</span><span><Check size={15}/> Organised learning</span></div></div><div className="nova-role-cards"><Reveal><article><span><GraduationCap size={19}/></span><div><b>Students</b><small>Lessons, practice, AI tutoring and progress.</small></div><ArrowUpRight size={16}/></article></Reveal><Reveal delay={.1}><article><span><Users size={19}/></span><div><b>Teachers</b><small>Classes, assignments, attendance and grading.</small></div><ArrowUpRight size={16}/></article></Reveal><Reveal delay={.2}><article><span><ShieldCheck size={19}/></span><div><b>Administrators</b><small>Accounts, permissions and platform operations.</small></div><ArrowUpRight size={16}/></article></Reveal></div></section>
  <section className="nova-section nova-faq" id="faq"><div><span className="nova-index">04 / SUPPORT</span><h2>{copy.faqTitle}</h2><p>Everything you need to know before getting started.</p></div><div className="nova-faq-list">{faqs.map(([q,a],i)=><article key={q}><button onClick={()=>setFaq(faq===i?null:i)} aria-expanded={faq===i}><span>{q}</span><ChevronDown size={18}/></button><AnimatePresence initial={false}>{faq===i&&<motion.div className="nova-faq-answer" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:.25}}><p>{a}</p></motion.div>}</AnimatePresence></article>)}</div></section>
  <section className="nova-cta"><div><span className="nova-index">YOUR NEXT STEP STARTS HERE</span><h2>{copy.cta}</h2><p>{copy.ctaSub}</p></div><button className="nova-primary" onClick={onLogin}>{copy.login}<ArrowUpRight size={17}/></button><div className="nova-cta-glow"/></section>
  <footer className="nova-footer"><a className="nova-brand" href="#home"><span className="nova-brand-mark">S<span>.</span></span><span><b>SAT ENGLISH</b><small>LEARNING PLATFORM</small></span></a><span>© {new Date().getFullYear()} SAT ENGLISH · LEARN WITH PURPOSE</span><button onClick={onLogin}><ShieldCheck size={14}/> Secure access</button></footer>
 </main>;
}
