import {describe,it,expect,afterAll} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {createIdentity,protectIdentity,encryptRecord} from '../../src/lib/vault/crypto';
const db=new PrismaClient();const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3000';const accounts:string[]=[];
async function account(label:string){const email=`fm-${label}-${crypto.randomUUID()}@example.test`;accounts.push(email);const response=await fetch(base+'/api/auth/sign-up/email',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({name:label,email,password:'Synthetic-password-only-123',ageGroup:'adult'})});expect(response.status,await response.clone().text()).toBe(200);const data=await response.json();const cookie=response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');const identity=await createIdentity();const {vault}=await protectIdentity(identity,'a separate synthetic vault passphrase');const request=async(path:string,body?:unknown)=>fetch(base+'/api/familymind/'+path,{method:body?'POST':'GET',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});expect((await request('identity',{publicKey:identity.publicKey,signingKey:identity.signingKey,vault})).status).toBe(200);return {id:data.user.id,email,identity,request,cookie};}
afterAll(async()=>{const users=await db.user.findMany({where:{email:{in:accounts}}});await db.family.deleteMany({where:{ownerId:{in:users.map(u=>u.id)}}});await db.encryptionIdentity.deleteMany({where:{userId:{in:users.map(u=>u.id)}}});await db.user.deleteMany({where:{email:{in:accounts}}});await db.$disconnect();});
describe('real auth and encrypted synchronization',()=>{
 it('isolates families and recipients, rejects stale writes, and commits batches atomically',async()=>{
  const alice=await account('alice'),bob=await account('bob'),outsider=await account('outside');
  const family=await (await alice.request('families',{timezone:'Asia/Dubai'})).json();const outsideFamily=await(await outsider.request('families',{timezone:'Asia/Dubai'})).json();
  expect((await bob.request('records?familyId='+family.id)).status).toBe(403);
  const invitation=await(await alice.request(`families/${family.id}/invite`,{email:bob.email,ageGroup:'adult'})).json();
  expect((await bob.request('join',{token:invitation.token})).status).toBe(200);expect((await bob.request('join',{token:invitation.token})).status).toBe(400);
  expect((await bob.request('records?familyId='+family.id)).status).toBe(403);
  expect((await alice.request(`families/${family.id}/members`,{userId:bob.id,operation:'approve'})).status).toBe(200);
  const make=(id:string,recipients:[typeof alice, ...typeof alice[]],version=1)=>encryptRecord({id,familyId:family.id,kind:'checkin',version,authorId:alice.id,senderId:alice.id,editorIds:[alice.id],recipients:recipients.map(x=>({userId:x.id,publicKey:x.identity.publicKey,signingKey:x.identity.signingKey})),payload:{data:{mood:3,energy:2,note:'NEVER READABLE IN DATABASE',createdAt:new Date().toISOString()},cloudAllowed:false}},alice.identity);
  const privateId=crypto.randomUUID(),sharedId=crypto.randomUUID();const privateRecord=await make(privateId,[alice]),sharedRecord=await make(sharedId,[alice,bob]);
  expect((await alice.request('records',privateRecord)).status).toBe(200);expect((await alice.request('records',sharedRecord)).status).toBe(200);
  const bobRows=await(await bob.request('records?familyId='+family.id)).json();expect(bobRows.map((r:{envelope:{id:string}})=>r.envelope.id)).toEqual([sharedId]);
  expect((await outsider.request('records?familyId='+family.id)).status).toBe(403);
  expect((await alice.request('records?familyId='+outsideFamily.id)).status).toBe(403);
  expect(JSON.stringify(await db.encryptedRecord.findMany({where:{familyId:family.id}}))).not.toContain('NEVER READABLE IN DATABASE');
  expect((await alice.request('records',await make(sharedId,[alice,bob],2))).status).toBe(200);
  expect((await alice.request('records',await make(sharedId,[alice,bob],2))).status).toBe(409);
  const newId=crypto.randomUUID();expect((await alice.request('records/batch',{records:[await make(newId,[alice]),await make(sharedId,[alice,bob],2)]})).status).toBe(409);expect(await db.encryptedRecord.findUnique({where:{id:newId}})).toBeNull();
  expect((await bob.request(`families/${family.id}/invite`,{email:'someone@example.test',ageGroup:'adult'})).status).toBe(403);
  expect((await alice.request(`families/${family.id}/members`,{userId:bob.id,operation:'remove'})).status).toBe(200);expect((await bob.request('records?familyId='+family.id)).status).toBe(403);
 },45000);
 it('requires a valid adult invitation for child registration',async()=>{const response=await fetch(base+'/api/auth/sign-up/email',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({name:'Synthetic child',email:'child-'+crypto.randomUUID()+'@example.test',password:'Synthetic-password-12345',ageGroup:'child'})});expect(response.status).toBe(403);});
});
