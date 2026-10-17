param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$RunName,
  [ValidateSet('turning','navigation','aiming','shooting','dodge','range','items','combat')][string]$Lesson='navigation',
  [int]$Steps=100000,
  [int]$Environments=4,
  [int]$MinibatchSequences=8,
  [ValidateRange(10,90)][int]$GpuUtilizationLimit=80,
  [string]$EnvironmentUrl='http://192.168.10.140:40101',
  [int]$MapId=7,
  [int]$AmmoId=2001,
  [ValidateRange(1,5)][int]$Mode=4,
  [ValidateRange(2,6)][int]$Players=2,
  [ValidateRange(1,6)][int]$Controlled=1,
  [switch]$CentralizedCritic,
  [ValidateRange(0,3)][int]$Level=1,
  [switch]$MixLevels,
  [int]$TeacherSteps=0,
  [double]$ImitationWeight,
  [string]$Curriculum='',
  [string]$OpponentPool='',
  [string]$Prior='D:/ai/cdtank/runs/motion-20261017-001/best.pt',
  [string]$Weights='',
  [string]$Resume=''
)

$ErrorActionPreference='Stop'
$root='D:/ai/cdtank'
if (Test-Path "$root/runs/$RunName") { throw 'Use a new run directory' }
$trainerRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$arguments="$PSScriptRoot/train_combat.py --environment-url $EnvironmentUrl --output $root/runs/$RunName --steps $Steps --environments $Environments --minibatch-sequences $MinibatchSequences --gpu-utilization-limit $GpuUtilizationLimit --lesson $Lesson --level $Level --map-id $MapId --ammo-id $AmmoId --mode $Mode --players $Players --controlled $Controlled"
if ($CentralizedCritic) { $arguments+=' --centralized-critic' }
if ($MixLevels) { $arguments+=' --mix-levels' }
if ($TeacherSteps) { $arguments+=" --teacher-steps $TeacherSteps" }
if ($Curriculum) { $arguments+=" --curriculum $Curriculum" }
if ($OpponentPool) { $arguments+=" --opponent-pool $OpponentPool" }
if ($PSBoundParameters.ContainsKey('ImitationWeight')) { $arguments+=" --imitation-weight $ImitationWeight" }
if ($Resume) { $arguments+=" --resume $Resume" }
elseif ($Weights) { $arguments+=" --weights $Weights" }
elseif ($Prior) { $arguments+=" --prior $Prior" }
$command="cmd.exe /d /c $root/venv/Scripts/python.exe $arguments > $root/runs/$RunName.stdout.log 2> $root/runs/$RunName.stderr.log"
# WMI creates a process outside the SSH session's terminating Windows job.
$created=Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
  CommandLine=$command
  CurrentDirectory=$trainerRoot
}
if ($created.ReturnValue -ne 0) { throw ('Training launch failed: '+$created.ReturnValue) }
@{processId=$created.ProcessId;run=$RunName;lesson=$Lesson;level=$Level;steps=$Steps;
  environments=$Environments;environmentUrl=$EnvironmentUrl;mapId=$MapId;ammoId=$AmmoId;mixLevels=[bool]$MixLevels;
  mode=$Mode;players=$Players;controlled=$Controlled;centralizedCritic=[bool]$CentralizedCritic;
  minibatchSequences=$MinibatchSequences;gpuUtilizationLimit=$GpuUtilizationLimit;
  teacherSteps=$TeacherSteps;imitationWeight=$(if($PSBoundParameters.ContainsKey('ImitationWeight')){$ImitationWeight}else{$null});
  curriculum=$Curriculum;opponentPool=$OpponentPool;
  prior=$Prior;weights=$Weights;resume=$Resume} |
  ConvertTo-Json | Set-Content -Encoding ascii "$root/runs/$RunName.launch.json"
Write-Output ('TRAINING_LAUNCH_PID='+$created.ProcessId)
