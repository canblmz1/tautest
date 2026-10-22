import unit from './vitest.unit.config.mts';
export default {...unit, test: {...unit.test, include: ["tests/unit/shared/value-objects.test.ts", "tests/unit/shared/value-objects/tautest-address-boundary.test.ts"], maxWorkers: 1, fileParallelism: false}};
