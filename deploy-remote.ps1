<#
.SYNOPSIS
    Automated Update Script for Vendor Inventory (Remote)
.DESCRIPTION
    Reads configuration from deploy-config.json.
    Connects to the remote server, pulls the latest code, installs dependencies, and restarts the service.
#>

$ErrorActionPreference = "Stop"
$ConfigPath = Join-Path $PSScriptRoot "deploy-config.json"

if (-not (Test-Path $ConfigPath)) {
    Write-Error "Configuration file not found: $ConfigPath"
    exit 1
}

$Config = Get-Content $ConfigPath | ConvertFrom-Json
$HostName = $Config.host
$User = $Config.username
$Password = $Config.password
$RemotePath = $Config.remotePath

Write-Host "Connecting to $User@$HostName for update..." -ForegroundColor Cyan

# Check for plink
if (-not (Get-Command "plink" -ErrorAction SilentlyContinue)) {
    Write-Error "Plink (PuTTY Link) is required but not found. Please install PuTTY."
    exit 1
}

# Commands to run on remote
$RemoteCommands = "
    echo '📂 Navigating to $RemotePath...'
    cd $RemotePath
    
    echo '⬇️ Pulling latest changes...'
    git pull
    
    echo '📦 Installing dependencies...'
    npm install
    
    echo '🚀 Restarting Service...'
    systemctl restart connect5
    
    echo '✅ Status Check:'
    systemctl status connect5 --no-pager
"

# Execute
$RemoteCommands = $RemoteCommands -replace "`r`n", "`n"
echo y | plink -ssh -P 22 -t -pw $Password "$User@$HostName" $RemoteCommands

Write-Host "`nUpdate Sequence Completed." -ForegroundColor Green
