import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';

const db=new PrismaClient(), origin='http://127.0.0.1:3002';
const clientId='familymind-synthetic.apps.googleusercontent.com';
const emails:string[]=[], families:string[]=[];
let auth:typeof import('../../src/server/auth')['auth'], privateKey:KeyObject, publicJwk:Record<string,unknown>;
let tokenRequests=0;
const profiles=new Map<string,{email:string;sub:string;nonce?:string}>();
const cookies=(response:Response)=>response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
async function post(path:string,data:unknown,cookie='') {
  return auth.handler(new Request(origin+'/api/auth'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)}));
}
function syntheticEmail(prefix:string){const value=`fm-google-${prefix}-${crypto.randomUUID()}@example.test`;emails.push(value);return value;}
async function begin(data:Record<string,unknown>={},cookie='',link=false){
  const response=await post(link?'/link-social':'/sign-in/social',{provider:'google',disableRedirect:true,callbackURL:'/account',errorCallbackURL:'/sign-in?google=error',...data},cookie);
  expect(response.status,await response.clone().text()).toBe(200);
  const body=await response.json(),url=new URL(body.url);
  expect(url.origin).toBe('https://accounts.google.com');
  expect(url.searchParams.get('redirect_uri')).toBe(origin+'/api/auth/callback/google');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('scope')?.split(' ').sort()).toEqual(['email','openid','profile']);
  return {url,cookie:[cookie,cookies(response)].filter(Boolean).join('; ')};
}
async function callback(flow:Awaited<ReturnType<typeof begin>>,email:string,options:{cookie?:string;state?:string}={}){
  const code=crypto.randomUUID();profiles.set(code,{email,sub:'google-'+email,nonce:flow.url.searchParams.get('nonce')??undefined});
  return auth.handler(new Request(origin+'/api/auth/callback/google?'+new URLSearchParams({state:options.state??flow.url.searchParams.get('state')!,code}),{headers:{Cookie:options.cookie??flow.cookie}}));
}
async function invite(email:string,ageGroup='child'){
  const ownerEmail=syntheticEmail('inviter');
  const owner=await db.user.create({data:{name:'Synthetic inviter',email:ownerEmail,emailVerified:true}});
  const family=await db.family.create({data:{ownerId:owner.id,memberships:{create:{userId:owner.id,role:'OWNER',status:'ACTIVE'}}}});families.push(family.id);
  const token=randomBytes(24).toString('base64url');
  const row=await db.familyInvitation.create({data:{familyId:family.id,email,ageGroup,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+60000)}});
  return {token,row,family};
}
beforeAll(async()=>{
  vi.stubEnv('APP_URL',origin);vi.stubEnv('AUTH_SECRET','synthetic-google-auth-secret-longer-than-32-characters');vi.stubEnv('GOOGLE_CLIENT_ID',clientId);vi.stubEnv('GOOGLE_CLIENT_SECRET','synthetic-google-client-secret');vi.stubEnv('NODE_ENV','test');
  const keys=generateKeyPairSync('rsa',{modulusLength:2048});privateKey=keys.privateKey;publicJwk={...keys.publicKey.export({format:'jwk'}),kid:'familymind-synthetic-key',alg:'RS256',use:'sig'};
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const request=new Request(input,init);
    if(request.url==='https://www.googleapis.com/oauth2/v3/certs')return Response.json({keys:[publicJwk]});
    if(request.url==='https://oauth2.googleapis.com/token'){
      tokenRequests++;const body=new URLSearchParams(await request.text()),profile=profiles.get(body.get('code')??'');if(!profile)throw new Error('Unknown synthetic OAuth code');
      expect(body.get('client_secret')).toBe('synthetic-google-client-secret');expect(body.get('code_verifier')?.length).toBeGreaterThan(40);
      const now=Math.floor(Date.now()/1000),encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
      const unsigned=encode({alg:'RS256',kid:'familymind-synthetic-key'})+'.'+encode({email:profile.email,email_verified:true,name:'Synthetic Google member',sub:profile.sub,aud:clientId,iss:'https://accounts.google.com',iat:now,exp:now+300,...(profile.nonce?{nonce:profile.nonce}:{})});
      const idToken=unsigned+'.'+sign('RSA-SHA256',Buffer.from(unsigned),privateKey).toString('base64url');
      return Response.json({access_token:'SYNTHETIC_GOOGLE_ACCESS_TOKEN',token_type:'Bearer',expires_in:3600,scope:'openid email profile',id_token:idToken});
    }
    throw new Error('Unexpected external request during synthetic OAuth test');
  }));
  ({auth}=await import('../../src/server/auth'));
});
beforeEach(()=>{tokenRequests=0;profiles.clear();});
afterAll(async()=>{
  await db.family.deleteMany({where:{id:{in:families}}});
  const users=await db.user.findMany({where:{email:{in:emails}}});await db.encryptionIdentity.deleteMany({where:{userId:{in:users.map(user=>user.id)}}});
  await db.user.deleteMany({where:{email:{in:emails}}});await db.$disconnect();vi.unstubAllGlobals();vi.unstubAllEnvs();
});
describe('Google OAuth with signed synthetic provider responses',()=>{
  it('creates the selected adult age group, a session and encrypted provider tokens',async()=>{
    const email=syntheticEmail('older');const flow=await begin({requestSignUp:true,additionalData:{ageGroup:'older',relationship:'Grandparent'},scopes:['https://www.googleapis.com/auth/drive'],additionalParams:{scope:'https://www.googleapis.com/auth/calendar'}});
    const response=await callback(flow,email);expect(response.status).toBe(302);expect(response.headers.get('location')).toBe('/account');
    const user=await db.user.findUniqueOrThrow({where:{email},include:{accounts:true,sessions:true}});
    expect(user.ageGroup).toBe('older');expect(user.relationship).toBe('Grandparent');expect(user.emailVerified).toBe(true);expect(user.sessions).toHaveLength(1);expect(user.accounts[0].providerId).toBe('google');
    expect(user.accounts[0].accessToken).toBeTruthy();expect(user.accounts[0].accessToken).not.toContain('SYNTHETIC_GOOGLE_ACCESS_TOKEN');
    expect(await db.encryptionIdentity.findUnique({where:{userId:user.id}})).toBeNull();expect(await db.familyMembership.count({where:{userId:user.id}})).toBe(0);
  });
  it('does not silently register a new Google user from the sign-in tab',async()=>{
    const email=syntheticEmail('signin-only'),flow=await begin({requestSignUp:false});const response=await callback(flow,email);
    expect(response.status).toBe(302);expect(response.headers.get('location')).toContain('error=');expect(await db.user.findUnique({where:{email}})).toBeNull();
  });
  it('rejects missing child invitations and cannot bypass enrollment with a client ID token',async()=>{
    const response=await post('/sign-in/social',{provider:'google',requestSignUp:true,additionalData:{ageGroup:'child'}});expect(response.status).toBe(403);
    const idToken=await post('/sign-in/social',{provider:'google',idToken:{token:'synthetic-client-token'},requestSignUp:true,additionalData:{ageGroup:'adult'}});expect(idToken.status).not.toBe(200);expect(tokenRequests).toBe(0);
  });
  it('binds an invited child to the matching Google email without granting family access',async()=>{
    const email=syntheticEmail('child'),invitation=await invite(email);
    const flow=await begin({requestSignUp:true,additionalData:{ageGroup:'child',invitationToken:invitation.token,serverContext:{familymindEnrollment:{ageGroup:'adult'}}}});
    expect(JSON.stringify(await db.verificationToken.findMany())).not.toContain(invitation.token);
    const response=await callback(flow,email);expect(response.status).toBe(302);expect(response.headers.get('location')).toBe('/account');
    const user=await db.user.findUniqueOrThrow({where:{email}});expect(user.ageGroup).toBe('child');expect(await db.familyMembership.count({where:{userId:user.id}})).toBe(0);
    const {handle}=await import('../../src/server/api');
    const ownership=await handle(new Request(origin+'/api/familymind/families',{method:'POST',headers:{Origin:origin,Cookie:cookies(response),'Content-Type':'application/json'},body:JSON.stringify({timezone:'Asia/Dubai'})}),['families']);expect(ownership.status).toBe(403);
    expect((await db.familyInvitation.findUniqueOrThrow({where:{id:invitation.row.id}})).acceptedAt).toBeNull();
  });
  it('rechecks invited email and revocation at callback',async()=>{
    const email=syntheticEmail('invited'),other=syntheticEmail('wrong'),invitation=await invite(email);
    const flow=await begin({requestSignUp:true,additionalData:{ageGroup:'child',invitationToken:invitation.token}});
    const mismatch=await callback(flow,other);expect(mismatch.headers.get('location')).toContain('GOOGLE_INVITATION_MISMATCH');expect(await db.user.findUnique({where:{email:other}})).toBeNull();
    const second=await begin({requestSignUp:true,additionalData:{ageGroup:'child',invitationToken:invitation.token}});await db.familyInvitation.update({where:{id:invitation.row.id},data:{revokedAt:new Date()}});
    const revoked=await callback(second,email);expect(revoked.headers.get('location')).toContain('GOOGLE_INVITATION_MISMATCH');expect(await db.user.findUnique({where:{email}})).toBeNull();
  });
  it('rejects missing state cookies before exchanging a Google code',async()=>{
    const email=syntheticEmail('state'),flow=await begin({requestSignUp:true,additionalData:{ageGroup:'adult'}});
    const response=await callback(flow,email,{cookie:''});expect(response.status).toBe(302);expect(response.headers.get('location')).toContain('error=');expect(tokenRequests).toBe(0);expect(await db.user.findUnique({where:{email}})).toBeNull();
  });
  it('requires explicit linking for an existing email account and keeps its user and vault',async()=>{
    const email=syntheticEmail('link');const registered=await post('/sign-up/email',{email,name:'Synthetic existing member',password:'Synthetic-google-link-password-123',ageGroup:'adult'});expect(registered.status).toBe(200);const {user}=await registered.clone().json();
    await db.encryptionIdentity.create({data:{userId:user.id,publicKey:'synthetic-unchanged-public-key',signingKey:'synthetic-unchanged-signing-key',vault:{syntheticEncryptedBackup:'unchanged'}}});
    const automatic=await begin();const denied=await callback(automatic,email);expect(denied.headers.get('location')).toContain('account_not_linked');expect(await db.account.count({where:{userId:user.id}})).toBe(1);
    const flow=await begin({},cookies(registered),true);const linked=await callback(flow,email);expect(linked.headers.get('location')).toBe('/account');
    expect(await db.user.count({where:{email}})).toBe(1);expect(await db.account.count({where:{userId:user.id}})).toBe(2);expect((await db.encryptionIdentity.findUniqueOrThrow({where:{userId:user.id}})).vault).toEqual({syntheticEncryptedBackup:'unchanged'});
    const next=await begin();const signedIn=await callback(next,email);expect(signedIn.headers.get('location')).toBe('/account');expect(cookies(signedIn)).toContain('session_token');
  });
});
