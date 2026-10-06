import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';

const run=new Date().toISOString().replace(/[:.]/g,'-');
const prefix=`recovery/output/react-settings-${run}`;
const only=process.argv.find(value=>value.startsWith('--only='))?.slice(7);
const summary={status:'RUNNING',run,selectedFixture:only??'all',scope:'E-R04-S: real React settings, native input, ordinary server room and live original audio; existing natural two-round/dual-item account evidence reused.',fixtures:[]};
let log='';
try {
  const main=await readFile('apps/web/src/main.ts','utf8');
  assert.equal((main.match(/\bcreateRoot\(/g)??[]).length,1);
  const views=['key-settings','quick-chat-settings','volume-settings'].map(name=>`apps/web/src/interface/settings/${name}.tsx`);
  for(const file of views){
    const source=await readFile(file,'utf8');
    assert(!/document\.createElement\(|\.innerHTML\s*=/.test(source),`${file}: JSX must own UI`);
    assert(!/\bcreateRoot\(/.test(source),`${file}: must use application root`);
  }
  summary.reactBoundary={singleRoot:'apps/web/src/main.ts',views};
  for(const [name,file,env] of [
    ['keys','tests/browser-key-settings.mjs','CDTANK_KEY_SETTINGS_OUTPUT'],
    ['secondary','tests/browser-secondary-keys.mjs','CDTANK_SECONDARY_KEYS_OUTPUT'],
    ['quick','tests/browser-quick-chat.mjs','CDTANK_QUICK_CHAT_OUTPUT'],
    ['volume','tests/browser-volume-settings.mjs','CDTANK_VOLUME_SETTINGS_OUTPUT'],
  ]){
    if(only&&only!==name)continue;
    const output=`${prefix}-${name}`;
    const child=spawn(process.execPath,['--import','tsx',file],{env:{...process.env,[env]:output},stdio:['ignore','pipe','pipe']});
    for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{log+=String(data);process.stdout.write(data);});
    const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
    summary.fixtures.push({name,file,exit,evidence:`${output}.json`});
    assert.equal(exit.code,0,`${name}: ${output}.json`);
    assert.equal(JSON.parse(await readFile(`${output}.json`,'utf8')).status,'PASS');
  }
  summary.status='PASS';
  console.log('PASS: React settings real-player acceptance '+(only??'all'));
} catch(error){summary.status='FAIL';summary.error=String(error);throw error;}
finally {
  await writeFile(`${prefix}.log`,log);
  summary.finishedAt=new Date().toISOString();await writeFile(`${prefix}-summary.json`,JSON.stringify(summary,null,2)+'\n');
  console.log(`Evidence: ${prefix}-summary.json`);
}
