// Per-mutant comparison across raw Stryker JSON reports: identity, status, testsCompleted,
// coveredBy and killedBy. Usage: node compare-runs.mjs runs/c7/T1.mutation.json runs/c7/D1.mutation.json ...
import { readFileSync } from 'node:fs';
import path from 'node:path';

const files = process.argv.slice(2);
const runs = files.map((file) => {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  const testName = Object.fromEntries(
    Object.values(report.testFiles ?? {}).flatMap(({ tests }) => tests.map((t) => [t.id, t.name]))
  );
  const mutants = new Map();
  for (const [file, { mutants: list }] of Object.entries(report.files)) {
    for (const m of list) {
      const { start, end } = m.location;
      const id = `${file.replace(/.*packages\//, '')}:${start.line}:${start.column}-${end.line}:${end.column} ${m.mutatorName} -> ${JSON.stringify(m.replacement ?? '')}`;
      mutants.set(id, {
        status: m.status,
        testsCompleted: m.testsCompleted,
        coveredBy: (m.coveredBy ?? []).map((t) => testName[t] ?? t).sort(),
        killedBy: (m.killedBy ?? []).map((t) => testName[t] ?? t)
      });
    }
  }
  return { label: path.basename(file).replace('.mutation.json', ''), mutants };
});

const tally = (m) => [...m.values()].reduce((acc, { status }) => ((acc[status] = (acc[status] ?? 0) + 1), acc), {});
for (const run of runs) console.log(`${run.label.padEnd(4)} ${run.mutants.size} mutants ${JSON.stringify(tally(run.mutants))}`);

const ids = new Set(runs.flatMap((r) => [...r.mutants.keys()]));
const sameIdentities = runs.every((r) => r.mutants.size === ids.size);
console.log(`identities: ${ids.size} distinct, ${sameIdentities ? 'identical in every run' : 'DIFFER between runs'}`);

const drifting = [...ids].filter((id) => new Set(runs.map((r) => r.mutants.get(id)?.status ?? 'missing')).size > 1);
console.log(`mutants whose status differs between runs: ${drifting.length}`);
const coverageChanged = [...ids].filter((id) => new Set(runs.map((r) => JSON.stringify(r.mutants.get(id)?.coveredBy ?? null))).size > 1);
console.log(`mutants whose covering-test set differs between runs: ${coverageChanged.length}`);

for (const id of drifting) {
  console.log(`\n${id}`);
  for (const run of runs) {
    const m = run.mutants.get(id);
    console.log(`  ${run.label.padEnd(4)} ${String(m?.status).padEnd(10)} testsCompleted=${m?.testsCompleted ?? '-'} covering=${m?.coveredBy.length ?? '-'}${m?.killedBy.length ? ` killedBy=${JSON.stringify(m.killedBy)}` : ''}`);
  }
  const covering = runs[0].mutants.get(id)?.coveredBy ?? [];
  console.log(`  covering tests (run 1): ${JSON.stringify(covering)}`);
}
