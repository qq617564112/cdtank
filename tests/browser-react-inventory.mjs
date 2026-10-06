import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const run = new Date().toISOString().replace(/[:.]/g, '-');
const prefix = `recovery/output/react-inventory-${run}`;
await mkdir('recovery/output', {recursive:true});
const directory = await mkdtemp(join(tmpdir(),'cdtank-react-inventory-'));
let chrome, fixture;
let log = '', chromeLog = '';
const result = {status:'RUNNING',run,startedAt:new Date().toISOString()};
try {
  const main = await readFile('apps/web/src/main.ts','utf8');
  assert.equal((main.match(/\bcreateRoot\(/g)??[]).length,1);
  const file = 'apps/web/src/interface/home/home-inventory.tsx';
  const source = await readFile(file,'utf8');
  assert(!/document\.createElement\(|\.innerHTML\s*=/.test(source));
  assert(source.includes('HomeInventoryView') && source.includes('<dialog'));
  result.reactBoundary={singleRoot:'apps/web/src/main.ts',jsxView:file};
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling',
    '--disable-renderer-backgrounding','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9362',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank',
  ],{stdio:['ignore','pipe','pipe']});
  for(const stream of [chrome.stdout,chrome.stderr])stream.on('data',data=>{chromeLog+=String(data);});
  let endpoint;
  for(let attempt=0;attempt<100;attempt++){
    try {endpoint=(await(await fetch('http://127.0.0.1:9362/json/version')).json()).webSocketDebuggerUrl;break;}
    catch {await new Promise(resolve=>setTimeout(resolve,50));}
  }
  assert(endpoint,'Dedicated Chromium did not start');
  fixture=spawn(process.execPath,['--import','tsx','tests/browser-home-inventory.mjs',endpoint],{
    env:{...process.env,CDTANK_INVENTORY_OUTPUT:prefix},detached:true,stdio:['ignore','pipe','pipe'],
  });
  for(const stream of [fixture.stdout,fixture.stderr])stream.on('data',data=>{log+=String(data);process.stdout.write(data);});
  const exit=await new Promise((resolve,reject)=>{fixture.once('error',reject);fixture.once('exit',(code,signal)=>resolve({code,signal}));});
  result.exit=exit;
  assert.equal(exit.code,0,`Inventory fixture failed; see ${prefix}.log`);
  const evidence=JSON.parse(await readFile(`${prefix}.json`,'utf8'));
  assert.equal(evidence.status,'PASS');
  result.inventoryEvidence=`${prefix}.json`;
  result.status='PASS';
  result.reusedEvidence='recovery/docs/react-match-browser.md: E-R01 natural rounds and dual-page Effect11/GA15';
  console.log('PASS: React inventory real mouse/keyboard/native drag, source 1080p/4K, pending isolation, failure preservation, account/restart and first-item consumption');
} catch(error) {result.status='FAIL';result.error=String(error);throw error;}
finally {
  if(fixture?.pid){try{process.kill(-fixture.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}}
  if(chrome?.exitCode===null){const ended=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill();await ended;}
  await rm(directory,{recursive:true,force:true});
  await writeFile(`${prefix}.log`,log);
  await writeFile(`${prefix}-chrome.log`,chromeLog);
  result.finishedAt=new Date().toISOString();
  await writeFile(`${prefix}-summary.json`,JSON.stringify(result,null,2)+'\n');
  console.log(`Evidence: ${prefix}-summary.json`);
}
