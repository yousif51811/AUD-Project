import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Plus, Heart, CalendarDays, Coffee } from 'lucide-react';
import { useApp } from '@/state/store';
import { useToast } from '@/components/shared/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { DAY_NAMES, formatTime } from '@/lib/time';
import { EditDialog } from '@/components/plan/PlanTools';
export function Today() {
  useDocumentTitle('Today');
  const app=useApp();const {toast}=useToast();const [adding,setAdding]=useState(false);
  const tasks=(app.plan?.actions??[]).filter(a=>a.day===app.today);
  const events=app.schedule.filter(e=>e.day===app.today).sort((a,b)=>a.start.localeCompare(b.start));
  const done=tasks.filter(a=>a.done).length;const rec=app.result?.recommendations[0];
  return <div className="family-today">
    <header className="planner-heading"><div><p className="planner-date">{DAY_NAMES[app.today]}{app.profile?.isDemo?' · the sample family week':''}</p><h1 tabIndex={-1} data-page-heading>Today, at home.</h1><p>The things to do. The people to look after. A little space in between.</p></div><button type="button" className="btn btn-primary" onClick={()=>setAdding(true)}><Plus size={18}/>Add a small action</button></header>
    <div className="today-layout"><div className="today-left">
      <section className="daily-paper"><div className="paper-section-heading"><div><span className="paper-label">THE SHARED TO-DO LIST</span><h2>One thing at a time.</h2></div><span className="completion-counter">{done}<span> / {tasks.length} done</span></span></div>
        {tasks.length>0&&<div className="progress" role="progressbar" aria-label="Today's plan completion" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={done}><span style={{width:`${done/tasks.length*100}%`}}/></div>}
        <ul className="family-task-list">{tasks.map(a=><li key={a.id} className={a.done?'is-done':''}><label className="family-task-check"><input type="checkbox" checked={a.done} onChange={()=>app.toggleAction(a.id)} aria-label={`Mark complete: ${a.title}`}/><span><Check size={14}/></span></label><div><strong>{a.title}</strong><p>{a.minutes} min · {a.participantIds.map(id=>app.profile?.members.find(m=>m.id===id)?.name).filter(Boolean).join(', ')||'For the family'}</p></div></li>)}</ul>
        {!tasks.length&&<div className="paper-empty"><Coffee size={27}/><p>Nothing on the list today.</p><span>Add something small, or enjoy the breathing room.</span></div>}
        <Link to="/plan" className="family-text-link">Look at the whole week <ArrowRight size={16}/></Link>
      </section>
      <section className="daily-paper schedule-paper"><div className="paper-section-heading"><div><span className="paper-label">WHO’S WHERE, AND WHEN</span><h2>On the calendar.</h2></div><Link to="/schedule" className="family-text-link">Open calendar <ArrowRight size={15}/></Link></div>
        {events.length===0?<div className="paper-empty"><CalendarDays size={26}/><p>No events planned for today.</p><span>You can add appointments, study time or a family meal in Calendar.</span></div>:<ol className="family-agenda">{events.map(e=><li key={e.id}><time>{formatTime(e.start)}</time><span className={`agenda-dot category-${e.category.toLowerCase().replaceAll(' ','-')}`}/><div><strong>{e.title}</strong><p>{e.assigneeIds.map(id=>app.profile?.members.find(m=>m.id===id)?.name).filter(Boolean).join(', ')} · until {formatTime(e.end)}</p></div><span className="agenda-type">{e.category}</span></li>)}</ol>}
      </section>
    </div><aside className="today-notes">
      <section className="family-sticky peach-note"><span className="sticky-tape" aria-hidden/><span className="paper-label">A THOUGHT FOR THIS WEEK</span><h2>{rec?.title??'How is everyone doing?'}</h2><p>{rec?.action??'A short check-in can help you work out what needs a little attention.'}</p><Link to={rec?'/results':'/assessment'} className="family-text-link">{rec?'Why this might help':'Take a family check-in'} <ArrowRight size={16}/></Link></section>
      <section className="daily-paper care-paper"><div className="paper-section-heading"><h2><Heart size={18}/>A little care.</h2></div><p className="care-paper-hint">Recurring routines &amp; upcoming reminders</p>{!app.care.reminders.length?<p className="muted">No care routines yet.</p>:<ul>{app.care.reminders.slice(0,4).map(r=><li key={r.id}><span>{formatTime(r.time)}</span><Link to="/care">{r.title}</Link>{r.status==='confirmed'&&<Check size={15} aria-label="Confirmed"/>}</li>)}</ul>}<Link to="/care" className="family-text-link">All care routines <ArrowRight size={15}/></Link><small>Reminders are a local demonstration, not background alerts.</small></section>
      <section className="weekly-note"><span className="paper-label">THE BIGGER PICTURE</span>{app.result?<><div className="weekly-number"><strong>{app.result.score}</strong><span>/ 100<br/>weekly check-in</span></div><p>{app.result.status}. A starting point for a conversation, not a judgment about your family.</p><Link to="/results" className="family-text-link">Understand the check-in <ArrowRight size={15}/></Link></>:<><h2>A moment to check in?</h2><p>Eight questions about how this week feels.</p><Link to="/assessment" className="family-text-link">Start here <ArrowRight size={15}/></Link></>}</section>
    </aside></div>
    {adding&&<EditDialog target="new" onClose={()=>setAdding(false)} onDelete={()=>{}} onSave={a=>{const errors=app.addQuickAction(a);if(errors.length){toast(errors.join(' '),'warn');return;}setAdding(false);toast('Added to your family plan.');}}/>}
  </div>;
}
