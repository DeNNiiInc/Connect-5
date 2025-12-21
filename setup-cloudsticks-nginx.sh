#!/bin/bash
# Automated Nginx Configuration for CloudSticks
# Specifically for /etc/nginx-cs/ setup

set -e  # Exit on error

echo "🔧 Connect-5 CloudSticks Nginx Configuration"
echo "=============================================="
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

# CloudSticks uses /etc/nginx-cs/
CONFIG_FILE="/etc/nginx-cs/nginx.conf"

echo "Step 1: Checking CloudSticks Nginx configuration..."
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ CloudSticks Nginx config not found at $CONFIG_FILE${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Found config: $CONFIG_FILE${NC}"
echo ""

echo "Step 2: Backing up original config..."
cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✅ Backup created${NC}"
echo ""

echo "Step 3: Checking if proxy rules already exist..."
if grep -q "proxy_pass.*3000" "$CONFIG_FILE"; then
    echo -e "${YELLOW}⚠️  Proxy rules already exist${NC}"
    echo "Skipping modification to avoid duplicates."
else
    echo "Adding proxy configuration to nginx.conf..."
    
    # Create the proxy configuration block
    cat > /tmp/nginx_proxy.conf << 'EOF'

    # Connect-5 API Proxy
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

    # Connect-5 Socket.io Proxy
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
    
    # Find the server block for port 443 and insert before its closing brace
    # Look for the last } in a server block listening on 443
    if grep -q "listen.*443" "$CONFIG_FILE"; then
        # Insert proxy config before the closing brace of the SSL server block
        awk '
        /listen.*443/ { in_ssl_block=1 }
        in_ssl_block && /^[[:space:]]*}[[:space:]]*$/ && !done {
            while ((getline line < "/tmp/nginx_proxy.conf") > 0) {
                print line
            }
            close("/tmp/nginx_proxy.conf")
            done=1
        }
        { print }
        ' "$CONFIG_FILE" > /tmp/nginx_modified.conf
        
        mv /tmp/nginx_modified.conf "$CONFIG_FILE"
        rm /tmp/nginx_proxy.conf
        
        echo -e "${GREEN}✅ Proxy configuration added${NC}"
    else
        echo -e "${RED}❌ Could not find SSL server block (port 443)${NC}"
        echo "You may need to add the proxy configuration manually."
        cat /tmp/nginx_proxy.conf
        exit 1
    fi
fi
echo ""

echo "Step 4: Testing Nginx configuration..."
if nginx -t 2>&1 | grep -q "successful\|syntax is ok"; then
    echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
else
    echo -e "${RED}❌ Nginx configuration has errors!${NC}"
    echo "Restoring backup..."
    cp "${CONFIG_FILE}.backup."* "$CONFIG_FILE" 2>/dev/null || true
    nginx -t
    exit 1
fi
echo ""

echo "Step 5: Reloading Nginx..."
systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null || nginx -s reload
echo -e "${GREEN}✅ Nginx reloaded${NC}"
echo ""

echo "Step 6: Checking Node.js server..."
if pgrep -f "node server.js" > /dev/null; then
    PID=$(pgrep -f "node server.js")
    echo -e "${GREEN}✅ Node.js server is running (PID: $PID)${NC}"
else
    echo -e "${YELLOW}⚠️  Node.js server not running${NC}"
    echo "Starting Node.js server..."
    cd /home/github2/apps/app-connect5
    nohup node server.js > server.log 2>&1 &
    sleep 3
    if pgrep -f "node server.js" > /dev/null; then
        echo -e "${GREEN}✅ Node.js server started${NC}"
    else
        echo -e "${RED}❌ Failed to start Node.js server${NC}"
        echo "Check server.log for errors"
    fi
fi
echo ""

echo "Step 7: Testing endpoints..."
sleep 2

# Test local endpoint
echo "Testing local endpoint..."
LOCAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/db-status 2>/dev/null || echo "000")
if [ "$LOCAL_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Local Node.js server responding (HTTP $LOCAL_CODE)${NC}"
else
    echo -e "${YELLOW}⚠️  Local server returned HTTP $LOCAL_CODE${NC}"
fi

# Test production endpoint
echo "Testing production endpoint..."
PROD_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://connect5.beyondcloud.technology/api/db-status 2>/dev/null || echo "000")
if [ "$PROD_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Production endpoint working! (HTTP $PROD_CODE)${NC}"
    echo ""
    echo "📊 Database Status:"
    curl -s https://connect5.beyondcloud.technology/api/db-status 2>/dev/null | python3 -m json.tool 2>/dev/null || curl -s https://connect5.beyondcloud.technology/api/db-status
elif [ "$PROD_CODE" = "000" ]; then
    echo -e "${YELLOW}⚠️  Could not connect to production URL${NC}"
else
    echo -e "${YELLOW}⚠️  Production returned HTTP $PROD_CODE${NC}"
    echo "May need a moment for changes to propagate..."
fi
echo ""

echo "=============================================="
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Visit: https://connect5.beyondcloud.technology/"
echo "2. Status bar should show 'Connected'"
echo "3. Test multiplayer functionality"
echo ""
echo "Logs:"
echo "  Nginx: sudo tail -f /var/log/nginx/error.log"
echo "  Node.js: tail -f /home/github2/apps/app-connect5/server.log"
echo ""
echo "Config backup: ${CONFIG_FILE}.backup.*"
echo "=============================================="
