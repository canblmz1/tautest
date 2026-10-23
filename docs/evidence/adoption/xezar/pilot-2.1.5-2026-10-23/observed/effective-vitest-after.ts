import original from './vitest.mutation.config.ts';
export default {...original,test:{...original.test,include:["src/mcp/api-reference.test.ts","src/mcp/tautest-refusal-only.test.ts"],maxWorkers:1,fileParallelism:false}};
