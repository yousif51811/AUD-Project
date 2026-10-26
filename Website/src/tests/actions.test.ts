import { describe, expect, it } from 'vitest';
import { appendQuickAction, validateAction, EMPTY_FILTERS, filterActions } from '@/lib/actions';
import { demoState, persistState, initialState } from '@/state/store';
import type { PlanAction } from '@/types';
import type { KVStore } from '@/lib/storage';
const action: PlanAction = { id:'quick',title:'A short walk',day:0,minutes:10,participantIds:['p1'],reason:'Added by us',category:'connection',done:false,source:'user' };
describe('quick actions', () => {
  it('creates only the requested action when there is no plan', () => {
    const r=appendQuickAction(null,action); expect(r.errors).toEqual([]); expect(r.plan?.actions).toEqual([action]); expect(r.plan?.parked).toEqual([]);
  });
  it('rejects blank titles, invalid durations and invalid days', () => {
    for (const patch of [{title:' '},{minutes:0},{minutes:NaN},{minutes:121},{minutes:2.5},{day:8}]) expect(appendQuickAction(null,{...action,...patch} as PlanAction).errors.length).toBeGreaterThan(0);
  });
  it('rejects full days rather than silently moving the action', () => {
    const base={actions:[{...action,id:'one'},{...action,id:'two'}],parked:[],reduced:false,isSample:false};
    const r=appendQuickAction(base,action); expect(r.plan).toBe(base); expect(r.errors.join(' ')).toContain('another day');
  });
  it('honors daily minutes, reduced workload and parked actions', () => {
    expect(appendQuickAction(null,{...action,minutes:20},10).errors.join(' ')).toContain('daily limit');
    const base={actions:[{...action,id:'one'}],parked:[],reduced:true,isSample:false};
    expect(appendQuickAction(base,action).errors.length).toBeGreaterThan(0);
    expect(appendQuickAction({...base,actions:[],parked:[{...action,id:'paused'},{...action,id:'paused2'}]},action).errors.length).toBeGreaterThan(0);
  });
  it('allows editing an active action while another is paused', () => {
    const errors=validateAction({...action,title:'Edited'},{actions:[action],parked:[{...action,id:'paused'}],reduced:true,isSample:false});
    expect(errors).toEqual([]);
  });
  it('preserves completion and restores quick additions from storage', () => {
    const values=new Map<string,string>(); const kv: KVStore={getItem:(k)=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:(k)=>{values.delete(k);}};
    const state={...demoState(),plan:appendQuickAction(null,{...action,done:true}).plan}; persistState(state,kv);
    expect(initialState(kv).plan?.actions[0]).toMatchObject({title:action.title,done:true});
  });
});
describe('display-only plan filters', () => {
  const list=[action,{...action,id:'two',day:2 as const,category:'rest' as const,done:true,participantIds:['p2']}];
  it('combines day, participant, category and completion without changing source actions', () => {
    const copy=JSON.stringify(list);
    expect(filterActions(list,{day:2,person:'p2',category:'rest',status:'done'}).map((a)=>a.id)).toEqual(['two']);
    expect(filterActions(list,{...EMPTY_FILTERS,status:'open'})).toEqual([action]);
    expect(filterActions(list,{...EMPTY_FILTERS,person:'missing'})).toEqual([]);
    expect(filterActions(list,EMPTY_FILTERS)).toEqual(list); expect(JSON.stringify(list)).toBe(copy);
  });
});
