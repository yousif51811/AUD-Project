import { AgentProposal } from './AgentProposal';
import { agentSnapshot } from '@/workspace/agent';
import { householdDate } from '@/lib/dates';
import { t, useLanguage } from '@/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/state/store';
import { useWorkspace } from '@/workspace/Workspace';
import { providerAnswer, cancelAIRequests } from '@/lib/model/engine';
import { PROVIDERS, PROVIDER_POLICIES, providerIds, type AIConnection } from '@/lib/model/providers';
import { serverAnswer } from '@/lib/model/server-client';
import { SERVER_AI_NAME, serverRequestSchema, type AISelection, type ServerAIRequest } from '@/lib/model/server-contract';
import { canonical } from '@/lib/canonical';
import { useAIConnections } from './AIConnections';
import { boundedFacts, contextFor, exactAnswer, parseAnswer, systemPrompt, type AssistantAnswer } from '@/lib/model/assistant';
import { uid } from '@/lib/sanitize';
import { DAY_NAMES } from '@/lib/time';
import { ArrowUp, ArrowUpRight, CalendarClock, CircleHelp, HeartHandshake, Leaf, ListChecks, LockKeyhole, RotateCcw, SlidersHorizontal } from 'lucide-react';
const starters = ["Who's responsible for today's tasks?", "Who's free right now?", "Who's open to talk?", 'How could we make this week easier?'];
const selectionName = (selection: AISelection) => selection === 'server' ? t(SERVER_AI_NAME) : PROVIDERS[selection].name;
const starterIcons = [ListChecks, CalendarClock, HeartHandshake, Leaf];
interface AssistantRequest {
    question: string;
    snapshot: string;
    management: ServerAIRequest["management"];
    system: string;
    connection?: AIConnection;
    selection: AISelection;
    model: string;
    facts: ServerAIRequest["facts"];
    memberIds: string[];
    recordIds: string[];
}
interface Message {
    id: string;
    question: string;
    result: AssistantAnswer;
    source: string;
    added?: boolean;
    snapshot?: string;
}
export function FamilyAssistant() {
  const { language } = useLanguage();
    const app = useApp(), w = useWorkspace(), ai = useAIConnections();
    const [input, setInput] = useState(''), [messages, setMessages] = useState<Message[]>([]), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
    const controller = useRef<AbortController | null>(null), generation = useRef(0);
    const log = useRef<HTMLDivElement>(null);
    useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages.length, busy]);
    useEffect(() => { const clear = () => { generation.current++; controller.current?.abort(); cancelAIRequests(); setMessages([]); setBusy(false); }; window.addEventListener('familymind:clear-ai', clear); return () => { clear(); window.removeEventListener('familymind:clear-ai', clear); }; }, []);
    const facts = () => serverRequestSchema.shape.facts.parse(boundedFacts(w.mode === 'demo' ? [{ id: 'sample-profile', kind: 'profile', data: app.profile ?? {} }, { id: 'sample-plan', kind: 'plan', data: app.plan ?? {} }, { id: 'sample-calendar', kind: 'calendar', data: {events:app.schedule} }] : contextFor(w.records, true, w.actorId, w.members.filter(m=>m.status==='ACTIVE').map(m=>m.userId))));
    const management = () => ({ actorId:w.actorId, role:(w.mode==='demo'?'DEMO':w.family?.role??'MEMBER') as 'DEMO'|'OWNER'|'MEMBER'|'VIEWER'|'CHILD', today: (()=>{const d=householdDate(new Date(),w.family?.timezone);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;})(), timezone:w.family?.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone });
    const active = ai.selected === 'server' ? undefined : ai.connections[ai.selected];
    const connectionSignature = ai.selected === 'server' ? `${ai.server?.model}:${ai.server?.available}` : active ? `${active.provider}:${active.model}:${active.verifiedAt}` : '';
    const memberIds = () => app.profile?.members.map(member => member.id) ?? [];
    const policy = PROVIDER_POLICIES[ai.selected === 'server' ? 'gemini' : ai.selected];
    const connected = ai.selected === 'server' ? !!ai.server?.available : !!active;
    useEffect(() => {
        generation.current++; controller.current?.abort(); setBusy(false); setStatus('');
    }, [ai.selected, connectionSignature, language]);
    const perform = async (requestContext: AssistantRequest) => {
        let changed = true;
        try { changed = systemPrompt(facts(), language, management()) !== requestContext.system || canonical(memberIds()) !== canonical(requestContext.memberIds) || ai.selected !== requestContext.selection || (requestContext.selection === 'server' ? !ai.server?.available || ai.server.model !== requestContext.model : ai.connections[requestContext.selection]?.apiKey !== requestContext.connection?.apiKey); }
        catch { /* Do not send stale or invalid context. */ }
        if (changed) { setError('Your records or AI connection changed. Please send your question again.'); return; }
        const request = ++generation.current;
        setBusy(true); setError(''); controller.current = new AbortController();
        try {
            setStatus(t('Waiting for {provider}… Your planner remains available.', {provider: selectionName(requestContext.selection)}));
            const text = requestContext.selection === 'server'
              ? JSON.stringify(await serverAnswer({question:requestContext.question,language,facts:requestContext.facts,memberIds:requestContext.memberIds,management:requestContext.management}, controller.current.signal))
              : await providerAnswer(requestContext.connection!, requestContext.system, requestContext.question, controller.current.signal);
            if (request !== generation.current) return;
            let result: AssistantAnswer;
            try { result = parseAnswer(text, requestContext.memberIds, requestContext.recordIds); }
            catch { throw new Error('The assistant returned an invalid suggestion. Nothing was changed. Try again or choose another model.'); }
            setInput(current => current.trim() === requestContext.question ? '' : current);
            const source = t('Cloud AI · {provider}', {provider: selectionName(requestContext.selection)});
            setMessages(xs => [...xs, { id: uid('chat'), question: requestContext.question, result, source, snapshot:requestContext.snapshot }].slice(-20));
            if (w.mode === 'account' && w.family?.role !== 'VIEWER') await w.save('chat', crypto.randomUUID(), { question: requestContext.question, answer: result.answer, source: requestContext.selection, createdAt: new Date().toISOString() });
        } catch (e) {
            if (request === generation.current && (e as Error).name !== 'AbortError') setError((e as Error).message || 'The assistant could not produce a valid answer. Nothing was changed.');
        } finally { if (request === generation.current) { setBusy(false); setStatus(''); } }
    };
    const send = (raw: string) => {
        const question = raw.trim().slice(0, 1000);
        if (!question || busy)
            return;
        setInput(question);
        setError('');
        setStatus('');
        const exact = exactAnswer(question, app, w.records, app.today, language);
        if (exact) {
            setInput('');
            setMessages(xs => [...xs, { id: uid('answer'), question, result: { answer: exact, actions: [], sources: [] }, source: 'Built-in tools · recorded facts' }].slice(-20));
            return;
        }
        if (!ai.ready || !connected) {
            setError(ai.selected === 'server'
              ? t(ai.server === null ? 'Checking shared assistant…' : 'The shared Gemini assistant is unavailable. Check AI settings or try again later.')
              : t('Connect {provider} in AI settings first. Built-in assignment and availability questions still work without AI.', {provider: selectionName(ai.selected)}));
            return;
        }
        try {
        const records = facts();
        void perform({ question, snapshot:agentSnapshot(app,w), management:management(), system: systemPrompt(records, language, management()), selection:ai.selected, model:ai.selected === 'server' ? ai.server!.model : active!.model, connection: active ? {...active} : undefined, facts:records, memberIds:memberIds(), recordIds: records.map(r => r.id) });
        } catch { setError('This assistant context could not be prepared. Nothing was sent. Try reloading the sample.'); }
    };
    const apply = (m: Message) => { setError(''); const errors = app.addQuickActions(m.result.actions.map(a => ({ ...a, day: a.day as import('@/types').DayIndex, id: uid('action'), done: false, source: 'coach' as const }))); if (errors.length) {
        setError(errors.join(' '));
        return;
    } setMessages(xs => xs.map(x => x.id === m.id ? { ...x, added: true } : x)); };
    return <section id="assistant" tabIndex={-1} className="home-assistant" aria-labelledby="assistant-title">
      <div className="assistant-heading">
        <div className="assistant-identity"><span className="assistant-mark" aria-hidden="true"><Leaf size={22}/></span><div><span className="courtyard-eyebrow">{t("YOUR FAMILY ASSISTANT")}</span><h2 id="assistant-title">{t("What’s on your mind?")}</h2></div></div>
        <span className="assistant-privacy"><LockKeyhole size={12} aria-hidden/>{t("Your conversation, your choice")}</span>
      </div>
      <p className="assistant-intro">{t("Untangle a busy day. Share the load. Find a little time for each other.")}</p>
      {(messages.length > 0 || busy || error || status) && <div className="assistant-conversation" ref={log}>
        <div role="log" aria-label={t("Conversation")} aria-live="polite" aria-relevant="additions text">
          {messages.map(m => <article className="assistant-exchange" key={m.id}>
            <p className="assistant-question">{m.question}</p>
            <div className="assistant-answer"><span className="answer-sprout" aria-hidden><Leaf size={17}/></span><div className="stack stack-sm"><p style={{ whiteSpace: 'pre-line' }}>{m.result.answer}</p><span className="answer-source">{t(m.source)}</span>
              {!!m.result.operations?.length && <AgentProposal operations={m.result.operations} snapshot={m.snapshot??''}/>}
              {m.result.actions.length > 0 && <><h3>{t("Proposed actions — review before adding")}</h3>{m.result.actions.map((a, i) => <div className="card stack stack-sm" key={i}><label className="field">{t("Action")}<input className="input" value={a.title} onChange={e => setMessages(xs => xs.map(x => x.id !== m.id ? x : { ...x, result: { ...x.result, actions: x.result.actions.map((v, n) => n === i ? { ...v, title: e.target.value } : v) } }))}/></label><p>{t(DAY_NAMES[a.day])} · {a.minutes}{t(" minutes · ")}{a.participantIds.map(id => app.profile?.members.find(p => p.id === id)?.name).join(', ')}</p><p className="hint">{a.reason}</p></div>)}<button className="btn btn-primary" disabled={m.added} onClick={() => apply(m)}>{m.added ? t("Submitted — check Our week / requests") : t("Confirm these actions")}</button><p className="hint">{t("Other members must accept changes to their commitments. No calendar event is automatically moved.")}</p></>}
            </div></div>
          </article>)}
        </div>
        {busy && <div role="status" className="assistant-progress"><span className="assistant-working" aria-hidden/><span>{t(status)}</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => { generation.current++; controller.current?.abort(); cancelAIRequests(); setBusy(false); setStatus('Cancelled.'); }}>{t("Cancel")}</button></div>}
        {error && <p className="notice notice-safety" role="alert">{t(error)}</p>}
        {!busy && status && <p className="hint" role="status">{t(status)}</p>}
      </div>}
      <form className="assistant-composer" onSubmit={e => { e.preventDefault(); send(input); }}>
        <label className="sr-only" htmlFor="home-assistant-input">{t("Ask about your week")}</label>
        <textarea aria-describedby="assistant-policy" id="home-assistant-input" value={input} onChange={e => setInput(e.target.value)} placeholder={t("A busy week? Let’s work it out together…")} maxLength={1000} rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } }}/>
        <button className="assistant-send" disabled={!input.trim() || busy} aria-label={t("Ask the assistant")}><ArrowUp size={23} aria-hidden/></button>
      </form>
      <p id="assistant-policy" className="assistant-policy hint">{t('By sending a message to this assistant, you agree to ')}<a href={policy.termsUrl} target="_blank" rel="noopener noreferrer">{t('{provider} Terms of Service', {provider: policy.name})}</a>{t(' and ')}<a href={policy.privacyUrl} target="_blank" rel="noopener noreferrer">{t('Privacy Policy')}</a>{'. '}<span>{t(ai.selected === 'server' ? 'Your message and AI-enabled records go through FamilyMind’s backend to Google.' : ai.selected === 'openrouter' ? 'Your message and AI-enabled records go directly to OpenRouter and its model host.' : 'Your message and AI-enabled records go directly to your selected provider.')}</span></p>
      <details className="assistant-disclosure"><summary>{t('Manage your family from here')}</summary><p>{t('Ask me to add, move or remove calendar events; manage tasks, care reminders, keepsakes and study settings; invite people or manage family access; change your family, language or appearance preferences. I will show the changes before you confirm.')}</p><p>{t('For example: “Add a study session for me on Friday from 17:00 to 18:00” or “Invite alex@example.com as an adult member”. Existing items can be named exactly. If details are missing, I will ask.')}</p><p>{t('Only AI-approved records are sent as context. Private content is not shared just to manage it. Account deletion, passwords, provider keys and AI-sharing consent stay in their dedicated controls.')}</p></details>
      <div className="assistant-starters" aria-label={t("Suggested questions")}>{starters.map((text, i) => { const Icon = starterIcons[i]; return <button type="button" key={text} disabled={busy} onClick={() => send(t(text))}><span aria-hidden className="starter-icon" data-tone={i}><Icon size={16}/></span><span className="starter-label">{t(text)}</span><ArrowUpRight size={14} aria-hidden/></button>; })}</div>
      <div className="assistant-toolbar">
        <label className="assistant-mode"><span className="mode-dot" aria-hidden/><span className="sr-only">{t("Answer with")}</span><select value={ai.selected} onChange={e => ai.select(e.target.value as AISelection)} disabled={busy || !ai.ready}><option value="server">{t(SERVER_AI_NAME)}{t(ai.server?.available ? ' · available' : ' · unavailable')}</option>{providerIds.map(id => <option key={id} value={id}>{PROVIDERS[id].name}{ai.connections[id] ? t(" · connected") : t(" · connect")}</option>)}</select></label>
        <div className="assistant-toolbar-links">{messages.length > 0 && <button type="button" onClick={() => { generation.current++; controller.current?.abort(); cancelAIRequests(); setMessages([]); setBusy(false); setError(''); setStatus(''); }} aria-label={t("Clear conversation")}><RotateCcw size={13}/><span>{t("Clear")}</span></button>}<Link to="/settings#ai-settings"><SlidersHorizontal size={13}/><span>{connected ? t("AI settings") : t("Connect AI")}</span></Link></div>
      </div>
      <details className="assistant-disclosure"><summary><CircleHelp size={12} aria-hidden/>{t("How answers & privacy work")}</summary><p>{t("Exact questions use labelled built-in tools and recorded facts on your device. Shared Gemini sends approved context through FamilyMind’s backend to Google. Personal providers receive approved requests directly from your browser. No suggestion changes your plan without confirmation. This is not a medical service and never infers anyone’s feelings.")}</p></details>

    </section>;
}
