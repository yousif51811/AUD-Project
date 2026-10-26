import type { FamilyMember, HouseholdProfile, ScheduleEvent } from '@/types';
import { toMin } from './time';

export function adults(p: HouseholdProfile | null): FamilyMember[] {
  return p ? p.members.filter((m) => m.ageGroup === 'adult') : [];
}
export function student(p: HouseholdProfile | null): FamilyMember | undefined {
  if (!p) return undefined;
  return p.members.find((m) => m.ageGroup === 'teen') ?? p.members.find((m) => m.ageGroup === 'child');
}
export function youngStudent(p: HouseholdProfile | null): FamilyMember | undefined {
  return p?.members.find((m) => m.ageGroup === 'child');
}
export function elder(p: HouseholdProfile | null): FamilyMember | undefined {
  return p?.members.find((m) => m.ageGroup === 'older');
}

const RESPONSIBILITY: ScheduleEvent['category'][] = ['Household Tasks', 'Older Adult Care'];

export function eventMinutes(e: Pick<ScheduleEvent, 'start' | 'end'>): number {
  return Math.max(5, toMin(e.end) - toMin(e.start));
}

/** Minutes of responsibility per member. Shared events are split evenly. */
export function responsibilityLoad(events: ScheduleEvent[], members: FamilyMember[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of members) out[m.id] = 0;
  for (const e of events) {
    if (!RESPONSIBILITY.includes(e.category) || e.assigneeIds.length === 0) continue;
    const share = eventMinutes(e) / e.assigneeIds.length;
    for (const id of e.assigneeIds) if (id in out) out[id] += share;
  }
  return out;
}

export interface BalanceEntry {
  member: FamilyMember;
  minutes: number;
  percent: number;
}

export function balanceOf(events: ScheduleEvent[], members: FamilyMember[]): BalanceEntry[] {
  const load = responsibilityLoad(events, members);
  const total = Object.values(load).reduce((a, b) => a + b, 0);
  return members
    .map((member) => ({
      member,
      minutes: Math.round(load[member.id] ?? 0),
      percent: total > 0 ? Math.round(((load[member.id] ?? 0) / total) * 100) : 0,
    }))
    .filter((e) => e.minutes > 0 || e.member.ageGroup !== 'older');
}

/** The adult carrying the most responsibility, and the adult carrying the least. */
export function carrierAndHelper(
  p: HouseholdProfile | null,
  events: ScheduleEvent[],
): { carrier?: FamilyMember; helper?: FamilyMember } {
  const ads = adults(p);
  if (ads.length === 0) return {};
  if (ads.length === 1) return { carrier: ads[0] };
  const load = responsibilityLoad(events, ads);
  const allZero = ads.every((m) => (load[m.id] ?? 0) === 0);
  if (allZero) return { carrier: ads[1], helper: ads[0] };
  const sorted = [...ads].sort((a, b) => (load[b.id] ?? 0) - (load[a.id] ?? 0) || ads.indexOf(a) - ads.indexOf(b));
  return { carrier: sorted[0], helper: sorted[sorted.length - 1] };
}

export function nameOf(m: FamilyMember | undefined, fallback: string): string {
  return m ? m.name : fallback;
}
