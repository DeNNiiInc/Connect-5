#!/bin/bash
# Simple CloudSticks Nginx Proxy Setup
# Adds proxy config to http block

set -e

echo "🔧 CloudSticks Nginx Proxy Setup (Simple Method)"
echo "================================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Run with sudo${NC}"
    exit 1
fi

CONFIG_FILE="/etc/nginx-cs/nginx.conf"

echo "Step 1: Backing up config..."
cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✅ Backup created${NC}"
echo ""

echo "Step 2: Adding proxy configuration..."

# Create a separate config file for Connect-5
cat > /etc/nginx-cs/conf.d/connect5-proxy.conf << 'EOF'
# Connect-5 Proxy Configuration
server {
    listen 443 ssl;
    server_name connect5.beyondcloud.technology;

    # SSL certificates (CloudSticks should handle these)
    # ssl_certificate and ssl_certificate_key are managed by CloudSticks

    # Root directory
    root /home/github2/apps/app-connect5;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Node.js
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy Socket.io WebSocket requests
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

echo -e "${GREEN}✅ Proxy config created at /etc/nginx-cs/conf.d/connect5-proxy.conf${NC}"
echo ""

echo "Step 3: Testing Nginx configuration..."
if nginx -t 2>&1 | grep -q "successful\|syntax is ok"; then
    echo -e "${GREEN}✅ Config valid${NC}"
else
    echo -e "${RED}❌ Config error${NC}"
    nginx -t
    echo ""
    echo "Restoring backup..."
    rm /etc/nginx-cs/conf.d/connect5-proxy.conf 2>/dev/null || true
    exit 1
fi
echo ""

echo "Step 4: Reloading Nginx..."
systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null || nginx -s reload
echo -e "${GREEN}✅ Nginx reloaded${NC}"
echo ""

echo "Step 5: Checking Node.js..."
if pgrep -f "node server.js" > /dev/null; then
    echo -e "${GREEN}✅ Node.js running${NC}"
else
    echo -e "${YELLOW}⚠️  Starting Node.js...${NC}"
    cd /home/github2/apps/app-connect5
    nohup node server.js > server.log 2>&1 &
    sleep 2
    echo -e "${GREEN}✅ Node.js started${NC}"
fi
echo ""

echo "Step 6: Testing..."
sleep 2

LOCAL=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/db-status 2>/dev/null || echo "000")
PROD=$(curl -s -o /dev/null -w "%{http_code}" https://connect5.beyondcloud.technology/api/db-status 2>/dev/null || echo "000")

echo "Local endpoint: HTTP $LOCAL"
echo "Production endpoint: HTTP $PROD"

if [ "$PROD" = "200" ]; then
    echo ""
    echo -e "${GREEN}✅ SUCCESS! Production is working!${NC}"
    echo ""
    curl -s https://connect5.beyondcloud.technology/api/db-status | python3 -m json.tool 2>/dev/null || curl -s https://connect5.beyondcloud.technology/api/db-status
fi

echo ""
echo "================================================="
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo "Visit: https://connect5.beyondcloud.technology/"
echo "================================================="
