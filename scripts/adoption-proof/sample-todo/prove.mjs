import {readFileSync,writeFileSync,mkdirSync,copyFileSync,symlinkSync,existsSync,unlinkSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';

const upstream=path.resolve(process.argv[2]);
const cli=path.resolve(process.argv[3]);
const out=path.resolve(process.argv[4]||'proof-out/sample-todo');mkdirSync(out,{recursive:true});
const root=path.resolve('.tautest/sample-todo-fixture');
if(existsSync(root))throw new Error('Refusing to reuse an existing fixture');
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:upstream,encoding:'utf8'}).trim();
if(head!=='7fd99fa4a6fe5b4471dc2d419b968fe90cda4a7c')throw new Error('Unexpected source revision');
const files=['src/domain/todo-title.ts','tests/unit/domain/todo-title.test.ts','tests/setup.ts','vitest.config.ts','tsconfig.json','package.json'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const originalHashes={};
for(const file of files){
  const src=path.join(upstream,'typescript',file),dest=path.join(root,file);
  mkdirSync(path.dirname(dest),{recursive:true});copyFileSync(src,dest);originalHashes[file]=hash(readFileSync(src));
}
symlinkSync(path.join(upstream,'typescript/node_modules'),path.join(root,'node_modules'),process.platform==='win32'?'junction':'dir');
writeFileSync(path.join(root,'vitest.pilot.config.mts'),`import base from './vitest.config.ts';\nexport default {...base,test:{...base.test,include:['tests/unit/domain/todo-title.test.ts','tests/unit/domain/tautest-title-boundary.test.ts'],maxWorkers:1,fileParallelism:false}};\n`);
const inherited=JSON.parse(readFileSync(path.join(upstream,'typescript/stryker.config.json'),'utf8'));
writeFileSync(path.join(root,'stryker.config.json'),JSON.stringify({...inherited,mutate:['src/domain/todo-title.ts'],vitest:{configFile:'vitest.pilot.config.mts',related:false},incremental:false,concurrency:1,reporters:['json'],logLevel:'error'}));
const {runStryker}=await import(new URL('../../@tautest/core/dist/index.js',pathToFileURL(cli)).href);
const candidate='tests/unit/domain/tautest-title-boundary.test.ts';
const candidatePath=path.join(root,candidate);
function run(label,args){
  const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:8e6,windowsHide:true});
  writeFileSync(path.join(out,label+'.stdout.txt'),result.stdout||'');writeFileSync(path.join(out,label+'.stderr.txt'),result.stderr||'');
  console.log(JSON.stringify({label,exitCode:result.status}));
  if(result.error||result.status!==0)throw new Error(`${label} failed: ${result.error?.message||result.stderr||result.stdout}`);
  return result.stdout;
}
const normal=label=>{
  const json=path.join(out,label+'.tests.json');
  run(label,[path.join(root,'node_modules/vitest/vitest.mjs'),'run','--config','vitest.pilot.config.mts','--reporter=json',`--outputFile=${json}`]);
  const result=JSON.parse(readFileSync(json,'utf8'));if(!result.numPassedTests||result.numFailedTests)throw new Error('Invalid normal baseline');return result.numPassedTests;
};
const counts=report=>Object.values(report.files).flatMap(f=>f.mutants).reduce((all,m)=>{all.total++;all[m.status]=(all[m.status]||0)+1;return all;},{total:0});
async function campaign(label){
  const file=path.join(out,label+'.mutation.json');await runStryker({cwd:root,config:{configFile:'stryker.config.json',jsonReporter:{fileName:file}},jsonReportPath:file});return JSON.parse(readFileSync(file,'utf8'));
}
const beforeTests=normal('normal-before');
const before=await campaign('before');
const target=before.files['src/domain/todo-title.ts'].mutants.find(m=>m.status==='Survived'&&m.mutatorName==='EqualityOperator'&&m.replacement==='value.length >= 255');
if(!target||!target.testsCompleted)throw new Error('The expected executed boundary survivor was not reproduced');
writeFileSync(candidatePath,readFileSync(new URL('./title-boundary.test.ts',import.meta.url)));
try{
  const afterTests=normal('normal-with-candidate');if(afterTests!==beforeTests+1)throw new Error('Unexpected candidate count');
  const verification=JSON.parse(run('verify',[cli,'verify','--from',path.join(out,'before.mutation.json'),'--mutant',target.id,'--file','src/domain/todo-title.ts','--test',candidate,'--budget','120','--json']));
  if(verification.status!=='verified')throw new Error('Exact target not verified');
  const raw=JSON.parse(readFileSync(path.join(verification.paths.directory,'mutation.json'),'utf8'));
  const killers=Object.entries(raw.testFiles||{}).flatMap(([file,record])=>record.tests.filter(t=>verification.killedBy.includes(t.id)).map(t=>({file,name:t.name})));
  if(!killers.some(k=>k.file===candidate&&k.name.includes('exactly 255')))throw new Error('Expected new boundary-test attribution absent');
  const after=await campaign('after');
  for(const file of files){if(hash(readFileSync(path.join(root,file)))!==originalHashes[file]||hash(readFileSync(path.join(upstream,'typescript',file)))!==originalHashes[file])throw new Error('Original source/tests changed');}
  const evidence={checkedAt:new Date().toISOString(),repo:'thalesraymond/sample-todo-apps',head,tautest:'2.1.2',node:process.version,scope:'Isolated TodoTitle fixture copied from frozen checkout: original four unit tests and one new test. Original Vitest config/setup inherited; include narrowed to the two domain test files. Original Stryker options inherited with mutation narrowed to TodoTitle and cache disabled. Not a whole-app check or score.',normal:{before:beforeTests,withCandidate:afterTests},before:counts(before),after:counts(after),target:{id:target.id,location:target.location,mutatorName:target.mutatorName,replacement:target.replacement},verification:{status:verification.status,testsCompleted:verification.testsCompleted,killingTests:killers},originalHashes,sourceUnchanged:true,upstreamCheckoutUnchanged:true,externalAdoption:false};
  writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}finally{if(existsSync(candidatePath))unlinkSync(candidatePath);}
