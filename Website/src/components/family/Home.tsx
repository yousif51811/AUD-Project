import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Check, Plus, Heart, Coffee, BookOpen, MessageCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useWorkspace } from '@/workspace/Workspace';
export function Home() {
  useDocumentTitle('A place for the everyday');
  const [checked,setChecked]=useState(false);
  const workspace=useWorkspace();
  if(workspace.mode==='account'&&workspace.user&&workspace.identity&&workspace.family) return <Navigate to="/dashboard" replace/>;
  return <>
    <section className="home-hero">
      <div className="home-hero-copy"><p className="home-label"><span/>For the beautifully busy business of family.</p><h1 tabIndex={-1}>All the little things.<br/>One place<br/><em>to come together.</em></h1><p>School runs. Study breaks. Checking in on grandma. FamilyMind helps you share the load and find a little time for each other.</p><div className="home-actions"><Link to="/sign-up" className="btn btn-primary btn-lg">Set up your family <ArrowRight size={18}/></Link><Link to="/demo" className="home-demo-link">Or meet our sample family <ArrowRight size={16}/></Link></div><span className="home-fineprint">Explore the fictional family without an account.</span></div>
      <div className="home-noticeboard" aria-label="An example of a shared family week">
        <div className="board-tape" aria-hidden/>
        <div className="board-caption"><span>A SAMPLE FAMILY WEEK</span><span>one week at a time</span></div>
        <div className="paper-calendar"><div className="paper-calendar-head"><h2>A week for all of us.</h2><span>MON — SUN</span></div><div className="paper-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>{Array.from({length:7},(_,i)=><div key={i} className={i===2?'paper-day important':'paper-day'}><span>{i+1}</span>{i===0&&<span className="calendar-stroke green">Family dinner</span>}{i===2&&<span className="calendar-stroke peach">Study time</span>}{i===4&&<span className="calendar-stroke blue">A walk, together</span>}{i===6&&<Heart size={20}/>}</div>)}</div><p><span className="ink-dot"/>Leave some space for the unplanned bits.</p></div>
        <div className="board-note"><span className="note-pin"/><p>One less thing<br/>on your plate.</p><button type="button" className={`paper-task${checked?' done':''}`} onClick={()=>setChecked(v=>!v)} aria-pressed={checked}><span><Check size={13}/></span><span>Share the grocery list</span></button><small>{checked?'A little win. Nice one.':'Go on, tick it off.'}</small></div>
        <div className="board-postcard"><span className="postcard-flower" aria-hidden>✳</span><p>Call grandma.<br/><em>Ask about her day.</em></p><span>18:30 · a little connection</span></div>
        <div className="board-scribble" aria-hidden><svg viewBox="0 0 140 75"><path d="M4 5c15 60 68 51 118 28m-12-8 17 5-8 18"/></svg><span>the things that matter</span></div>
      </div>
    </section>
    <div className="home-strip"><span>A shared plan, with room for real life.</span><span>Made for every generation.</span><span>Suggestions. Always your decision.</span></div>
    <section className="home-tools"><div className="home-section-heading"><p className="home-label">A FEW WAYS TO MAKE THE WEEK EASIER</p><h2>You don't have to<br/><em>keep it all in your head.</em></h2><p>Start wherever your family needs a little help. The rest can wait.</p></div><div className="home-tool-grid">
      <Link to="/plan" className="home-tool tool-green"><span className="tool-sketch"><Check size={32}/></span><span className="home-tool-kicker">THE SHARED PLAN</span><h3>A little less<br/>“who’s doing what?”</h3><p>Small actions, shared responsibilities, and a week you can actually manage.</p><span className="tool-link">See the family plan <ArrowRight size={18}/></span></Link>
      <Link to="/assessment" className="home-tool tool-peach"><span className="tool-sketch"><Coffee size={32}/></span><span className="home-tool-kicker">THE CHECK-IN</span><h3>How is everyone<br/>really doing?</h3><p>Eight questions to notice the pressure points and find a good place to start.</p><span className="tool-link">Take a moment <ArrowRight size={18}/></span></Link>
      <Link to="/memories" className="home-tool tool-lilac"><span className="tool-sketch"><BookOpen size={32}/></span><span className="home-tool-kicker">THE KEEPSAKES</span><h3>Keep the small,<br/>good things.</h3><p>A story, a thank-you, a little win. Make a place for the things worth remembering.</p><span className="tool-link">Open the keepsakes <ArrowRight size={18}/></span></Link>
    </div></section>
    <section className="home-about"><div><span className="handwritten">a helping hand, not another thing to manage</span><h2>Your family knows best.<br/>We just help you<br/><em>join the dots.</em></h2></div><div><MessageCircle size={30}/><p>FamilyMind connects your check-in answers with practical ideas for the week. You can see why each idea was suggested, change it, or leave it.</p><p>It’s a student-built prototype combining explainable planning with optional AI connected from your browser. No hidden monitoring, and every suggested change remains your decision.</p><Link to="/trust" className="home-demo-link">Get to know the project <ArrowRight size={16}/></Link></div></section>
    <section className="home-end"><Plus size={30}/><h2>Start with one small thing.</h2><p>A shared meal. A lighter afternoon. A phone call you've been meaning to make.</p><Link className="btn btn-primary btn-lg" to="/sign-up">Start your family plan <ArrowRight size={18}/></Link></section>
  </>;
}
