import {useState} from 'react';
import {Bot,Send,Sparkles,Trash2} from 'lucide-react';
import './ai-tutor.css';
type Message={role:'user'|'assistant';content:string;provider?:string};
export default function AITutor({client}:{client:any}){
 const [messages,setMessages]=useState<Message[]>([{role:'assistant',content:'Hello! I can help you practise SAT, EST and ACT English. Ask me about grammar, reading comprehension, vocabulary or rhetorical skills.'}]);
 const [draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const send=async(e:React.FormEvent)=>{
  e.preventDefault();const text=draft.trim();if(!text||busy)return;
  const next=[...messages,{role:'user' as const,content:text}];setMessages(next);setDraft('');setBusy(true);setNotice('');
  const {data,error}=await client.functions.invoke('ai-learning',{body:{action:'tutor',messages:next.slice(-20).map(m=>({role:m.role,content:m.content}))}});
  if(error||data?.error){setNotice(data?.error||error?.message||'The AI tutor could not respond.');setMessages(old=>[...old,{role:'assistant',content:'I could not reach the AI provider. Please try again in a moment.'}]);}
  else setMessages(old=>[...old,{role:'assistant',content:data.content,provider:data.provider+' · '+data.model}]);
  setBusy(false);
 };
 return <section className="ai-tutor"><header><div className="ai-tutor-icon"><Bot/></div><div><span>PERSONAL LEARNING ASSISTANT</span><h2>AI English Tutor</h2><p>Ask questions, practise exam skills and get clear explanations.</p></div><button onClick={()=>{setMessages([{role:'assistant',content:'Hello! What English skill would you like to practise today?'}]);setNotice('');}} title="Clear conversation"><Trash2 size={15}/></button></header>
  {notice&&<div className="ai-tutor-notice">{notice}</div>}
  <div className="ai-chat-messages">{messages.map((m,i)=><article key={i} className={'ai-chat-message '+m.role}><span className="ai-chat-avatar">{m.role==='assistant'?<Sparkles size={14}/>: 'You'}</span><div><p>{m.content}</p>{m.provider&&<small>{m.provider}</small>}</div></article>)}{busy&&<article className="ai-chat-message assistant"><span className="ai-chat-avatar"><Sparkles size={14}/></span><div className="ai-typing"><i/><i/><i/> Thinking…</div></article>}</div>
  <form className="ai-chat-compose" onSubmit={send}><textarea rows={2} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Ask your English tutor anything…" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send(e as any);}}}/><button disabled={busy||!draft.trim()}><Send size={16}/></button></form>
  <small className="ai-tutor-footnote">AI answers can contain mistakes. Check explanations against your course materials and ask your teacher when unsure.</small>
 </section>;
}
