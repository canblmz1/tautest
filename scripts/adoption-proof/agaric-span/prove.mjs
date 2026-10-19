import {readFileSync,writeFileSync,mkdirSync,existsSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {createHash} from 'node:crypto';

const meta=JSON.parse(readFileSync('.tautest/agaric-span-workspace.json','utf8'));
const out=path.resolve('proof-out/agaric-span');mkdirSync(out,{recursive:true});
const src=path.join(meta.root,meta.sourcePath),original=readFileSync(src,'utf8');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(hash(original)!==meta.sourceHash)throw new Error('Unexpected fixture source');
const originalTest=readFileSync(path.join(meta.root,meta.testPath));
const candidate=path.join(meta.root,'src/lib/search-query/__tests__/tautest-unclosed-span.test.ts');
if(existsSync(candidate))throw new Error('Refusing to overwrite an existing candidate');
const test=readFileSync(new URL('./candidate.test.ts',import.meta.url),'utf8');
function offset(pos){const lines=original.split('\n');return lines.slice(0,pos.line-1).reduce((n,l)=>n+l.length+1,0)+pos.column-1;}
const start=offset(meta.mutant.location.start),end=offset(meta.mutant.location.end);
if(original.slice(start,end)!=='[start, i]')throw new Error('Not the exact reported expression');
const mutated=original.slice(0,start)+meta.mutant.replacement+original.slice(end);
const results=[];
function run(label){
  const json=path.join(out,label+'.json');
  const r=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','--reporter=json',`--outputFile=${json}`],{cwd:meta.root,encoding:'utf8',timeout:60000,maxBuffer:2e6});
  writeFileSync(path.join(out,label+'.stdout.txt'),r.stdout||'');writeFileSync(path.join(out,label+'.stderr.txt'),r.stderr||'');
  if(r.error)throw r.error;
  const report=JSON.parse(readFileSync(json,'utf8'));
  const record={label,exitCode:r.status,passed:report.numPassedTests,failed:report.numFailedTests,failedTests:report.testResults.flatMap(f=>f.assertionResults.filter(t=>t.status==='failed').map(t=>t.fullName))};
  results.push(record);console.log(JSON.stringify(record));return record;
}
try{
  const baseline=run('original-existing-tests');if(baseline.exitCode!==0||!baseline.passed)throw new Error('Invalid baseline');
  writeFileSync(src,mutated);
  const negative=run('reported-mutant-existing-tests');if(negative.exitCode!==0||negative.passed!==baseline.passed)throw new Error('Survivor not reproduced');
  writeFileSync(candidate,test);
  const red=run('reported-mutant-with-candidate');if(red.exitCode!==1||red.failed!==1||red.failedTests[0]!=='preserves the UTF-16 span of a word with an unclosed embedded quote')throw new Error('Unexpected candidate failure');
  const failure=JSON.parse(readFileSync(path.join(out,'reported-mutant-with-candidate.json'),'utf8')).testResults.flatMap(f=>f.assertionResults).find(t=>t.status==='failed');
  if(!failure.failureMessages.some(message=>message.includes('AssertionError')&&message.includes('match object')))throw new Error('Candidate failed without the expected assertion');
  writeFileSync(src,original);
  const green=run('original-with-candidate');if(green.exitCode!==0||green.passed!==baseline.passed+1)throw new Error('Candidate does not pass unchanged source');
}finally{
  writeFileSync(src,original);
  if(existsSync(candidate))unlinkSync(candidate);
}
if(hash(readFileSync(src))!==meta.sourceHash||!originalTest.equals(readFileSync(path.join(meta.root,meta.testPath))))throw new Error('Original fixture source/tests changed');
const evidence={checkedAt:new Date().toISOString(),repo:'jfolcini/agaric',head:meta.head,sourcePath:meta.sourcePath,sourceHash:meta.sourceHash,testHash:hash(originalTest),sourceRestored:true,mutant:meta.mutant,reportRun:meta.reportRun,reportSha256:meta.reportSha256,results,scope:'Isolated pure tokenizer fixture with unchanged upstream tokenizer and test file, Vitest 5.0.3, minimal alias-only configuration. Applied the exact reported replacement by line AND column, ran tests, and restored source in finally. This is not a Stryker campaign, a Tautest verify result, a full project check, or external adoption.',externalAdoption:false};
writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
