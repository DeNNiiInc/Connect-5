#!/bin/bash
set -e

# Configuration
DB_PASSWORD="SecurePassword123!"
REMOTE_PATH="/var/www/connect5"
GIT_TOKEN="${GIT_TOKEN}" # Ensure this is passed as an env var or replaced before running
GIT_REPO="https://${GIT_TOKEN}@github.com/DeNNiiInc/Connect-5.git"

echo '📦 Step 1: Installing System Dependencies...'
apt-get update
apt-get install -y git postgresql postgresql-contrib

echo '📂 Step 2: Preparing Directory...'
mkdir -p $REMOTE_PATH
chown -R root:root $REMOTE_PATH

echo '⬇️ Step 3: Cloning Repository...'
if [ -d "$REMOTE_PATH/.git" ]; then
    echo "Repo already exists, pulling..."
    cd $REMOTE_PATH
    git pull
else
    git clone "$GIT_REPO" "$REMOTE_PATH"
    cd "$REMOTE_PATH"
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
    PASSWORD: '$DB_PASSWORD',
    DB: 'connect5',
    dialect: 'postgres',
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
};
EOF

# Setup Postgres User and DB
su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';\""
su - postgres -c "psql -c \"CREATE DATABASE connect5;\" || true"
# Import Schema
su - postgres -c "psql -d connect5 -f $REMOTE_PATH/postgres-schema.sql"

echo '⚙️ Step 6: Setting up Service...'
bash setup-auto-start.sh

echo '🌐 Step 7: Configuring Nginx Reverse Proxy...'
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/nodejs

cat > /etc/nginx/sites-available/connect5 <<NGINX
server {
    listen 80;
    server_name _;
    root $REMOTE_PATH;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/connect5 /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

echo '✅ Deployment Complete!'
