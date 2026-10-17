param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$RunName,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$Predecessor,
  [string]$EnvironmentUrl='http://192.168.10.140:40104',
  [int]$Steps=300000,
  [int]$Environments=8
)
$ErrorActionPreference='Stop'
$root='D:/ai/cdtank'
$statusPath="$root/runs/$RunName.schedule.json"
$completed="$root/runs/$Predecessor/result.json"
try {
  @{state='waiting';predecessor=$Predecessor;stepsPerMode=$Steps;environments=$Environments;
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
    stepsPerMode=$Steps;environments=$Environments;environmentUrl=$EnvironmentUrl;readyForGameplay=$false} |
    ConvertTo-Json -Depth 7 | Set-Content -Encoding ascii $statusPath
  & "$root/venv/Scripts/python.exe" "$PSScriptRoot/train_modes.py" --environment-url $EnvironmentUrl --checkpoint $checkpoint --output "$root/runs/$RunName" --steps $Steps --environments $Environments --minibatch-sequences 64 --gpu-utilization-limit 80
  if ($LASTEXITCODE -ne 0) { throw ('Mode training failed: '+$LASTEXITCODE) }
  @{state='complete';predecessor=$Predecessor;result="$root/runs/$RunName/result.json";readyForGameplay=$false} |
    ConvertTo-Json | Set-Content -Encoding ascii $statusPath
} catch {
  @{state='failed';predecessor=$Predecessor;error=$_.Exception.Message;readyForGameplay=$false} |
    ConvertTo-Json | Set-Content -Encoding ascii $statusPath
  throw
}
