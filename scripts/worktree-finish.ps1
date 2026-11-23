#Requires -Version 5.1
<#
.SYNOPSIS
  Finishes work in a git worktree:
  1) Acquires a cross-worktree lock to prevent parallel merge/push races
  2) Syncs main with origin/main and rebases the worktree branch onto main
  3) Fast-forward merges the branch into main and pushes origin/main
  4) Safely unlinks node_modules junctions, removes the worktree, and deletes the merged branch
#>
[CmdletBinding()]
param(
    [switch]$NoPush,
    [switch]$KeepWorktree,
    [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = 'Stop'

function Get-NormalizedPath([string]$Path) {
    return [System.IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)][string]$RepoDir,
        [Parameter(Mandatory = $true)][string[]]$Args
    )
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $raw = & git -C $RepoDir @Args 2>&1
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEap
    }
    $text = (($raw | ForEach-Object { $_.ToString() }) -join "`n").Trim()
    return [pscustomobject]@{
        ExitCode = $code
        Output   = $text
    }
}

function Remove-JunctionsSafely([string]$RootDir) {
    if (-not (Test-Path -LiteralPath $RootDir)) { return }
    # Remove top-level and 1-level nested junctions (e.g. <service>/node_modules) without touching targets
    $candidates = @()
    $topDirs = Get-ChildItem -LiteralPath $RootDir -Directory -Force -ErrorAction SilentlyContinue
    foreach ($d in $topDirs) {
        if ($d.Name -eq '.git') { continue }
        if (($d.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            $candidates += $d.FullName
        } else {
            $subDirs = Get-ChildItem -LiteralPath $d.FullName -Directory -Force -ErrorAction SilentlyContinue
            foreach ($sd in $subDirs) {
                if (($sd.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                    $candidates += $sd.FullName
                }
            }
        }
    }
    foreach ($j in $candidates) {
        # Directory.Delete(path, false) deletes ONLY the junction point, never the target contents.
        [System.IO.Directory]::Delete($j, $false)
        Write-Host "[worktree-finish] Unlinked junction: $j"
    }
}

# ---------------------------------------------------------------------------
# 1. Validate current worktree & branch state
# ---------------------------------------------------------------------------
$topRes = Invoke-Git -RepoDir (Get-Location).Path -Args @('rev-parse', '--show-toplevel')
if ($topRes.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($topRes.Output)) {
    Write-Error '[worktree-finish] Not inside a git worktree.'
    exit 1
}

$commonRes = Invoke-Git -RepoDir $topRes.Output -Args @('rev-parse', '--path-format=absolute', '--git-common-dir')
if ($commonRes.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($commonRes.Output)) {
    Write-Error '[worktree-finish] Failed to locate git common directory.'
    exit 1
}

$worktreeRoot = Get-NormalizedPath $topRes.Output
$gitCommonDir = Get-NormalizedPath $commonRes.Output
$mainRoot = Get-NormalizedPath (Split-Path -Parent $gitCommonDir)

$branchRes = Invoke-Git -RepoDir $worktreeRoot -Args @('rev-parse', '--abbrev-ref', 'HEAD')
$branch = $branchRes.Output

if ($worktreeRoot -ieq $mainRoot) {
    Write-Error '[worktree-finish] Currently in the primary worktree. Run this script from a task worktree.'
    exit 1
}
if ($branch -eq 'main' -or $branch -eq 'HEAD' -or [string]::IsNullOrWhiteSpace($branch)) {
    Write-Error "[worktree-finish] Invalid worktree branch: '$branch'."
    exit 1
}

$wtDirty = (Invoke-Git -RepoDir $worktreeRoot -Args @('status', '--porcelain')).Output
if (-not [string]::IsNullOrWhiteSpace($wtDirty)) {
    Write-Error "[worktree-finish] Uncommitted changes exist in worktree. Commit all changes first:`n$wtDirty"
    exit 1
}

# ---------------------------------------------------------------------------
# 2. Acquire cross-worktree atomic lock (prevents concurrent main merges)
# ---------------------------------------------------------------------------
$lockDir = Join-Path $gitCommonDir 'worktree-finish.lock'
$lockAcquired = $false
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)

while (-not $lockAcquired) {
    try {
        New-Item -ItemType Directory -Path $lockDir -ErrorAction Stop | Out-Null
        Set-Content -LiteralPath (Join-Path $lockDir 'owner.txt') -Value "pid=$PID branch=$branch started=$(Get-Date -Format o)"
        $lockAcquired = $true
    } catch {
        if (Test-Path -LiteralPath $lockDir) {
            $age = (Get-Date) - (Get-Item -LiteralPath $lockDir).LastWriteTime
            if ($age.TotalMinutes -gt 5) {
                Write-Warning "[worktree-finish] Clearing stale lock (>5m old): $lockDir"
                Remove-Item -LiteralPath $lockDir -Recurse -Force -ErrorAction SilentlyContinue
                continue
            }
        }
        if ((Get-Date) -ge $deadline) {
            Write-Error "[worktree-finish] Timed out waiting for lock: $lockDir"
            exit 1
        }
        Start-Sleep -Milliseconds 500
    }
}

try {
    # -----------------------------------------------------------------------
    # 3. Verify primary main worktree is on main & has no tracked modifications
    # -----------------------------------------------------------------------
    $mainBranch = (Invoke-Git -RepoDir $mainRoot -Args @('rev-parse', '--abbrev-ref', 'HEAD')).Output
    if ($mainBranch -ne 'main') {
        Write-Error "[worktree-finish] Primary worktree ($mainRoot) is on '$mainBranch', expected 'main'."
        exit 1
    }

    $mainTrackedDirty = (Invoke-Git -RepoDir $mainRoot -Args @('status', '--porcelain', '--untracked-files=no')).Output
    if (-not [string]::IsNullOrWhiteSpace($mainTrackedDirty)) {
        Write-Error "[worktree-finish] Primary main worktree has uncommitted tracked edits. Commit or stash them before merging:`n$mainTrackedDirty"
        exit 1
    }

    # Fetch and fast-forward local main to origin/main if remote exists
    $hasOrigin = (Invoke-Git -RepoDir $mainRoot -Args @('remote', 'get-url', 'origin')).ExitCode -eq 0
    if ($hasOrigin) {
        $fetchRes = Invoke-Git -RepoDir $mainRoot -Args @('fetch', 'origin', 'main')
        if ($fetchRes.ExitCode -ne 0) {
            Write-Error "[worktree-finish] git fetch origin main failed:`n$($fetchRes.Output)"
            exit 1
        }
        $ffOriginRes = Invoke-Git -RepoDir $mainRoot -Args @('merge', '--ff-only', 'origin/main')
        if ($ffOriginRes.ExitCode -ne 0) {
            Write-Error "[worktree-finish] Local main cannot fast-forward to origin/main. Reconcile main first:`n$($ffOriginRes.Output)"
            exit 1
        }
    }

    # Check if there are actually commits to merge
    $aheadCount = (Invoke-Git -RepoDir $worktreeRoot -Args @('rev-list', '--count', "main..$branch")).Output
    if ($aheadCount -eq '0') {
        Write-Host "[worktree-finish] Branch '$branch' has no new commits ahead of main."
    } else {
        # -------------------------------------------------------------------
        # 4. Rebase worktree branch onto latest main (conflicts stay isolated)
        # -------------------------------------------------------------------
        Write-Host "[worktree-finish] Rebasing '$branch' ($aheadCount commit(s)) onto latest main..."
        $rebaseRes = Invoke-Git -RepoDir $worktreeRoot -Args @('rebase', 'main')
        if ($rebaseRes.ExitCode -ne 0) {
            Invoke-Git -RepoDir $worktreeRoot -Args @('rebase', '--abort') | Out-Null
            [Console]::Error.WriteLine("[worktree-finish] Rebase conflict with latest main (aborted cleanly). Run 'git rebase main', resolve conflicts, re-run verification checks, then re-run scripts/worktree-finish.ps1.`n$($rebaseRes.Output)")
            exit 2
        }

        $rebasedSha = (Invoke-Git -RepoDir $worktreeRoot -Args @('rev-parse', 'HEAD')).Output

        # -------------------------------------------------------------------
        # 5. Fast-forward merge into main & verify ancestry
        # -------------------------------------------------------------------
        Write-Host "[worktree-finish] Fast-forward merging '$branch' ($($rebasedSha.Substring(0,8))) into main..."
        $mergeRes = Invoke-Git -RepoDir $mainRoot -Args @('merge', '--ff-only', $branch)
        if ($mergeRes.ExitCode -ne 0) {
            Write-Error "[worktree-finish] Fast-forward merge into main failed:`n$($mergeRes.Output)"
            exit 1
        }

        $ancRes = Invoke-Git -RepoDir $mainRoot -Args @('merge-base', '--is-ancestor', $rebasedSha, 'main')
        if ($ancRes.ExitCode -ne 0) {
            Write-Error '[worktree-finish] Safety check failed: commit is not an ancestor of main. Aborting cleanup.'
            exit 1
        }

        # -------------------------------------------------------------------
        # 6. Push main to origin (triggers auto-deploy & updates base for new worktrees)
        # -------------------------------------------------------------------
        if (-not $NoPush -and $hasOrigin) {
            Write-Host '[worktree-finish] Pushing main to origin...'
            $pushRes = Invoke-Git -RepoDir $mainRoot -Args @('push', 'origin', 'main')
            if ($pushRes.ExitCode -ne 0) {
                Write-Error "[worktree-finish] git push origin main failed (worktree preserved so nothing is lost):`n$($pushRes.Output)"
                exit 1
            }
        }
    }

    # -----------------------------------------------------------------------
    # 7. Cleanup finished worktree & branch
    # -----------------------------------------------------------------------
    if (-not $KeepWorktree) {
        Set-Location -LiteralPath $mainRoot
        Remove-JunctionsSafely -RootDir $worktreeRoot

        Write-Host "[worktree-finish] Removing worktree: $worktreeRoot"
        $rmRes = Invoke-Git -RepoDir $mainRoot -Args @('worktree', 'remove', '--force', $worktreeRoot)
        if ($rmRes.ExitCode -ne 0) {
            Write-Warning "[worktree-finish] Could not fully remove worktree directory (likely held open by an active shell handle on Windows): $($rmRes.Output)"
        }

        Invoke-Git -RepoDir $mainRoot -Args @('worktree', 'prune') | Out-Null

        $delBranchRes = Invoke-Git -RepoDir $mainRoot -Args @('branch', '-d', $branch)
        if ($delBranchRes.ExitCode -eq 0) {
            Write-Host "[worktree-finish] Deleted merged branch: $branch"
        } else {
            Write-Warning "[worktree-finish] Could not delete branch '$branch' yet: $($delBranchRes.Output)"
        }

        # On Windows, the parent process invoking this script may hold a CWD handle on $worktreeRoot
        # until this command exits. Once unregistered from git worktree list, retry removing the
        # leftover folder briefly in a detached background process.
        if (Test-Path -LiteralPath $worktreeRoot) {
            $escapedWt = $worktreeRoot.Replace("'", "''")
            $cleanupCmd = "for (`$i=0; `$i -lt 10; `$i++) { Start-Sleep -Milliseconds 500; if (-not (Test-Path -LiteralPath '$escapedWt')) { break }; Remove-Item -LiteralPath '$escapedWt' -Recurse -Force -ErrorAction SilentlyContinue }"
            Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $cleanupCmd) | Out-Null
            Write-Host "[worktree-finish] Scheduled background removal for locked folder: $worktreeRoot"
        }
    }

    $finalSha = (Invoke-Git -RepoDir $mainRoot -Args @('rev-parse', '--short', 'main')).Output
    Write-Host "[worktree-finish] Complete! main is now at $finalSha."
} finally {
    if ($lockAcquired) {
        Remove-Item -LiteralPath $lockDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
