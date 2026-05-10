export const EXIT_CODES = {
  ok: 0,
  thresholdFailed: 1,
  noOp: 2,
  configError: 10,
  detectionError: 11,
  strykerError: 12,
  gitError: 20
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

