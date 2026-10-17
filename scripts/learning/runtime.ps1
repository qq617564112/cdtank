param([Parameter(Mandatory=$true)][string]$Archive)

$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$root='D:/ai/cdtank'
$env:TEMP="$root/cache"
$env:TMP=$env:TEMP
$env:PATH="$root/tools/node;"+$env:PATH
New-Item -ItemType Directory -Force "$root/game" | Out-Null
tar -xzf $Archive -C "$root/game"
if ($LASTEXITCODE -ne 0) { throw 'Simulation source extraction failed' }
'{"private":true,"dependencies":{"tsx":"4.20.6","mistreevous":"4.3.1"}}' | Set-Content -Encoding ascii "$root/game/package.json"
Set-Location "$root/game"
& "$root/tools/node/npm.cmd" install --cache "$root/cache/npm" --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Simulation runtime dependencies failed' }
Write-Output 'SIMULATION_RUNTIME_READY'
