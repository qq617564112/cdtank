param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$RunName,
  [ValidateSet('navigation','shooting','dodge','combat')][string]$Lesson='navigation',
  [int]$Steps=100000,
  [int]$Environments=4,
  [ValidateRange(0,3)][int]$Level=1,
  [string]$Prior='D:/ai/cdtank/runs/motion-20261017-001/best.pt',
  [string]$Weights='',
  [string]$Resume=''
)

$ErrorActionPreference='Stop'
$root='D:/ai/cdtank'
if (Test-Path "$root/runs/$RunName") { throw 'Use a new run directory' }
$arguments="$root/game/scripts/learning/train_combat.py --game $root/game --node $root/tools/node/node.exe --output $root/runs/$RunName --steps $Steps --environments $Environments --lesson $Lesson --level $Level"
if ($Resume) { $arguments+=" --resume $Resume" }
elseif ($Weights) { $arguments+=" --weights $Weights" }
elseif ($Prior) { $arguments+=" --prior $Prior" }
$command="cmd.exe /d /c $root/venv/Scripts/python.exe $arguments > $root/runs/$RunName.stdout.log 2> $root/runs/$RunName.stderr.log"
# WMI creates a process outside the SSH session's terminating Windows job.
$created=Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
  CommandLine=$command
  CurrentDirectory="$root/game"
}
if ($created.ReturnValue -ne 0) { throw ('Training launch failed: '+$created.ReturnValue) }
@{processId=$created.ProcessId;run=$RunName;lesson=$Lesson;level=$Level;steps=$Steps;
  environments=$Environments;prior=$Prior;weights=$Weights;resume=$Resume} |
  ConvertTo-Json | Set-Content -Encoding ascii "$root/runs/$RunName.launch.json"
Write-Output ('TRAINING_LAUNCH_PID='+$created.ProcessId)
