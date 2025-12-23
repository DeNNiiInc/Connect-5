
# Initial Deployment Script for Connect-5
# Usage: ./initial-deploy.ps1
$ErrorActionPreference = "Stop"

# Load Configuration
$ConfigPath = Join-Path $PSScriptRoot "deploy-config.json"
if (-not (Test-Path $ConfigPath)) { Write-Error "Config file not found"; exit 1 }
$Config = Get-Content $ConfigPath | ConvertFrom-Json

$HostName = $Config.host
$User = $Config.username
$Password = $Config.password
$RemotePath = $Config.remotePath
$GitToken = $Config.gitToken
$GitRepo = "https://${GitToken}@github.com/DeNNiiInc/Connect-5.git"
$DBPassword = "SecurePassword123!" # Hardcoded secure password for automation

Write-Host "🚀 Starting Remote Deployment to $User@$HostName..." -ForegroundColor Cyan

# Check for plink
if (-not (Get-Command "plink" -ErrorAction SilentlyContinue)) {
    Write-Error "Plink not found. Please install PuTTY."
    exit 1
}

# Construct the massive command string
# We use a heredoc for the remote bash script
$RemoteScript = @"
set -e

echo '📦 Step 1: Installing System Dependencies...'
apt-get update
apt-get install -y git postgresql postgresql-contrib

echo '📂 Step 2: Preparing Directory...'
mkdir -p $RemotePath
chown -R root:root $RemotePath

echo '⬇️ Step 3: Cloning Repository...'
if [ -d "$RemotePath/.git" ]; then
    echo "Repo already exists, pulling..."
    cd $RemotePath
    git pull
else
    git clone "$GitRepo" "$RemotePath"
    cd "$RemotePath"
fi

echo '📦 Step 4: Installing Node Modules...'
npm install

echo '🔐 Step 5: Configuring Database...'
systemctl start postgresql
systemctl enable postgresql

# Create DB Config File
cat > db.config.js <<EOF
module.exports = {
    HOST: 'localhost',
    USER: 'postgres',
    PASSWORD: '$DBPassword',
    DB: 'connect5',
    dialect: 'postgres',
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
};
EOF

# Setup Postgres User and DB (Idempotent)
su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD '$DBPassword';\""
su - postgres -c "psql -c \"CREATE DATABASE connect5;\" || true"
# Import Schema
su - postgres -c "psql -d connect5 -f $RemotePath/postgres-schema.sql"

echo '⚙️ Step 6: Setting up Service...'
bash setup-auto-start.sh

echo '🌐 Step 7: Configuring Nginx Reverse Proxy...'
# Remove default sites (including TurnKey default)
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/nodejs

# Create Nginx Config
cat > /etc/nginx/sites-available/connect5 <<'NGINX'
server {
    listen 80;
    server_name _;
    root $RemotePath;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_cache_bypass `$http_upgrade;
    }
    
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
    }
}
NGINX

# Enable Site
ln -sf /etc/nginx/sites-available/connect5 /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

echo '✅ Deployment Complete!'
"@


# Execute via Plink
# We echo 'y' to accept the host key (blindly, for automation)
# Fix CRLF to LF for Linux compatibility
$RemoteScript = $RemoteScript -replace "`r`n", "`n"
plink -batch -P 22 -ssh -pw $Password "$User@$HostName" $RemoteScript

Write-Host "Done!" -ForegroundColor Green
