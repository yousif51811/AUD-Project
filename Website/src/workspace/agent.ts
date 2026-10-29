import type { AppApi } from '@/state/store';
import type { Workspace } from './Workspace';
import type { AgentOperation } from '@/lib/model/operations';
import { operationList, isStateOperation, ownerOperation, localOperation } from '@/lib/model/operations';
import { canonical } from '@/lib/canonical';
import { api } from './transport';
import { respondToRequest } from './requests';
import { dateForDay } from '@/lib/dates';
import type { InvitationSummary } from '@/shared/contracts';
export function agentSnapshot(app:AppApi,w:Workspace) {
 return canonical({profile:app.profile,plan:app.plan,schedule:app.schedule,care:app.care,student:app.student,memories:app.memories,actor:w.actorId,family:w.family,mode:w.mode,generation:w.generation,members:w.members.map(m=>({id:m.userId,role:m.role,status:m.status})),versions:w.records.filter(r=>!['chat','notification'].includes(r.kind)).map(r=>[r.id,r.version]).sort()});
}
function resolve<T>(items:T[],value:string,id:(item:T)=>string,name:(item:T)=>string):T {
 const exact=items.find(item=>id(item)===value);if(exact)return exact;
 const matches=items.filter(item=>name(item).trim().toLowerCase()===value.trim().toLowerCase());
 if(matches.length!==1)throw new Error('This item is missing or ambiguous. Ask for a new proposal with more detail.');
 return matches[0];
}
export function prepareOperations(raw:AgentOperation[],app:AppApi,w:Workspace):AgentOperation[]{
 const operations=structuredClone(operationList.parse(raw));
 const member=(value:string)=>w.mode==='demo'?resolve(app.profile?.members??[],value,m=>m.id,m=>m.name).id:resolve(w.members.filter(m=>m.status!=='REVOKED'&&m.status!=='LEFT'),value,m=>m.userId,m=>m.displayName??'').userId;
 for(const op of operations){
  if(w.mode==='account'&&!localOperation(op)&&(!w.identity||!w.family||w.family.role==='VIEWER'))throw new Error('Your membership cannot make this change.');
  if(ownerOperation(op)&&w.mode==='account'&&w.family?.role!=='OWNER')throw new Error('Only the family owner can manage members and family settings.');
  if(op.tool.startsWith('family.')&&w.mode==='demo'&&op.tool!=='family.update')throw new Error('Sign in to manage real invitations and members.');
  if('userId' in op){op.userId=member(op.userId);if(op.userId===w.actorId)throw new Error('Choose another family member.');}
  if(op.tool==='calendar.create')op.event.assigneeIds=op.event.assigneeIds.map(member);
  if(op.tool==='tasks.create')op.task.participantIds=op.task.participantIds.map(member);
  if(op.tool==='rotation.create')op.participantIds=op.participantIds.map(member);
  if(op.tool==='memories.create')op.memory.tagIds=op.memory.tagIds.map(member);
  if('id' in op){
   if(op.tool.startsWith('calendar.'))op.id=resolve(app.schedule,op.id,e=>e.id,e=>e.title).id;
   if(op.tool.startsWith('tasks.'))op.id=resolve(app.plan?.actions??[],op.id,e=>e.id,e=>e.title).id;
   if(op.tool.startsWith('care.'))op.id=resolve(app.care.reminders,op.id,e=>e.id,e=>e.title).id;
   if(op.tool.startsWith('memories.'))op.id=resolve(app.memories,op.id,e=>e.id,e=>e.title).id;
   if(op.tool==='request.respond')op.id=resolve(w.records.filter(r=>r.kind==='proposal'&&r.data.status==='pending'),op.id,e=>e.id,e=>String(e.data.title)).id;
   if(op.tool.startsWith('rotation.'))op.id=resolve(w.records.filter(r=>r.kind==='recurrence'),op.id,e=>e.id,e=>String(e.data.title)).id;
  }
  if(op.tool==='calendar.update'&&op.patch.assigneeIds)op.patch.assigneeIds=op.patch.assigneeIds.map(member);
  if(op.tool==='tasks.update'&&op.patch.participantIds)op.patch.participantIds=op.patch.participantIds.map(member);
  if(op.tool==='memories.update'&&op.patch.tagIds)op.patch.tagIds=op.patch.tagIds.map(member);
  // The server also enforces these rights. Check before any local proposal is offered.
  if(w.mode==='account'&&'id' in op&&isStateOperation(op)){
   const kind=op.tool.startsWith('calendar.')?'event':op.tool.startsWith('tasks.')?'plan':op.tool.startsWith('care.')?'care':'memory';
   const record=w.records.find(r=>r.kind===kind&&(kind==='plan'||kind==='care'||r.data.id===op.id));
   if(!record||!record.editorIds.includes(w.actorId))throw new Error('You cannot edit this record.');
  }
 }
 return operations;
}
export async function executeOperations(operations:AgentOperation[],app:AppApi,w:Workspace,preferences:{display:(patch:{largeText?:boolean;highContrast?:boolean;reduceMotion?:boolean})=>void;language:(value:'system'|'en'|'ar')=>void;appearance:(value:'system'|'light'|'dark')=>void}):Promise<{message:string;link?:string;details?:string}> {
 const parsed=prepareOperations(operations,app,w);
 if(parsed.every(isStateOperation))return {message:await app.applyAgentChanges(parsed)?'Request sent. Named members must accept before shared commitments change.':'Changes saved.'};
 const op=parsed[0], family=w.family?.id;
 switch(op.tool){
  case 'family.invitations.list': {const rows=await api<InvitationSummary[]>(`families/${family}/invite`);return {message:rows.length?'Current invitations':'No pending invitations.',details:rows.map(i=>`${i.email} · ${i.role} · ${i.expiresAt}`).join('\n')};}
  case 'family.members.list': return {message:'Family members',details:w.members.filter(m=>m.status!=='REVOKED'&&m.status!=='LEFT').map(m=>`${m.displayName??m.userId} · ${m.role} · ${m.status}`).join('\n')};
  case 'family.invite': {const result=await api<{token:string}>(`families/${family}/invite`,{target:op.target,ageGroup:op.ageGroup,role:op.role});return {message:'Invitation created. Share this link privately; no email was sent.',link:location.origin+'/invitations/'+result.token};}
  case 'family.invitation.cancel': {const rows=await api<InvitationSummary[]>(`families/${family}/invite`);const invitation=resolve(rows,op.invitationId,i=>i.id,i=>i.email);await api(`families/${family}/invite`,{invitationId:invitation.id},'DELETE');break;}
  case 'family.member.approve': await w.approve(op.userId);break;
  case 'family.member.remove': await api(`families/${family}/members`,{userId:op.userId,operation:'remove'});break;
  case 'family.member.role': await api(`families/${family}/members`,{userId:op.userId,operation:'role',role:op.role});break;
  case 'family.owner.transfer': await api(`families/${family}/members`,{userId:op.userId,operation:'transfer'});break;
  case 'family.timezone': await api(`families/${family}/timezone`,{timezone:op.timezone});break;
  case 'checkin.create': await w.save('checkin',crypto.randomUUID(),{mood:op.mood,energy:op.energy,note:op.note,createdAt:new Date().toISOString(),audience:'private'});break;
  case 'availability.set': await w.save('availability',(w.family?.id??'sample')+':availability:'+w.actorId,{available:op.available,talk:op.talk,expiresAt:new Date(Date.now()+op.minutes*60000).toISOString(),audience:'family'},{recipientIds:w.mode==='demo'?app.profile!.members.map(m=>m.id):w.members.filter(m=>m.status==='ACTIVE').map(m=>m.userId),editorIds:[w.actorId]});break;
  case 'requests.list': return {message:'Pending requests',details:w.records.filter(r=>r.kind==='proposal'&&r.data.status==='pending').map(r=>`${r.data.title} · ${r.id}`).join('\n')||'—'};
  case 'request.respond': return {message:await respondToRequest(w,app,op.id,op.accept)};
  case 'rotation.create': {const all=w.mode==='demo'?app.profile!.members.map(m=>m.id):w.members.filter(m=>m.status==='ACTIVE').map(m=>m.userId);await w.save('recurrence',crypto.randomUUID(),{title:op.title,day:op.day,minutes:op.minutes,participantIds:op.participantIds,acceptedIds:op.participantIds.includes(w.actorId)?[w.actorId]:[],createdWeek:dateForDay(0),audience:'family'},{recipientIds:all,editorIds:all});return {message:'Rotation proposed. Every named member must accept before preparing tasks.'};}
  case 'rotation.accept': {const record=w.records.find(r=>r.id===op.id)!;if(!(record.data.participantIds as string[]).includes(w.actorId))throw new Error('Only a named participant can accept this rotation.');await w.save('recurrence',record.id,{...record.data,acceptedIds:[...new Set([...(record.data.acceptedIds as string[]),w.actorId])]},{expectedVersion:record.version});break;}
  case 'rotation.delete': await w.remove(op.id);break;
  case 'display.update': preferences.display(op.patch);break;
  case 'language.set': preferences.language(op.preference);break;
  case 'appearance.set': preferences.appearance(op.preference);break;
  default: throw new Error('This operation is not available.');
 }
 await w.refresh();return {message:'Changes saved.'};
}
