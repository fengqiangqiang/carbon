$ErrorActionPreference = "Stop"

try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {
  # Ignore console encoding failures in older hosts.
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-CommandExists {
  param([string]$CommandName)
  return $null -ne (Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Test-DockerReady {
  docker info *> $null
  return $LASTEXITCODE -eq 0
}

function Start-DockerDesktopIfNeeded {
  if (Test-DockerReady) {
    Write-Host "Docker is already running." -ForegroundColor Green
    return
  }

  $dockerDesktopPaths = @(
    "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
  )

  $dockerDesktop = $dockerDesktopPaths | Where-Object {
    Test-Path -LiteralPath $_
  } | Select-Object -First 1

  if (-not $dockerDesktop) {
    throw "Docker is not running and Docker Desktop was not found. Please start Docker Desktop manually, then run this script again."
  }

  Write-Host "Starting Docker Desktop..." -ForegroundColor Yellow
  Start-Process -FilePath $dockerDesktop -WindowStyle Hidden | Out-Null

  $maxAttempts = 90
  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    Start-Sleep -Seconds 2
    if (Test-DockerReady) {
      Write-Host "Docker is ready." -ForegroundColor Green
      return
    }

    if (($attempt % 5) -eq 0) {
      Write-Host "Waiting for Docker Desktop... ($($attempt * 2)s)"
    }
  }

  throw "Docker Desktop did not become ready within $($maxAttempts * 2) seconds."
}

function Test-LocalPortListening {
  param([int]$Port)

  $netstatLines = & cmd.exe /c "netstat -ano -p tcp"
  foreach ($line in $netstatLines) {
    if ($line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") {
      return $true
    }
  }

  return $false
}

function Test-CarbonAppsAlreadyRunning {
  $erpListening = Test-LocalPortListening -Port 3000
  $mesListening = Test-LocalPortListening -Port 3001
  return $erpListening -and $mesListening
}

Write-Step "Checking required tools"

if (-not (Test-CommandExists "pnpm.cmd")) {
  throw "pnpm.cmd was not found on PATH. Install pnpm or open a shell where pnpm is available."
}

if (-not (Test-CommandExists "docker.exe")) {
  throw "docker.exe was not found on PATH. Install Docker Desktop first."
}

Write-Host "pnpm and Docker CLI are available." -ForegroundColor Green

Write-Step "Checking Docker"
Start-DockerDesktopIfNeeded

if (Test-CarbonAppsAlreadyRunning) {
  Write-Host ""
  Write-Host "Carbon app ports are already listening. Services appear to be running." -ForegroundColor Green
  Write-Host ""
  Write-Host "ERP:       http://localhost:3000"
  Write-Host "Dev Login: http://localhost:3000/dev-login.html"
  Write-Host "MES:       http://localhost:3001"
  Write-Host "API:       http://localhost:54321"
  Write-Host "Studio:    http://localhost:50063"
  Write-Host "Mail:      http://localhost:50064"
  Write-Host "Inngest:   http://localhost:50065"
  exit 0
}

Write-Step "Starting Carbon"
Write-Host "This window must stay open while Carbon is running."
Write-Host "Press Ctrl+C in this window to stop the dev app supervisor."
Write-Host ""
Write-Host "ERP will be available at:       http://localhost:3000"
Write-Host "Dev login will be available at: http://localhost:3000/dev-login.html"
Write-Host "MES will be available at:       http://localhost:3001"
Write-Host ""

& pnpm.cmd --filter "@carbon/dev" exec tsx src/main.ts up --no-portless
exit $LASTEXITCODE
