import {useState} from 'react';
import {motion,AnimatePresence} from 'framer-motion';
import {ArrowUpRight,ArrowRight,BookOpen,GraduationCap,Menu,X,Globe2,Target,ChevronDown,ShieldCheck,BrainCircuit,ChartNoAxesCombined,FileText,Zap,Activity,Layers,LockKeyhole,Check,Play, Sparkles,Clock3,Users,Search,Command,PanelRight,RefreshCw} from 'lucide-react';

type Props={onLogin:()=>void};
const rise={hidden:{opacity:0,y:24},show:{opacity:1,y:0,transition:{duration:.65,ease:[.22,1,.36,1] as const}}};
const stagger={hidden:{opacity:0},show:{opacity:1,transition:{staggerChildren:.11}}};
const programs=[
 {name:'SAT English',tag:'DIGITAL SAT',desc:'Reading, grammar, vocabulary and rhetorical skills for the SAT.',icon:BookOpen,meta:'Reading & Writing'},
 {name:'EST English',tag:'EGYPTIAN EXAMS',desc:'Build exam confidence with focused lessons and structured practice.',icon:Target,meta:'EST preparation'},
 {name:'ACT English',tag:'INTERNATIONAL',desc:'Sharpen grammar, editing and rhetorical analysis skills.',icon:GraduationCap,meta:'English section'}
];
const trending=[
 {name:'Reading comprehension',sub:'SAT · Information & Ideas',level:'CORE SKILL',score:'82%',width:'82%'},
 {name:'Grammar & conventions',sub:'SAT · Standard English',level:'HIGH IMPACT',score:'76%',width:'76%'},
 {name:'Rhetorical synthesis',sub:'SAT · Expression of Ideas',level:'PRACTICE',score:'64%',width:'64%'},
 {name:'Vocabulary in context',sub:'SAT · Craft & Structure',level:'POPULAR',score:'58%',width:'58%'}
];
const features=[
 {icon:BrainCircuit,title:'AI that teaches, not just answers',desc:'Ask questions, get clear step-by-step explanations and practise until concepts click.',tag:'AI LEARNING ASSISTANT'},
 {icon:FileText,title:'Practice built around your exam',desc:'Lessons, question banks, assignments and mock exams in one connected workspace.',tag:'LESSONS & QUESTION BANKS'},
 {icon:ChartNoAxesCombined,title:'Know what to work on next',desc:'Track your progress, spot weak areas and make every study session count.',tag:'PERSONAL PROGRESS'}
];
function Reveal({children,className='',delay=0}:{children:React.ReactNode,className?:string,delay?:number}){
 return <motion.div className={className} variants={rise} initial="hidden" whileInView="show" viewport={{once:true,amount:.18}} transition={{delay}}>{children}</motion.div>;
}
export default function LandingPage({onLogin}:Props){
 const [lang,setLang]=useState<'en'|'ar'>('en'),[menu,setMenu]=useState(false),[openFaq,setOpenFaq]=useState<number|null>(0);
 const rtl=lang==='ar';
 const t=rtl?{
  nav:['البرامج','المميزات','الأسئلة الشائعة'],login:'دخول الحساب',eyebrow:'منصة متكاملة للاستعداد للاختبارات',title:'كل ما تحتاجه. في مكان واحد.',sub:'استعد لاختبارات SAT وEST وACT English من خلال تجربة تعليمية منظمة تجمع بين الدروس والتدريب ومساعد ذكي يتابع تقدمك.',explore:'استكشف البرامج',workspace:'افتح مساحة التعلم',programs:'مساراتك التعليمية',programsSub:'اختر الاختبار وابدأ بخطة واضحة للتقدم.',features:'تعلّم أذكى. تقدّم أسرع.',featuresSub:'أدوات متكاملة تساعدك على الاستعداد بثقة.',faq:'الأسئلة الشائعة',cta:'ابدأ خطوتك التالية',ctasub:'سجّل الدخول للوصول إلى مساحة التعلم الخاصة بك.',faqs:[['كيف أحصل على حساب؟','يتم إنشاء الحسابات بواسطة فريق العمل المصرح له. لا يوجد تسجيل عام.'],['ما الاختبارات المتاحة؟','تتضمن المنصة الاستعداد لقسم اللغة الإنجليزية في SAT وEST وACT.'],['هل يوجد مساعد ذكاء اصطناعي؟','تتضمن مساحة التعلم أدوات مساعدة تعليمية بالذكاء الاصطناعي حسب صلاحيات حسابك.']]
 }:{
  nav:['Programmes','Learning tools','FAQ'],login:'Sign in',eyebrow:'THE ALL-IN-ONE ENGLISH PREPARATION PLATFORM',title:'Your next score starts here.',sub:'One focused workspace for SAT, EST and ACT English. Learn with guided lessons, practise with purpose and see your progress clearly.',explore:'Explore programmes',workspace:'Open learning workspace',programs:'Find your path to progress',programsSub:'Focused preparation for the exam you are taking, with everything organised in one place.',features:'Everything works together',featuresSub:'A connected learning experience designed to help you prepare with confidence.',faq:'Frequently asked questions',cta:'Make your next study session count',ctasub:'Sign in to continue learning in your personal workspace.',faqs:[['How do I get an account?','Accounts are created by authorized staff. There is no public registration.'],['Which exams are supported?','The platform supports preparation for SAT, EST and ACT English.'],['Does the platform include AI?','AI learning tools are available inside the workspace according to your account permissions.']]
 };
 return <main className="orx-site" dir={rtl?'rtl':'ltr'}>
  <header className="orx-header"><a className="orx-brand" href="#top"><span className="orx-logo">S</span><span><b>SAT ENGLISH</b><small>LEARNING PLATFORM</small></span></a>
   <nav className={menu?'orx-nav is-open':'orx-nav'}>{t.nav.map((n,i)=><a key={n} href={['#programmes','#features','#faq'][i]} onClick={()=>setMenu(false)}>{n}</a>)}</nav>
   <div className="orx-actions"><button className="orx-lang" onClick={()=>setLang(rtl?'en':'ar')}><Globe2 size={14}/>{rtl?'EN':'عربي'}</button><button className="orx-login" onClick={onLogin}>{t.login}<ArrowUpRight size={15}/></button><button className="orx-menu" onClick={()=>setMenu(!menu)} aria-label="Toggle menu">{menu?<X/>:<Menu/>}</button></div>
  </header>
  <section className="orx-hero" id="top">
   <div className="orx-hero-grid"/>
   <motion.div className="orx-hero-copy" variants={stagger} initial="hidden" animate="show">
    <motion.div className="orx-eyebrow" variants={rise}><i/> {t.eyebrow}</motion.div>
    <motion.h1 variants={rise}>{rtl?<>كل ما تحتاجه.<br/><em>في مكان واحد.</em></>:<>Your next score<br/><em>starts here.</em></>}</motion.h1>
    <motion.p variants={rise}>{t.sub}</motion.p>
    <motion.div className="orx-hero-buttons" variants={rise}><a className="orx-primary" href="#programmes">{t.explore}<ArrowRight size={16}/></a><button className="orx-secondary" onClick={onLogin}>{t.workspace}<ArrowUpRight size={15}/></button></motion.div>
    <motion.div className="orx-trust" variants={rise}><span><ShieldCheck size={14}/> Secure student & staff access</span><span><Zap size={14}/> AI-assisted learning</span></motion.div>
   </motion.div>
   <motion.div className="orx-hero-visual" initial={{opacity:0,y:30,scale:.97}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.9,delay:.2,ease:[.22,1,.36,1]}}>
    <div className="orx-glow"/>
    <div className="orx-dash-window">
     <div className="orx-window-bar"><div className="orx-dots"><i/><i/><i/></div><span>STUDENT WORKSPACE</span><span className="orx-live"><i/> LIVE</span></div>
     <div className="orx-window-content"><aside className="orx-mini-side"><b><span>✳</span> LEARN</b><span className="active"><PanelRight size={12}/> Overview</span><span><BrainCircuit size={12}/> AI tutor</span><span><BookOpen size={12}/> My courses</span><span><FileText size={12}/> Practice</span><span><Activity size={12}/> Progress</span><div className="orx-side-bottom"><span>YOUR PLAN</span><b>Study smarter</b><small>Keep your streak going.</small></div></aside>
      <div className="orx-mini-main"><div className="orx-mini-heading"><div><small>YOUR LEARNING SPACE</small><h3>Welcome back.</h3><p>Ready for another productive session?</p></div><span className="orx-avatar">B</span></div>
       <div className="orx-mini-stats"><div><small>Study sessions</small><b>24 <em>this month</em></b><div className="orx-spark"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div><div><small>Learning progress</small><b>76<em>% completed</em></b><div className="orx-progress"><i/></div></div></div>
       <div className="orx-mini-continue"><div className="orx-continue-icon"><BookOpen size={16}/></div><div><small>CONTINUE LEARNING</small><b>Subject–verb agreement</b><span>Grammar · 12 min lesson</span></div><button onClick={onLogin}><ArrowUpRight size={16}/></button></div>
       <div className="orx-mini-bottom"><span><span className="orx-dot-purple"/> AI tutor available</span><span><Clock3 size={12}/> 12 min today</span></div>
      </div>
     </div>
    </div>
    <motion.div className="orx-float-card orx-float-a" animate={{y:[0,-8,0]}} transition={{duration:5,repeat:Infinity,ease:'easeInOut'}}><span><Sparkles size={14}/></span><div><small>AI LEARNING ASSISTANT</small><b>Ready to help you learn</b></div><i/></motion.div>
    <motion.div className="orx-float-card orx-float-b" animate={{y:[0,7,0]}} transition={{duration:6,repeat:Infinity,ease:'easeInOut',delay:.5}}><span className="orx-float-check"><Check size={15}/></span><div><small>YOUR WEEKLY PROGRESS</small><b>You're building momentum</b></div></motion.div>
   </motion.div>
   <div className="orx-hero-caption"><span>BUILT AROUND YOUR LEARNING</span><span>SAT · EST · ACT ENGLISH</span></div>
  </section>
  <section className="orx-stats-band"><div className="orx-stats-inner"><div><strong>01</strong><span>One learning workspace</span></div><i/><div><strong>03</strong><span>Exam pathways</span></div><i/><div><strong>AI</strong><span>Personal learning support</span></div><i/><div><strong>24/7</strong><span>Learn at your pace</span></div></div></section>
  <section className="orx-trending"><div className="orx-trending-head"><div><small>YOUR LEARNING, AT A GLANCE</small><h2>Build skills that move your score.</h2></div><span className="orx-updated"><i/> LEARNING AREAS</span></div><div className="orx-trending-list">{trending.map((x,i)=><motion.div className="orx-trend-row" key={x.name} initial={{opacity:0,x:-18}} whileInView={{opacity:1,x:0}} viewport={{once:true}} transition={{delay:i*.09,duration:.55}}><span className="orx-trend-num">0{i+1}</span><div className="orx-trend-name"><b>{x.name}</b><small>{x.sub}</small></div><span className="orx-trend-tag">{x.level}</span><div className="orx-trend-meter"><i style={{width:x.width}}/></div><strong>{x.score}</strong><ArrowUpRight size={15}/></motion.div>)}</div></section>
  <section className="orx-section orx-programmes" id="programmes"><div className="orx-section-head"><div><small>01 / EXAM PROGRAMMES</small><h2>{t.programs}</h2></div><p>{t.programsSub}</p></div><div className="orx-program-grid">{programs.map((p,i)=><motion.article key={p.name} className="orx-program-card" initial={{opacity:0,y:22}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.2}} transition={{delay:i*.1,duration:.6}}><div className="orx-program-top"><span>{p.tag}</span><p.icon size={19}/></div><h3>{p.name}</h3><p>{p.desc}</p><div className="orx-program-bottom"><span>{p.meta}</span><button onClick={onLogin} aria-label={'Open '+p.name}><ArrowUpRight size={16}/></button></div></motion.article>)}</div></section>
  <section className="orx-feature-section" id="features"><div className="orx-section orx-feature-inner"><div className="orx-section-head"><div><small>02 / THE LEARNING PLATFORM</small><h2>{t.features}</h2></div><p>{t.featuresSub}</p></div>
   <div className="orx-feature-layout"><div className="orx-feature-list">{features.map((f,i)=><Reveal key={f.title}><article className="orx-feature-item"><span className="orx-feature-icon"><f.icon size={18}/></span><div><small>0{i+1} / {f.tag}</small><h3>{rtl?['مساعد ذكي للتعلم','تدريب منظم','متابعة التقدم'][i]:f.title}</h3><p>{rtl?['شرح خطوة بخطوة وتدريب يساعدك على فهم المفاهيم.','دروس وأسئلة وواجبات واختبارات في مكان واحد.','تابع مستواك وحدد المهارات التي تحتاج إلى تطوير.'][i]:f.desc}</p></div><ArrowUpRight size={16}/></article></Reveal>)}</div>
    <Reveal className="orx-ai-demo"><div className="orx-demo-head"><span><Sparkles size={14}/> AI LEARNING ASSISTANT</span><span className="orx-demo-status">AVAILABLE</span></div><div className="orx-chat"><div className="orx-chat-user">Can you explain subject–verb agreement?</div><div className="orx-chat-answer"><span className="orx-ai-mark"><BrainCircuit size={15}/></span><div><small>SAT ENGLISH AI</small><p>Of course. The verb must agree with its subject in number. A singular subject takes a singular verb, while a plural subject takes a plural verb.</p><div className="orx-example"><b>Example</b><span>The student <em>practises</em> every day.</span><span>The students <em>practise</em> every day.</span></div></div></div></div><div className="orx-chat-input"><span>Ask a follow-up question...</span><button><ArrowUpRight size={15}/></button></div><div className="orx-demo-foot"><ShieldCheck size={12}/> Step-by-step learning support</div></Reveal>
   </div>
  </div></section>
  <section className="orx-analytics"><div className="orx-section orx-analytics-inner"><Reveal className="orx-analytics-copy"><small>03 / YOUR PROGRESS</small><h2>See how far you've come. Know where to go next.</h2><p>Keep your learning organised with a clear view of lessons, practice and performance. Your workspace helps you focus on the skills that need attention.</p><div className="orx-checks"><span><Check size={14}/> Personal progress tracking</span><span><Check size={14}/> Structured learning activity</span><span><Check size={14}/> Clear next steps</span></div><button className="orx-text-link" onClick={onLogin}>Explore your workspace <ArrowUpRight size={15}/></button></Reveal>
   <Reveal className="orx-analytics-demo"><div className="orx-analytics-top"><div><small>STUDENT OVERVIEW</small><b>Learning activity</b></div><span>LAST 7 DAYS⌄</span></div><div className="orx-analytics-kpis"><div><small>Practice sessions</small><b>18 <em>+4 this week</em></b></div><div><small>Average accuracy</small><b>84% <em>On track</em></b></div></div><div className="orx-chart"><div className="orx-chart-labels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span></div><div className="orx-chart-bars">{[38,55,46,72,61,84,68].map((v,i)=><div key={i}><i style={{height:v+'%'}}/><small>{['M','T','W','T','F','S','S'][i]}</small></div>)}</div></div><div className="orx-analytics-foot"><span><i/> Practice completed</span><span>Consistent progress <ArrowUpRight size={12}/></span></div></Reveal>
  </div></section>
  <section className="orx-security"><div className="orx-section orx-security-inner"><Reveal><div className="orx-security-icon"><LockKeyhole size={19}/></div><small>04 / BUILT FOR YOUR CLASSROOM</small><h2>A focused space for every learner.</h2><p>Students, teachers and administrators each get the tools and access they need. Secure sign-in and role-based workspaces keep learning organised.</p></Reveal><div className="orx-role-grid">{[{icon:Users,title:'Students',desc:'Lessons, practice and personal progress.'},{icon:GraduationCap,title:'Teachers',desc:'Class tools, assignments and student support.'},{icon:Layers,title:'Administrators',desc:'Manage users, access and platform settings.'}].map((r,i)=><Reveal key={r.title} delay={i*.08}><div className="orx-role-card"><r.icon size={18}/><b>{r.title}</b><span>{r.desc}</span></div></Reveal>)}</div></div></section>
  <section className="orx-section orx-faq" id="faq"><div><small>05 / SUPPORT</small><h2>{t.faq}</h2><p>Quick answers about getting started with SAT English.</p></div><div className="orx-faq-list">{t.faqs.map(([q,a],i)=><article key={q}><button onClick={()=>setOpenFaq(openFaq===i?null:i)} aria-expanded={openFaq===i}><span>{q}</span><ChevronDown size={17}/></button><AnimatePresence initial={false}>{openFaq===i&&<motion.div className="orx-faq-answer" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:.25}}><p>{a}</p></motion.div>}</AnimatePresence></article>)}</div></section>
  <section className="orx-cta"><div><small>READY WHEN YOU ARE</small><h2>{t.cta}</h2><p>{t.ctasub}</p></div><button className="orx-primary" onClick={onLogin}>{t.login}<ArrowUpRight size={16}/></button><div className="orx-cta-orb"/></section>
  <footer className="orx-footer"><a className="orx-brand" href="#top"><span className="orx-logo">S</span><span><b>SAT ENGLISH</b><small>LEARNING PLATFORM</small></span></a><span>© {new Date().getFullYear()} SAT ENGLISH · SECURE LEARNING</span><button onClick={onLogin}><ShieldCheck size={14}/> Student & staff access</button></footer>
 </main>;
}
