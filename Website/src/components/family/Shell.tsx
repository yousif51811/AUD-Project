import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, CalendarDays, House, ListChecks, Menu, MessageCircle, HeartHandshake, BookOpen, GraduationCap, Users, ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { useApp } from '@/state/store';
import { AppearanceControl, SystemAppearanceControl } from './AppearanceControl';
import { AvatarStack } from '@/components/shared/Common';

const PAGES = [
  { to:'/dashboard', label:'Today', icon:House },
  { to:'/plan', label:'Our week', icon:ListChecks },
  { to:'/schedule', label:'Calendar', icon:CalendarDays },
];
const MORE = [
  {to:'/assessment',label:'Family check-in',text:'Take a moment to see how things are going.',icon:Users},
  {to:'/results',label:'Our check-in results',text:'Understand the week, then choose a next step.',icon:ListChecks},
  {to:'/coach',label:'Talk it through',text:'Practical ideas for the things on your mind.',icon:MessageCircle},
  {to:'/student',label:'Study & rest',text:'Make room for school, sleep and a breather.',icon:GraduationCap},
  {to:'/care',label:'Care routines',text:'The little reminders that help us look after each other.',icon:HeartHandshake},
  {to:'/memories',label:'Family keepsakes',text:'A place for stories, thank-yous and small wins.',icon:BookOpen},
  {to:'/onboarding',label:'Household settings',text:'People, preferences and shared time.',icon:Users},
  {to:'/trust',label:'About your data',text:'How this prototype works, and its limits.',icon:ShieldCheck},
];
export function Brand() {
  return <Link className="family-brand" to="/" aria-label="FamilyMind home"><span className="brand-drawing" aria-hidden><svg viewBox="0 0 40 42"><path d="M5 19 20 6l15 13v18H6V19M16 37V25h9v12"/><path d="M4 19 20 5l16 14M29 9V4h5v10"/><path d="M10 17c3 0 5-2 6-5"/></svg></span><span>familymind<span className="brand-period">.</span></span></Link>;
}
export function FamilyShell({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  const { profile, storageOk } = useApp();
  const [menu,setMenu] = useState(false);
  useEffect(() => {
    setMenu(false);
    window.scrollTo({top:0,behavior:'instant'});
    const frame=requestAnimationFrame(()=>document.querySelector<HTMLElement>('h1')?.focus({preventScroll:true}));
    return ()=>cancelAnimationFrame(frame);
  },[pathname]);
  const home=pathname === '/';
  return <div className={`family-site${home ? ' is-home' : ''}`} data-page={pathname.slice(1)||'home'}>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="family-header"><div className="family-header-inner"><Brand />
      <nav className="family-nav" aria-label="Main navigation">{PAGES.map(({to,label})=><NavLink key={to} to={to}>{label}</NavLink>)}<button type="button" aria-expanded={menu} aria-haspopup="dialog" onClick={()=>setMenu(true)}>Family &amp; more <Menu size={16} aria-hidden /></button></nav>
      <Link className="header-demo" to="/demo">Try the sample family <ArrowRight size={15} aria-hidden /></Link>
      <AppearanceControl />
      <button className="family-mobile-menu" type="button" onClick={()=>setMenu(true)} aria-label="Open menu" aria-expanded={menu} aria-haspopup="dialog"><Menu size={22}/></button>
    </div></header>
    {!home && <div className="household-bar"><div>{profile && <AvatarStack members={profile.members.slice(0,5)} />}<span>{profile?.name ?? 'Your family space'}</span></div><span className="household-mode">{profile?.isDemo ? 'Sample family · demo week' : profile ? 'Saved in this browser' : 'No household set up yet'}</span></div>}
    <main id="main" tabIndex={-1} className={home ? 'family-home-main' : 'family-main'}>
      {!storageOk && <p className="notice notice-safety" role="status">Browser storage is unavailable. Changes will last until this page closes.</p>}
      {children ?? <Outlet />}
    </main>
    <footer className="family-footer"><Brand /><p>A student project for the everyday work of being a family.</p><Link to="/trust">How it works &amp; your data <ArrowRight size={14}/></Link><span>Offline guidance · Not a medical service</span></footer>
    {!home && <nav className="family-bottom-nav" aria-label="Quick navigation">{PAGES.map(({to,label,icon:Icon})=><NavLink key={to} to={to}><Icon size={19}/>{label}</NavLink>)}<button type="button" onClick={()=>setMenu(true)} aria-label="Family and more"><Users size={19}/>Family</button></nav>}
    <Modal open={menu} title="A place for the whole family" onClose={()=>setMenu(false)}>
      <SystemAppearanceControl />
      <nav className="family-menu" aria-label="All pages">{PAGES.map(({to,label,icon:Icon})=><Link className="family-menu-primary" key={to} to={to} onClick={()=>setMenu(false)}><Icon size={19}/>{label}</Link>)}{MORE.map(({to,label,text,icon:Icon})=><Link to={to} key={to} onClick={()=>setMenu(false)}><Icon size={20}/><span><strong>{label}</strong><span>{text}</span></span><ArrowRight size={15}/></Link>)}<Link to="/demo" onClick={()=>setMenu(false)}><House size={20}/><span><strong>Meet the sample family</strong><span>A guided tour using fictional information.</span></span></Link></nav>
    </Modal>
  </div>;
}
