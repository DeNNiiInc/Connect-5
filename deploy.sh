#!/bin/bash
# Connect-5 Production Deployment Script
# Supports CloudSticks and standard servers with Nginx or Apache

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Connect-5 Production Deployment Script            ║"
echo "║              PostgreSQL + Node.js + Nginx/Apache          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Get project directory
echo -e "${BLUE}📁 Project Directory${NC}"
echo "Current directory: $(pwd)"
echo ""
read -p "Enter project path (or press Enter to use current directory): " PROJECT_DIR

if [ -z "$PROJECT_DIR" ]; then
    PROJECT_DIR=$(pwd)
fi

# Validate directory
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Directory does not exist: $PROJECT_DIR${NC}"
    exit 1
fi

if [ ! -f "$PROJECT_DIR/package.json" ]; then
    echo -e "${RED}❌ Not a valid Connect-5 project (package.json not found)${NC}"
    exit 1
fi

cd "$PROJECT_DIR"
echo -e "${GREEN}✅ Using project directory: $PROJECT_DIR${NC}"
echo ""

# Get PostgreSQL credentials
echo -e "${BLUE}🔐 PostgreSQL Configuration${NC}"
echo ""
read -p "PostgreSQL Host: " PG_HOST
read -p "PostgreSQL User [postgres]: " PG_USER
PG_USER=${PG_USER:-postgres}
read -s -p "PostgreSQL Password: " PG_PASSWORD
echo ""
read -p "Database Name [connect5]: " PG_DB
PG_DB=${PG_DB:-connect5}
echo ""

if [ -z "$PG_HOST" ] || [ -z "$PG_PASSWORD" ]; then
    echo -e "${RED}❌ PostgreSQL host and password are required${NC}"
    exit 1
fi

# Create db.config.js
echo -e "${BLUE}📝 Creating db.config.js...${NC}"
cat > "$PROJECT_DIR/db.config.js" << EOF
module.exports = {
    HOST: '$PG_HOST',
    USER: '$PG_USER',
    PASSWORD: '$PG_PASSWORD',
    DB: '$PG_DB',
    dialect: 'postgres',
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};
EOF
echo -e "${GREEN}✅ db.config.js created${NC}"
echo ""

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Detect web server
echo -e "${BLUE}🌐 Detecting web server...${NC}"
WEB_SERVER=""
if systemctl list-units | grep -q "nginx-cs"; then
    WEB_SERVER="nginx-cs"
    echo -e "${GREEN}✅ Detected: CloudSticks Nginx${NC}"
elif systemctl list-units | grep -q "nginx.service"; then
    WEB_SERVER="nginx"
    echo -e "${GREEN}✅ Detected: Standard Nginx${NC}"
elif systemctl list-units | grep -q "apache2"; then
    WEB_SERVER="apache2"
    echo -e "${GREEN}✅ Detected: Apache${NC}"
else
    echo -e "${YELLOW}⚠️  Could not detect web server${NC}"
    echo "Please select:"
    echo "1) CloudSticks Nginx (nginx-cs)"
    echo "2) Standard Nginx"
    echo "3) Apache"
    read -p "Selection: " SERVER_CHOICE
    case $SERVER_CHOICE in
        1) WEB_SERVER="nginx-cs" ;;
        2) WEB_SERVER="nginx" ;;
        3) WEB_SERVER="apache2" ;;
        *) echo -e "${RED}❌ Invalid selection${NC}"; exit 1 ;;
    esac
fi
echo ""

