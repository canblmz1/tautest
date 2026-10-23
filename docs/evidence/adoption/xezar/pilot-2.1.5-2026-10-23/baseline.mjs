import {readFileSync as read,writeFileSync as write,existsSync} from 'node:fs';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.join(here,'project');
const git=a=>execFileSync('git',a,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const check=(v,m)=>{if(!v)throw Error(m)};
check(git(['rev-parse','HEAD'])==='00b37e6d5d0aabb3ba305004b97ecda1a1f57ee8'&&!git(['status','--porcelain','--untracked-files=no']),'Pinned clean clone required');
check(!existsSync(path.join(here,'baseline.json')),'Do not overwrite baseline');
const hashes=Object.fromEntries(['package.json','package-lock.json','vitest.config.ts','packages/xezar/vitest.config.ts','packages/xezar/vitest.mutation.config.ts','packages/xezar/vitest.setup.ts','scripts/test-local-state.mjs','packages/xezar/stryker.config.mjs','packages/xezar/src/mcp/api-reference.ts','packages/xezar/src/mcp/api-reference.test.ts'].map(f=>[f,createHash('sha256').update(read(path.join(root,f))).digest('hex')]));
const records=[];
const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
for(const label of ['baseline-1','baseline-2']){
 const output=path.join(here,label+'.tests.json'),args=[npm,'test','--','--project','server','packages/xezar/src/mcp/api-reference.test.ts','--maxWorkers=1','--no-file-parallelism','--reporter=json','--outputFile='+output];
 let stdout='',stderr='',timedOut=false;const startedAt=new Date().toISOString(),child=spawn(process.execPath,args,{cwd:root,windowsHide:true,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(()=>{timedOut=true;if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:10000});else try{process.kill(-child.pid,'SIGKILL')}catch{}},120000);
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const r=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(exitCode,signal)=>resolve({exitCode,signal}))});clearTimeout(timer);
 write(path.join(here,label+'.stdout.log'),stdout);write(path.join(here,label+'.stderr.log'),stderr);
 const tests=existsSync(output)?JSON.parse(read(output,'utf8')):null;
 records.push({label,startedAt,command:{file:process.execPath,args,cwd:root},...r,timedOut,passed:tests?.numPassedTests??null,failed:tests?.numFailedTests??null,tests:tests?.testResults?.map(f=>({file:f.name,tests:f.assertionResults.map(t=>({name:t.fullName,status:t.status}))}))});
 write(path.join(here,'baseline.json'),JSON.stringify({projectSha:git(['rev-parse','HEAD']),node:process.version,platform:process.platform,hashes,records},null,2));console.log(JSON.stringify(records.at(-1)));
 check(r.exitCode===0&&!timedOut&&tests?.numPassedTests===4&&tests?.numFailedTests===0,'Original baseline failed; do not produce mutant claims');
}
