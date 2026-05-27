#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';

const [reportPath, outputMode] = process.argv.slice(2);

if (!reportPath) {
  console.error('Usage: node index.mjs <path-to-report.json> [--json]');
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const diagnostics = buildDiagnostics(report);

if (outputMode === '--json') {
  console.log(JSON.stringify({ schemaVersion: report.schemaVersion, diagnostics }, null, 2));
} else {
  for (const diagnostic of diagnostics) {
    console.log(`${diagnostic.severity.toUpperCase()} ${diagnostic.file}:${diagnostic.line} ${diagnostic.message}`);
  }
}

export function buildDiagnostics(report) {
  if (report.version !== '1' || report.schemaVersion !== '1') {
    throw new Error(`Unsupported Tautest report schema: ${report.version ?? 'unknown'}/${report.schemaVersion ?? 'unknown'}`);
  }

  return (report.surviving ?? []).map((mutant) => ({
    file: normalizePath(mutant.filePath),
    line: mutant.line,
    severity: severityForStatus(mutant.status),
    code: mutant.mutatorName,
    message: mutant.insight?.missingBehavior ?? `${mutant.mutatorName} survived mutation testing.`,
    detail: mutant.insight?.suggestedTestIdea ?? '',
    source: 'tautest'
  }));
}

function severityForStatus(status) {
  if (status === 'NoCoverage') {
    return 'information';
  }

  return 'warning';
}

function normalizePath(value) {
  return value.split(path.sep).join('/');
}
