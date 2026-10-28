import {beforeAll,describe,it,expect} from 'vitest';
import {createIdentity,protectIdentity,unlockIdentity,encryptRecord,decryptRecord,type Identity} from '@/lib/vault/crypto';
import {canonical} from '@/lib/canonical';
let alice:Identity,bob:Identity,eve:Identity;
beforeAll(async()=>{alice=await createIdentity();bob=await createIdentity();eve=await createIdentity();});
const person=(userId:string,key:Identity)=>({userId,publicKey:key.publicKey,signingKey:key.signingKey});
const seal=()=>encryptRecord({id:'record-1',familyId:'family-1',kind:'checkin',version:1,authorId:'alice',senderId:'alice',editorIds:['alice'],recipients:[person('alice',alice),person('bob',bob)],payload:{data:{note:'PRIVATE TEST PHRASE'},cloudAllowed:false}},alice);
describe('encrypted record boundaries',()=>{
 it('decrypts only for named recipients',async()=>{const e=await seal();expect((await decryptRecord(e,'bob',bob,person('alice',alice))).data.note).toBe('PRIVATE TEST PHRASE');await expect(decryptRecord(e,'eve',eve,person('alice',alice))).rejects.toThrow();});
 it('does not contain readable payload text',async()=>{expect(JSON.stringify(await seal())).not.toContain('PRIVATE TEST PHRASE');});
 it('rejects ciphertext tampering',async()=>{const e=await seal();e.ciphertext='AAAA'+e.ciphertext.slice(4);await expect(decryptRecord(e,'bob',bob,person('alice',alice))).rejects.toThrow();});
 it('rejects forged sender keys',async()=>{await expect(decryptRecord(await seal(),'bob',bob,person('alice',eve))).rejects.toThrow();});
 it('binds record identity, version and audience',async()=>{for(const patch of [{familyId:'other-family'},{version:2},{editorIds:['bob']}])await expect(decryptRecord({...await seal(),...patch},'bob',bob,person('alice',alice))).rejects.toThrow();});
 it('uses a fresh key and nonce for each version',async()=>{const a=await seal(),b=await seal();expect(a.nonce).not.toBe(b.nonce);expect(a.ciphertext).not.toBe(b.ciphertext);});
 it('a removed recipient cannot decrypt a new version',async()=>{const e=await encryptRecord({id:'record-1',familyId:'family-1',kind:'checkin',version:2,authorId:'alice',senderId:'alice',editorIds:['alice'],recipients:[person('alice',alice)],payload:{data:{note:'New version'},cloudAllowed:false}},alice);await expect(decryptRecord(e,'bob',bob,person('alice',alice))).rejects.toThrow();});
 it('protects keys with independent passphrase and recovery paths',async()=>{const {vault,recoveryCode}=await protectIdentity(alice,'a separate vault passphrase');expect(JSON.stringify(vault)).not.toContain(alice.privateKey);expect((await unlockIdentity(vault,'a separate vault passphrase')).publicKey).toBe(alice.publicKey);expect((await unlockIdentity(vault,recoveryCode,true)).publicKey).toBe(alice.publicKey);await expect(unlockIdentity(vault,'incorrect passphrase')).rejects.toThrow();await expect(unlockIdentity(vault,'not-a-recovery-code',true)).rejects.toThrow();});
 it('signing serialization is stable across property insertion order',()=>{expect(canonical({b:[2,1],a:{y:2,x:1}})).toBe(canonical({a:{x:1,y:2},b:[2,1]}));});
});
