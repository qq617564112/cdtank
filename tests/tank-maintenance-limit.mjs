import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {AccountStore} from '../apps/server/src/account-store.ts';
const catalog=JSON.parse(await readFile('recovery/output/web-assets/combat-catalog.json','utf8'));
const store=new AccountStore(':memory:');
try{
 const account=store.open(),bytes=new Uint8Array(0x170);new DataView(bytes.buffer).setUint32(0x74,1000,true);
 store.replaceRoleProfile(account.accountId,{bytes,strings:['limit fixture','unchanged']});
 store.replaceRoleRecords(account.accountId,{base:[],equipment:[{name:'duration boundary fixture',fields:new Map([[0x1c,1],[0x24,3],[0x34,254*1440],[0x3c,125]])}]});
 const initial=store.tankMaintenance(account.accountId,{operation:'QUERY'},catalog);
 assert.throws(()=>store.tankMaintenance(account.accountId,{operation:'MAINTAIN',instanceId:1,days:7,currency:0,requestId:'over_limit_before'},catalog),/255天/);
 assert.deepEqual(store.tankMaintenance(account.accountId,{operation:'QUERY'},catalog),initial);
 const request={operation:'MAINTAIN',instanceId:1,days:1,currency:0,requestId:'exact_limit_day1'};
 const accepted=store.tankMaintenance(account.accountId,request,catalog);
 assert.equal(accepted.maintained.remainingMinutes,367200);assert.equal(accepted.tokens,950);
 const replay=store.tankMaintenance(account.accountId,request,catalog);assert.equal(replay.replayed,true);assert.equal(replay.tokens,950);
 assert.throws(()=>store.tankMaintenance(account.accountId,{...request,requestId:'beyond_limit_day1'},catalog),/255天/);
 const final=store.tankMaintenance(account.accountId,{operation:'QUERY'},catalog);assert.equal(final.tokens,950);assert.deepEqual(final.owned,accepted.owned);assert.deepEqual(final.profile,accepted.profile);
 await writeFile('recovery/output/tank-maintenance-limit.json',JSON.stringify({status:'PASS_ACCOUNT_TRANSACTION_LIMIT_FIXTURE',scope:'In-memory explicit duration boundary fixture, not ordinary acquisition or battle actual',acceptedMinutes:367200,tokens:950,overLimitRollback:true,replayAtCapNoCharge:true},null,2)+'\n');
 console.log('PASS exact255days, over-limit rollback and replay without debit');
}finally{store.close();}
