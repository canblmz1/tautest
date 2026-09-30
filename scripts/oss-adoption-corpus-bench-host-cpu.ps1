# Samples the Windows host's CPU while the benchmark containers run, so that a row measured next to a busy
# host can be told apart from a quiet one. One line every -IntervalSeconds:
#
#   2026-09-30T09:15:03Z total=41 vm=37 other=4
#
# total is the whole host in percent, vm the WSL 2 virtual machine that runs the containers (vmmem / vmmemWSL,
# as a percent of all logical CPUs), other everything outside it. scripts/oss-adoption-corpus-bench-report.mjs
# reads this file with --host-cpu. It only reads performance counters and runs until it is stopped.
#
#   powershell -NoProfile -File scripts/oss-adoption-corpus-bench-host-cpu.ps1 -Out host-cpu.log
param(
  [string]$Out = 'host-cpu.log',
  [int]$IntervalSeconds = 30,
  [int]$SampleSeconds = 5
)

$cpus = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
$utf8 = New-Object System.Text.UTF8Encoding($false)
$fullPath = [System.IO.Path]::GetFullPath($Out)

while ($true) {
  $counters = @('\Processor Information(_Total)\% Processor Utility', '\Process(vmmem*)\% Processor Time')
  $samples = (Get-Counter -Counter $counters -SampleInterval $SampleSeconds -MaxSamples 1 -ErrorAction SilentlyContinue).CounterSamples
  $total = ($samples | Where-Object { $_.Path -like '*processor information(_total)*' } | Select-Object -First 1).CookedValue
  $vm = ($samples | Where-Object { $_.Path -like '*process(vmmem*' } | Measure-Object -Property CookedValue -Sum).Sum / $cpus
  $total = [math]::Min(100, [math]::Round([double]$total))
  $vm = [math]::Min($total, [math]::Round([double]$vm))
  $line = '{0} total={1} vm={2} other={3}' -f (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'), $total, $vm, ($total - $vm)
  [System.IO.File]::AppendAllText($fullPath, $line + "`n", $utf8)
  Start-Sleep -Seconds ([math]::Max(1, $IntervalSeconds - $SampleSeconds))
}