# Configure web server
case $WEB_SERVER in
    "nginx-cs")
        echo -e "${BLUE}⚙️  Configuring CloudSticks Nginx...${NC}"
        
        # Find existing vhost config
        DOMAIN=$(basename "$PROJECT_DIR" | sed 's/app-//')
        VHOST_FILE="/etc/nginx-cs/vhosts.d/app-${DOMAIN}.conf"
        
        if [ ! -f "$VHOST_FILE" ]; then
            echo -e "${YELLOW}⚠️  Vhost file not found: $VHOST_FILE${NC}"
            echo "Available vhost files:"
            ls -1 /etc/nginx-cs/vhosts.d/ | grep ".conf$"
            read -p "Enter vhost filename: " VHOST_NAME
            VHOST_FILE="/etc/nginx-cs/vhosts.d/$VHOST_NAME"
        fi
        
        if [ ! -f "$VHOST_FILE" ]; then
            echo -e "${RED}❌ Vhost file not found${NC}"
            exit 1
        fi
        
        # Backup
        cp "$VHOST_FILE" "${VHOST_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Check if proxy rules already exist
        if grep -q "proxy_pass.*3000" "$VHOST_FILE"; then
            echo -e "${YELLOW}⚠️  Proxy rules already exist${NC}"
        else
            # Add proxy rules before closing brace
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
    }' "$VHOST_FILE"
            
            echo -e "${GREEN}✅ Proxy rules added to $VHOST_FILE${NC}"
        fi
        
        systemctl restart nginx-cs
        echo -e "${GREEN}✅ Nginx-CS restarted${NC}"
        ;;
        
    "nginx")
        echo -e "${BLUE}⚙️  Configuring Standard Nginx...${NC}"
        echo "Please manually add proxy configuration to your Nginx vhost"
        echo "See DEPLOYMENT.md for instructions"
        ;;
        
    "apache2")
        echo -e "${BLUE}⚙️  Configuring Apache...${NC}"
        echo "Enabling required modules..."
        a2enmod proxy proxy_http proxy_wstunnel rewrite 2>/dev/null || true
        echo "Please manually add proxy configuration to your Apache vhost"
        echo "See DEPLOYMENT.md for instructions"
        systemctl restart apache2
        ;;
esac
echo ""

# Start Node.js server
echo -e "${BLUE}🚀 Starting Node.js server...${NC}"
if pgrep -f "node server.js" > /dev/null; then
    echo -e "${YELLOW}⚠️  Server already running, restarting...${NC}"
    pkill -f "node server.js"
    sleep 2
fi

cd "$PROJECT_DIR"
nohup node server.js > server.log 2>&1 &
sleep 3

if pgrep -f "node server.js" > /dev/null; then
    PID=$(pgrep -f "node server.js")
    echo -e "${GREEN}✅ Node.js server started (PID: $PID)${NC}"
else
    echo -e "${RED}❌ Failed to start Node.js server${NC}"
    echo "Check server.log for errors"
    exit 1
fi
echo ""

# Test endpoints
echo -e "${BLUE}🧪 Testing endpoints...${NC}"
sleep 2

LOCAL=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/db-status 2>/dev/null || echo "000")
echo "Local (localhost:3000): HTTP $LOCAL"

if [ "$LOCAL" = "200" ]; then
    echo -e "${GREEN}✅ Local endpoint working${NC}"
    echo ""
    echo "Database Status:"
    curl -s http://localhost:3000/api/db-status | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/api/db-status
else
    echo -e "${RED}❌ Local endpoint failed${NC}"
    echo "Check server.log for errors"
fi
echo ""

# Final summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  Deployment Complete!                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✅ Project Directory:${NC} $PROJECT_DIR"
echo -e "${GREEN}✅ Database:${NC} PostgreSQL"
echo -e "${GREEN}✅ Web Server:${NC} $WEB_SERVER"
echo -e "${GREEN}✅ Node.js:${NC} Running on port 3000"
echo ""
echo "📋 Next Steps:"
echo "1. Test your production URL"
echo "2. Check status bar shows 'Connected'"
echo "3. Test multiplayer functionality"
echo ""
echo "📝 Logs:"
echo "  Node.js: tail -f $PROJECT_DIR/server.log"
echo "  Web Server: journalctl -u $WEB_SERVER -f"
echo ""
echo "🔧 Troubleshooting:"
echo "  - If API returns 404, check web server proxy configuration"
echo "  - If database disconnected, verify PostgreSQL credentials"
echo "  - See DEPLOYMENT.md for detailed instructions"
echo ""
