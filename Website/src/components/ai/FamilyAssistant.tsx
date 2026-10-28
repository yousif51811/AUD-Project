import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/state/store';
import { useWorkspace } from '@/workspace/Workspace';
import { providerAnswer, cancelAIRequests } from '@/lib/model/engine';
import { PROVIDERS, providerIds, type AIConnection, type ProviderId } from '@/lib/model/providers';
import { useAIConnections } from './AIConnections';
import { contextFor, exactAnswer, parseAnswer, systemPrompt, type AssistantAnswer } from '@/lib/model/assistant';
import { uid } from '@/lib/sanitize';
import { Modal } from '@/components/shared/Modal';
import { DAY_NAMES } from '@/lib/time';
import { ArrowUp, ArrowUpRight, CircleHelp, Leaf, LockKeyhole, RotateCcw, SlidersHorizontal } from 'lucide-react';
const starters = ["Who's responsible for today's tasks?", "Who's free right now?", "Who's open to talk?", 'How could we make this week easier?'];
interface Message {
    id: string;
    question: string;
    result: AssistantAnswer;
    source: string;
    added?: boolean;
}
export function FamilyAssistant() {
    const app = useApp(), w = useWorkspace(), ai = useAIConnections();
    const [input, setInput] = useState(''), [messages, setMessages] = useState<Message[]>([]), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState(''), [consent, setConsent] = useState<{
        question: string;
        system: string;
        connection: AIConnection;
        recordIds: string[];
    } | null>(null);
    const controller = useRef<AbortController | null>(null), generation = useRef(0);
    const log = useRef<HTMLDivElement>(null);
    useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages.length, busy]);
    useEffect(() => { const clear = () => { generation.current++; controller.current?.abort(); cancelAIRequests(); setMessages([]); setBusy(false); setConsent(null); }; window.addEventListener('familymind:clear-ai', clear); return () => { clear(); window.removeEventListener('familymind:clear-ai', clear); }; }, []);
    const facts = () => w.mode === 'demo' ? [{ id: 'sample-profile', kind: 'profile', data: app.profile }, { id: 'sample-plan', kind: 'plan', data: app.plan }, { id: 'sample-calendar', kind: 'calendar', data: app.schedule }] : contextFor(w.records, true, w.actorId, w.members.filter(m=>m.status==='ACTIVE').map(m=>m.userId));
    const active = ai.connections[ai.selected];
    const connectionSignature = active ? `${active.provider}:${active.model}:${active.verifiedAt}` : '';
    useEffect(() => {
        generation.current++; controller.current?.abort(); setBusy(false); setStatus(''); setConsent(null);
    }, [ai.selected, connectionSignature]);
    const perform = async (preview: NonNullable<typeof consent>) => {
        if (systemPrompt(facts()) !== preview.system || ai.connections[preview.connection.provider]?.apiKey !== preview.connection.apiKey || ai.selected !== preview.connection.provider) {
            setError('Your records or AI connection changed. Review a new request preview before sending.'); return;
        }
        const request = ++generation.current;
        setBusy(true); setError(''); controller.current = new AbortController();
        try {
            setStatus(`Waiting for ${PROVIDERS[preview.connection.provider].name}… Your planner remains available.`);
            const text = await providerAnswer(preview.connection, preview.system, preview.question, controller.current.signal);
            if (request !== generation.current) return;
            let result: AssistantAnswer;
            try { result = parseAnswer(text, app.profile?.members.map(m => m.id) ?? [], preview.recordIds); }
            catch { throw new Error('The assistant returned an invalid suggestion. Nothing was changed. Try again or choose another model.'); }
            const source = `Cloud AI · ${PROVIDERS[preview.connection.provider].name}`;
            setMessages(xs => [...xs, { id: uid('chat'), question: preview.question, result, source }].slice(-20));
            if (w.mode === 'account') await w.save('chat', crypto.randomUUID(), { question: preview.question, answer: result.answer, source: preview.connection.provider, createdAt: new Date().toISOString() });
        } catch (e) {
            if (request === generation.current && (e as Error).name !== 'AbortError') setError((e as Error).message || 'The assistant could not produce a valid answer. Nothing was changed.');
        } finally { if (request === generation.current) { setBusy(false); setStatus(''); } }
    };
    const send = (raw: string) => {
        const question = raw.trim().slice(0, 1000);
        if (!question || busy)
            return;
        setInput('');
        setError('');
        setStatus('');
        const exact = exactAnswer(question, app, w.records, app.today);
        if (exact) {
            setMessages(xs => [...xs, { id: uid('answer'), question, result: { answer: exact, actions: [], sources: [] }, source: 'Built-in tools · recorded facts' }].slice(-20));
            return;
        }
        if (!active) {
            setError(`Connect ${PROVIDERS[ai.selected].name} in AI settings first. Built-in assignment and availability questions still work without AI.`);
            return;
        }
        const records = facts();
        setConsent({ question, system: systemPrompt(records), connection: { ...active }, recordIds: records.map(r => r.id) });
    };
    const apply = (m: Message) => { setError(''); const errors = app.addQuickActions(m.result.actions.map(a => ({ ...a, day: a.day as import('@/types').DayIndex, id: uid('action'), done: false, source: 'coach' as const }))); if (errors.length) {
        setError(errors.join(' '));
        return;
    } setMessages(xs => xs.map(x => x.id === m.id ? { ...x, added: true } : x)); };
    return <section id="assistant" tabIndex={-1} className="home-assistant" aria-labelledby="assistant-title">
      <div className="assistant-heading">
        <div className="assistant-identity"><span className="assistant-mark" aria-hidden="true"><Leaf size={22}/></span><div><span className="courtyard-eyebrow">YOUR FAMILY ASSISTANT</span><h2 id="assistant-title">What’s on your mind?</h2></div></div>
        <span className="assistant-privacy"><LockKeyhole size={12} aria-hidden/>Your conversation, your choice</span>
      </div>
      <p className="assistant-intro">Untangle a busy day. Share the load. Find a little time for each other.</p>
      {(messages.length > 0 || busy || error || status) && <div className="assistant-conversation" ref={log}>
        <div role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
          {messages.map(m => <article className="assistant-exchange" key={m.id}>
            <p className="assistant-question">{m.question}</p>
            <div className="assistant-answer"><span className="answer-sprout" aria-hidden><Leaf size={17}/></span><div className="stack stack-sm"><p style={{ whiteSpace: 'pre-line' }}>{m.result.answer}</p><span className="answer-source">{m.source}</span>
              {m.result.actions.length > 0 && <><h3>Proposed actions — review before adding</h3>{m.result.actions.map((a, i) => <div className="card stack stack-sm" key={i}><label className="field">Action<input className="input" value={a.title} onChange={e => setMessages(xs => xs.map(x => x.id !== m.id ? x : { ...x, result: { ...x.result, actions: x.result.actions.map((v, n) => n === i ? { ...v, title: e.target.value } : v) } }))}/></label><p>{DAY_NAMES[a.day]} · {a.minutes} minutes · {a.participantIds.map(id => app.profile?.members.find(p => p.id === id)?.name).join(', ')}</p><p className="hint">{a.reason}</p></div>)}<button className="btn btn-primary" disabled={m.added} onClick={() => apply(m)}>{m.added ? 'Submitted — check Our week / requests' : 'Confirm these actions'}</button><p className="hint">Other members must accept changes to their commitments. No calendar event is automatically moved.</p></>}
            </div></div>
          </article>)}
        </div>
        {busy && <div role="status" className="assistant-progress"><span className="assistant-working" aria-hidden/><span>{status}</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => { generation.current++; controller.current?.abort(); cancelAIRequests(); setBusy(false); setStatus('Cancelled.'); }}>Cancel</button></div>}
        {error && <p className="notice notice-safety" role="alert">{error}</p>}
        {!busy && status && <p className="hint" role="status">{status}</p>}
      </div>}
      <form className="assistant-composer" onSubmit={e => { e.preventDefault(); send(input); }}>
        <label className="sr-only" htmlFor="home-assistant-input">Ask about your week</label>
        <textarea id="home-assistant-input" value={input} onChange={e => setInput(e.target.value)} placeholder="A busy week? Let’s work it out together…" maxLength={1000} rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } }}/>
        <button className="assistant-send" disabled={!input.trim() || busy} aria-label="Ask the assistant"><ArrowUp size={23} aria-hidden/></button>
      </form>
      <div className="assistant-starters" aria-label="Suggested questions">{starters.map((text, i) => <button type="button" key={text} disabled={busy} onClick={() => send(text)}><span aria-hidden className="starter-dot" data-tone={i}/>{text}<ArrowUpRight size={13} aria-hidden/></button>)}</div>
      <div className="assistant-toolbar">
        <label className="assistant-mode"><span className="mode-dot" aria-hidden/><span className="sr-only">Answer with</span><select value={ai.selected} onChange={e => ai.select(e.target.value as ProviderId)} disabled={busy || !ai.ready || consent !== null}>{providerIds.map(id => <option key={id} value={id}>{PROVIDERS[id].name}{ai.connections[id] ? ' · connected' : ' · connect'}</option>)}</select></label>
        <div className="assistant-toolbar-links">{messages.length > 0 && <button type="button" onClick={() => { generation.current++; controller.current?.abort(); cancelAIRequests(); setMessages([]); setBusy(false); setError(''); setStatus(''); }} aria-label="Clear conversation"><RotateCcw size={13}/><span>Clear</span></button>}<Link to="/settings#ai-settings"><SlidersHorizontal size={13}/><span>{active ? 'AI settings' : 'Connect AI'}</span></Link></div>
      </div>
      <details className="assistant-disclosure"><summary><CircleHelp size={12} aria-hidden/>How answers & privacy work</summary><p>Exact questions use labelled built-in tools and recorded facts on your device. AI requests go directly to the provider you choose, using only the context you preview and approve. No model download or special GPU is needed. Keys stay in this browser; our backend does not perform inference. No suggestion changes your plan without confirmation. This is not a medical service and never infers anyone’s feelings.</p></details>
      <Modal open={consent !== null} title="Review what leaves this device" onClose={() => setConsent(null)}><p>This question and the approved records below will be readable by {consent ? PROVIDERS[consent.connection.provider].name : 'your provider'}{consent?.connection.provider === 'openrouter' ? ' and its selected model host' : ''}. They go directly from this browser; our backend never handles the AI request.</p><p className="hint">Model: {consent?.connection.model}. Previous chat messages are excluded. You decide whether to send this request.</p><pre className="context-preview">{consent?.question}{'\n\n'}{consent?.system}</pre><button className="btn btn-primary" onClick={() => { const preview = consent!; setConsent(null); void perform(preview); }}>Send this request to {consent ? PROVIDERS[consent.connection.provider].name : 'provider'}</button></Modal>
    </section>;
}
