import { describe, it, expect, vi } from 'vitest';
import { demoState, type AppApi } from '@/state/store';
import type { Workspace } from '@/workspace/Workspace';
import { agentState, affectedMembers } from '@/workspace/agent-state';
import { prepareOperations, executeOperations, agentSnapshot } from '@/workspace/agent';
import { parseAnswer, systemPrompt, contextFor } from '@/lib/model/assistant';
import { operationList, type AgentOperation } from '@/lib/model/operations';
import { persistChanges } from '@/workspace/persistChanges';
const app = () => ({...demoState(),applyAgentChanges:vi.fn().mockResolvedValue(false)}) as unknown as AppApi;
const workspace = (role='OWNER') => ({mode:'account',actorId:'omar',identity:{publicKey:'synthetic'},family:{id:'f',role,status:'ACTIVE'},members:[{userId:'omar',displayName:'Omar',status:'ACTIVE',role:'OWNER'},{userId:'mariam',displayName:'Mariam',status:'ACTIVE',role:'MEMBER'}],records:[],generation:0,refresh:vi.fn().mockResolvedValue(undefined),save:vi.fn().mockResolvedValue(undefined),saveMany:vi.fn().mockResolvedValue(undefined)}) as unknown as Workspace;
const event:AgentOperation={tool:'calendar.create',event:{title:'Synthetic study',date:'2026-10-30',start:'17:00',end:'18:00',category:'Study',assigneeIds:['omar']}};
const prefs={display:vi.fn(),language:vi.fn(),appearance:vi.fn()};
describe('assistant management tools',()=>{
 it('parses typed tools without executing any changes',()=>{const answer=parseAnswer(JSON.stringify({answer:'Review the study session.',sources:[],actions:[],operations:[event]}),['omar'],[]);expect(answer.operations).toEqual([event]);});
 it.each([
  {tool:'http.request',url:'https://example.test'},
  {...event,event:{...event.event,date:'2026-02-30'}},
  {...event,event:{...event.event,start:'24:30'}},
  {tool:'family.invite',target:'example',ageGroup:'adult',role:'OWNER'},
  {tool:'study.update',patch:{shares:{sleep:true}}},
  {tool:'family.update',patch:{consent:{}}},
  {tool:'calendar.update',id:'event',patch:{id:'replacement'}},
 ])('rejects unsupported or unsafe command fields: %o',operation=>expect(()=>operationList.parse([operation])).toThrow());
 it('requires administrative operations separately, rejecting mixed partial-success batches',()=>expect(()=>operationList.parse([event,{tool:'family.invite',target:'alex@example.test',ageGroup:'adult',role:'MEMBER'}])).toThrow());
 it('rejects mixing legacy suggestions with commands',()=>expect(()=>parseAnswer(JSON.stringify({answer:'Bad mixed reply',sources:[],actions:[{title:'Walk',reason:'Rest',day:0,minutes:10,participantIds:['omar'],category:'rest'}],operations:[event]}),['omar'],[])).toThrow());
 it('adds an actual dated event with the correct weekday and supports editing/deleting it',()=>{
  const original=app(),created=agentState(original,[event]);const added=created.schedule.at(-1)!;expect(added.day).toBe(4);expect(original.schedule.some(e=>e.title==='Synthetic study')).toBe(false);
  const updated=agentState(created,[{tool:'calendar.update',id:added.id,patch:{date:'2026-11-01',start:'18:00',end:'19:00'}}]);expect(updated.schedule.at(-1)!.day).toBe(6);
  expect(agentState(updated,[{tool:'calendar.delete',id:added.id}]).schedule.some(e=>e.id===added.id)).toBe(false);
 });
 it('validates all state changes before making any mutation',()=>{const original=app(),snapshot=JSON.stringify(original);expect(()=>agentState(original,[event,{tool:'calendar.update',id:'missing',patch:{title:'Missing'}}])).toThrow();expect(JSON.stringify(original)).toBe(snapshot);});
 it('rejects impossible event intervals and invented assignees',()=>{expect(()=>agentState(app(),[{...event,event:{...event.event,end:'16:00'}}])).toThrow();expect(()=>agentState(app(),[{...event,event:{...event.event,assigneeIds:['invented']}}])).toThrow();});
 it('creates tasks, reminders, private keepsakes and study preferences without changing sharing consent',()=>{
  const original=app();original.plan=null;
  const next=agentState(original,[{tool:'tasks.create',task:{title:'Study',reason:'Requested',day:4,minutes:20,participantIds:['omar'],category:'study'}},{tool:'care.create',reminder:{title:'Drink water',time:'18:00',kind:'hydration',detail:'A gentle reminder'}},{tool:'memories.create',memory:{title:'Synthetic win',message:'Completed a task',date:'2026-10-29',type:'Weekly Win',visibility:'Only me',tagIds:[]}},{tool:'study.update',patch:{goal:'Read 10 pages',bedtime:'22:00'}}]);
  expect(next.plan!.actions[0].title).toBe('Study');expect(next.care.reminders.at(-1)!.backupAgreed).toBe(false);expect(next.memories[0].visibility).toBe('Only me');expect(next.student.shares).toEqual(original.student.shares);
 });
 it('resolves exact local names but rejects ambiguity and unknown targets',()=>{const a=app(),w=workspace();w.mode='demo';expect(prepareOperations([{...event,event:{...event.event,assigneeIds:['Omar']}}],a,w)[0]).toMatchObject({event:{assigneeIds:['omar']}});a.profile!.members.push({...a.profile!.members[0],id:'other-omar'});expect(()=>prepareOperations([{...event,event:{...event.event,assigneeIds:['Omar']}}],a,w)).toThrow('ambiguous');});
 it('blocks read-only and non-owner administrative commands before any API call',()=>{expect(()=>prepareOperations([event],app(),workspace('VIEWER'))).toThrow('membership');expect(()=>prepareOperations([{tool:'family.invite',target:'alex',ageGroup:'adult',role:'MEMBER'}],app(),workspace('MEMBER'))).toThrow('owner');});
 it('never manages real invitations in the fictional sample',()=>{const w=workspace();w.mode='demo';expect(()=>prepareOperations([{tool:'family.invite',target:'alex',ageGroup:'adult',role:'MEMBER'}],app(),w)).toThrow('Sign in');});
 it('awaits persistence and reports a request, not a completed shared-calendar mutation',async()=>{const a=app();vi.mocked(a.applyAgentChanges).mockResolvedValue(true);const result=await executeOperations([event],a,workspace(),prefs);expect(result.message).toContain('must accept');expect(a.applyAgentChanges).toHaveBeenCalledOnce();});
 it('does not claim success when saving fails',async()=>{const a=app();vi.mocked(a.applyAgentChanges).mockRejectedValue(new Error('Saving failed'));await expect(executeOperations([event],a,workspace(),prefs)).rejects.toThrow('Saving failed');});
 it('does not mark stored chat as a stale proposal, but catches edits and role changes',()=>{const a=app(),w=workspace(),before=agentSnapshot(a,w);w.records.push({id:'chat',kind:'chat',version:1} as never);expect(agentSnapshot(a,w)).toBe(before);w.family!.role='VIEWER';expect(agentSnapshot(a,w)).not.toBe(before);});
 it('preserves acceptance for former assignees removed by an edit',async()=>{const before=app(),after=structuredClone(demoState());before.plan=null;after.plan=null;before.schedule=[{id:'shared',title:'Shared task',day:0,start:'10:00',end:'11:00',category:'Household Tasks',assigneeIds:['mariam'],done:false,date:'2026-10-26'}];after.schedule=[{...before.schedule[0],assigneeIds:['omar']}];expect(affectedMembers(before,after)).toEqual(expect.arrayContaining(['mariam','omar']));const w=workspace();expect(await persistChanges(before,after,w)).toBe(true);expect(w.save).toHaveBeenCalledWith('proposal',expect.any(String),expect.objectContaining({requiredUserIds:['mariam']}),expect.any(Object));expect(w.saveMany).not.toHaveBeenCalled();});
 it('keeps unapproved records out of inference while documenting capabilities',()=>{expect(contextFor([{id:'event',kind:'event',authorId:'omar',data:{title:'Not approved'},cloudAllowed:false} as never],true,'omar',['omar'])).toEqual([]);expect(systemPrompt([], 'en',{actorId:'omar',role:'OWNER'})).toContain('calendar.update');expect(systemPrompt([], 'en')).toContain('No credentials');});
});
