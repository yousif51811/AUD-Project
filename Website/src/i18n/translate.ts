import type { Language } from '@/lib/language';
import ar from './ar.json';
const dictionary: Readonly<Record<string, string>> = ar;
export function translate(text: string, language: Language, values: Record<string, string | number> = {}): string {
  const key = text.trim();
  const translated = language === 'ar' && Object.hasOwn(dictionary, key) ? text.replace(key, () => dictionary[key]) : text;
  return translated.replace(/\{(\w+)\}/g, (match, name: string) => Object.hasOwn(values, name) ? String(values[name]) : match);
}
