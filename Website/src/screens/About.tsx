import { Link } from 'react-router-dom';
import { ArrowRight, HeartHandshake, Leaf, Quote, Sprout } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { about, supervisor, team } from '@/data/about';
import { CourtyardDrawing } from '@/components/family/LivingGarden';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function About() {
  const { language } = useLanguage(), copy = about[language];
  useDocumentTitle(language === 'ar' ? 'من نحن' : 'About us');
  return <div className="about-page">
    <header className="about-hero"><div><p className="courtyard-eyebrow"><Sprout size={16} aria-hidden/>{copy.eyebrow}</p><h1 tabIndex={-1}>{copy.title}<br/><em>{copy.accent}</em></h1><p className="about-intro">{copy.intro}</p><Link className="btn btn-primary" to="/demo">{copy.demo}<ArrowRight size={17} aria-hidden/></Link></div><div className="about-garden"><span className="about-orbit" aria-hidden/><CourtyardDrawing/><p>{copy.note}</p></div></header>
    <section className="about-story" aria-labelledby="about-story-title"><div><span className="paper-label">{copy.storyLabel}</span><h2 id="about-story-title">{copy.storyTitle}</h2></div><div><p>{copy.story}</p><blockquote><Quote size={22} aria-hidden/><p>{copy.quote}</p></blockquote></div></section>
    <section aria-labelledby="about-values-title" className="about-values"><h2 className="courtyard-eyebrow" id="about-values-title">{copy.approach}</h2><div className="about-value-grid">{copy.values.map((value, index) => { const Icon = [Leaf, Sprout, HeartHandshake][index]; return <article key={value.number} className="about-value"><div><span>{value.number}</span><Icon size={25} aria-hidden/></div><h3>{value.title}</h3><p>{value.body}</p></article>; })}</div></section>
    <section className="about-team" aria-labelledby="about-team-title"><p className="courtyard-eyebrow">{copy.teamLabel}</p><h2 id="about-team-title">{copy.teamTitle}</h2><p>{copy.teamIntro}</p><ul className="about-team-grid">{team.map((name, index) => <li key={name}><span className="about-monogram" data-tone={index} aria-hidden>{name.split(' ').map(part => part[0]).join('')}</span><h3><bdi>{name}</bdi></h3><span className="about-team-rule" aria-hidden/></li>)}</ul><div className="about-supervisor"><span>{copy.supervision}</span><strong><bdi>{supervisor}</bdi></strong></div></section>
    <section className="about-context"><div><span className="paper-label">{copy.contextLabel}</span><h2>{copy.contextTitle}</h2></div><div><p>{copy.context}</p><p className="small">{copy.limits}</p><Link className="family-text-link" to="/trust">{copy.privacy}<ArrowRight size={16} aria-hidden/></Link></div></section>
    <section className="about-end"><HeartHandshake size={29} aria-hidden/><h2>{copy.end}</h2><Link className="btn btn-primary" to="/demo">{copy.demo}<ArrowRight size={17} aria-hidden/></Link></section>
  </div>;
}
