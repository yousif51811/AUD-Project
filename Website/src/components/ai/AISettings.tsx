import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, Cloud, KeyRound, LockKeyhole, Unplug } from 'lucide-react';
import { useWorkspace } from '@/workspace/Workspace';
import { useAIConnections } from './AIConnections';
import { PROVIDERS, providerIds, type ProviderId } from '@/lib/model/providers';
import { testConnection } from '@/lib/model/engine';

export function AISettings() {
  const w = useWorkspace(), ai = useAIConnections();
  const [provider, setProvider] = useState<ProviderId>(ai.selected);
  const [key, setKey] = useState(''), [model, setModel] = useState<string>(PROVIDERS[ai.selected].defaultModel);
  const [remember, setRemember] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null), operation = useRef(0);
  const info = PROVIDERS[provider], existing = ai.connections[provider];
  const legacy = w.records.filter(r => r.kind === 'cloud');
  useEffect(() => {
    if (ai.ready) { setProvider(ai.selected); setModel(ai.connections[ai.selected]?.model ?? PROVIDERS[ai.selected].defaultModel); setRemember(ai.connections[ai.selected]?.remember ?? false); }
  }, [ai.ready, ai.selected, ai.connections]);
  useEffect(() => {
    const clear = () => { operation.current++; controller.current?.abort(); setKey(''); setBusy(false); setMessage(''); setError(''); };
    window.addEventListener('familymind:clear-ai', clear);
    return () => { operation.current++; controller.current?.abort(); window.removeEventListener('familymind:clear-ai', clear); };
  }, []);
  const choose = (id: ProviderId) => {
    operation.current++; controller.current?.abort(); setBusy(false); setProvider(id); setKey('');
    setModel(ai.connections[id]?.model ?? PROVIDERS[id].defaultModel); setRemember(ai.connections[id]?.remember ?? false); setMessage(''); setError('');
  };
  const connect = async () => {
    const run = ++operation.current;
    controller.current?.abort(); controller.current = new AbortController(); setBusy(true); setMessage(''); setError('');
    try {
      const connection = { provider, apiKey: key.trim() || existing?.apiKey || '', model: model.trim() };
      await testConnection(connection, controller.current.signal);
      if (run !== operation.current) return;
      const stored = await ai.connect({ ...connection, verifiedAt: new Date().toISOString(), remember });
      if (run !== operation.current) return;
      setKey(''); setRemember(stored); setMessage(`${info.name} is connected. ${stored ? 'Remembered on this browser, encrypted behind your vault.' : 'The key stays in memory for this visit.'}`);
    } catch (e) { if (run === operation.current && (e as Error).name !== 'AbortError') setError((e as Error).message); }
    finally { if (run === operation.current) setBusy(false); }
  };
  return <section id="ai-settings" tabIndex={-1} className="daily-paper ai-settings stack" aria-labelledby="ai-settings-title">
    <header className="ai-settings-heading"><span className="ai-settings-icon" aria-hidden><Cloud size={24}/></span><div><span className="courtyard-eyebrow">A HELPING HAND, WITHOUT THE DOWNLOAD</span><h2 id="ai-settings-title">Connect your assistant.</h2><p>Choose a provider. Add your key. You’re ready to go.</p></div></header>
    <p className="ai-boundary"><LockKeyhole size={15} aria-hidden/> Requests go straight from your browser to your chosen provider. Keys never go to FamilyMind’s backend.</p>
    <div className="ai-provider-grid" role="group" aria-label="Choose an AI provider">{providerIds.map(id => <button type="button" key={id} className={`ai-provider${provider === id ? ' is-selected' : ''}`} aria-pressed={provider === id} onClick={() => choose(id)} disabled={!ai.ready || busy}>
      <span className="ai-provider-top"><strong>{PROVIDERS[id].name}</strong>{provider === id && <Check size={16} aria-hidden/>}</span><span>{PROVIDERS[id].short}</span><small>{ai.connections[id] ? 'Connected on this browser' : id === 'groq' ? 'Suggested starting point' : 'Bring your own key'}</small>
    </button>)}</div>
    <div className="ai-setup-layout"><div className="ai-setup-guide"><span className="paper-label">THREE SMALL STEPS</span><ol>{info.steps.map((step, i) => <li key={step}><span aria-hidden>{i + 1}</span>{step}</li>)}</ol><a className="btn btn-secondary" href={info.keyUrl} target="_blank" rel="noreferrer">Get a {info.name} key <ArrowUpRight size={15}/></a><p className="hint">{info.note} <a href={info.docsUrl} target="_blank" rel="noreferrer">Check current limits and terms ↗</a></p></div>
      <form className="ai-setup-form stack" onSubmit={e => { e.preventDefault(); void connect(); }}>
        <label className="field">{info.name} API key<input className="input" type="password" autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={4096} value={key} onChange={e => { setKey(e.target.value); setError(''); }} placeholder={existing ? 'Connected key is hidden · paste to replace' : 'Paste your key here'} disabled={busy}/></label>
        <p className="hint"><KeyRound size={12} aria-hidden/> {existing ? `Connected model: ${existing.model}.` : `We’ve selected ${info.modelLabel} for you.`} Each browser connects separately; keys are never shared with other members.</p>
        <details className="ai-advanced"><summary>Choose another model</summary><label className="field">Model ID<input className="input" value={model} onChange={e => setModel(e.target.value)} maxLength={120} disabled={busy}/></label><button type="button" className="family-text-link" onClick={() => setModel(info.defaultModel)} disabled={busy}>Use the suggested model</button></details>
        {w.mode === 'account' && w.identity && <label className="ai-remember"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} disabled={busy}/><span>Remember on this browser<small>Encrypted with your vault. Available again after unlocking. Never synced to our server.</small></span></label>}
        {w.mode === 'demo' && <p className="hint">Sample-family keys last only for this visit. They clear on reload, reset or perspective changes.</p>}
        <p className="hint">Testing sends a tiny synthetic message, with no family records. Provider pricing applies to tests and chat; use a free-tier account for a free demo. Other model IDs may use paid credits.</p>
        <div className="cluster"><button className="btn btn-primary" disabled={busy || !ai.ready || !(key.trim() || existing) || !model.trim()}>{busy ? 'Testing direct connection…' : 'Test & connect'} {!busy && <ArrowRight size={15}/>}</button>{busy && <button type="button" className="btn btn-ghost" onClick={() => { operation.current++; controller.current?.abort(); setBusy(false); setMessage('Connection test cancelled.'); }}>Cancel test</button>}
          {existing && !busy && <button type="button" className="btn btn-ghost" onClick={() => { void ai.disconnect(provider).then(() => { setKey(''); setRemember(false); setMessage(`${info.name} disconnected on this browser.`); }).catch(() => setError('Could not update this browser’s saved connection.')); }}><Unplug size={14}/>Disconnect</button>}</div>
        {existing && <p className="hint">Last connection test: {new Date(existing.verifiedAt).toLocaleString()}. <a href={info.usageUrl} target="_blank" rel="noreferrer">Provider usage ↗</a></p>}
      </form></div>
    {ai.notice && <p className="notice notice-safety" role="status">{ai.notice}</p>}{message && <div className="notice notice-ok stack stack-sm" role="status"><p>{message}</p><Link to="/dashboard#assistant" className="family-text-link">Go to your assistant <ArrowRight size={15}/></Link></div>}{error && <p className="notice notice-safety" role="alert">{error}</p>}
    <p className="hint">The provider can read what you approve. A free plan still has limits; there is no automatic switch to another provider or paid model. Disconnect removes the local connection; revoke the key in the provider console to invalidate it everywhere.</p>
    {legacy.length > 0 && <details><summary>Earlier shared AI settings</summary><p>An older encrypted family credential is no longer used. New connections stay only on this browser.</p>{w.family?.role === 'OWNER' && <button type="button" className="btn btn-secondary" onClick={() => { if (confirm('Remove the earlier encrypted shared credential? Reconnect on each browser instead.')) void Promise.all(legacy.map(r => w.remove(r.id))).catch(() => setError('The earlier credential could not be removed.')); }}>Remove earlier shared credential</button>}</details>}
    {w.mode === 'account' && <details><summary>Choose records the assistant may send</summary><p>Each record is excluded by default. Only its author may enable provider processing. Each request still needs your preview and approval.</p><div className="stack">{w.records.filter(r => r.authorId === w.actorId && !['cloud', 'chat', 'draft', 'import'].includes(r.kind)).map(r => <label key={r.id}><input type="checkbox" checked={r.cloudAllowed} onChange={e => void w.save(r.kind, r.id, r.data, { recipientIds: r.recipientIds, editorIds: r.editorIds, cloudAllowed: e.target.checked }).catch(() => setError('This record’s AI approval could not be saved.'))}/> {r.kind} · {String(r.data.title ?? r.data.name ?? r.id).slice(0, 70)}</label>)}</div></details>}
  </section>;
}
