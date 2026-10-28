import {proposalCalendar} from '@/workspace/proposals';
import type {WorkspaceRecord} from '@/shared/contracts';
import {describe,it,expect} from 'vitest';
import {dateForDay,householdDate} from '@/lib/dates';
import {detectConflicts,applyChanges} from '@/lib/scheduleOptimizer';
import {demoState} from '@/state/store';
import {legacyImportRows} from '@/workspace/legacy';
import {boundedFacts} from '@/lib/model/assistant';
describe('merge data adapters',()=>{
 it('calculates dates in household time across midnight',()=>{const now=new Date('2026-10-27T23:30:00Z');expect(householdDate(now,'Asia/Dubai').getDate()).toBe(28);expect(dateForDay(0,now,'Asia/Dubai')).toBe('2026-10-26');});
 it('does not report equal weekday times in different weeks as a conflict',()=>{const sample=demoState().schedule[0];expect(detectConflicts([{...sample,id:'a',date:'2026-10-26'},{...sample,id:'b',date:'2026-11-02'}])).toEqual([]);});
 it('keeps the event date consistent when an optimizer changes its weekday',()=>{const e={...demoState().schedule[0],date:'2026-10-26'};expect(applyChanges([e],[{op:'update',eventId:e.id,patch:{day:2}}])[0].date).toBe('2026-10-28');});
 it('imports privately with canonical record ids and a complete archive',()=>{const source=demoState();const serialized=JSON.stringify(source);const rows=legacyImportRows(source,'family','member');expect(JSON.stringify(source)).toBe(serialized);for(const row of rows){expect(row.recipientIds).toEqual(['member']);if(row.kind==='event'||row.kind==='memory')expect(row.id).toBe('family:'+row.data.id);}expect(rows.at(-1)?.data.legacyState).toEqual(source);expect(rows.at(-1)?.expectedVersion).toBe(0);});
 it('bounds model context without cutting JSON in the middle of a record',()=>{const facts=boundedFacts(Array.from({length:20},(_,i)=>({id:String(i),data:{note:'x'.repeat(6000)}})));expect(JSON.stringify(facts).length).toBeLessThanOrEqual(6500);expect(()=>JSON.parse(JSON.stringify(facts))).not.toThrow();});
});

it('does not put private or unchanged calendar entries in a family acceptance request',()=>{const first=demoState().schedule[0];const before=[{...first,id:'private'},{...first,id:'shared'},{...first,id:'untouched'}];const after=before.map(e=>({...e,title:e.id==='untouched'?e.title:'Updated'}));const records=[{id:'f:private',data:{audience:'private'}},{id:'f:shared',data:{audience:'family'}}] as unknown as WorkspaceRecord[];const proposal=proposalCalendar(before,after,records,'f');expect(proposal.before.map(e=>e.id)).toEqual(['shared']);expect(proposal.after.map(e=>e.id)).toEqual(['shared']);});
