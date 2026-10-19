import {readFileSync,writeFileSync,mkdirSync,existsSync,unlinkSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root=path.resolve(process.argv[2]);
const cli=path.resolve(process.argv[3]);
const out=path.resolve(process.argv[4]||'proof-out/vimsplain');mkdirSync(out,{recursive:true});
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(head!=='e65d98ca48f6432779b6bf2cb677d1a9116400d8')throw new Error('Unexpected fixture revision');
const {runStryker}=await import(new URL('../../@tautest/core/dist/index.js',pathToFileURL(cli)).href);
const originalConfig=JSON.parse(readFileSync(path.join(root,'stryker.config.json'),'utf8'));
const originalFiles=execFileSync('git',['ls-files','src','tests','stryker.config.json','vitest.config.ts','tsconfig.json','package.json'],{cwd:root,encoding:'utf8'}).trim().split('\n');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const originalHashes=Object.fromEntries(originalFiles.map(file=>[file,hash(readFileSync(path.join(root,file)))]));
const candidate='tests/tautest-ex-command.test.ts',candidatePath=path.join(root,candidate);
if(existsSync(candidatePath))throw new Error('Refusing to overwrite existing candidate');
const test=readFileSync(new URL('./ex-command-whitespace.test.ts',import.meta.url),'utf8');
const steps=[];
function run(label,args){
  const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:8e6,windowsHide:true});
  writeFileSync(path.join(out,label+'.stdout.txt'),r.stdout||'');writeFileSync(path.join(out,label+'.stderr.txt'),r.stderr||'');
  steps.push({label,exitCode:r.status,error:r.error?.message});console.log(JSON.stringify(steps.at(-1)));
  if(r.error||r.status!==0)throw new Error(`${label} failed: ${r.error?.message||r.stderr||r.stdout}`);
  return r.stdout;
}
const vitest=path.join(root,'node_modules/vitest/vitest.mjs');
const normal=(label)=>{
  const json=path.join(out,label+'.tests.json');run(label,[vitest,'run','--maxWorkers=1','--reporter=json',`--outputFile=${json}`]);
  const r=JSON.parse(readFileSync(json,'utf8'));if(!r.numPassedTests||r.numFailedTests)throw new Error('Incomplete normal suite');return r.numPassedTests;
};
// Let Stryker load its config once. Re-passing its thresholds.break=null
// triggers upstream deepMerge(null, null) before the campaign can start.
const config={configFile:'stryker.config.json',mutate:['src/handlers/command.ts'],incremental:false,concurrency:1,reporters:['json'],logLevel:'error'};
const counts=report=>Object.values(report.files).flatMap(f=>f.mutants).reduce((all,m)=>{all.total++;all[m.status]=(all[m.status]||0)+1;return all;},{total:0});
async function campaign(label){
  const json=path.join(out,label+'.mutation.json');await runStryker({cwd:root,config:{...config,jsonReporter:{fileName:json}},jsonReportPath:json});return JSON.parse(readFileSync(json,'utf8'));
}
const passedBefore=normal('normal-before');
const before=await campaign('before');
const targets=before.files['src/handlers/command.ts'].mutants.filter(m=>m.status==='Survived'&&m.mutatorName==='MethodExpression'&&['cmd','context.remaining'].includes(m.replacement));
if(targets.length!==2||targets.some(m=>!m.testsCompleted))throw new Error('Both expected executed survivors must be present');
writeFileSync(candidatePath,test);
const verification=[];
try{
  const passedAfter=normal('normal-with-candidate');if(passedAfter!==passedBefore+2)throw new Error('Unexpected candidate test count');
  for(const target of targets){
    const proof=JSON.parse(run('verify-'+target.id,[cli,'verify','--from',path.join(out,'before.mutation.json'),'--mutant',target.id,'--file','src/handlers/command.ts','--test',candidate,'--budget','120','--json']));
    if(proof.status!=='verified')throw new Error('Exact target not verified');
    const raw=JSON.parse(readFileSync(path.join(proof.paths.directory,'mutation.json'),'utf8'));
    const killers=Object.entries(raw.testFiles||{}).flatMap(([file,value])=>value.tests.filter(t=>proof.killedBy.includes(t.id)).map(t=>({file,name:t.name})));
    if(!killers.some(k=>k.file===candidate))throw new Error('No candidate-file attribution');
    verification.push({target:{originalId:target.id,location:target.location,mutatorName:target.mutatorName,replacement:target.replacement},status:proof.status,testsCompleted:proof.testsCompleted,killingTests:killers});
    writeFileSync(path.join(out,`verify-${target.id}.mutation.json`),JSON.stringify({schemaVersion:raw.schemaVersion,framework:raw.framework,files:raw.files,testFiles:raw.testFiles},null,2));
  }
  const after=await campaign('after');
  for(const file of originalFiles)if(hash(readFileSync(path.join(root,file)))!==originalHashes[file])throw new Error('Original fixture source/config/tests changed');
  const evidence={checkedAt:new Date().toISOString(),repo:'oller/vimgym',head,tautest:'2.1.2',node:process.version,scope:'Full command.ts only, original package suite plus two new ex-command tests. Not a full-package mutation score.',normal:{before:passedBefore,withCandidate:passedAfter},before:counts(before),after:counts(after),verification,originalHashes,sourceUnchanged:true,configUnchanged:true,originalTestsUnchanged:true,externalAdoption:false};
  writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}finally{if(existsSync(candidatePath))unlinkSync(candidatePath);}
