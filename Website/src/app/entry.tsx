'use client';
import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';
import { languageStore } from '@/lib/language';
function Opening() {
  const language = useSyncExternalStore(languageStore.subscribe, languageStore.getSnapshot, () => 'en' as const);
  return <main style={{minHeight:'100dvh',display:'grid',placeItems:'center',padding:24,fontFamily:'system-ui,sans-serif'}}><p role="status">{language === 'ar' ? 'جارٍ فتح مساحة أسرتك…' : 'Opening your family space…'}</p></main>;
}
const App = dynamic(() => import('../client'), {ssr:false, loading:Opening});
export default App;
