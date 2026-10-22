import unit from './vitest.unit.config.mts';
export default {...unit, test: {...unit.test, include: ["tests/unit/shared/value-objects.test.ts"], maxWorkers: 1, fileParallelism: false}};
