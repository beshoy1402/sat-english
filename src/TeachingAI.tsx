import { useState } from 'react';
import { BrainCircuit, Copy, Download, RefreshCw, Sparkles } from 'lucide-react';

type WorksheetQuestion = { prompt: string; choices?: string[]; answer: string; explanation: string; difficulty?: string };
type Worksheet = { title: string; instructions: string; passage?: string; questions: WorksheetQuestion[]; answer_key?: Array<{ number: number; answer: string; explanation: string }> };

export default function TeachingAI({ client }: { client: any }) {
  const [program, setProgram] = useState('SAT English');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('mixed');
  const [count, setCount] = useState(10);
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [includePassage, setIncludePassage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setWorksheet(null);
    try {
      const { data, error: invokeError } = await client.functions.invoke('ai-learning', { body: {
        action: 'worksheet', exam_program: program, topic: topic.trim(), difficulty: level,
        question_count: count, include_answer_key: includeAnswers, include_passage: includePassage
      }});
      if (invokeError) throw new Error(invokeError.message || 'Worksheet generation failed.');
      if (data?.error) throw new Error(data.error);
      if (!data?.worksheet?.questions?.length) throw new Error('The AI returned an empty worksheet. Try again.');
      setWorksheet(data.worksheet);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not generate the worksheet.'); }
    finally { setBusy(false); }
  };

  const printable = () => {
    if (!worksheet) return '';
    return [
      worksheet.title, '', worksheet.instructions, '',
      worksheet.passage ? 'PASSAGE\n' + worksheet.passage + '\n' : '',
      ...worksheet.questions.map((q, i) => [(i + 1) + '. ' + q.prompt, ...(q.choices ?? []).map((c, n) => String.fromCharCode(65+n) + '. ' + c)].join('\n')),
      includeAnswers ? '\nANSWER KEY\n' + worksheet.questions.map((q, i) => (i+1)+'. '+q.answer+' — '+q.explanation).join('\n') : ''
    ].filter(Boolean).join('\n\n');
  };
  const download = () => {
    const blob = new Blob([printable()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'english-worksheet.txt'; a.click(); URL.revokeObjectURL(url);
  };

  return <section className="panel full-panel teaching-ai">
    <div className="panel-heading"><div><small>GEMINI-POWERED TEACHING ASSISTANT</small><h3>AI Worksheet Studio</h3><p>Create SAT, EST and ACT English practice worksheets with questions, answer keys and explanations.</p></div><BrainCircuit/></div>
    <form className="teaching-ai-form" onSubmit={generate}>
      <label>Exam program<select value={program} onChange={e=>setProgram(e.target.value)}><option>SAT English</option><option>EST English</option><option>ACT English</option></select></label>
      <label>Topic or skill<input required minLength={2} maxLength={160} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. subject-verb agreement, transitions, inference"/></label>
      <div className="teaching-ai-grid">
        <label>Difficulty<select value={level} onChange={e=>setLevel(e.target.value)}><option value="mixed">Mixed</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
        <label>Number of questions<select value={count} onChange={e=>setCount(Number(e.target.value))}>{[5,10,15,20].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      </div>
      <label className="teaching-ai-check"><input type="checkbox" checked={includePassage} onChange={e=>setIncludePassage(e.target.checked)}/> Include a reading passage when appropriate</label>
      <label className="teaching-ai-check"><input type="checkbox" checked={includeAnswers} onChange={e=>setIncludeAnswers(e.target.checked)}/> Include teacher answer key and explanations</label>
      {error&&<div className="error-banner">{error}</div>}
      <button className="small-primary" disabled={busy}><Sparkles size={16}/>{busy?'Generating worksheet…':'Generate worksheet'}</button>
    </form>
    {worksheet&&<div className="teaching-ai-result">
      <div className="teaching-ai-result-head"><div><small>GENERATED DRAFT · REVIEW BEFORE SHARING</small><h3>{worksheet.title}</h3></div><div><button className="icon-button" onClick={()=>void navigator.clipboard.writeText(printable())} title="Copy worksheet"><Copy size={16}/></button><button className="icon-button" onClick={download} title="Download worksheet"><Download size={16}/></button></div></div>
      <p>{worksheet.instructions}</p>
      {worksheet.passage&&<blockquote>{worksheet.passage}</blockquote>}
      {worksheet.questions.map((q,i)=><article className="teaching-ai-question" key={i}><b>{i+1}. {q.prompt}</b>{q.choices?.map((choice,n)=><p key={n}>{String.fromCharCode(65+n)}. {choice}</p>)}{includeAnswers&&<details><summary>Answer and explanation</summary><p><b>{q.answer}</b> — {q.explanation}</p></details>}</article>)}
      <div className="ai-security-note"><Sparkles size={17}/><div><b>AI-generated material is a draft</b><span>Review every question, answer and explanation for accuracy and alignment with your lesson before assigning it.</span></div></div>
      <button className="small-primary" onClick={()=>void navigator.clipboard.writeText(printable())}><Copy size={15}/> Copy worksheet</button>
      <button className="icon-button" onClick={()=>setWorksheet(null)}><RefreshCw size={15}/> Start another</button>
    </div>}
  </section>;
}
