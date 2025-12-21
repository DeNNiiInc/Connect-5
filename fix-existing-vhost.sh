#!/bin/bash
# Add proxy rules to existing CloudSticks vhost config

echo "🔧 Adding proxy rules to existing app-connect5.conf"
echo "===================================================="
echo ""

GREEN='\033[0;32m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then 
    echo "❌ Run with sudo"
    exit 1
fi

CONFIG="/etc/nginx-cs/vhosts.d/app-connect5.conf"

echo "Step 1: Backing up existing config..."
cp "$CONFIG" "${CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✅ Backup created${NC}"
echo ""

echo "Step 2: Adding proxy rules..."

# Add proxy rules before the closing brace
sed -i '/^}$/i\
\
    # Connect-5 API Proxy\
    location /api {\
        proxy_pass http://localhost:3000;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection '"'"'upgrade'"'"';\
        proxy_set_header Host $host;\
        proxy_cache_bypass $http_upgrade;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
    }\
\
    # Connect-5 Socket.io Proxy\
    location /socket.io {\
        proxy_pass http://localhost:3000;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
        proxy_set_header Host $host;\
        proxy_cache_bypass $http_upgrade;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
    }' "$CONFIG"

echo -e "${GREEN}✅ Proxy rules added${NC}"
echo ""

echo "Step 3: Removing duplicate connect5-proxy.conf..."
rm -f /etc/nginx-cs/vhosts.d/connect5-proxy.conf
echo -e "${GREEN}✅ Removed duplicate${NC}"
echo ""

echo "Step 4: Restarting nginx-cs..."
systemctl restart nginx-cs
echo -e "${GREEN}✅ Nginx restarted${NC}"
echo ""

echo "Step 5: Checking Node.js..."
if ! pgrep -f "node server.js" > /dev/null; then
    cd /home/github2/apps/app-connect5
    nohup node server.js > server.log 2>&1 &
    sleep 2
fi
echo -e "${GREEN}✅ Node.js running${NC}"
echo ""

echo "Step 6: Testing..."
sleep 3

LOCAL=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/db-status 2>/dev/null)
PROD=$(curl -s -o /dev/null -w "%{http_code}" https://connect5.beyondcloud.technology/api/db-status 2>/dev/null)

echo "Local: HTTP $LOCAL"
echo "Production: HTTP $PROD"
echo ""

if [ "$PROD" = "200" ]; then
    echo -e "${GREEN}✅✅✅ SUCCESS! ✅✅✅${NC}"
    echo ""
    curl -s https://connect5.beyondcloud.technology/api/db-status | python3 -m json.tool 2>/dev/null
    echo ""
    echo "===================================================="
    echo -e "${GREEN}🎉 PRODUCTION IS LIVE! 🎉${NC}"
    echo "Visit: https://connect5.beyondcloud.technology/"
    echo "===================================================="
else
    echo "⚠️  Still HTTP $PROD - check logs"
fi
