#!/bin/bash
# Automated Apache Configuration Script for Connect-5
# This script configures Apache to proxy requests to the Node.js server

set -e  # Exit on error

echo "🔧 Connect-5 Apache Configuration Script"
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

echo "Step 1: Enabling Apache modules..."
a2enmod proxy 2>/dev/null || echo "proxy already enabled"
a2enmod proxy_http 2>/dev/null || echo "proxy_http already enabled"
a2enmod proxy_wstunnel 2>/dev/null || echo "proxy_wstunnel already enabled"
a2enmod rewrite 2>/dev/null || echo "rewrite already enabled"
echo -e "${GREEN}✅ Apache modules enabled${NC}"
echo ""

echo "Step 2: Finding Apache configuration file..."
# Try to find the SSL config file
CONFIG_FILE=""

# Check common locations
if [ -f "/etc/apache2/sites-available/connect5-le-ssl.conf" ]; then
    CONFIG_FILE="/etc/apache2/sites-available/connect5-le-ssl.conf"
elif [ -f "/etc/apache2/sites-available/connect5.conf" ]; then
    CONFIG_FILE="/etc/apache2/sites-available/connect5.conf"
elif [ -f "/etc/apache2/sites-available/000-default-le-ssl.conf" ]; then
    CONFIG_FILE="/etc/apache2/sites-available/000-default-le-ssl.conf"
elif [ -f "/etc/apache2/sites-available/default-ssl.conf" ]; then
    CONFIG_FILE="/etc/apache2/sites-available/default-ssl.conf"
else
    echo -e "${YELLOW}⚠️  Could not auto-detect config file${NC}"
    echo "Available config files:"
    ls -1 /etc/apache2/sites-available/
    echo ""
    read -p "Enter the full path to your Apache config file: " CONFIG_FILE
fi

echo -e "${GREEN}✅ Using config file: $CONFIG_FILE${NC}"
echo ""

echo "Step 3: Backing up original config..."
cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✅ Backup created${NC}"
echo ""

echo "Step 4: Checking if proxy rules already exist..."
if grep -q "ProxyPass /api" "$CONFIG_FILE"; then
    echo -e "${YELLOW}⚠️  Proxy rules already exist in config file${NC}"
    echo "Skipping modification to avoid duplicates."
else
    echo "Adding proxy configuration..."
    
    # Create the proxy configuration
    PROXY_CONFIG="
    # Connect-5 Node.js Proxy Configuration
    ProxyPreserveHost On
    ProxyPass /api http://localhost:3000/api
    ProxyPassReverse /api http://localhost:3000/api
    ProxyPass /socket.io http://localhost:3000/socket.io
    ProxyPassReverse /socket.io http://localhost:3000/socket.io
    
    # WebSocket support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*)           ws://localhost:3000/\$1 [P,L]
"
    
    # Insert before the closing </VirtualHost> tag
    sed -i "/<\/VirtualHost>/i\\$PROXY_CONFIG" "$CONFIG_FILE"
    
    echo -e "${GREEN}✅ Proxy configuration added${NC}"
fi
echo ""

echo "Step 5: Testing Apache configuration..."
if apache2ctl configtest 2>&1 | grep -q "Syntax OK"; then
    echo -e "${GREEN}✅ Apache configuration is valid${NC}"
else
    echo -e "${RED}❌ Apache configuration has errors!${NC}"
    echo "Restoring backup..."
    cp "${CONFIG_FILE}.backup."* "$CONFIG_FILE"
    echo "Please check the configuration manually."
    exit 1
fi
echo ""

echo "Step 6: Restarting Apache..."
systemctl restart apache2
echo -e "${GREEN}✅ Apache restarted${NC}"
echo ""

echo "Step 7: Checking if Node.js server is running..."
if pgrep -f "node server.js" > /dev/null; then
    echo -e "${GREEN}✅ Node.js server is running${NC}"
else
    echo -e "${YELLOW}⚠️  Node.js server is not running${NC}"
    echo "Starting Node.js server..."
    cd /home/github2/apps/app-connect5
    nohup node server.js > server.log 2>&1 &
    sleep 2
    echo -e "${GREEN}✅ Node.js server started${NC}"
fi
echo ""

echo "Step 8: Testing API endpoint..."
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://connect5.beyondcloud.technology/api/db-status)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ API endpoint is working! (HTTP $HTTP_CODE)${NC}"
    echo ""
    echo "📊 Database Status:"
    curl -s https://connect5.beyondcloud.technology/api/db-status | python3 -m json.tool 2>/dev/null || curl -s https://connect5.beyondcloud.technology/api/db-status
else
    echo -e "${YELLOW}⚠️  API endpoint returned HTTP $HTTP_CODE${NC}"
    echo "This might take a moment for DNS/cache to update."
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
echo "  Apache: sudo tail -f /var/log/apache2/error.log"
echo "  Node.js: tail -f /home/github2/apps/app-connect5/server.log"
echo ""
echo "Backup saved to: ${CONFIG_FILE}.backup.*"
echo "=========================================="
