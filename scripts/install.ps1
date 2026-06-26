<#
.SYNOPSIS
  agentry installer (Windows).

.DESCRIPTION
  Copies generated agentry content from this repo into your AI harness's
  expected location. Run `npm run sync` first to produce the generated files.
  Never edit the generated directories directly — they are wiped by the next sync.

.EXAMPLE
  .\scripts\install.ps1 -Target claude
  .\scripts\install.ps1 -Target claude -Project
  .\scripts\install.ps1 -Target cursor
  .\scripts\install.ps1 -Target codex
  .\scripts\install.ps1 -Target codex -Project
  .\scripts\install.ps1 -Target opencode
  .\scripts\install.ps1 -Target claude -Uninstall
#>

[CmdletBinding()]
param(
  [ValidateSet('claude','cursor','codex','opencode')]
  [string]$Target,

  [switch]$User,
  [switch]$Project,
  [switch]$Uninstall,
  [switch]$Help
)

$ErrorActionPreference = 'Stop'

function Write-Err($msg) { [Console]::Error.WriteLine($msg) }

function Show-Usage {
  @'
Usage: install.ps1 -Target <name> [-User|-Project] [-Uninstall] [-Help]

Targets:
  claude    Claude Code config (default scope: -User)
  cursor    Cursor project config (default scope: -Project)
  codex     Codex skills (default scope: -User)
  opencode  OpenCode config (default scope: -User)

Flags:
  -User         Install to user-level location (claude, codex, opencode)
  -Project      Install to current working directory's project location
  -Uninstall    Remove agentry-installed files instead of copying
  -Help         Show this help and exit

Examples:
  .\scripts\install.ps1 -Target claude
  .\scripts\install.ps1 -Target claude -Project
  .\scripts\install.ps1 -Target cursor
  .\scripts\install.ps1 -Target codex
  .\scripts\install.ps1 -Target codex -Project
  .\scripts\install.ps1 -Target opencode
  .\scripts\install.ps1 -Target claude -Uninstall
'@ | Write-Host
}

if ($Help) { Show-Usage; exit 0 }

if (-not $Target) {
  Write-Err "Error: -Target is required"
  Show-Usage
  exit 1
}

if ($User -and $Project) {
  Write-Err "Error: cannot specify both -User and -Project"
  exit 1
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$Scope = if ($User) { 'user' }
         elseif ($Project) { 'project' }
         elseif ($Target -eq 'claude' -or $Target -eq 'codex' -or $Target -eq 'opencode') { 'user' }
         else { 'project' }

if ($Target -eq 'cursor' -and $Scope -eq 'user') {
  Write-Err "Error: Cursor has no user-level config directory. Use -Project."
  exit 1
}

if ($Target -eq 'claude') {
  $SrcDir = Join-Path $RepoRoot '.claude'
  $DestDir = if ($Scope -eq 'user') {
    Join-Path $env:USERPROFILE '.claude'
  } else {
    Join-Path (Get-Location).Path '.claude'
  }
  $SubDirs = @('agents','skills','commands','rules','hooks')
} elseif ($Target -eq 'cursor') {
  $SrcDir = Join-Path $RepoRoot '.cursor'
  $DestDir = Join-Path (Get-Location).Path '.cursor'
  $SubDirs = @('agents','rules')
} elseif ($Target -eq 'opencode') {
  # opencode: project config is .opencode\; user config is ~\.config\opencode\.
  $SrcDir = Join-Path $RepoRoot '.opencode'
  $DestDir = if ($Scope -eq 'user') {
    Join-Path $env:USERPROFILE '.config\opencode'
  } else {
    Join-Path (Get-Location).Path '.opencode'
  }
  $SubDirs = @('agents','commands','skills')
} else {
  # codex: skills live under .agents\skills\ at the destination. The src path
  # points at .codex\agents (one level above the skills\ subdir), so the
  # generic loop below works: srcSub = SrcDir\skills, destSub = DestDir\skills.
  $SrcDir = Join-Path $RepoRoot '.codex\agents'
  $DestDir = if ($Scope -eq 'user') {
    Join-Path $env:USERPROFILE '.agents'
  } else {
    Join-Path (Get-Location).Path '.agents'
  }
  $SubDirs = @('skills')
}

if (-not (Test-Path -LiteralPath $SrcDir -PathType Container)) {
  Write-Err "Error: Generated directory not found at $SrcDir"
  Write-Err "Run 'npm run sync' first."
  exit 1
}

# Uninstall removes only entries whose names match what's currently in the
# repo's generated dir — user-authored files in the destination are preserved.
if ($Uninstall) {
  Write-Host "Uninstalling $Target from $DestDir"
  foreach ($subdir in $SubDirs) {
    $srcSub = Join-Path $SrcDir $subdir
    $destSub = Join-Path $DestDir $subdir
    if (-not (Test-Path -LiteralPath $srcSub -PathType Container)) { continue }
    if (-not (Test-Path -LiteralPath $destSub -PathType Container)) { continue }
    foreach ($entry in Get-ChildItem -LiteralPath $srcSub) {
      $targetPath = Join-Path $destSub $entry.Name
      if (Test-Path -LiteralPath $targetPath) {
        Remove-Item -LiteralPath $targetPath -Recurse -Force
        Write-Host "  - removed $targetPath"
      }
    }
  }
  Write-Host "Uninstalled $Target from $DestDir"
  exit 0
}

Write-Host "Installing $Target to $DestDir"
foreach ($subdir in $SubDirs) {
  $srcSub = Join-Path $SrcDir $subdir
  if (-not (Test-Path -LiteralPath $srcSub -PathType Container)) { continue }
  $destSub = Join-Path $DestDir $subdir
  New-Item -ItemType Directory -Force -Path $destSub | Out-Null
  foreach ($entry in Get-ChildItem -LiteralPath $srcSub) {
    $targetPath = Join-Path $destSub $entry.Name
    if ($entry.PSIsContainer) {
      if (Test-Path -LiteralPath $targetPath) {
        Remove-Item -LiteralPath $targetPath -Recurse -Force
      }
      Copy-Item -LiteralPath $entry.FullName -Destination $targetPath -Recurse -Force
    } else {
      Copy-Item -LiteralPath $entry.FullName -Destination $targetPath -Force
    }
    Write-Host "  + $targetPath"
  }
}
Write-Host "Installed $Target to $DestDir"
