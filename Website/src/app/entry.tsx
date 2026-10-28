'use client';
import dynamic from 'next/dynamic';
const App=dynamic(()=>import('../client'),{ssr:false,loading:()=> <main className="family-main"><p role="status">Opening your family space…</p></main>});
export default App;
