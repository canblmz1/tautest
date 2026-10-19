import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';

const head='d52b57959a7ed7781b4f718884200ce1e4eac35f';
const root=path.resolve('.tautest/agaric-span-fixture');
const sourcePath='src/lib/search-query/tokenize.ts';
const testPath='src/lib/search-query/__tests__/tokenize.test.ts';
const sourceHash='c5267fa41aa5f1044253fba9ac03299fe35b5287c207124ac35e99d26fb6d828';
const hashes={};
for(const file of [sourcePath,testPath,'LICENSE']){
  const response=await fetch(`https://raw.githubusercontent.com/jfolcini/agaric/${head}/${file}`,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Fixture download failed: ${file}, ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  hashes[file]=createHash('sha256').update(bytes).digest('hex');
  if(file===sourcePath&&hashes[file]!==sourceHash)throw new Error('Frozen source hash mismatch');
  mkdirSync(path.dirname(path.join(root,file)),{recursive:true});writeFileSync(path.join(root,file),bytes);
}
writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,type:'module',devDependencies:{vitest:'5.0.3'}}));
writeFileSync(path.join(root,'pnpm-workspace.yaml'),"packages:\n  - '.'\n");
writeFileSync(path.join(root,'vitest.config.mts'),`import {defineConfig} from 'vitest/config';\nimport {fileURLToPath} from 'node:url';\nexport default defineConfig({resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},test:{include:['src/lib/search-query/__tests__/*.test.ts'],maxWorkers:1,fileParallelism:false}});\n`);
const meta={root,head,sourcePath,testPath,sourceHash,hashes,mutant:{id:'63',mutatorName:'ArrayDeclaration',replacement:'[]',original:'[start, i]',status:'Survived',location:{start:{line:158,column:39},end:{line:158,column:49}}},reportRun:'https://github.com/jfolcini/agaric/actions/runs/39183149461',reportSha256:'495a662ca2f4453804e45b2bcaa7214493cb5cb6eb6442598e92a45a989e1213'};
writeFileSync('.tautest/agaric-span-workspace.json',JSON.stringify(meta,null,2));
console.log('Prepared unchanged public tokenizer/test fixture; original GPL license retained in fixture.');
