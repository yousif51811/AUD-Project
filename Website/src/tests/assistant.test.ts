import {describe,it,expect} from 'vitest';
import {parseAnswer,exactAnswer,contextFor} from '@/lib/model/assistant';
import {demoState} from '@/state/store';
import type {WorkspaceRecord} from '@/shared/contracts';
const valid={answer:'Try a short family walk.',sources:['event-1'],actions:[{title:'Take a walk',reason:'A shared break',day:0,minutes:10,participantIds:['a'],category:'connection'}]};
describe('assistant confirmation and context boundaries',()=>{
 for(const [name,patch] of [
 ['invented member',{actions:[{...valid.actions[0],participantIds:['unknown']}]}],
 ['invented source',{sources:['private-unseen-record']}],
 ['invalid day',{actions:[{...valid.actions[0],day:7}]}],
 ['negative duration',{actions:[{...valid.actions[0],minutes:-1}]}],
 ['oversized duration',{actions:[{...valid.actions[0],minutes:121}]}],
 ['empty participants',{actions:[{...valid.actions[0],participantIds:[]}]}],
 ['empty title',{actions:[{...valid.actions[0],title:''}]}],
 ['unknown command',{execute:'delete-family'}],
 ['too many actions',{actions:Array.from({length:4},()=>valid.actions[0])}],
 ['invalid category',{actions:[{...valid.actions[0],category:'diagnosis'}]}],
 ] as const)it(`rejects ${name}`,()=>{expect(()=>parseAnswer(JSON.stringify({...valid,...patch}),['a'],['event-1'])).toThrow();});
 it('accepts a bounded, grounded proposal without executing it',()=>{expect(parseAnswer(JSON.stringify(valid),['a'],['event-1']).actions).toHaveLength(1);});
 it('rejects invalid JSON',()=>expect(()=>parseAnswer('not json',['a'],[])).toThrow());
 it('accepts answers without mutations',()=>expect(parseAnswer('{"answer":"No active status is shared.","sources":[],"actions":[]}',[],[]).actions).toEqual([]));
 it('excludes credentials and private chat from AI context',()=>{const records=['cloud','chat','draft','notification','proposal','import'].map(kind=>({id:kind,kind,data:{secret:'secret'},cloudAllowed:true})) as unknown as WorkspaceRecord[];expect(contextFor(records,false)).toEqual([]);});
 it('excludes records without author cloud approval',()=>{const record={id:'event',kind:'event',data:{title:'A task'},cloudAllowed:false} as unknown as WorkspaceRecord;expect(contextFor([record],true)).toEqual([]);expect(contextFor([record],false)).toHaveLength(1);});
 it('uses recorded assignments for responsibility questions',()=>{const state=demoState();expect(exactAnswer("Who's responsible?",state,[])).toContain(state.plan!.actions[0].title);});
 it('does not infer availability from calendar gaps',()=>{expect(exactAnswer("Who's free?",demoState(),[])).toContain('does not mean');});
 it('does not infer willingness to talk',()=>expect(exactAnswer("Who's open to talk?",demoState(),[])).toContain('Nobody')); 
 it('ignores expired availability',()=>{expect(exactAnswer("Who's free?",demoState(),[{kind:'availability',data:{available:true,expiresAt:'2000-01-01'},authorId:'a'} as unknown as WorkspaceRecord])).toContain('Nobody');});
 it('keeps ordinary advice as a model request',()=>expect(exactAnswer('How can we make the week easier?',demoState(),[])).toBeNull());
});

it('keeps clinical questions out of live inference',()=>expect(exactAnswer('What dosage should I take?',demoState(),[])).toContain('does not diagnose'));
it('rejects clinical model suggestions',()=>expect(()=>parseAnswer(JSON.stringify({...valid,answer:'Use this dosage for depression.'}),['a'],['event-1'])).toThrow());

it('does not turn another member’s selected-recipient information into family-wide AI context',()=>{const selected={id:'private-to-two',kind:'checkin',authorId:'other',recipientIds:['other','actor'],data:{audience:'selected',note:'Private content'},cloudAllowed:true} as unknown as WorkspaceRecord;expect(contextFor([selected],false,'actor',['actor','other','third'])).toEqual([]);expect(contextFor([selected],true,'actor',['actor','other','third'])).toEqual([]);});
