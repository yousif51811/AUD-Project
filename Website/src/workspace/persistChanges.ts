import type { AppState } from '@/state/store';
import type { Workspace } from './Workspace';
import { canonical } from '@/lib/canonical';
import { splitState } from './records';
import { proposalCalendar } from './proposals';
import { affectedMembers } from './agent-state';
import { toMin } from '@/lib/time';
/** Persist the same validated state changes used by manual and assistant controls. */
export async function persistChanges(previous:AppState,state:AppState,workspace:Workspace):Promise<boolean> {
        const actor=workspace.actorId;
        const affected=affectedMembers(previous,state).filter(id=>id!==actor&&workspace.members.some(m=>m.userId===id&&m.status==='ACTIVE'));
        if(affected.length){
          const calendar=proposalCalendar(previous.schedule,state.schedule,workspace.records,workspace.family!.id);
          await workspace.save('proposal',crypto.randomUUID(),{title:'Review a proposed plan change',beforePlan:previous.plan,afterPlan:state.plan,beforeSchedule:calendar.before,afterSchedule:calendar.after,baseVersions:Object.fromEntries(workspace.records.filter(r=>r.kind==='plan'||calendar.recordIds.includes(r.id)).map(r=>[r.id,r.version])),requiredUserIds:affected,acceptedUserIds:[],status:'pending',createdAt:new Date().toISOString(),audience:'selected'}, {recipientIds:[actor,...affected],editorIds:[actor,...affected]});
          return true;
        }
        const currentRows=splitState(state),oldRows=splitState(previous);
        const all=workspace.members.filter(m=>m.status==='ACTIVE').map(m=>m.userId);
        const adults=workspace.members.filter(m=>m.status==='ACTIVE'&&m.role!=='CHILD').map(m=>m.userId);
        const changes:import('@/workspace/Workspace').RecordChange[]=[];
        for(const row of currentRows){
          if(canonical(row.data)===canonical(oldRows.find(r=>r.id===row.id)?.data??null))continue;
          const privateSlice=['draft','student','assessment'].includes(row.kind);
          const memory=row.kind==='memory';const visibility=memory?String(row.data.visibility):'';
          const id=workspace.family!.id+':'+row.id+(privateSlice?':'+actor:'');
          const stored=workspace.records.find(r=>r.id===id);
          const audience=memory?(visibility==='Only me'?'private':visibility==='Selected members'?'selected':'family'):String(stored?.data.audience??(privateSlice?'private':'family'));
          const recipients=audience==='private'?[actor]:audience==='selected'?(memory?[actor,...(row.data.tagIds as string[]??[])]:stored?.recipientIds??[actor]):all;
          changes.push({kind:row.kind,id,data:{...row.data,audience},expectedVersion:stored?.version??0,recipientIds:recipients,editorIds:audience==='family'&&row.kind!=='memory'&&row.kind!=='profile'?all:row.kind==='profile'?(stored?.editorIds??adults):[actor]});
          if(row.kind==='student'){
            const student=state.student,summary:Record<string,unknown>={updatedAt:new Date().toISOString(),audience:Object.values(student.shares).some(Boolean)?'family':'private'};
            if(student.shares.workload)summary.workloadMinutes=state.schedule.filter(e=>e.assigneeIds.includes(actor)&&e.category==='Study').reduce((n,e)=>n+Math.max(0,toMin(e.end)-toMin(e.start)),0);
            if(student.shares.exams)summary.exams=state.schedule.filter(e=>e.assigneeIds.includes(actor)&&e.exam).map(e=>({title:e.title,date:e.date,day:e.day}));
            if(student.shares.sleep&&student.sleepLog.length)summary.sleepAverage=student.sleepLog.reduce((n,h)=>n+h,0)/student.sleepLog.length;
            if(student.shares.support)summary.supportRequest=student.supportRequest;
            changes.push({kind:'student-summary',id:workspace.family!.id+':student-summary:'+actor,data:summary,recipientIds:Object.values(student.shares).some(Boolean)?all:[actor],editorIds:[actor]});
          }
        }
        for(const row of oldRows.filter(r=>!currentRows.some(x=>x.id===r.id))){const suffix=['draft','student','assessment'].includes(row.kind)?':'+actor:'';changes.push({kind:row.kind,id:workspace.family!.id+':'+row.id+suffix,data:row.data,deleted:true});}
        await workspace.saveMany(changes);
        return false;
}
