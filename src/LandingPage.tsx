import {useState} from 'react';
import {motion} from 'framer-motion';
import {ArrowUpRight,ArrowRight,BookOpen,GraduationCap,CheckCircle2,Menu,X,Globe2,Target,Sparkles,ChevronDown,ShieldCheck,BrainCircuit,ChartNoAxesCombined,FileText,Zap} from 'lucide-react';

type Props={onLogin:()=>void};
const programs=[
 {name:'SAT English',tag:'DIGITAL SAT',desc:'Reading, grammar, vocabulary and rhetorical skills for the SAT.',icon:BookOpen,meta:'Reading & Writing'},
 {name:'EST English',tag:'EGYPTIAN EXAMS',desc:'Build exam confidence with focused lessons and structured practice.',icon:Target,meta:'EST preparation'},
 {name:'ACT English',tag:'INTERNATIONAL',desc:'Sharpen grammar, editing and rhetorical analysis skills.',icon:GraduationCap,meta:'English section'}
];
const features=[
 {icon:BrainCircuit,title:'AI learning assistant',desc:'Get step-by-step explanations, ask questions and practise difficult concepts.'},
 {icon:FileText,title:'Structured practice',desc:'Work through lessons, question sets, assignments and practice exams.'},
 {icon:ChartNoAxesCombined,title:'Progress that makes sense',desc:'Review your activity and identify the skills to focus on next.'}
];
export default function LandingPage({onLogin}:Props){
 const [lang,setLang]=useState<'en'|'ar'>('en'),[menu,setMenu]=useState(false),[openFaq,setOpenFaq]=useState<number|null>(0);
 const rtl=lang==='ar';
 const t=rtl?{
  nav:['البرامج','المميزات','الأسئلة الشائعة'],login:'دخول الحساب',eyebrow:'منصة تعلم اللغة الإنجليزية',title:'استعد بذكاء.',sub:'تعلّم وتدرّب وتابع تقدمك في مكان واحد. إعداد منظم لاختبارات SAT وEST وACT مع أدوات تعليمية مدعومة بالذكاء الاصطناعي.',explore:'استكشف البرامج',workspace:'افتح مساحة التعلم',programs:'اختر مسارك',programsSub:'مسارات واضحة للاستعداد لاختبارات اللغة الإنجليزية.',features:'كل ما تحتاجه للتقدم',featuresSub:'أدوات تعليمية وتدريبية تساعدك على الاستعداد بتركيز.',faq:'الأسئلة الشائعة',cta:'ابدأ رحلتك التعليمية',ctasub:'سجّل الدخول إلى مساحة التعلم الخاصة بك.',faqs:[['كيف أحصل على حساب؟','يتم إنشاء الحسابات بواسطة فريق العمل المصرح له. لا يوجد تسجيل عام.'],['ما الاختبارات المتاحة؟','تتضمن المنصة الاستعداد لقسم اللغة الإنجليزية في SAT وEST وACT.'],['هل يوجد مساعد ذكاء اصطناعي؟','تتضمن مساحة التعلم أدوات مساعدة تعليمية بالذكاء الاصطناعي حسب صلاحيات حسابك.']]
 }:{
  nav:['Programmes','Features','FAQ'],login:'Sign in',eyebrow:'THE ENGLISH PREPARATION WORKSPACE',title:'Prepare with purpose.',sub:'Learn, practise and track your progress in one focused workspace. Structured preparation for SAT, EST and ACT English, supported by AI-powered learning tools.',explore:'Explore programmes',workspace:'Open learning workspace',programs:'Choose your path',programsSub:'Focused preparation pathways for the English exam you are taking.',features:'Everything you need to improve',featuresSub:'A connected learning experience built around lessons, practice and progress.',faq:'Frequently asked questions',cta:'Your next step starts here',ctasub:'Sign in to open your personal learning workspace.',faqs:[['How do I get an account?','Accounts are created by authorized staff. There is no public registration.'],['Which exams are supported?','The platform supports preparation for SAT, EST and ACT English.'],['Does the platform include AI?','AI learning tools are available inside the workspace according to your account permissions.']]
 };
 return <main className="or-site" dir={rtl?'rtl':'ltr'}>
  <header className="or-header">
   <a className="or-brand" href="#top" aria-label="SAT English home"><span className="or-brand-mark">S</span><span><b>SAT ENGLISH</b><small>LEARNING PLATFORM</small></span></a>
   <nav className={menu?'or-nav is-open':'or-nav'}>{t.nav.map((item,i)=><a key={item} href={['#programmes','#features','#faq'][i]} onClick={()=>setMenu(false)}>{item}</a>)}</nav>
   <div className="or-header-actions"><button className="or-language" onClick={()=>setLang(rtl?'en':'ar')}><Globe2 size={15}/>{rtl?'EN':'عربي'}</button><button className="or-signin" onClick={onLogin}>{t.login}<ArrowUpRight size={15}/></button><button className="or-mobile-menu" onClick={()=>setMenu(!menu)} aria-label="Toggle navigation">{menu?<X/>:<Menu/>}</button></div>
  </header>
  <section className="or-hero" id="top">
   <div className="or-hero-copy">
    <div className="or-eyebrow"><span/> {t.eyebrow}</div>
    <h1>{t.title}</h1>
    <p>{t.sub}</p>
    <div className="or-hero-actions"><a className="or-primary" href="#programmes">{t.explore}<ArrowRight size={16}/></a><button className="or-secondary" onClick={onLogin}>{t.workspace}<ArrowUpRight size={16}/></button></div>
    <div className="or-proof"><span><ShieldCheck size={15}/> Secure student and staff access</span><span><Zap size={15}/> AI-assisted learning</span></div>
   </div>
   <motion.div className="or-product-preview" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.7}}>
    <div className="or-preview-top"><div><i/><i/><i/></div><span>STUDENT WORKSPACE / OVERVIEW</span><span className="or-preview-status">● LIVE WORKSPACE</span></div>
    <div className="or-preview-body">
     <aside className="or-preview-side"><b>✳ LEARN</b><span className="selected">Overview</span><span>AI English tutor</span><span>Practice exams</span><span>My courses</span><span>Progress</span></aside>
     <div className="or-preview-main"><div className="or-preview-welcome"><small>YOUR LEARNING SPACE</small><b>Welcome back.</b><span>Your next study session is ready.</span></div><div className="or-preview-metrics"><div><small>Practice completed</small><b>12 <em>sessions</em></b><i style={{width:'72%'}}/></div><div><small>Skills in progress</small><b>08 <em>topics</em></b><i style={{width:'54%'}}/></div></div><div className="or-preview-task"><div><small>CONTINUE LEARNING</small><b>Subject–verb agreement</b><span>Grammar · 12 min lesson</span></div><span className="or-preview-play"><ArrowUpRight size={17}/></span></div><div className="or-preview-bottom"><span><BrainCircuit size={14}/> AI learning assistant</span><span><ChartNoAxesCombined size={14}/> Progress tracking</span></div></div>
    </div>
   </motion.div>
   <div className="or-hero-foot"><span>BUILT FOR YOUR NEXT SCORE</span><span>SAT · EST · ACT ENGLISH</span></div>
  </section>
  <section className="or-section or-programmes" id="programmes"><div className="or-section-heading"><div><small>01 / EXAM PROGRAMMES</small><h2>{t.programs}</h2></div><p>{t.programsSub}</p></div><div className="or-program-grid">{programs.map((p,i)=><motion.article key={p.name} className="or-program-card" initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*.08}}><div className="or-card-top"><span>{p.tag}</span><p.icon size={19}/></div><h3>{p.name}</h3><p>{p.desc}</p><div className="or-card-bottom"><span>{p.meta}</span><button onClick={onLogin} aria-label={'Open '+p.name}><ArrowUpRight size={17}/></button></div></motion.article>)}</div></section>
  <section className="or-section or-features" id="features"><div className="or-section-heading"><div><small>02 / LEARNING TOOLS</small><h2>{t.features}</h2></div><p>{t.featuresSub}</p></div><div className="or-feature-grid">{features.map((f,i)=><article key={f.title} className="or-feature-card"><span className="or-feature-icon"><f.icon size={20}/></span><small>0{i+1} / PLATFORM FEATURE</small><h3>{rtl?['مساعد التعلم بالذكاء الاصطناعي','تدريب منظم','متابعة التقدم'][i]:f.title}</h3><p>{rtl?['احصل على شرح خطوة بخطوة واسأل وتدرّب على المفاهيم الصعبة.','تدرّب من خلال الدروس والأسئلة والواجبات والاختبارات.','راجع نشاطك وحدد المهارات التي تحتاج إلى التركيز عليها.'][i]:f.desc}</p></article>)}</div></section>
  <section className="or-section or-faq" id="faq"><div><small>03 / SUPPORT</small><h2>{t.faq}</h2></div><div className="or-faq-list">{t.faqs.map(([q,a],i)=><article key={q}><button onClick={()=>setOpenFaq(openFaq===i?null:i)} aria-expanded={openFaq===i}><span>{q}</span><ChevronDown size={17}/></button>{openFaq===i&&<p>{a}</p>}</article>)}</div></section>
  <section className="or-cta"><div><small>READY WHEN YOU ARE</small><h2>{t.cta}</h2><p>{t.ctasub}</p></div><button className="or-primary" onClick={onLogin}>{t.login}<ArrowUpRight size={16}/></button></section>
  <footer className="or-footer"><a className="or-brand" href="#top"><span className="or-brand-mark">S</span><span><b>SAT ENGLISH</b><small>LEARNING PLATFORM</small></span></a><span>© {new Date().getFullYear()} SAT ENGLISH · SECURE LEARNING</span><button onClick={onLogin}><ShieldCheck size={14}/> Staff & student access</button></footer>
 </main>;
}
