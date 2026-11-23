#Requires -Version 5.1
<#
.SYNOPSIS
  Links node_modules (NTFS junctions) and copies local .env files from the primary
  seedtick worktree into a newly created git worktree so builds, tests, and hooks work immediately.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Get-NormalizedPath([string]$Path) {
    return [System.IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
}

$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$worktreeRootRaw = (& git rev-parse --show-toplevel 2>&1 | Out-String)
$wtCode = $LASTEXITCODE
$gitCommonDirRaw = (& git rev-parse --path-format=absolute --git-common-dir 2>&1 | Out-String)
$cmCode = $LASTEXITCODE
$ErrorActionPreference = $prevEap

if ($wtCode -ne 0 -or [string]::IsNullOrWhiteSpace($worktreeRootRaw)) {
    Write-Error '[worktree-setup] Not inside a git repository.'
    exit 1
}

if ($cmCode -ne 0 -or [string]::IsNullOrWhiteSpace($gitCommonDirRaw)) {
    Write-Error '[worktree-setup] Could not resolve git common directory.'
    exit 1
}

$worktreeRoot = Get-NormalizedPath $worktreeRootRaw.Trim()
$gitCommonDir = Get-NormalizedPath $gitCommonDirRaw.Trim()
$mainRoot = Get-NormalizedPath (Split-Path -Parent $gitCommonDir)

if ($worktreeRoot -ieq $mainRoot) {
    Write-Host '[worktree-setup] Running in primary worktree — nothing to link.'
    exit 0
}

Write-Host "[worktree-setup] Linking dependencies from $mainRoot -> $worktreeRoot"

# 1. Link node_modules via NTFS Junctions (instant, zero disk overhead, no admin needed)
$serviceDirs = Get-ChildItem -Path $mainRoot -Directory -ErrorAction SilentlyContinue
foreach ($dir in $serviceDirs) {
    $srcNodeModules = Join-Path $dir.FullName 'node_modules'
    $dstServiceDir = Join-Path $worktreeRoot $dir.Name
    $dstNodeModules = Join-Path $dstServiceDir 'node_modules'

    if ((Test-Path -LiteralPath $srcNodeModules) -and (Test-Path -LiteralPath $dstServiceDir) -and -not (Test-Path -LiteralPath $dstNodeModules)) {
        New-Item -ItemType Junction -Path $dstNodeModules -Target $srcNodeModules | Out-Null
        Write-Host "  + junction: $($dir.Name)/node_modules"
    }

    # 2. Copy git-ignored local .env files (.env, .env.local, .env.development.local)
    if (Test-Path -LiteralPath $dstServiceDir) {
        $envFiles = Get-ChildItem -Path $dir.FullName -File -Force -Filter '.env*' -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notmatch '\.(example|sample|template)$' }
        foreach ($envFile in $envFiles) {
            $dstEnv = Join-Path $dstServiceDir $envFile.Name
            if (-not (Test-Path -LiteralPath $dstEnv)) {
                Copy-Item -LiteralPath $envFile.FullName -Destination $dstEnv
                Write-Host "  + env copy: $($dir.Name)/$($envFile.Name)"
            }
        }
    }
}

Write-Host '[worktree-setup] Done.'
