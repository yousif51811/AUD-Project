import type { AppState } from '@/state/store';
import type { DayIndex, PlanAction, ScheduleEvent } from '@/types';
import { uid } from '@/lib/sanitize';
import { appendQuickAction, validateAction } from '@/lib/actions';
import { operationList, type AgentOperation } from '@/lib/model/operations';
export function agentState(before:AppState, operations:AgentOperation[]):AppState {
 operationList.parse(operations);
 const next:AppState=structuredClone({profile:before.profile,plan:before.plan,schedule:before.schedule,care:before.care,student:before.student,memories:before.memories,assessment:before.assessment,draft:before.draft}), members=next.profile?.members.map(m=>m.id)??[];
 const people=(ids:string[])=>{if(ids.some(id=>!members.includes(id)))throw new Error('Choose current family members before confirming.');};
 const find=<T extends {id:string}>(items:T[],id:string)=>{const item=items.find(item=>item.id===id);if(!item)throw new Error('This item is no longer available. Ask for an updated proposal.');return item;};
 const event=(value:ScheduleEvent)=>{people(value.assigneeIds);if(value.start>=value.end)throw new Error('An event must end after it starts.');if(value.date)value.day=((new Date(value.date+'T12:00:00Z').getUTCDay()+6)%7) as DayIndex;return value;};
 for(const op of operations){
  switch(op.tool){
   case 'calendar.create': next.schedule.push(event({...op.event,id:uid('ev'),day:0,done:op.event.done??false}));break;
   case 'calendar.update': Object.assign(find(next.schedule,op.id),op.patch);event(find(next.schedule,op.id));break;
   case 'calendar.delete': find(next.schedule,op.id);next.schedule=next.schedule.filter(e=>e.id!==op.id);break;
   case 'tasks.create': {people(op.task.participantIds);const added=appendQuickAction(next.plan,{...op.task,day:op.task.day as DayIndex,id:uid('action'),done:op.task.done??false,source:'coach'},next.profile?.preferences.maxDailyMinutes??90);if(added.errors.length)throw new Error(added.errors.join(' '));next.plan=added.plan;break;}
   case 'tasks.update': {const task=find(next.plan?.actions??[],op.id);Object.assign(task,op.patch);people(task.participantIds);const errors=validateAction(task,next.plan,next.profile?.preferences.maxDailyMinutes??90);if(errors.length)throw new Error(errors.join(' '));break;}
   case 'tasks.delete': find(next.plan?.actions??[],op.id);next.plan!.actions=next.plan!.actions.filter(a=>a.id!==op.id);break;
   case 'care.create': next.care.reminders.push({...op.reminder,id:uid('reminder'),status:op.reminder.status??'pending',required:false,backupAgreed:false,log:[]});break;
   case 'care.update': Object.assign(find(next.care.reminders,op.id),op.patch);break;
   case 'care.delete': find(next.care.reminders,op.id);next.care.reminders=next.care.reminders.filter(r=>r.id!==op.id);break;
   case 'memories.create': people(op.memory.tagIds);next.memories.unshift({...op.memory,id:uid('mem')});break;
   case 'memories.update': {const item=find(next.memories,op.id);Object.assign(item,op.patch);people(item.tagIds);break;}
   case 'memories.delete': find(next.memories,op.id);next.memories=next.memories.filter(m=>m.id!==op.id);break;
   case 'study.update': Object.assign(next.student,op.patch);break;
   case 'family.update': {if(!next.profile)throw new Error('Open your family first.');const {name,goals,maxDailyMinutes,reminders}=op.patch;if(name)next.profile.name=name;if(goals)next.profile.goals=goals;if(maxDailyMinutes)next.profile.preferences.maxDailyMinutes=maxDailyMinutes;if(reminders)next.profile.preferences.reminders=reminders;break;}
   default: throw new Error('Confirm this account tool separately.');
  }
 }
 return next;
}
export function affectedMembers(before:AppState,after:AppState):string[]{
 const changed=<T extends {id:string}>(a:T[],b:T[])=>[...a,...b].filter(item=>JSON.stringify(a.find(x=>x.id===item.id)??null)!==JSON.stringify(b.find(x=>x.id===item.id)??null));
 return [...new Set([...changed(before.schedule,after.schedule).flatMap(e=>e.assigneeIds),...changed(before.plan?.actions??[],after.plan?.actions??[]).flatMap((a:PlanAction)=>a.participantIds)])];
}
