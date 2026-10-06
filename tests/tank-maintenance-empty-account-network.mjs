import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const {WsClient}=createRequire(import.meta.url)('tsrpc');
const port=Number(process.env.TANK_MAINTENANCE_PORT);assert(Number.isInteger(port)&&port>0);
const directory=await mkdtemp(join(tmpdir(),'cdtank-maintenance-empty-'));
const output='recovery/output/tank-maintenance-empty-account-network-'+new Date().toISOString().replace(/[:.]/g,'-');
const server=spawn(process.execPath,['scripts/start-server.mjs'],{env:{...process.env,PORT:String(port),ACCOUNT_DB_PATH:join(directory,'accounts.sqlite')},stdio:['ignore','pipe','pipe']});
let log='',evidence={status:'RUNNING',port};for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>log+=String(chunk));
const client=new WsClient(serviceProto,{server:`ws://127.0.0.1:${port}`,logger:undefined});
try{
 const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(resolve=>setTimeout(resolve,20));assert(log.includes('Server started'),log);
 assert((await client.connect()).isSucc);assert((await client.callApi('Account',{})).isSucc);
 const query=await client.callApi('TankMaintenance',{operation:'QUERY'});assert(query.isSucc,JSON.stringify(query));assert.deepEqual(query.res,{tanks:[],owned:{base:[],equipment:[]}});
 const maintenance=await client.callApi('TankMaintenance',{operation:'MAINTAIN',instanceId:1,currency:0,days:1,requestId:'empty_account_reject'});assert(!maintenance.isSucc);
 const repeated=await client.callApi('TankMaintenance',{operation:'QUERY'});assert(repeated.isSucc);assert.deepEqual(repeated.res,query.res);
 evidence={status:'PASS',port,compiled:true,ordinaryAccountCreated:true,emptyQuery:query.res,maintenanceRejected:maintenance.err.message,noProfileOrWalletManufactured:true};console.log('PASS '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{await client.disconnect();if(server.exitCode===null&&server.signalCode===null){const exited=new Promise(resolve=>server.once('exit',resolve));server.kill();await exited;}await rm(directory,{recursive:true,force:true});evidence.cleanup={serverStopped:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',log);}
