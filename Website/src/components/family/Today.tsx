import { t, useLanguage } from '@/i18n';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Plus, Heart, CalendarDays, Coffee, ArrowUpRight, Sprout } from 'lucide-react';
import { useApp } from '@/state/store';
import { useToast } from '@/components/shared/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { DAY_NAMES, formatTime, greeting } from '@/lib/time';
import { useWorkspace } from '@/workspace/Workspace';
import { FamilyAssistant } from '@/components/ai/FamilyAssistant';
import { CourtyardDrawing, GardenMotionControl } from './LivingGarden';
import { EditDialog } from '@/components/plan/PlanTools';
export function Today() {
  useLanguage();
  useDocumentTitle('At home');
  const workspace=useWorkspace();
  const app=useApp();const {toast}=useToast();const [adding,setAdding]=useState(false);
  const tasks=(app.plan?.actions??[]).filter(a=>a.day===app.today);
  const events=app.schedule.filter(e=>e.day===app.today).sort((a,b)=>a.start.localeCompare(b.start));
  const done=tasks.filter(a=>a.done).length;const rec=app.result?.recommendations[0];
  const firstName=(app.profile?.members.find(m=>m.id===workspace.actorId)?.name??workspace.user?.name??'').split(' ')[0];
  return <div className="family-today courtyard-home">
    <header className="courtyard-welcome">
      <div className="courtyard-welcome-copy"><p className="courtyard-eyebrow"><span className="welcome-dot"/> {t(greeting(!!app.profile?.isDemo))}{firstName?`, ${firstName}`:''}{t(". Make yourself at home.")}</p><h1 tabIndex={-1} data-page-heading>{t("A little more ")}<em>{t("together.")}</em></h1><p>{t("For the beautifully busy business of being a family.")}<br className="desktop-break"/>{t(" A shared plan. A helping hand. Room to breathe.")}</p><div className="courtyard-day-label"><CalendarDays size={14} aria-hidden/><span>{t(DAY_NAMES[app.today])}{app.profile?.isDemo?t(" · your sample family week"):''}</span><span className="courtyard-day-divider"/><Link to="/check-ins">{t("How are you doing? ")}<ArrowUpRight size={13}/></Link></div></div>
      <div className="courtyard-welcome-art"><CourtyardDrawing/><GardenMotionControl/></div>
    </header>
    {workspace.mode === 'account' && workspace.family?.role === 'OWNER' && <div className="cluster"><Link className="btn btn-secondary" to="/family#invite-family">{t('Invite family')}{workspace.members.some(m => m.status === 'PENDING') ? ' · ' + t('Waiting for your confirmation') : ''}</Link></div>}
    <FamilyAssistant/>
    <section className="day-overview" aria-labelledby="day-overview-title"><div><span className="courtyard-eyebrow">{t("THE EVERYDAY, A LITTLE LIGHTER")}</span><h2 id="day-overview-title">{t("The shape of your day")}<span>.</span></h2></div><button type="button" className="btn btn-secondary" onClick={()=>setAdding(true)}><Plus size={16}/>{t("Add a small action")}</button></section>
    <div className="day-pulse"><span><span className="pulse-mark"><Check size={14}/></span><strong>{done}{t(" of ")}{tasks.length}</strong>{t(" small actions done")}</span><span><CalendarDays size={15}/><strong>{events.length}</strong>{t(" calendar ")}{events.length===1?t("commitment"):t("commitments")}</span><Link to="/plan">{t("Make room in the week ")}<ArrowRight size={15}/></Link></div>
    <div className="today-layout"><div className="today-left">
      <section className="daily-paper"><div className="paper-section-heading"><div><span className="paper-label">{t("THE SHARED TO-DO LIST")}</span><h2>{t("One thing at a time.")}</h2></div><span className="completion-counter">{done}<span> / {tasks.length}{t(" done")}</span></span></div>
        {tasks.length>0&&<div className="progress" role="progressbar" aria-label={t("Today's plan completion")} aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={done}><span style={{width:`${done/tasks.length*100}%`}}/></div>}
        <ul className="family-task-list">{tasks.map(a=><li key={a.id} className={a.done?'is-done':''}><label className="family-task-check"><input type="checkbox" checked={a.done} onChange={()=>app.toggleAction(a.id)} aria-label={t('Mark complete: {title}', { title: a.title })}/><span><Check size={14}/></span></label><div><strong>{a.title}</strong><p>{a.minutes}{t(" min · ")}{a.participantIds.map(id=>app.profile?.members.find(m=>m.id===id)?.name).filter(Boolean).join(', ')||'For the family'}</p></div></li>)}</ul>
        {!tasks.length&&<div className="paper-empty"><Coffee size={27}/><p>{t("Nothing on the list today.")}</p><span>{t("Add something small, or enjoy the breathing room.")}</span></div>}
        <Link to="/plan" className="family-text-link">{t("Look at the whole week ")}<ArrowRight size={16}/></Link>
      </section>
      <section className="daily-paper schedule-paper"><div className="paper-section-heading"><div><span className="paper-label">{t("WHO’S WHERE, AND WHEN")}</span><h2>{t("On the calendar.")}</h2></div><Link to="/schedule" className="family-text-link">{t("Open calendar ")}<ArrowRight size={15}/></Link></div>
        {events.length===0?<div className="paper-empty"><CalendarDays size={26}/><p>{t("No events planned for today.")}</p><span>{t("You can add appointments, study time or a family meal in Calendar.")}</span></div>:<ol className="family-agenda">{events.map(e=><li key={e.id}><time>{formatTime(e.start)}</time><span className={`agenda-dot category-${e.category.toLowerCase().replaceAll(' ','-')}`}/><div><strong>{e.title}</strong><p>{e.assigneeIds.map(id=>app.profile?.members.find(m=>m.id===id)?.name).filter(Boolean).join(', ')}{t(" · until ")}{formatTime(e.end)}</p></div><span className="agenda-type">{t(e.category)}</span></li>)}</ol>}
      </section>
    </div><aside className="today-notes">
      <section className="family-sticky peach-note courtyard-thought"><Sprout size={26} className="thought-sprout" aria-hidden/><span className="paper-label">{t("A THOUGHT FOR THIS WEEK")}</span><h2>{rec?.title??'How is everyone doing?'}</h2><p>{rec?.action??'A short check-in can help you work out what needs a little attention.'}</p><Link to={rec?'/results':'/assessment'} className="family-text-link">{rec?t("Why this might help"):t("Take a family check-in")} <ArrowRight size={16}/></Link></section>
      <section className="daily-paper care-paper"><div className="paper-section-heading"><h2><Heart size={18}/>{t("A little care.")}</h2></div><p className="care-paper-hint">{t("Recurring routines & upcoming reminders")}</p>{!app.care.reminders.length?<p className="muted">{t("No care routines yet.")}</p>:<ul>{app.care.reminders.slice(0,4).map(r=><li key={r.id}><span>{formatTime(r.time)}</span><Link to="/care">{r.title}</Link>{r.status==='confirmed'&&<Check size={15} aria-label={t("Confirmed")}/>}</li>)}</ul>}<Link to="/care" className="family-text-link">{t("All care routines ")}<ArrowRight size={15}/></Link><small>{t("Reminders appear while FamilyMind is open.")}</small></section>
      <section className="weekly-note"><span className="paper-label">{t("THE BIGGER PICTURE")}</span>{app.result?<><div className="weekly-number"><strong>{app.result.score}</strong><span>/ 100<br/>{t("weekly check-in")}</span></div><p>{app.result.status}{t(". A starting point for a conversation, not a judgment about your family.")}</p><Link to="/results" className="family-text-link">{t("Understand the check-in ")}<ArrowRight size={15}/></Link></>:<><h2>{t("A moment to check in?")}</h2><p>{t("Eight questions about how this week feels.")}</p><Link to="/assessment" className="family-text-link">{t("Start here ")}<ArrowRight size={15}/></Link></>}</section>
    </aside></div>
    {adding&&<EditDialog target="new" onClose={()=>setAdding(false)} onDelete={()=>{}} onSave={a=>{const errors=app.addQuickAction(a);if(errors.length){toast(errors.join(' '),'warn');return;}setAdding(false);toast('Added to your family plan.');}}/>}
  </div>;
}
