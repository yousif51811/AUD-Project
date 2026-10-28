import type {ScheduleEvent} from '@/types';
import type {WorkspaceRecord} from '@/shared/contracts';
import {canonical} from '@/lib/canonical';
/** A family request must never carry unchanged/private calendar content. */
export function proposalCalendar(before:ScheduleEvent[],after:ScheduleEvent[],records:WorkspaceRecord[],familyId:string){
 const ids=new Set([...before,...after].map(e=>e.id));
 const changed=[...ids].filter(id=>canonical(before.find(e=>e.id===id)??null)!==canonical(after.find(e=>e.id===id)??null));
 const publicIds=changed.filter(id=>{const record=records.find(r=>r.id===familyId+':'+id);return !record||record.data.audience==='family';});
 return {before:before.filter(e=>publicIds.includes(e.id)),after:after.filter(e=>publicIds.includes(e.id)),recordIds:publicIds.map(id=>familyId+':'+id)};
}
