#!/bin/bash
# Move proxy config to correct CloudSticks directory

echo "🔧 Moving proxy config to correct location"
echo "==========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Run with sudo${NC}"
    exit 1
fi

echo "Step 1: Moving config to vhosts.d..."
if [ -f "/etc/nginx-cs/conf.d/connect5-proxy.conf" ]; then
    mv /etc/nginx-cs/conf.d/connect5-proxy.conf /etc/nginx-cs/vhosts.d/connect5-proxy.conf
    echo -e "${GREEN}✅ Moved to /etc/nginx-cs/vhosts.d/connect5-proxy.conf${NC}"
else
    echo "Creating new config in vhosts.d..."
    cat > /etc/nginx-cs/vhosts.d/connect5-proxy.conf << 'EOF'
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
    echo -e "${GREEN}✅ Created in vhosts.d${NC}"
fi
echo ""

echo "Step 2: Restarting Nginx..."
systemctl restart nginx
echo -e "${GREEN}✅ Nginx restarted${NC}"
echo ""

echo "Step 3: Checking Node.js..."
if ! pgrep -f "node server.js" > /dev/null; then
    echo "Starting Node.js..."
    cd /home/github2/apps/app-connect5
    nohup node server.js > server.log 2>&1 &
    sleep 2
fi
echo -e "${GREEN}✅ Node.js running${NC}"
echo ""

echo "Step 4: Testing..."
sleep 2

LOCAL=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/db-status 2>/dev/null || echo "000")
PROD=$(curl -s -o /dev/null -w "%{http_code}" https://connect5.beyondcloud.technology/api/db-status 2>/dev/null || echo "000")

echo "Local: HTTP $LOCAL"
echo "Production: HTTP $PROD"
echo ""

if [ "$PROD" = "200" ]; then
    echo -e "${GREEN}✅✅✅ SUCCESS! ✅✅✅${NC}"
    echo ""
    echo "Database Status:"
    curl -s https://connect5.beyondcloud.technology/api/db-status | python3 -m json.tool 2>/dev/null || curl -s https://connect5.beyondcloud.technology/api/db-status
    echo ""
    echo "==========================================="
    echo -e "${GREEN}🎉 Production is LIVE!${NC}"
    echo "Visit: https://connect5.beyondcloud.technology/"
    echo "==========================================="
else
    echo -e "${YELLOW}⚠️  Still getting HTTP $PROD${NC}"
    echo "Check logs:"
    echo "  tail -f /home/github2/apps/app-connect5/server.log"
fi
