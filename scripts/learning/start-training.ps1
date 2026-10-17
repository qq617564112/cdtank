param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$RunName,
  [ValidateSet('turning','navigation','aiming','shooting','dodge','range','items','combat')][string]$Lesson='navigation',
  [int]$Steps=100000,
  [int]$Environments=4,
  [int]$MinibatchSequences=8,
  [double]$LearningRate=0.00025,
  [ValidateSet(0,64,128,256)][int]$HiddenSize=0,
  [ValidateRange(10,90)][int]$GpuUtilizationLimit=80,
  [string]$EnvironmentUrl='http://192.168.10.140:40106',
  [int]$MapId=7,
  [int]$TankId=1,
  [int]$AmmoId=2001,
  [ValidateRange(1,5)][int]$Mode=4,
  [ValidateRange(2,6)][int]$Players=2,
  [ValidateRange(1,6)][int]$Controlled=1,
  [switch]$CentralizedCritic,
  [ValidateRange(0,3)][int]$Level=1,
  [switch]$MixLevels,
  [int]$TeacherSteps=0,
  [ValidateSet('primitive','cpu')][string]$TeacherSource='primitive',
  [int]$TeacherReplaySequences=4096,
  [int]$TeacherBatchSequences=256,
  [int]$TeacherEpochs=2,
  [double]$ImitationWeight,
  [string]$Curriculum='',
  [string]$Rehearsal='',
  [double]$RehearsalWeight=3,
  [int]$RehearsalBatchSequences=32,
  [string]$RehearsalReferences='',
  [double]$RehearsalReferenceWeight=10,
  [string]$OpponentPool='',
  [string]$Prior='D:/ai/cdtank/runs/motion-20261017-001/best.pt',
  [string]$Weights='',
  [string]$Resume=''
)

$ErrorActionPreference='Stop'
$root='D:/ai/cdtank'
if (Test-Path "$root/runs/$RunName") { throw 'Use a new run directory' }
$trainerRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$arguments="$PSScriptRoot/train_combat.py --environment-url $EnvironmentUrl --output $root/runs/$RunName --steps $Steps --environments $Environments --minibatch-sequences $MinibatchSequences --learning-rate $LearningRate --gpu-utilization-limit $GpuUtilizationLimit --lesson $Lesson --level $Level --map-id $MapId --tank-id $TankId --ammo-id $AmmoId --mode $Mode --players $Players --controlled $Controlled"
if ($CentralizedCritic) { $arguments+=' --centralized-critic' }
if ($HiddenSize) { $arguments+=" --hidden-size $HiddenSize" }
if ($MixLevels) { $arguments+=' --mix-levels' }
if ($TeacherSteps) { $arguments+=" --teacher-steps $TeacherSteps" }
$arguments+=" --teacher-source $TeacherSource"
$arguments+=" --teacher-replay-sequences $TeacherReplaySequences --teacher-batch-sequences $TeacherBatchSequences --teacher-epochs $TeacherEpochs"
if ($Curriculum) { $arguments+=" --curriculum $Curriculum" }
if ($Rehearsal) { $arguments+=" --rehearsal $Rehearsal --rehearsal-weight $RehearsalWeight --rehearsal-batch-sequences $RehearsalBatchSequences" }
if ($RehearsalReferences) { $arguments+=" --rehearsal-references $RehearsalReferences" }
if ($Rehearsal) { $arguments+=" --rehearsal-reference-weight $RehearsalReferenceWeight" }
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
  environments=$Environments;environmentUrl=$EnvironmentUrl;mapId=$MapId;tankId=$TankId;ammoId=$AmmoId;mixLevels=[bool]$MixLevels;
  mode=$Mode;players=$Players;controlled=$Controlled;centralizedCritic=[bool]$CentralizedCritic;
  minibatchSequences=$MinibatchSequences;learningRate=$LearningRate;gpuUtilizationLimit=$GpuUtilizationLimit;
  hiddenSize=$HiddenSize;
  teacherSteps=$TeacherSteps;imitationWeight=$(if($PSBoundParameters.ContainsKey('ImitationWeight')){$ImitationWeight}else{$null});
  teacherSource=$TeacherSource;
  teacherReplaySequences=$TeacherReplaySequences;teacherBatchSequences=$TeacherBatchSequences;teacherEpochs=$TeacherEpochs;
  curriculum=$Curriculum;opponentPool=$OpponentPool;
  rehearsal=$Rehearsal;rehearsalWeight=$RehearsalWeight;rehearsalBatchSequences=$RehearsalBatchSequences;
  rehearsalReferences=$RehearsalReferences;rehearsalReferenceWeight=$RehearsalReferenceWeight;
  prior=$Prior;weights=$Weights;resume=$Resume} |
  ConvertTo-Json | Set-Content -Encoding ascii "$root/runs/$RunName.launch.json"
Write-Output ('TRAINING_LAUNCH_PID='+$created.ProcessId)
