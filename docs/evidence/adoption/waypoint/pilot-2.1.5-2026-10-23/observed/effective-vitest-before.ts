import original from './vite.config';
export default {...original,test:{...original.test,projects:[{extends:'./vite.config.ts',test:{name:'server',environment:'node',include:["src/lib/shell/trip-time.test.ts"],maxWorkers:1,fileParallelism:false}}]}};
