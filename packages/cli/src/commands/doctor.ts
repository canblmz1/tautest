import { formatDoctorReport, runDoctor } from '../lib/doctor';

export interface DoctorOptions {
  json?: boolean;
}

export function runDoctorCommand(cwd: string, options: DoctorOptions): { output: string; hasErrors: boolean } {
  const report = runDoctor(cwd);

  return {
    output: options.json ? `${JSON.stringify(report, null, 2)}\n` : formatDoctorReport(report),
    hasErrors: report.errors.length > 0
  };
}

