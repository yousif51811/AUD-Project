import {spawn} from 'node:child_process';
import pg from 'pg';
try{process.loadEnvFile('.env');}catch{}
const task=process.argv[2];const url=new URL(process.env.DATABASE_URL??'postgresql://familymind:familymind_local@127.0.0.1:5433/familymind');
if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Automated fixture tests require a local database.');
const adminUrl=new URL(url);adminUrl.pathname='/postgres';url.pathname='/familymind_test';
const env={...process.env,DATABASE_URL:url.href,DATABASE_URL_UNPOOLED:url.href,APP_URL:'http://127.0.0.1:3002',TEST_BASE_URL:process.env.TEST_BASE_URL??'http://127.0.0.1:3002',FAMILYMIND_TEST:'1',NEXT_TELEMETRY_DISABLED:'1'};
function run(file,args){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[file,...args],{stdio:'inherit',env});const stop=()=>child.kill('SIGTERM');process.once('SIGTERM',stop);process.once('SIGINT',stop);child.on('exit',code=>{process.off('SIGTERM',stop);process.off('SIGINT',stop);if(code)reject(new Error('Test command failed ('+code+').'));else resolve();});});}
if(task==='server'){
 const client=new pg.Client({connectionString:adminUrl.href});await client.connect();try{await client.query('CREATE DATABASE familymind_test');}catch(e){if(e.code!=='42P04')throw e;}finally{await client.end();}
 await run('node_modules/prisma/build/index.js',['migrate','deploy']);await run('node_modules/next/dist/bin/next',['dev','--webpack','--hostname','127.0.0.1','--port','3002']);
}else if(task==='integration')await run('node_modules/vitest/vitest.mjs',['run','--config','vitest.integration.config.ts',...process.argv.slice(3)]);
else if(task==='browser')await run('node_modules/@playwright/test/cli.js',['test',...process.argv.slice(3)]);
else throw new Error('Choose server, integration or browser.');
