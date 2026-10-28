import {afterEach,expect,it,vi} from 'vitest';
import {serverAnswer} from '@/lib/model/server-client';
const input={question:'A synthetic question',language:'en' as const,facts:[],memberIds:[]};
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('sends only approved fields to the same-origin endpoint and validates its answer',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({answer:'An idea',sources:[],actions:[]}));vi.stubGlobal('fetch',fetcher);
 expect(await serverAnswer(input)).toEqual({answer:'An idea',sources:[],actions:[]});expect(fetcher).toHaveBeenCalledWith('/api/ai/answer',expect.objectContaining({credentials:'same-origin',body:JSON.stringify(input)}));
 fetcher.mockResolvedValue(Response.json({answer:'bad',actions:'invalid'}));await expect(serverAnswer(input)).rejects.toThrow();
});
it('never displays arbitrary server or proxy error text',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('PRIVATE KEY AND PROMPT',{status:429})));
 await expect(serverAnswer(input)).rejects.toThrow('request allowance');
});
it('cancels after 45 seconds and distinguishes timeout from user cancellation',async()=>{
 vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn((_url,options)=>new Promise((_resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));} )));
 const timeout=expect(serverAnswer(input)).rejects.toThrow('took too long');await vi.advanceTimersByTimeAsync(45000);await timeout;
 const controller=new AbortController();const cancelled=expect(serverAnswer(input,controller.signal)).rejects.toMatchObject({name:'AbortError'});controller.abort();await cancelled;
});
