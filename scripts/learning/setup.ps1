$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$root='D:/ai/cdtank'
New-Item -ItemType Directory -Force -Path "$root/data","$root/runs","$root/src","$root/tools","$root/cache" | Out-Null
$env:TEMP="$root/cache"
$env:TMP=$env:TEMP
$env:PIP_CACHE_DIR="$root/cache/pip"
& C:/ProgramData/miniconda3/python.exe -m venv --system-site-packages "$root/venv"
if ($LASTEXITCODE -ne 0) { throw 'Python environment creation failed' }
& "$root/venv/Scripts/python.exe" -c "import torch; assert torch.cuda.is_available(); print(torch.__version__); print(torch.cuda.get_device_name(0)); print(torch.cuda.get_device_capability(0))"
if ($LASTEXITCODE -ne 0) { throw 'The training environment requires CUDA PyTorch with sm_75 support' }
Write-Output 'TRAINING_ENVIRONMENT_READY'
