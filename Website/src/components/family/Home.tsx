import { t, useLanguage } from '@/i18n';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Check, Plus, Heart, Coffee, BookOpen, MessageCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useWorkspace } from '@/workspace/Workspace';
import { AuthLink } from './AuthDialog';
export function Home() {
  useLanguage();
  useDocumentTitle('A place for the everyday');
  const [checked,setChecked]=useState(false);
  const workspace=useWorkspace();
  if(workspace.mode==='account'&&workspace.user&&workspace.identity&&workspace.family) return <Navigate to="/dashboard" replace/>;
  return <>
    <section className="home-hero">
      <div className="home-hero-copy"><p className="home-label"><span/>{t("A little room for what matters.")}</p><h1 tabIndex={-1}>{t("Family life.")}<br/>{t("A little lighter.")}<br/><em>{t("A lot more together.")}</em></h1><p>{t("School runs. Study breaks. Checking in on grandma. Share the everyday load, and make room for each other.")}</p><div className="home-actions"><AuthLink to="/sign-up" className="btn btn-primary btn-lg">{t("Set up your family ")}<ArrowRight size={18}/></AuthLink><Link to="/demo" className="home-demo-link">{t("Meet our sample family ")}<ArrowRight size={16}/></Link></div><span className="home-fineprint">{t("Your people. Your pace. One shared space.")}</span></div>
      <div className="home-noticeboard" aria-label={t("An example of a shared family week")}>
        <div className="board-tape" aria-hidden/>
        <div className="board-caption"><span>{t("A SAMPLE FAMILY WEEK")}</span><span>{t("one week at a time")}</span></div>
        <div className="paper-calendar"><div className="paper-calendar-head"><h2>{t("A week for all of us.")}</h2><span>{t("MON — SUN")}</span></div><div className="paper-days"><span>{t("Mon")}</span><span>{t("Tue")}</span><span>{t("Wed")}</span><span>{t("Thu")}</span><span>{t("Fri")}</span><span>{t("Sat")}</span><span>{t("Sun")}</span>{Array.from({length:7},(_,i)=><div key={i} className={i===2?'paper-day important':'paper-day'}><span>{i+1}</span>{i===0&&<span className="calendar-stroke green">{t("Family dinner")}</span>}{i===2&&<span className="calendar-stroke peach">{t("Study time")}</span>}{i===4&&<span className="calendar-stroke blue">{t("A walk, together")}</span>}{i===6&&<Heart size={20}/>}</div>)}</div><p><span className="ink-dot"/>{t("Leave some space for the unplanned bits.")}</p></div>
        <div className="board-note"><span className="note-pin"/><p>{t("One less thing")}<br/>{t("on your plate.")}</p><button type="button" className={`paper-task${checked?' done':''}`} onClick={()=>setChecked(v=>!v)} aria-pressed={checked}><span><Check size={13}/></span><span>{t("Share the grocery list")}</span></button><small>{checked?t("A little win. Nice one."):t("Go on, tick it off.")}</small></div>
        <div className="board-postcard"><span className="postcard-flower" aria-hidden>✳</span><p>{t("Call grandma.")}<br/><em>{t("Ask about her day.")}</em></p><span>{t("18:30 · a little connection")}</span></div>
        <div className="board-scribble" aria-hidden><svg viewBox="0 0 140 75"><path d="M4 5c15 60 68 51 118 28m-12-8 17 5-8 18"/></svg><span>{t("the things that matter")}</span></div>
      </div>
    </section>
    <div className="home-strip"><span>{t("A shared plan, with room for real life.")}</span><span>{t("Made for every generation.")}</span><span>{t("Suggestions. Always your decision.")}</span></div>
    <section className="home-tools"><div className="home-section-heading"><p className="home-label">{t("A FEW WAYS TO MAKE THE WEEK EASIER")}</p><h2>{t("You don't have to")}<br/><em>{t("keep it all in your head.")}</em></h2><p>{t("Start wherever your family needs a little help. The rest can wait.")}</p></div><div className="home-tool-grid">
      <Link to="/plan" className="home-tool tool-green"><span className="tool-sketch"><Check size={32}/></span><span className="home-tool-kicker">{t("THE SHARED PLAN")}</span><h3>{t("A little less")}<br/>{t("“who’s doing what?”")}</h3><p>{t("Small actions, shared responsibilities, and a week you can actually manage.")}</p><span className="tool-link">{t("See the family plan ")}<ArrowRight size={18}/></span></Link>
      <Link to="/assessment" className="home-tool tool-peach"><span className="tool-sketch"><Coffee size={32}/></span><span className="home-tool-kicker">{t("THE CHECK-IN")}</span><h3>{t("How is everyone")}<br/>{t("really doing?")}</h3><p>{t("Eight questions to notice the pressure points and find a good place to start.")}</p><span className="tool-link">{t("Take a moment ")}<ArrowRight size={18}/></span></Link>
      <Link to="/memories" className="home-tool tool-lilac"><span className="tool-sketch"><BookOpen size={32}/></span><span className="home-tool-kicker">{t("THE KEEPSAKES")}</span><h3>{t("Keep the small,")}<br/>{t("good things.")}</h3><p>{t("A story, a thank-you, a little win. Make a place for the things worth remembering.")}</p><span className="tool-link">{t("Open the keepsakes ")}<ArrowRight size={18}/></span></Link>
    </div></section>
    <section className="home-about"><div><span className="handwritten">{t("a helping hand, not another thing to manage")}</span><h2>{t("Your family knows best.")}<br/>{t("We just help you")}<br/><em>{t("join the dots.")}</em></h2></div><div><MessageCircle size={30}/><p>{t("FamilyMind connects your check-in answers with practical ideas for the week. You can see why each idea was suggested, change it, or leave it.")}</p><p>{t("It’s a student-built prototype combining explainable planning with optional shared Gemini or a personal AI provider. No hidden monitoring, and every suggested change remains your decision.")}</p><Link to="/about" className="home-demo-link">{t("Get to know the project ")}<ArrowRight size={16}/></Link></div></section>
    <section className="home-end"><Plus size={30}/><h2>{t("Start with one small thing.")}</h2><p>{t("A shared meal. A lighter afternoon. A phone call you've been meaning to make.")}</p><AuthLink className="btn btn-primary btn-lg" to="/sign-up">{t("Start your family plan ")}<ArrowRight size={18}/></AuthLink></section>
  </>;
}
