import { t, useLanguage, languageStore } from '@/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, Cloud, KeyRound, LockKeyhole, Unplug } from 'lucide-react';
import { useWorkspace } from '@/workspace/Workspace';
import { useAIConnections } from './AIConnections';
import { PROVIDERS, providerIds, type ProviderId } from '@/lib/model/providers';
import { testConnection } from '@/lib/model/engine';

export function AISettings() {
  useLanguage();
  const w = useWorkspace(), ai = useAIConnections();
  const [provider, setProvider] = useState<ProviderId>(ai.selected === 'server' ? 'gemini' : ai.selected);
  const [key, setKey] = useState(''), [model, setModel] = useState<string>(PROVIDERS[ai.selected === 'server' ? 'gemini' : ai.selected].defaultModel);
  const [remember, setRemember] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null), operation = useRef(0);
  const info = PROVIDERS[provider], existing = ai.connections[provider];
  const legacy = w.records.filter(r => r.kind === 'cloud');
  useEffect(() => {
    if (ai.ready && ai.selected !== 'server') { setProvider(ai.selected); setModel(ai.connections[ai.selected]?.model ?? PROVIDERS[ai.selected].defaultModel); setRemember(ai.connections[ai.selected]?.remember ?? false); }
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
      setKey(''); setRemember(stored); setMessage(t('{provider} is connected. {storage}', { provider: info.name, storage: t(stored ? 'Remembered on this browser, encrypted behind your vault.' : 'The key stays in memory for this visit.') }));
    } catch (e) { if (run === operation.current && (e as Error).name !== 'AbortError') setError((e as Error).message); }
    finally { if (run === operation.current) setBusy(false); }
  };
  return <section id="ai-settings" tabIndex={-1} className="daily-paper ai-settings stack" aria-labelledby="ai-settings-title">
    <header className="ai-settings-heading"><span className="ai-settings-icon" aria-hidden><Cloud size={24}/></span><div><span className="courtyard-eyebrow">{t("A HELPING HAND, WITHOUT THE DOWNLOAD")}</span><h2 id="ai-settings-title">{t("Connect your assistant.")}</h2><p>{t("Use shared Gemini, or connect a personal provider.")}</p></div></header>
    <p className="ai-boundary"><LockKeyhole size={15} aria-hidden/>{t("Shared Gemini sends approved context through FamilyMind’s backend to Google. Personal providers connect directly from your browser; personal keys stay on this browser.")}</p>
    <section className="card stack" aria-labelledby="server-ai-title"><h3 id="server-ai-title">{t('Server-side · Gemini')}</h3><p>{t('The default shared assistant. No personal API key is needed.')}</p><p className="hint" role="status">{ai.server === null ? t('Checking shared assistant…') : ai.server.available ? t('Configured on this site. Shared request limits apply.') : t('Shared Gemini is not configured or could not be reached. Ask the presenter to check the server settings.')}</p><p className="hint">{t('Model: ')}<span dir="ltr">{ai.server?.model ?? 'gemini-3.5-flash-lite'}</span></p><div className="cluster"><button type="button" className="btn btn-primary" disabled={!ai.ready || busy || !ai.server?.available} aria-pressed={ai.selected === 'server'} onClick={() => ai.select('server')}>{ai.selected === 'server' ? t('Shared assistant selected') : t('Use shared assistant')}</button><button type="button" className="btn btn-secondary" onClick={ai.refreshServer}>{t('Check availability')}</button></div><p className="hint">{t('Only the question and context you approve are sent. Google can read them. No request is sent just by opening this page.')}</p></section>
    <h3>{t('Personal providers')}</h3>
    <div className="ai-provider-grid" role="group" aria-label={t("Choose an AI provider")}>{providerIds.map(id => <button type="button" key={id} className={`ai-provider${provider === id ? ' is-selected' : ''}`} aria-pressed={provider === id} onClick={() => choose(id)} disabled={!ai.ready || busy}>
      <span className="ai-provider-top"><strong>{PROVIDERS[id].name}</strong>{provider === id && <Check size={16} aria-hidden/>}</span><span>{t(PROVIDERS[id].short)}</span><small>{ai.connections[id] ? t("Connected on this browser") : id === 'groq' ? t("Suggested starting point") : t("Bring your own key")}</small>
    </button>)}</div>
    <div className="ai-setup-layout"><div className="ai-setup-guide"><span className="paper-label">{t("THREE SMALL STEPS")}</span><ol>{info.steps.map((step, i) => <li key={step}><span aria-hidden>{i + 1}</span>{t(step)}</li>)}</ol><a className="btn btn-secondary" href={info.keyUrl} target="_blank" rel="noreferrer">{t("Get a ")}{info.name}{t(" key ")}<ArrowUpRight size={15}/></a><p className="hint">{t(info.note)} <a href={info.docsUrl} target="_blank" rel="noreferrer">{t("Check current limits and terms ↗")}</a></p></div>
      <form className="ai-setup-form stack" onSubmit={e => { e.preventDefault(); void connect(); }}>
        <label className="field">{info.name}{t(" API key")}<input className="input" dir="ltr" type="password" autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={4096} value={key} onChange={e => { setKey(e.target.value); setError(''); }} placeholder={existing ? t("Connected key is hidden · paste to replace") : t("Paste your key here")} disabled={busy}/></label>
        <p className="hint"><KeyRound size={12} aria-hidden/> {existing ? t('Connected model: {model}.', { model: existing.model }) : t('We’ve selected {model} for you.', { model: info.modelLabel })}{t(" Each browser connects separately; keys are never shared with other members.")}</p>
        <details className="ai-advanced"><summary>{t("Choose another model")}</summary><label className="field">{t("Model ID")}<input className="input" dir="ltr" value={model} onChange={e => setModel(e.target.value)} maxLength={120} disabled={busy}/></label><button type="button" className="family-text-link" onClick={() => setModel(info.defaultModel)} disabled={busy}>{t("Use the suggested model")}</button></details>
        {w.mode === 'account' && w.identity && <label className="ai-remember"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} disabled={busy}/><span>{t("Remember on this browser")}<small>{t("Encrypted with your vault. Available again after unlocking. Never synced to our server.")}</small></span></label>}
        {w.mode === 'demo' && <p className="hint">{t("Sample-family keys last only for this visit. They clear on reload, reset or perspective changes.")}</p>}
        <p className="hint">{t("Testing sends a tiny synthetic message, with no family records. Provider pricing applies to tests and chat; use a free-tier account for a free demo. Other model IDs may use paid credits.")}</p>
        <div className="cluster"><button className="btn btn-primary" disabled={busy || !ai.ready || !(key.trim() || existing) || !model.trim()}>{busy ? t("Testing direct connection…") : t("Test & connect")} {!busy && <ArrowRight size={15}/>}</button>{busy && <button type="button" className="btn btn-ghost" onClick={() => { operation.current++; controller.current?.abort(); setBusy(false); setMessage('Connection test cancelled.'); }}>{t("Cancel test")}</button>}
          {existing && !busy && <button type="button" className="btn btn-ghost" onClick={() => { void ai.disconnect(provider).then(() => { setKey(''); setRemember(false); setMessage(t('{provider} disconnected on this browser.', {provider: info.name})); }).catch(() => setError('Could not update this browser’s saved connection.')); }}><Unplug size={14}/>{t("Disconnect")}</button>}</div>
        {existing && <p className="hint">{t("Last connection test: ")}{new Date(existing.verifiedAt).toLocaleString(languageStore.getSnapshot() === 'ar' ? 'ar-AE' : 'en-GB')}. <a href={info.usageUrl} target="_blank" rel="noreferrer">{t("Provider usage ↗")}</a></p>}
      </form></div>
    {ai.notice && <p className="notice notice-safety" role="status">{ai.notice}</p>}{message && <div className="notice notice-ok stack stack-sm" role="status"><p>{t(message)}</p><Link to="/dashboard#assistant" className="family-text-link">{t("Go to your assistant ")}<ArrowRight size={15}/></Link></div>}{error && <p className="notice notice-safety" role="alert">{t(error)}</p>}
    <p className="hint">{t("The provider can read what you approve. A free plan still has limits; there is no automatic switch to another provider or paid model. Disconnect removes the local connection; revoke the key in the provider console to invalidate it everywhere.")}</p>
    {legacy.length > 0 && <details><summary>{t("Earlier shared AI settings")}</summary><p>{t("An older encrypted family credential is no longer used. New connections stay only on this browser.")}</p>{w.family?.role === 'OWNER' && <button type="button" className="btn btn-secondary" onClick={() => { if (confirm('Remove the earlier encrypted shared credential? Reconnect on each browser instead.')) void Promise.all(legacy.map(r => w.remove(r.id))).catch(() => setError('The earlier credential could not be removed.')); }}>{t("Remove earlier shared credential")}</button>}</details>}
    {w.mode === 'account' && <details><summary>{t("Choose records the assistant may send")}</summary><p>{t("Each record is excluded by default. Only its author may enable provider processing. Each request still needs your preview and approval.")}</p><div className="stack">{w.records.filter(r => r.authorId === w.actorId && !['cloud', 'chat', 'draft', 'import'].includes(r.kind)).map(r => <label key={r.id}><input type="checkbox" checked={r.cloudAllowed} onChange={e => void w.save(r.kind, r.id, r.data, { recipientIds: r.recipientIds, editorIds: r.editorIds, cloudAllowed: e.target.checked }).catch(() => setError('This record’s AI approval could not be saved.'))}/> {r.kind} · {String(r.data.title ?? r.data.name ?? r.id).slice(0, 70)}</label>)}</div></details>}
  </section>;
}
