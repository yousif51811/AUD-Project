import type { DayIndex, PlanAction, PlanCategory, WeeklyPlan } from '@/types';
import { MAX_ACTIONS_PER_DAY } from './plan';
import { sanitizeText } from './sanitize';
export const CATEGORY_LABELS: Record<PlanCategory, string> = { connection: 'Connection', balance: 'Balance', study: 'Study', care: 'Care', rest: 'Rest', reflection: 'Reflection' };
export function validateAction(action: PlanAction, plan: WeeklyPlan | null, maxMinutes = 90): string[] {
  const errors: string[] = [];
  if (!sanitizeText(action.title, 200)) errors.push('Add a title for this action.');
  if (!Number.isInteger(action.day) || action.day < 0 || action.day > 6) errors.push('Choose a day of the week.');
  if (!Number.isInteger(action.minutes) || action.minutes < 1 || action.minutes > 120) errors.push('Choose a duration from 1 to 120 whole minutes.');
  const others = [...(plan?.actions ?? []), ...(plan?.parked ?? [])].filter((a) => a.id !== action.id && a.day === action.day);
  const activeOthers = (plan?.actions ?? []).filter((a) => a.id !== action.id && a.day === action.day);
  if (others.length >= MAX_ACTIONS_PER_DAY) errors.push(`This day already has ${MAX_ACTIONS_PER_DAY} actions. Choose another day or remove one first.`);
  else if (plan?.reduced && activeOthers.length >= 1) errors.push('Reduce workload allows one active action per day. Choose another day or remove one first.');
  if (others.reduce((n, a) => n + a.minutes, 0) + action.minutes > maxMinutes) errors.push(`This would exceed your ${maxMinutes}-minute daily limit. Choose another day or a shorter duration.`);
  return errors;
}
export function appendQuickAction(plan: WeeklyPlan | null, action: PlanAction, maxMinutes = 90): { plan: WeeklyPlan | null; errors: string[] } {
  const errors = validateAction(action, plan, maxMinutes);
  if (errors.length) return { plan, errors };
  const base = plan ?? { actions: [], parked: [], reduced: false, isSample: false };
  return { plan: { ...base, isSample: false, actions: [...base.actions, { ...action, title: sanitizeText(action.title, 200), source: 'user' as const }].sort((a,b) => a.day - b.day) }, errors };
}
export interface ActionFilters { day: DayIndex | 'all'; person: string; category: PlanCategory | 'all'; status: 'all' | 'open' | 'done' }
export const EMPTY_FILTERS: ActionFilters = { day: 'all', person: 'all', category: 'all', status: 'all' };
export function filterActions(actions: PlanAction[], filters: ActionFilters): PlanAction[] {
  return actions.filter((a) => (filters.day === 'all' || a.day === filters.day) && (filters.person === 'all' || a.participantIds.includes(filters.person)) && (filters.category === 'all' || a.category === filters.category) && (filters.status === 'all' || a.done === (filters.status === 'done')));
}
