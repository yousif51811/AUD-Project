import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { t, useLanguage, languageStore } from '@/i18n';
import { useApp } from '@/state/store';
import { useWorkspace } from '@/workspace/Workspace';
import { useDisplay } from '@/lib/display';
import { appearance } from '@/components/family/AppearanceControl';
import { agentSnapshot, executeOperations, prepareOperations } from '@/workspace/agent';
import type { ScheduleEvent, PlanAction } from '@/types';
import { DAY_NAMES } from '@/lib/time';
import type { AgentOperation } from '@/lib/model/operations';
const names:Record<AgentOperation['tool'],string>={
 'calendar.create':'Add calendar event','calendar.update':'Edit calendar event','calendar.delete':'Delete calendar event',
 'tasks.create':'Add task','tasks.update':'Edit task','tasks.delete':'Delete task',
 'care.create':'Add care reminder','care.update':'Edit care reminder','care.delete':'Delete care reminder',
 'memories.create':'Add keepsake','memories.update':'Edit keepsake','memories.delete':'Delete keepsake',
 'study.update':'Update study settings','family.update':'Update family settings','family.invite':'Invite family member',
 'family.invitations.list':'List invitations','family.members.list':'List family members','family.invitation.cancel':'Cancel invitation',
 'family.member.approve':'Confirm family access','family.member.remove':'Remove family member','family.member.role':'Change member role','family.owner.transfer':'Transfer ownership','family.timezone':'Change family timezone',
 'checkin.create':'Save private check-in','availability.set':'Set volunteered availability','rotation.create':'Propose responsibility rotation','rotation.accept':'Accept responsibility rotation','rotation.delete':'Delete responsibility rotation',
 'requests.list':'List pending requests','request.respond':'Respond to shared change request',
 'display.update':'Update display preferences','language.set':'Change language','appearance.set':'Change appearance',
};
const labels:Record<string,string>={title:'Title',date:'Date',start:'Start',end:'End',category:'Category',assigneeIds:'People',participantIds:'People',tagIds:'People',notes:'Notes',reason:'Reason',day:'Day',minutes:'Minutes',done:'Completed',flexible:'Flexible',protected:'Protected',exam:'Assessment',time:'Time',kind:'Kind',detail:'Details',status:'Status',message:'Message',type:'Type',visibility:'Visibility',goal:'Goal',bedtime:'Bedtime',wake:'Wake time',supportRequest:'Support request',name:'Family name',goals:'Goals',maxDailyMinutes:'Daily plan limit',reminders:'Reminders',target:'Username or email',ageGroup:'Age group',role:'Family role',userId:'Family member',invitationId:'Invitation',timezone:'Timezone',mood:'Mood',energy:'Energy',note:'Note',available:'Available',talk:'Open to talk',largeText:'Larger text',highContrast:'High contrast',reduceMotion:'Reduce motion',preference:'Preference',accept:'Accept',id:'Current item'};
export function AgentProposal({operations,snapshot}:{operations:AgentOperation[];snapshot:string}) {
 useLanguage();const app=useApp(),w=useWorkspace(),[,setDisplay]=useDisplay(w.actorId);
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[cancelled,setCancelled]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<{message:string;link?:string;details?:string}|null>(null);
 const working=useRef(false);
 let resolved:AgentOperation[]=[],invalid='';
 try{resolved=prepareOperations(operations,app,w);}catch(e){invalid=(e as Error).message;}
 const value=(input:unknown):string=>Array.isArray(input)?input.map(value).join(', '):typeof input==='boolean'?t(input?'Yes':'No'):typeof input==='string'?(w.records.find(r=>r.id===input&&['proposal','recurrence'].includes(r.kind))?.data.title as string??app.schedule.find(e=>e.id===input)?.title??app.plan?.actions.find(a=>a.id===input)?.title??app.care.reminders.find(r=>r.id===input)?.title??app.memories.find(m=>m.id===input)?.title??app.profile?.members.find(m=>m.id===input)?.name??w.members.find(m=>m.userId===input)?.displayName??input):String(input);
 const fields=(data:Record<string,unknown>)=>Object.entries(data).filter(([key])=>key!=='tool').flatMap(([key,input]):Array<[string,unknown]>=>input&&typeof input==='object'&&!Array.isArray(input)?fields(input as Record<string,unknown>):[[key,input]]);
 const previous=(op:AgentOperation):string=>{
  if(!('id' in op))return '';
  if(op.tool==='request.respond'){
   const request=w.records.find(r=>r.id===op.id);if(!request)return '';
   const before=request.data.beforeSchedule as ScheduleEvent[],after=request.data.afterSchedule as ScheduleEvent[];
   const changes=[...after.map(e=>`${e.title} · ${e.date??t(DAY_NAMES[e.day])} · ${e.start}–${e.end}`),...before.filter(e=>!after.some(a=>a.id===e.id)).map(e=>`${t('Delete calendar event')}: ${e.title}`)];
   const tasks=(request.data.afterPlan as {actions:PlanAction[]}|null)?.actions??[];
   const oldTasks=(request.data.beforePlan as {actions:PlanAction[]}|null)?.actions??[];
   for(const task of tasks.filter(task=>JSON.stringify(task)!==JSON.stringify(oldTasks.find(a=>a.id===task.id))))changes.push(`${task.title} · ${t(DAY_NAMES[task.day])} · ${task.minutes} ${t('Minutes')}`);
   for(const task of oldTasks.filter(task=>!tasks.some(a=>a.id===task.id)))changes.push(`${t('Delete task')}: ${task.title}`);
   return changes.join('\n');
  }
  const event=app.schedule.find(e=>e.id===op.id);
  if(op.tool.startsWith('calendar.')&&event)return `${event.title} · ${event.date??t(DAY_NAMES[event.day])} · ${event.start}–${event.end} · ${event.assigneeIds.map(value).join(', ')}`;
  const task=app.plan?.actions.find(a=>a.id===op.id);
  if(op.tool.startsWith('tasks.')&&task)return `${task.title} · ${t(DAY_NAMES[task.day])} · ${task.minutes} ${t('Minutes')}`;
  return '';
 };
 const confirm=async()=>{
  if(working.current||done||cancelled)return;
  working.current=true;setBusy(true);setError('');
  try{
   if(agentSnapshot(app,w)!==snapshot)throw new Error('Your records or permissions changed. Ask for an updated proposal.');
   const response=await executeOperations(operations,app,w,{display:setDisplay,language:languageStore.setLanguage,appearance:appearance.setPreference});
   setResult(response);setDone(true);
  }catch(e){setError((e as Error).message);}finally{working.current=false;setBusy(false);}
 };
 return <div className="stack agent-proposal"><h3>{t('Review changes')}</h3>
 {(resolved.length?resolved:operations).map((op,index)=><article className="card stack stack-sm" key={index}><strong>{t(names[op.tool])}</strong>{previous(op)&&<div><span className="hint">{t('Current details / request contents')}</span><p style={{whiteSpace:'pre-line'}}>{previous(op)}</p></div>}<dl className="agent-change-fields">{fields(op as unknown as Record<string,unknown>).map(([key,input])=><div key={key}><dt>{t(labels[key]??key)}</dt><dd style={{overflowWrap:'anywhere',whiteSpace:'pre-line'}}>{key==='day'&&typeof input==='number'?t(DAY_NAMES[input]):['category','status','ageGroup','role','preference','kind','visibility','type','reminders'].includes(key)&&typeof input==='string'?t(input):value(input)}</dd></div>)}</dl>{op.tool==='family.member.remove'&&<p className="hint">{t('Removal stops future access. Previously downloaded copies cannot be withdrawn.')}</p>}</article>)}
 <p className="hint">{t('Nothing changes until you confirm. Changes to other members’ commitments are sent for their acceptance. Invitations create a link for you to share.')}</p>
 {invalid&&!done&&<p className="notice notice-safety" role="alert">{t(invalid)}</p>}
 {error&&<p className="notice notice-safety" role="alert">{t(error)}</p>}
 {!done&&!cancelled&&<div className="cluster"><button type="button" className="btn btn-primary" disabled={busy||!!invalid} onClick={()=>void confirm()}>{busy?t('Saving…'):t('Confirm changes')}</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setCancelled(true)}>{t('Dismiss proposal')}</button></div>}
 {cancelled&&<p role="status">{t('Proposal dismissed. Nothing was changed.')}</p>}
 {result&&<div role="status" className="notice stack"><p>{t(result.message)}</p>{result.link&&<label className="field">{t('Share this invitation link privately')}<input className="input" dir="ltr" readOnly value={result.link} onFocus={event=>event.target.select()}/><button className="btn btn-secondary" onClick={()=>void navigator.clipboard.writeText(result.link!).catch(()=>setError('Select the invitation link and copy it.'))}>{t('Copy invitation link')}</button></label>}{result.details&&<p style={{whiteSpace:'pre-line',overflowWrap:'anywhere'}}>{result.details}</p>}<Link className="family-text-link" to="/notifications">{t('View requests')}</Link></div>}
 </div>;
}
