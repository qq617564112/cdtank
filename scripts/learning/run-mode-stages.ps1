param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$RunName,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$Predecessor,
  [string]$EnvironmentUrl='http://192.168.10.140:40106',
  [int]$Steps=300000,
  [int]$Environments=8,
  [int]$MinibatchSequences=64,
  [int]$TeacherSteps=80000,
  [int]$TeacherBatchSequences=256,
  [ValidateRange(10,90)][int]$GpuUtilizationLimit=75,
  [ValidateSet(64,128,256)][int]$HiddenSize=256
)
$ErrorActionPreference='Stop'
$root='D:/ai/cdtank'
$statusPath="$root/runs/$RunName.schedule.json"
$completed="$root/runs/$Predecessor/result.json"
try {
  @{state='waiting';predecessor=$Predecessor;stepsPerMode=$Steps;environments=$Environments;
    hiddenSize=$HiddenSize;
    minibatchSequences=$MinibatchSequences;gpuUtilizationLimit=$GpuUtilizationLimit;
    teacherSteps=$TeacherSteps;teacherBatchSequences=$TeacherBatchSequences;
    environmentUrl=$EnvironmentUrl;readyForGameplay=$false} |
    ConvertTo-Json | Set-Content -Encoding ascii $statusPath
  while ($true) {
    if (Test-Path $completed) {
      $result=Get-Content $completed -Raw|ConvertFrom-Json
      if ($result.evaluations.Count -gt 0) { break }
    }
    Start-Sleep -Seconds 30
  }
  $checkpoint="$root/runs/$Predecessor/latest.pt"
  @{state='running';predecessor=$Predecessor;checkpoint=$checkpoint;predecessorEvaluations=$result.evaluations;
    stepsPerMode=$Steps;environments=$Environments;environmentUrl=$EnvironmentUrl;
    hiddenSize=$HiddenSize;minibatchSequences=$MinibatchSequences;gpuUtilizationLimit=$GpuUtilizationLimit;
    teacherSteps=$TeacherSteps;teacherBatchSequences=$TeacherBatchSequences;readyForGameplay=$false} |
    ConvertTo-Json -Depth 7 | Set-Content -Encoding ascii $statusPath
  & "$root/venv/Scripts/python.exe" "$PSScriptRoot/train_modes.py" --environment-url $EnvironmentUrl --checkpoint $checkpoint --output "$root/runs/$RunName" --steps $Steps --environments $Environments --minibatch-sequences $MinibatchSequences --hidden-size $HiddenSize --gpu-utilization-limit $GpuUtilizationLimit --teacher-steps $TeacherSteps --teacher-batch-sequences $TeacherBatchSequences
  if ($LASTEXITCODE -ne 0) { throw ('Mode training failed: '+$LASTEXITCODE) }
  @{state='complete';predecessor=$Predecessor;result="$root/runs/$RunName/result.json";readyForGameplay=$false} |
    ConvertTo-Json | Set-Content -Encoding ascii $statusPath
} catch {
  @{state='failed';predecessor=$Predecessor;error=$_.Exception.Message;readyForGameplay=$false} |
    ConvertTo-Json | Set-Content -Encoding ascii $statusPath
  throw
}
