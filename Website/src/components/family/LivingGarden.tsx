import { t, useLanguage } from '@/i18n';
import { useEffect, useRef } from 'react';
import { Pause, Play } from 'lucide-react';
import { useApp } from '@/state/store';
import { useWorkspace } from '@/workspace/Workspace';
import { useDisplay } from '@/lib/display';

/** Pointer scenery is decorative; moving the pointer never triggers React renders. */
export function LivingBackdrop() {
  useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const { profile } = useApp();
  const { actorId } = useWorkspace();
  const [display] = useDisplay(actorId);
  const reduced = display.reduceMotion ?? profile?.preferences.reduceMotion ?? false;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const fine = matchMedia('(pointer: fine)'), media = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const reset = () => { cancelAnimationFrame(frame); frame = 0; node.style.setProperty('--garden-x', '0px'); node.style.setProperty('--garden-y', '0px'); };
    const move = (event: PointerEvent) => {
      if (reduced || media.matches || !fine.matches || document.hidden) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        node.style.setProperty('--garden-x', `${(event.clientX / innerWidth - .5) * 64}px`);
        node.style.setProperty('--garden-y', `${(event.clientY / innerHeight - .5) * 48}px`);
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
    document.documentElement.addEventListener('pointerleave', reset);
    media.addEventListener('change', reset);
    fine.addEventListener('change', reset);
    return () => {
      reset(); window.removeEventListener('pointermove', move); window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset); document.documentElement.removeEventListener('pointerleave', reset);
      media.removeEventListener('change', reset); fine.removeEventListener('change', reset);
    };
  }, [reduced]);
  return <div className="living-backdrop" ref={ref} aria-hidden="true">
    <div className="garden-wash garden-wash-sage"/><div className="garden-wash garden-wash-apricot"/>
    <svg className="garden-margin garden-margin-left" viewBox="0 0 180 600" fill="none"><path d="M-20 590C145 415-75 340 100 100M5 478c50 2 80-30 75-64-45 1-70 26-75 64ZM32 364c-60-10-70-46-56-79 47 7 62 41 56 79ZM39 267c48-8 68-36 58-64-38 2-61 29-58 64Z"/></svg>
    <svg className="garden-margin garden-margin-right" viewBox="0 0 180 600" fill="none"><path d="M10 600C165 440 20 300 170 150M86 472c51-6 78-34 66-64-41 6-66 31-66 64ZM94 362c-47-14-57-48-42-77 36 9 54 39 42 77ZM105 262c48 2 69-24 65-50-40-1-61 22-65 50Z"/></svg>
  </div>;
}

export function GardenMotionControl() {
  useLanguage();
  const { actorId } = useWorkspace();
  const { profile } = useApp();
  const [display, update] = useDisplay(actorId);
  const paused = display.reduceMotion ?? profile?.preferences.reduceMotion ?? false;
  return <button type="button" className="garden-motion" aria-pressed={paused} title={t("Your device’s reduced-motion preference always applies.")} onClick={() => update({ reduceMotion: !paused })}>
    {paused ? <Play size={13} aria-hidden/> : <Pause size={13} aria-hidden/>}{paused ? t("Resume scenery") : t("Pause scenery")}
  </button>;
}

export function CourtyardDrawing() {
  useLanguage();
  return <div className="courtyard-drawing" aria-hidden="true">
    <svg viewBox="0 0 520 340" fill="none">
      <ellipse className="courtyard-orbit" cx="270" cy="187" rx="213" ry="119" transform="rotate(-16 270 187)"/>
      <ellipse className="courtyard-orbit orbit-inner" cx="270" cy="187" rx="185" ry="92" transform="rotate(-16 270 187)"/>
      <g className="courtyard-sun"><circle cx="356" cy="88" r="58"/><path d="M356 12v-9m76 85h9m-10-55 7-7m-143 7-7-7"/></g>
      <path className="courtyard-ground" d="M93 259c36-37 90-36 134-23 56-36 123-32 194 2-33 55-230 91-328 21Z"/>
      <g className="courtyard-plant plant-left"><path d="M173 257c-13-55-25-92-69-126m49 64c5-40-10-70-31-84-17 26-5 66 31 84Zm-17 23c-42 4-69-15-75-44 35-4 61 14 75 44Zm36 11c31-29 33-66 14-90-28 22-37 56-14 90Z"/></g>
      <g className="courtyard-house"><path className="house-shadow" d="m207 246 76 25 81-27-76-25-81 27Z"/><path className="house-wall" d="M213 163h100v83H213z"/><path className="house-side" d="m313 163 33-21v87l-33 17v-83Z"/><path className="house-roof" d="m193 166 69-64 68 64H193Z"/><path className="house-roof-side" d="m262 102 33-17 70 62-35 19-68-64Z"/><path className="house-door" d="M254 246v-38a14 14 0 0 0-28 0v38"/><path className="house-window" d="M277 193h21v24h-21z"/><path className="house-details" d="M287 193v24m-10-12h21M245 217h1"/><path className="house-chimney" d="M299 108V85h14v36"/></g>
      <g className="courtyard-plant plant-right"><path d="M373 252c12-46 17-81 45-116m-29 59c-22-25-17-57 1-75 20 19 21 53-1 75Zm9 21c30-2 53-22 54-45-28 0-47 15-54 45Z"/></g>
      <path className="courtyard-path" d="M237 249c-19 17-6 33 29 32 51-2 75 14 38 37"/>
      <g className="courtyard-flower flower-one" transform="translate(115 74)"><path d="M0-15C8-28 19-9 8-5 29-8 24 15 9 8c16 15-7 23-10 9-9 19-26 2-14-8-22 1-13-22 0-16-14-17 9-22 15-8Z"/><circle r="5"/></g>
      <g className="courtyard-flower flower-two" transform="translate(427 265) scale(.6)"><path d="M0-15C8-28 19-9 8-5 29-8 24 15 9 8c16 15-7 23-10 9-9 19-26 2-14-8-22 1-13-22 0-16-14-17 9-22 15-8Z"/><circle r="5"/></g>
      <path className="courtyard-spark" d="M461 99v18m-9-9h18M66 273v12m-6-6h12M179 52v10m-5-5h10"/>
      <circle className="courtyard-dot" cx="68" cy="158" r="4"/><circle className="courtyard-dot" cx="453" cy="197" r="3"/>
    </svg>
    <span className="courtyard-caption">{t("a little space for all of us")}</span>
  </div>;
}
