#!/bin/bash
# CloudSticks Nginx Setup - Handles custom nginx paths

set -e

echo "🔧 CloudSticks Nginx Proxy Setup"
echo "================================="
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

echo "Step 2: Creating proxy configuration..."
mkdir -p /etc/nginx-cs/conf.d

cat > /etc/nginx-cs/conf.d/connect5-proxy.conf << 'EOF'
# Connect-5 Proxy Configuration
server {
    listen 443 ssl;
    server_name connect5.beyondcloud.technology;

    root /home/github2/apps/app-connect5;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

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

echo -e "${GREEN}✅ Proxy config created${NC}"
echo ""

echo "Step 3: Finding nginx command..."
NGINX_CMD=""
if command -v nginx &> /dev/null; then
    NGINX_CMD="nginx"
elif [ -f "/usr/sbin/nginx" ]; then
    NGINX_CMD="/usr/sbin/nginx"
elif [ -f "/usr/local/sbin/nginx" ]; then
    NGINX_CMD="/usr/local/sbin/nginx"
elif [ -f "/opt/cloudsticks/nginx/sbin/nginx" ]; then
    NGINX_CMD="/opt/cloudsticks/nginx/sbin/nginx"
else
    echo -e "${YELLOW}⚠️  Could not find nginx command${NC}"
    echo "Trying to reload via systemctl..."
fi

if [ -n "$NGINX_CMD" ]; then
    echo "Testing config with: $NGINX_CMD"
    if $NGINX_CMD -t 2>&1 | grep -q "successful\|syntax is ok"; then
        echo -e "${GREEN}✅ Config valid${NC}"
    else
        echo -e "${RED}❌ Config error${NC}"
        $NGINX_CMD -t
        rm /etc/nginx-cs/conf.d/connect5-proxy.conf
        exit 1
    fi
fi
echo ""

echo "Step 4: Reloading Nginx..."
if systemctl reload nginx 2>/dev/null; then
    echo -e "${GREEN}✅ Reloaded via systemctl${NC}"
elif service nginx reload 2>/dev/null; then
    echo -e "${GREEN}✅ Reloaded via service${NC}"
elif [ -n "$NGINX_CMD" ]; then
    $NGINX_CMD -s reload 2>/dev/null && echo -e "${GREEN}✅ Reloaded via nginx -s${NC}" || echo -e "${YELLOW}⚠️  Could not reload${NC}"
else
    echo -e "${YELLOW}⚠️  Please restart nginx manually${NC}"
    echo "Try: systemctl restart nginx"
fi
echo ""

echo "Step 5: Checking Node.js..."
if pgrep -f "node server.js" > /dev/null; then
    PID=$(pgrep -f "node server.js")
    echo -e "${GREEN}✅ Node.js running (PID: $PID)${NC}"
else
    echo -e "${YELLOW}⚠️  Starting Node.js...${NC}"
    cd /home/github2/apps/app-connect5
    nohup node server.js > server.log 2>&1 &
    sleep 2
    if pgrep -f "node server.js" > /dev/null; then
        echo -e "${GREEN}✅ Node.js started${NC}"
    fi
fi
echo ""

echo "Step 6: Testing endpoints..."
sleep 3

LOCAL=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/db-status 2>/dev/null || echo "000")
echo "Local (localhost:3000): HTTP $LOCAL"

if [ "$LOCAL" = "200" ]; then
    echo -e "${GREEN}✅ Node.js server is responding${NC}"
fi

PROD=$(curl -s -o /dev/null -w "%{http_code}" https://connect5.beyondcloud.technology/api/db-status 2>/dev/null || echo "000")
echo "Production: HTTP $PROD"

if [ "$PROD" = "200" ]; then
    echo -e "${GREEN}✅ Production is working!${NC}"
    echo ""
    echo "Database Status:"
    curl -s https://connect5.beyondcloud.technology/api/db-status 2>/dev/null | python3 -m json.tool 2>/dev/null || curl -s https://connect5.beyondcloud.technology/api/db-status
elif [ "$PROD" = "502" ]; then
    echo -e "${YELLOW}⚠️  502 Bad Gateway - Nginx is proxying but Node.js might not be ready${NC}"
elif [ "$PROD" = "404" ]; then
    echo -e "${YELLOW}⚠️  404 - Nginx might need manual restart${NC}"
    echo "Try: sudo systemctl restart nginx"
fi

echo ""
echo "================================="
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo "Config file: /etc/nginx-cs/conf.d/connect5-proxy.conf"
echo "Visit: https://connect5.beyondcloud.technology/"
echo ""
echo "If not working, try:"
echo "  sudo systemctl restart nginx"
echo "  tail -f /home/github2/apps/app-connect5/server.log"
echo "================================="
