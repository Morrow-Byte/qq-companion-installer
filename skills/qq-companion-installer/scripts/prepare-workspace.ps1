param([Parameter(Mandatory=$true)][string]$Root)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This workspace helper supports Windows only.' }
if ($Root -notmatch '^[A-Za-z]:[\\/]') { throw 'Choose an absolute local drive path.' }
$taskRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\','/')
$driveRoot = [IO.Path]::GetPathRoot($taskRoot)
if ($taskRoot.TrimEnd('\') -eq $driveRoot.TrimEnd('\')) { throw 'Use a dedicated folder, not a drive root.' }
if (-not (Test-Path -LiteralPath $driveRoot)) { throw 'The selected drive does not exist.' }
$skillRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
if ($taskRoot.Equals($skillRoot,[StringComparison]::OrdinalIgnoreCase) -or $taskRoot.StartsWith($skillRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Deployment files must be outside the shareable skill.' }
for ($probe = $taskRoot; $probe; $probe = [IO.Path]::GetDirectoryName($probe)) {
    if (Test-Path -LiteralPath (Join-Path $probe 'SKILL.md')) { throw 'Do not create deployment state inside a skill source tree.' }
    if (Test-Path -LiteralPath $probe) {
        $item = Get-Item -LiteralPath $probe -Force
        if (-not $item.PSIsContainer) { throw 'An existing path component is not a folder.' }
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Select a real directory, not a junction or symlink.' }
    }
}
$directories = @('config','config\private','runtime','logs','downloads','models','harness','harness-data','qq-bridge','NapCat','workspace','backups','desktop','media','media\audio','media\images','media\stickers','media\reference','music','cache','cache\tmp','cache\npm','cache\huggingface','cache\torch','cache\numba','cache\matplotlib','cache\pip','cache\cuda','cache\modelscope','cache\nltk')
foreach ($relative in $directories) {
    $destination = Join-Path $taskRoot $relative
    if (Test-Path -LiteralPath $destination) {
        $existing = Get-Item -LiteralPath $destination -Force
        if (-not $existing.PSIsContainer -or ($existing.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'A workspace destination is not a real folder.' }
    }
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
}
$config = Join-Path $taskRoot 'config\deployment.request.json'
if (-not (Test-Path -LiteralPath $config)) {
    $request = Get-Content -LiteralPath (Join-Path $skillRoot 'assets\deployment.example.json') -Raw -Encoding utf8 | ConvertFrom-Json
    $request.install_root = $taskRoot
    $request | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $config -Encoding utf8
}
$cacheScript = Join-Path $taskRoot 'runtime\Use-CacheEnvironment.ps1'
if (-not (Test-Path -LiteralPath $cacheScript)) {
    $variables = [ordered]@{
        TEMP='cache\tmp'; TMP='cache\tmp'; HF_HOME='cache\huggingface';
        TORCH_HOME='cache\torch'; NUMBA_CACHE_DIR='cache\numba';
        MPLCONFIGDIR='cache\matplotlib'; PIP_CACHE_DIR='cache\pip';
        CUDA_CACHE_PATH='cache\cuda'; MODELSCOPE_CACHE='cache\modelscope';
        NLTK_DATA='cache\nltk'; npm_config_cache='cache\npm'; DSH_HOME='harness-data'
    }
    $lines = @('# Dot-source from service launchers; process-scoped variables only.')
    foreach ($key in $variables.Keys) {
        $value = (Join-Path $taskRoot $variables[$key]).Replace("'","''")
        $lines += ('$env:'+$key+" = '"+$value+"'")
    }
    $lines += @("`$env:PYTHONUTF8 = '1'","`$env:PYTHONIOENCODING = 'utf-8'","`$env:HF_HUB_DISABLE_TELEMETRY = '1'")
    $lines | Set-Content -LiteralPath $cacheScript -Encoding utf8
}
$state = Join-Path $taskRoot 'runtime\deployment-state.json'
if (-not (Test-Path -LiteralPath $state)) {
    @{schema_version=1;status='workspace_prepared';modules=@{};pending=@('Collect account and model settings','Install and verify selected services')} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $state -Encoding utf8
}
Write-Output 'Workspace ready. Existing deployment configuration was preserved. No services were installed or started.'
