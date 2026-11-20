import {useState} from 'react';
import {motion} from 'framer-motion';
import {ArrowUpRight,ArrowRight,BookOpen,GraduationCap,Play,CheckCircle2,Menu,X,Globe2,Target,Sparkles} from 'lucide-react';

type Props={onLogin:()=>void};
const copy={
 en:{nav:['Courses','How it works','Results','About'],login:'Student login',cta:'Explore courses',eyebrow:'SAT · EST · ACT ENGLISH',titleA:'Make your next',titleB:'score your best.',desc:'A smarter, more focused way to prepare for English exams — with expert teaching, structured practice and a clear path forward.',primary:'Explore programmes',secondary:'Student portal',trusted:'A focused academy for ambitious students',programmes:'One goal. Three pathways.',programmesSub:'Choose the exam you are preparing for. Build the skills, confidence and strategy to reach your target.',how:'A clear path to progress',howSub:'Everything you need to turn consistent effort into measurable improvement.',results:'Progress you can understand',resultsSub:'Practice with purpose, review your mistakes and know what to work on next.',about:'Teaching with direction',aboutSub:'Clear explanations, thoughtful practice and support that keeps your goals in focus.',faq:'Frequently asked questions',contact:'Ready to take the next step?',contactSub:'Explore the programmes and find the right starting point for your preparation.',footer:'Focused English preparation. Built around your next score.',start:'Start learning',learn:'Learn more',online:'Online & in-person learning',mentor:'Guided by your teacher',practice:'Structured exam practice'},
 ar:{nav:['البرامج','كيف نعمل','النتائج','عن الأكاديمية'],login:'دخول الطالب',cta:'استكشف البرامج',eyebrow:'SAT · EST · ACT ENGLISH',titleA:'اجعل نتيجتك',titleB:'القادمة الأفضل.',desc:'طريقة أكثر تركيزًا وذكاءً للاستعداد لاختبارات اللغة الإنجليزية، من خلال شرح واضح وتدريب منظم وخطة تساعدك على التقدم.',primary:'استكشف البرامج',secondary:'بوابة الطالب',trusted:'أكاديمية متخصصة للطلاب الطموحين',programmes:'هدف واحد. ثلاثة مسارات.',programmesSub:'اختر الاختبار الذي تستعد له، وطور مهاراتك وثقتك واستراتيجيتك للوصول إلى هدفك.',how:'طريق واضح نحو التقدم',howSub:'كل ما تحتاجه لتحويل المذاكرة المنتظمة إلى تحسن يمكنك قياسه.',results:'تقدم يمكنك فهمه',resultsSub:'تدرب بهدف، وراجع أخطاءك، واعرف ما تحتاج إلى تحسينه بعد ذلك.',about:'تعليم بخطة واضحة',aboutSub:'شرح مبسط وتدريب مدروس ودعم يساعدك على التركيز على أهدافك.',faq:'الأسئلة الشائعة',contact:'مستعد للخطوة التالية؟',contactSub:'استكشف البرامج واختر نقطة البداية المناسبة لاستعدادك.',footer:'إعداد مركز للغة الإنجليزية. من أجل نتيجتك القادمة.',start:'ابدأ التعلم',learn:'اعرف المزيد',online:'تعلم أونلاين أو حضوريًا',mentor:'بمتابعة مدرسك',practice:'تدريب منظم على الاختبارات'}
};
const programs=[{tag:'01 / COLLEGE ADMISSIONS',name:'SAT English',detail:'Reading, Writing & Language',text:'Build the reading, grammar and reasoning skills needed for the digital SAT.',icon:BookOpen},{tag:'02 / EGYPTIAN EXAMS',name:'EST English',detail:'EST English preparation',text:'Strengthen your English foundations and practise with a focused exam strategy.',icon:Target},{tag:'03 / INTERNATIONAL',name:'ACT English',detail:'English test preparation',text:'Improve grammar, rhetoric and editing skills with targeted practice.',icon:GraduationCap}];
const steps=[['01','Understand your level','Start with a clear picture of your strengths and the skills that need attention.'],['02','Learn with structure','Follow focused lessons and guided practice designed around your exam.'],['03','Practise and improve','Review performance, learn from mistakes and keep moving toward your goal.']];
export default function LandingPage({onLogin}:Props){
 const [lang,setLang]=useState<'en'|'ar'>('en'),[menu,setMenu]=useState(false);
 const t=copy[lang],rtl=lang==='ar';
 return <main className="ns-landing" dir={rtl?'rtl':'ltr'}>
  <header className="ns-nav">
   <a className="ns-brand" href="#home"><span className="ns-brand-symbol">N</span><span><b>NORTHSTAR</b><small>ENGLISH ACADEMY</small></span></a>
   <nav className={menu?'ns-links is-open':'ns-links'}>{t.nav.map((n,i)=><a key={n} href={['#programmes','#method','#results','#about'][i]} onClick={()=>setMenu(false)}>{n}</a>)}</nav>
   <div className="ns-nav-actions"><button className="ns-language" onClick={()=>setLang(rtl?'en':'ar')} aria-label="Change language"><Globe2 size={15}/>{rtl?'EN':'عربي'}</button><button className="ns-login" onClick={onLogin}>{t.login}<ArrowUpRight size={15}/></button><button className="ns-menu" onClick={()=>setMenu(!menu)} aria-label="Toggle menu">{menu?<X/>:<Menu/>}</button></div>
  </header>
  <section className="ns-hero" id="home">
   <div className="ns-hero-grid"/>
   <div className="ns-hero-copy">
    <motion.div className="ns-eyebrow" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.6}}><span/> {t.eyebrow}</motion.div>
    <motion.h1 initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:.75,delay:.08}}>{t.titleA}<br/><em>{t.titleB}</em></motion.h1>
    <motion.p initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.7,delay:.18}}>{t.desc}</motion.p>
    <motion.div className="ns-hero-actions" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{duration:.6,delay:.28}}><a className="ns-primary" href="#programmes">{t.primary}<ArrowRight size={17}/></a><button className="ns-secondary" onClick={onLogin}><span><Play size={13} fill="currentColor"/></span>{t.secondary}</button></motion.div>
    <div className="ns-proof"><div className="ns-avatar-stack"><i>B</i><i>✦</i><i>+</i></div><span>{t.trusted}</span></div>
   </div>
   <motion.div className="ns-hero-art" initial={{opacity:0,scale:.88,rotateY:-12}} animate={{opacity:1,scale:1,rotateY:0}} transition={{duration:1.1,ease:[.2,.75,.2,1],delay:.15}}>
    <div className="ns-orbit ns-orbit-one"/><div className="ns-orbit ns-orbit-two"/>
    <div className="ns-glow"/>
    <div className="ns-book ns-book-back"><span>READ</span><b>THE<br/>WORLD</b><small>01 / ENGLISH</small></div>
    <div className="ns-book ns-book-front"><span>NORTHSTAR / ACADEMY</span><b>WORDS<br/><i>MATTER.</i></b><small>READ · THINK · ACHIEVE</small><div className="ns-book-lines"><i/><i/><i/></div></div>
    <div className="ns-floating ns-float-top"><Sparkles size={15}/><span>THINK<br/>CLEARLY</span></div>
    <div className="ns-floating ns-float-bottom"><Target size={17}/><span>YOUR NEXT<br/>MILESTONE</span></div>
    <div className="ns-art-caption"><span>01</span><i/> BUILT FOR YOUR NEXT CHAPTER</div>
   </motion.div>
   <div className="ns-hero-bottom"><span>SCROLL TO EXPLORE</span><i/></div>
  </section>
  <section className="ns-strip"><span> {t.online}</span><i/><span>{t.mentor}</span><i/><span>{t.practice}</span><i/><span>SAT · EST · ACT</span></section>
  <section className="ns-section ns-programmes" id="programmes"><div className="ns-section-head"><div><span className="ns-label">01 / EXAM PROGRAMMES</span><h2>{t.programmes}</h2></div><p>{t.programmesSub}</p></div><div className="ns-program-grid">{programs.map((p,i)=><motion.article className="ns-program-card" key={p.name} initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.2}} transition={{delay:i*.1}}><div className="ns-program-top"><span>{p.tag}</span><p.icon size={22}/></div><h3>{p.name}</h3><b>{p.detail}</b><p>{p.text}</p><button onClick={onLogin}>{t.start}<ArrowUpRight size={16}/></button><span className="ns-card-number">0{i+1}</span></motion.article>)}</div></section>
  <section className="ns-section ns-method" id="method"><div className="ns-method-intro"><span className="ns-label">02 / THE NORTHSTAR METHOD</span><h2>{t.how}</h2><p>{t.howSub}</p><button className="ns-outline" onClick={onLogin}>{t.learn}<ArrowUpRight size={15}/></button></div><div className="ns-steps">{steps.map(([n,title,desc])=><article key={n}><span>{n}</span><div><h3>{title}</h3><p>{desc}</p></div><ArrowUpRight size={18}/></article>)}</div></section>
  <section className="ns-section ns-results" id="results"><div className="ns-results-visual"><div className="ns-score-card"><span>YOUR STUDY JOURNEY</span><div className="ns-score-ring"><b>+<i>1</i></b><small>STEP AT A TIME</small></div><div className="ns-score-bars"><i/><i/><i/></div><small>LEARN · PRACTISE · GROW</small></div><div className="ns-results-orb"/></div><div className="ns-results-copy"><span className="ns-label">03 / MEASURE YOUR GROWTH</span><h2>{t.results}</h2><p>{t.resultsSub}</p><ul><li><CheckCircle2/> Track your learning activity</li><li><CheckCircle2/> Identify skills to improve</li><li><CheckCircle2/> Review your exam performance</li></ul></div></section>
  <section className="ns-section ns-about" id="about"><span className="ns-label">04 / OUR APPROACH</span><h2>{t.about}</h2><p>{t.aboutSub}</p><div className="ns-about-stats"><div><b>01</b><span>Focused lessons</span></div><div><b>02</b><span>Purposeful practice</span></div><div><b>03</b><span>Clear feedback</span></div></div></section>
  <section className="ns-cta"><div><span className="ns-label">YOUR NEXT CHAPTER STARTS HERE</span><h2>{t.contact}</h2><p>{t.contactSub}</p></div><button className="ns-primary" onClick={onLogin}>{t.cta}<ArrowUpRight size={17}/></button></section>
  <footer className="ns-footer"><a className="ns-brand" href="#home"><span className="ns-brand-symbol">N</span><span><b>NORTHSTAR</b><small>ENGLISH ACADEMY</small></span></a><p>{t.footer}</p><span>© {new Date().getFullYear()} NORTHSTAR ENGLISH</span></footer>
 </main>;
}
