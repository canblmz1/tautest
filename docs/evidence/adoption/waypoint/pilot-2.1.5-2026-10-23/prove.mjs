import {readFileSync as read, writeFileSync as write, mkdirSync, existsSync, unlinkSync} from 'node:fs';
import {spawn, spawnSync, execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
const here=path.dirname(fileURLToPath(import.meta.url)), req=createRequire(path.join(here,'tools/package.json'));
if(process.argv[2]==='--engine') {
 const {root,config}=JSON.parse(read(process.argv[3],'utf8')); process.chdir(root);
 const {Stryker}=await import(pathToFileURL(req.resolve('@stryker-mutator/core')).href);
 await new Stryker(config).runMutationTest();
} else await main();
async function main(){
 const root=path.resolve(process.argv[2]), out=path.resolve(process.argv[3]);
 const sourceFile='src/lib/shell/trip-time.ts', existing='src/lib/shell/trip-time.test.ts', candidate='src/lib/shell/tautest-timezone-trim.test.ts', configName='stryker.config.json', unitName='vitest.tautest-pilot.config.ts';
 const hash=x=>createHash('sha256').update(x).digest('hex'), git=a=>execFileSync('git',a,{cwd:root,encoding:'utf8',windowsHide:true}).trim(), check=(x,m)=>{if(!x)throw new Error(m);};
 const sourceBytes=read(path.join(root,sourceFile)), source=sourceBytes.toString('utf8');
 const baseline=JSON.parse(read(path.join(here,'baseline.json'),'utf8'));
 check(git(['rev-parse','HEAD'])==='dfbc0ce81a507c1f80f555b9ca5b2bd0e19d6c69' && !git(['status','--porcelain','--untracked-files=no']),'Use clean pinned clone');
 check(baseline.success && baseline.records.filter(r=>r.label.startsWith('baseline')).every(r=>r.passed===15),'Baseline required');
 for(const f of [candidate,configName,unitName])check(!existsSync(path.join(root,f)),`Refusing overwrite ${f}`);
 check(!existsSync(out),'Fresh output required');mkdirSync(out,{recursive:true});
 const protectedFiles=Object.keys(baseline.files), protectedHashes=Object.fromEntries(protectedFiles.map(f=>[f,hash(read(path.join(root,f)))]));
 const cli=path.join(here,'tools/node_modules/tautest/dist/index.js'),vitest=path.join(root,'node_modules/vitest/vitest.mjs');
 const env={...process.env,PUBLIC_PB_URL:'http://127.0.0.1:8090',PUBLIC_APP_URL:'http://127.0.0.1:5173',WAYPOINT_DEV_MODE:'true'};
 const steps=[];
 async function run(label,args,expected=0){
  const startedAt=new Date().toISOString();let stdout='',stderr='',timedOut=false;
  const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
  const timer=setTimeout(()=>{timedOut=true;if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});else try{process.kill(-child.pid,'SIGKILL')}catch{}},180000);
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const result=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(exitCode,signal)=>resolve({exitCode,signal}))});clearTimeout(timer);
  write(path.join(out,label+'.stdout.log'),stdout);write(path.join(out,label+'.stderr.log'),stderr);
  steps.push({label,startedAt,command:{file:process.execPath,args,cwd:root},...result,timedOut});write(path.join(out,'steps.json'),JSON.stringify(steps,null,2));console.log(JSON.stringify(steps.at(-1)));
  check(!timedOut && result.exitCode===expected,`${label} failed, inspect logs`);return stdout;
 }
 async function normal(label,withCandidate,pass,fail=0){const output=path.join(out,label+'.tests.json');await run(label,[vitest,'run','--project','server',existing,...(withCandidate?[candidate]:[]),'--maxWorkers=1','--no-file-parallelism','--reporter=json','--outputFile='+output],fail?1:0);const result=JSON.parse(read(output,'utf8'));check(result.numPassedTests===pass && result.numFailedTests===fail,label+' counts');return result;}
 const engine=req.resolve('@stryker-mutator/core'),engineReq=createRequire(engine),instrumenter=engineReq.resolve('@stryker-mutator/instrumenter');
 const {allMutators}=await import(new URL('./mutators/mutate.js',pathToFileURL(instrumenter)).href);
 const config={testRunner:'vitest',plugins:[req.resolve('@stryker-mutator/vitest-runner')],mutate:[sourceFile+':18-18'],vitest:{configFile:unitName,related:false},reporters:['json'],coverageAnalysis:'perTest',concurrency:1,incremental:false,thresholds:{high:80,low:60,break:0},logLevel:'error',inPlace:false,tempDirName:'.stryker-tmp',cleanTempDir:'always',mutator:{excludedMutations:allMutators.map(x=>x.name).filter(x=>x!=='MethodExpression')}};
 const targetOf=report=>{const active=report.files[sourceFile].mutants.filter(m=>m.status!=='Ignored');check(active.length>=1 && active.length<=3,'small active scope');const matches=active.filter(m=>m.mutatorName==='MethodExpression'&&m.replacement==='trip.timezone');check(matches.length===1,'exact trim removal');return matches[0]};
 const fingerprint=(report,m)=>({file:sourceFile,sourceSha256LF:hash(report.files[sourceFile].source.replace(/\r\n/g,'\n')),location:m.location,mutatorName:m.mutatorName,replacement:m.replacement});
 const testsFor=(r,ids)=>Object.entries(r.testFiles??{}).flatMap(([file,x])=>(x.tests??[]).filter(t=>ids?.includes(t.id)).map(t=>({file,...t})));
 const candidateBytes=Buffer.from("import { expect, it } from 'vitest';\nimport { tripTz } from './trip-time';\n\nit('preserves a valid stored timezone surrounded by whitespace', () => {\n\texpect(tripTz({ timezone: '  Europe/Madrid  ' })).toBe('Europe/Madrid');\n});\n");
 const unit=(include)=>`import original from './vite.config';\nexport default {...original,test:{...original.test,projects:[{extends:'./vite.config.ts',test:{name:'server',environment:'node',include:${JSON.stringify(include)},maxWorkers:1,fileParallelism:false}}]}};\n`;
 try{
  write(path.join(root,unitName),unit([existing]));write(path.join(root,configName),JSON.stringify(config,null,2));write(path.join(out,'effective-stryker.json'),JSON.stringify(config,null,2));write(path.join(out,'effective-vitest-before.ts'),read(path.join(root,unitName)));
  await run('engine-selection-baseline',[vitest,'run','--config',unitName,'--project','server','--maxWorkers=1','--reporter=json','--outputFile='+path.join(out,'engine-selection-baseline.tests.json')]);
  const request=path.join(out,'request.json');write(request,JSON.stringify({root,config:{...config,jsonReporter:{fileName:path.join(out,'before.raw.json')}}},null,2));
  await run('direct-before',[fileURLToPath(import.meta.url),'--engine',request]);
  const before=JSON.parse(read(path.join(out,'before.raw.json'),'utf8')),target=targetOf(before),identity=fingerprint(before,target);
  check(target.status==='Survived'&&target.testsCompleted>0&&target.coveredBy?.length,'Executed survivor required');
  check(identity.sourceSha256LF===hash(source.replace(/\r\n/g,'\n')),'Report source mismatch');
  const analysis=JSON.parse(await run('analyze',[cli,'analyze','--from',path.join(out,'before.raw.json'),'--runner','vitest','--report-dir',path.join(out,'analysis'),'--json']));
  write(path.join(root,candidate),candidateBytes);write(path.join(here,'timezone-trim.test.ts'),candidateBytes);
  await normal('candidate-original',true,16);
  const offset=p=>{let at=0;for(let i=1;i<p.line;i++)at=source.indexOf('\n',at)+1;return at+p.column-1;};
  const start=offset(target.location.start),end=offset(target.location.end);check(source.slice(start,end)==='trip.timezone?.trim()','Exact original expression mismatch');
  let failed;
  try{write(path.join(root,sourceFile),source.slice(0,start)+target.replacement+source.slice(end));await normal('manual-existing',false,15);failed=await normal('manual-candidate',true,15,1)}finally{write(path.join(root,sourceFile),sourceBytes)}
  const failures=failed.testResults.flatMap(f=>f.assertionResults.filter(t=>t.status==='failed').map(t=>({file:f.name,...t})));
  check(failures.length===1&&failures[0].fullName.includes('surrounded by whitespace')&&failures[0].failureMessages.some(m=>m.includes('AssertionError')&&m.includes('UTC')&&m.includes('Europe/Madrid')),'Behavior assertion required');write(path.join(out,'manual-mutant.json'),JSON.stringify({fingerprint:identity,failures},null,2));
  write(path.join(root,unitName),unit([existing,candidate]));write(path.join(out,'effective-vitest-after.ts'),read(path.join(root,unitName)));
  const verifications=[];for(const label of ['verify','verify-repeat']){const result=JSON.parse(await run(label,[cli,'verify','--from',path.join(out,'before.raw.json'),'--file',sourceFile,'--mutant',target.id,'--test',candidate,'--runner','vitest','--budget','120','--report-dir',path.join(out,label),'--json']));check(result.status==='verified'&&!result.execution.budgetExceeded,'verified required');const raw=JSON.parse(read(path.join(result.paths.directory,'mutation.json'),'utf8')),after=targetOf(raw);check(after.status==='Killed'&&same(fingerprint(raw,after),identity),'Exact identity/status');const killers=testsFor(raw,after.killedBy);check(killers.some(t=>t.file===candidate&&t.name.includes('surrounded by whitespace')),'Candidate kill required');write(path.join(out,label+'.raw.json'),JSON.stringify(raw,null,2));verifications.push({label,result,target:after,killers});}
  const runnerReq=createRequire(req.resolve('@stryker-mutator/vitest-runner'));
  write(path.join(out,'evidence.json'),JSON.stringify({checkedAt:new Date().toISOString(),project:'toxroxmysox/Waypoint',projectSha:git(['rev-parse','HEAD']),node:process.version,platform:process.platform,versions:Object.fromEntries(['tautest','@tautest/core','@stryker-mutator/core','@stryker-mutator/vitest-runner','vitest','vite','typescript'].map(n=>[n,JSON.parse(read(path.join(here,'tools/node_modules',n,'package.json'),'utf8')).version])),runnerVitest:runnerReq.resolve('vitest/package.json'),baseline,protectedHashes,fingerprint:identity,before:target,coveredBy:testsFor(before,target.coveredBy),analysis:{rawSummary:analysis.rawSummary,status:analysis.status},candidate:{file:candidate,sha256:hash(candidateBytes)},verifications,independentTrial:false,benefitConfirmedByMaintainer:false,repeatUse:false,limits:['Maintainer-authored Stryker engine; Tautest contributes imported report review and exact mutant verify.','One line, MethodExpression-only, not full suite or project score.','Our controlled checkout, no independent adoption.','No speed comparison, app server, PocketBase or E2E.','New test demonstrates existing trim contract; issue551 scope must be checked before outreach.']},null,2));
 }finally{
  write(path.join(root,sourceFile),sourceBytes);for(const f of [candidate,unitName,configName])if(existsSync(path.join(root,f)))unlinkSync(path.join(root,f));
  const unchanged=Object.fromEntries(protectedFiles.map(f=>[f,hash(read(path.join(root,f)))===protectedHashes[f]]));write(path.join(out,'cleanup.json'),JSON.stringify({unchanged,trackedStatus:git(['status','--porcelain','--untracked-files=no'])},null,2));check(Object.values(unchanged).every(Boolean),'Protected file changed');
 }
}
