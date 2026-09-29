#!/usr/bin/env bash
# Alternating Tautest / direct Stryker runs with the same effective Stryker options.
#   LABEL=c7 CONCURRENCY=7 TIMEOUT_MS=5000 ROUNDS=3 bash mutate-runs.sh
# Keeps every raw mutation report under runs/<LABEL>/.
set -uo pipefail
: "${BASE:?}" "${LABEL:?}" "${CONCURRENCY:?}" "${TIMEOUT_MS:=5000}" "${ROUNDS:=3}"
cd /work/repo
out="runs/$LABEL"; mkdir -p "$out"

cat > tautest.config.json <<EOF
{ "stryker": { "vitestConfigFile": "vitest.stryker-root.config.ts", "concurrency": $CONCURRENCY, "timeoutMS": $TIMEOUT_MS,
  "userConfig": { "ignorePatterns": ["website"] } } }
EOF

ms() { echo $(( ($(date +%s%N) - $1) / 1000000 )); }

run_tautest() {
  local i=$1 s; s=$(date +%s%N)
  node_modules/.bin/tautest run --base "$BASE" --json > "$out/T$i.json" 2> "$out/T$i.err"
  local e=$?; echo "T$i exit $e $(ms "$s") ms" | tee -a "$out/timings.txt"
  cp .tautest/mutation.json "$out/T$i.mutation.json" 2>/dev/null || true
}

run_direct() {
  local i=$1 s
  # Mutate ranges come from Tautest's first run; the rest mirrors Tautest's config generator.
  node -e '
    const fs = require("fs");
    const t = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    fs.writeFileSync("stryker.direct.config.json", JSON.stringify({
      allowConsoleColors: false, cleanTempDir: true, coverageAnalysis: "perTest", disableTypeChecks: true,
      dryRunTimeoutMinutes: 2, incremental: false, fileLogLevel: "off", logLevel: "error",
      mutate: t.report.scope.mutatePatterns, reporters: ["json"], jsonReporter: { fileName: process.argv[2] },
      tempDirName: ".stryker-tmp-direct", ignorePatterns: ["website", ".stryker-tmp"],
      testRunner: "vitest", thresholds: { break: 0, high: 0, low: 0 }, timeoutMS: Number(process.argv[3]),
      tsconfigFile: "tsconfig.json", packageManager: "pnpm", plugins: ["@stryker-mutator/vitest-runner"],
      vitest: { configFile: "vitest.stryker-root.config.ts", related: false }, concurrency: Number(process.argv[4])
    }, null, 2));' "$out/T1.json" "$out/D$i.mutation.json" "$TIMEOUT_MS" "$CONCURRENCY"
  s=$(date +%s%N)
  node_modules/.bin/stryker run stryker.direct.config.json > "$out/D$i.log" 2>&1
  local e=$?; echo "D$i exit $e $(ms "$s") ms" | tee -a "$out/timings.txt"
  rm -rf .stryker-tmp-direct
}

run_tautest 1
for i in $(seq 1 "$ROUNDS"); do
  if [ $((i % 2)) -eq 1 ]; then run_direct "$i"; [ "$i" -gt 1 ] && run_tautest "$i"; else run_tautest "$i"; run_direct "$i"; fi
done
cp stryker.direct.config.json "$out/"; cp tautest.config.json "$out/"
