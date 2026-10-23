import original from './vitest.config';
export default {...original,test:{...original.test,include:["src/lib/active-session/roster.test.ts"],maxWorkers:1,fileParallelism:false}};
