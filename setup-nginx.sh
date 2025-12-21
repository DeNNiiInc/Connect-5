#!/bin/bash
# Automated Nginx Configuration Script for Connect-5 on CloudSticks
# Ubuntu 24.04 / Nginx

set -e  # Exit on error

echo "🔧 Connect-5 Nginx Configuration Script"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
    exit 1
fi

echo "Step 1: Finding Nginx configuration file..."
CONFIG_FILE=""

# Check common CloudSticks/Nginx locations
if [ -f "/etc/nginx/sites-available/connect5.beyondcloud.technology" ]; then
    CONFIG_FILE="/etc/nginx/sites-available/connect5.beyondcloud.technology"
elif [ -f "/etc/nginx/sites-available/connect5" ]; then
    CONFIG_FILE="/etc/nginx/sites-available/connect5"
elif [ -f "/etc/nginx/sites-available/default" ]; then
    CONFIG_FILE="/etc/nginx/sites-available/default"
elif [ -f "/etc/nginx/conf.d/connect5.conf" ]; then
    CONFIG_FILE="/etc/nginx/conf.d/connect5.conf"
else
    echo -e "${YELLOW}⚠️  Could not auto-detect config file${NC}"
    echo "Available Nginx config files:"
    ls -1 /etc/nginx/sites-available/ 2>/dev/null || echo "No sites-available directory"
    ls -1 /etc/nginx/conf.d/ 2>/dev/null || echo "No conf.d directory"
    echo ""
    
    # Try to find by domain name
    FOUND=$(grep -l "connect5.beyondcloud.technology\|beyondcloud.technology" /etc/nginx/sites-available/* /etc/nginx/conf.d/* 2>/dev/null | head -1)
    if [ -n "$FOUND" ]; then
        CONFIG_FILE="$FOUND"
        echo -e "${GREEN}✅ Found config by domain: $CONFIG_FILE${NC}"
    else
        read -p "Enter the full path to your Nginx config file: " CONFIG_FILE
    fi
fi

echo -e "${GREEN}✅ Using config file: $CONFIG_FILE${NC}"
echo ""

echo "Step 2: Backing up original config..."
cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✅ Backup created${NC}"
echo ""

echo "Step 3: Checking if proxy rules already exist..."
if grep -q "proxy_pass.*3000" "$CONFIG_FILE"; then
    echo -e "${YELLOW}⚠️  Proxy rules already exist in config file${NC}"
    echo "Skipping modification to avoid duplicates."
else
    echo "Adding proxy configuration..."
    
    # Create a temporary file with the proxy configuration
    cat > /tmp/nginx_proxy_config.txt << 'EOF'
    # Connect-5 Node.js Proxy Configuration
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
EOF
    
    # Insert before the last closing brace
    # Find the last server block and insert before its closing brace
    if grep -q "server {" "$CONFIG_FILE"; then
        # Insert before the last closing brace of server block
        sed -i '/^[[:space:]]*}[[:space:]]*$/i\    # Connect-5 Proxy Config' "$CONFIG_FILE"
        sed -i '/# Connect-5 Proxy Config/r /tmp/nginx_proxy_config.txt' "$CONFIG_FILE"
        sed -i '/# Connect-5 Proxy Config/d' "$CONFIG_FILE"
    else
        echo -e "${RED}❌ Could not find server block in config${NC}"
        exit 1
    fi
    
    rm /tmp/nginx_proxy_config.txt
    
    echo -e "${GREEN}✅ Proxy configuration added${NC}"
fi
echo ""

echo "Step 4: Testing Nginx configuration..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
else
    echo -e "${RED}❌ Nginx configuration has errors!${NC}"
    echo "Restoring backup..."
    cp "${CONFIG_FILE}.backup."* "$CONFIG_FILE"
    echo "Please check the configuration manually."
    nginx -t
    exit 1
fi
echo ""

echo "Step 5: Reloading Nginx..."
systemctl reload nginx
echo -e "${GREEN}✅ Nginx reloaded${NC}"
echo ""

echo "Step 6: Checking if Node.js server is running..."
if pgrep -f "node server.js" > /dev/null; then
    echo -e "${GREEN}✅ Node.js server is running${NC}"
    PID=$(pgrep -f "node server.js")
    echo "   Process ID: $PID"
else
    echo -e "${YELLOW}⚠️  Node.js server is not running${NC}"
    echo "Starting Node.js server..."
    cd /home/github2/apps/app-connect5
    nohup node server.js > server.log 2>&1 &
    sleep 2
    echo -e "${GREEN}✅ Node.js server started${NC}"
fi
echo ""

echo "Step 7: Testing API endpoint..."
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://connect5.beyondcloud.technology/api/db-status 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ API endpoint is working! (HTTP $HTTP_CODE)${NC}"
    echo ""
    echo "📊 Database Status:"
    curl -s https://connect5.beyondcloud.technology/api/db-status 2>/dev/null | python3 -m json.tool 2>/dev/null || curl -s https://connect5.beyondcloud.technology/api/db-status
elif [ "$HTTP_CODE" = "000" ]; then
    echo -e "${YELLOW}⚠️  Could not connect to server${NC}"
    echo "Testing local endpoint..."
    LOCAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/db-status 2>/dev/null || echo "000")
    if [ "$LOCAL_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Local endpoint works (HTTP $LOCAL_CODE)${NC}"
        echo "The proxy might need a moment to update."
    else
        echo -e "${RED}❌ Node.js server not responding${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  API endpoint returned HTTP $HTTP_CODE${NC}"
fi
echo ""

echo "=========================================="
echo -e "${GREEN}🎉 Configuration Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Visit https://connect5.beyondcloud.technology/"
echo "2. Check that the status bar shows 'Connected'"
echo "3. Test multiplayer functionality"
echo ""
echo "Logs:"
echo "  Nginx: sudo tail -f /var/log/nginx/error.log"
echo "  Node.js: tail -f /home/github2/apps/app-connect5/server.log"
echo ""
echo "Backup saved to: ${CONFIG_FILE}.backup.*"
echo "=========================================="
