import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const only=process.argv.includes('--camouflage-only')?'camouflage':process.argv.includes('--roles-only')?'roles':undefined;
const run=new Date().toISOString().replace(/[:.]/g,'-');
const prefix=`recovery/output/react-roles-${run}`;
await mkdir('recovery/output',{recursive:true});
const directory=await mkdtemp(join(tmpdir(),'cdtank-react-roles-'));
let chrome,fixture,log='',chromeLog='';
const result={status:'RUNNING',scope:only??'roles-and-camouflage',run,startedAt:new Date().toISOString(),fixtures:[]};
async function availablePort(){
  const listener=createServer();
  await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'127.0.0.1',resolve);});
  const port=listener.address().port;
  await new Promise(resolve=>listener.close(resolve));
  return port;
}
try {
  const main=await readFile('apps/web/src/main.ts','utf8');
  assert.equal((main.match(/\bcreateRoot\(/g)??[]).length,1,'Application retains one React root');
  const views=['apps/web/src/interface/home/home-roles.tsx','apps/web/src/interface/home/home-tank-texture-selection.tsx'];
  for(const file of views){
    const source=await readFile(file,'utf8');
    assert(!/document\.createElement\(|\.innerHTML\s*=/.test(source),`${file} must render JSX`);
    assert(source.includes('<dialog'),`${file} must own its dialog in JSX`);
    assert(!/\bcreateRoot\(/.test(source),`${file} must use the application React root`);
  }
  result.reactBoundary={singleRoot:'apps/web/src/main.ts',jsxViews:views};
  const port=await availablePort();result.chromePort=port;
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling',
    '--disable-renderer-backgrounding','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',`--remote-debugging-port=${port}`,
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank',
  ],{stdio:['ignore','pipe','pipe']});
  for(const stream of [chrome.stdout,chrome.stderr])stream.on('data',data=>{chromeLog+=String(data);});
  let endpoint;
  for(let attempt=0;attempt<100;attempt++){
    try {endpoint=(await(await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;break;}
    catch {await new Promise(resolve=>setTimeout(resolve,50));}
  }
  assert(endpoint,'Dedicated Chromium did not start');
  for(const [name,file,variable] of [
    ['roles','tests/browser-home-roles.mjs','CDTANK_ROLES_OUTPUT'],
    ['camouflage','tests/browser-tank-texture-selection.mjs','CDTANK_TEXTURES_OUTPUT'],
  ]){
    if(only && name!==only)continue;
    const output=`${prefix}-${name}`;
    fixture=spawn(process.execPath,['--import','tsx',file,endpoint],{env:{...process.env,[variable]:output},detached:true,stdio:['ignore','pipe','pipe']});
    for(const stream of [fixture.stdout,fixture.stderr])stream.on('data',data=>{log+=String(data);process.stdout.write(data);});
    const exit=await new Promise((resolve,reject)=>{fixture.once('error',reject);fixture.once('exit',(code,signal)=>resolve({code,signal}));});
    result.fixtures.push({name,file,exit,evidence:`${output}.json`});
    assert.equal(exit.code,0,`${name} fixture failed; see ${output}.json and ${prefix}.log`);
    const evidence=JSON.parse(await readFile(`${output}.json`,'utf8'));assert.equal(evidence.status,'PASS');
    fixture=undefined;
  }
  result.status='PASS';
  result.reusedEvidence='recovery/docs/react-match-browser.md: E-R01 two natural CPU rounds and dual-page Effect11/GA15';
  console.log(only==='camouflage'?'PASS: React camouflage real input, source 1080p/4K, payment/pending, account/restart, preview lifecycle and normal WAITING owned textures':only==='roles'?'PASS: React tank/pet real input, source 1080p/4K, pending isolation, account/restart and preview lifecycle':'PASS: React tank/pet and camouflage, real input, source 1080p/4K, pending isolation, account/restart, preview lifecycle and normal WAITING owned textures');
} catch(error){result.status='FAIL';result.error=String(error);throw error;}
finally {
  if(fixture?.pid){try{process.kill(-fixture.pid,'SIGCONT');process.kill(-fixture.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}}
  if(chrome?.exitCode===null){const ended=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill();await ended;}
  await rm(directory,{recursive:true,force:true});
  await writeFile(`${prefix}.log`,log);await writeFile(`${prefix}-chrome.log`,chromeLog);
  result.finishedAt=new Date().toISOString();await writeFile(`${prefix}-summary.json`,JSON.stringify(result,null,2)+'\n');
  console.log(`Evidence: ${prefix}-summary.json`);
}
