#!/bin/bash
# CloudSticks Deployment Script for Connect-5
# This version works without PM2 - uses systemd or direct node

set -e  # Exit on error

echo "🚀 Connect-5 CloudSticks Deployment"
echo "===================================="
echo ""

# Configuration
PROJECT_DIR="/home/github2/apps/app-connect5"
NODE_PORT=3000

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Navigate to project directory
echo "📁 Navigating to project directory..."
cd "$PROJECT_DIR" || { echo -e "${RED}❌ Project directory not found!${NC}"; exit 1; }
echo -e "${GREEN}✅ In directory: $(pwd)${NC}"
echo ""

# Step 2: Install dependencies
echo "📦 Installing dependencies..."
npm install || { echo -e "${RED}❌ npm install failed!${NC}"; exit 1; }
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 3: Check if db.config.js exists
echo "🔍 Checking for db.config.js..."
if [ ! -f "db.config.js" ]; then
    echo -e "${YELLOW}⚠️  db.config.js not found!${NC}"
    echo "Creating db.config.js from template..."
    
    cat > db.config.js << 'EOF'
// Database Configuration File
// IMPORTANT: This file contains sensitive credentials
// DO NOT commit this file to git - it's in .gitignore

// Supabase Configuration
module.exports = {
    supabaseUrl: 'https://wxtirlphaphwbrgsjyop.supabase.co',
    supabaseAnonKey: 'sb_publishable_Onh4nNYCV99d2eGidQIpqA_9PBkY8zs',
    supabasePassword: 't1hWsackxbYzRIPD',
    
    // Optional: Direct PostgreSQL connection
    postgresConnectionString: 'postgresql://postgres:t1hWsackxbYzRIPD@db.wxtirlphaphwbrgsjyop.supabase.co:5432/postgres'
};
EOF
    
    echo -e "${GREEN}✅ db.config.js created${NC}"
else
    echo -e "${GREEN}✅ db.config.js already exists${NC}"
fi
echo ""

# Step 4: Check how to restart the server
echo "🔄 Checking server management..."

# Check if systemd service exists
if systemctl list-units --type=service --all | grep -q "connect5.service"; then
    echo "Found systemd service, restarting..."
    sudo systemctl restart connect5
    echo -e "${GREEN}✅ Server restarted via systemd${NC}"
    
elif command -v pm2 &> /dev/null; then
    echo "Found PM2, restarting..."
    pm2 restart connect5 || pm2 start server.js --name connect5
    pm2 save
    echo -e "${GREEN}✅ Server restarted via PM2${NC}"
    
else
    echo -e "${YELLOW}⚠️  No process manager found${NC}"
    echo "Please restart your Node.js server manually:"
    echo "  Option 1: If using systemd: sudo systemctl restart connect5"
    echo "  Option 2: If using PM2: pm2 restart connect5"
    echo "  Option 3: Kill existing node process and start new one"
    echo ""
    echo "To start the server manually:"
    echo "  cd $PROJECT_DIR"
    echo "  node server.js &"
fi
echo ""

# Step 5: Test API endpoint (if server is running)
echo "🧪 Testing API endpoint..."
sleep 3  # Give server time to start

API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$NODE_PORT/api/db-status 2>/dev/null || echo "000")

if [ "$API_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ API endpoint responding (HTTP $API_RESPONSE)${NC}"
    
    # Get actual status
    echo ""
    echo "📊 Database Status:"
    curl -s http://localhost:$NODE_PORT/api/db-status | python3 -m json.tool 2>/dev/null || echo "Could not parse JSON"
    
elif [ "$API_RESPONSE" = "000" ]; then
    echo -e "${YELLOW}⚠️  Could not connect to server${NC}"
    echo "The server might not be running yet."
else
    echo -e "${YELLOW}⚠️  API endpoint returned HTTP $API_RESPONSE${NC}"
fi
echo ""

# Final instructions
echo "===================================="
echo -e "${GREEN}🎉 Deployment Steps Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Ensure Node.js server is running"
echo "2. Visit https://connect5.beyondcloud.technology/"
echo "3. Check the status bar shows 'Connected'"
echo ""
echo "If server is not running, start it with:"
echo "  cd $PROJECT_DIR"
echo "  node server.js > server.log 2>&1 &"
echo "===================================="
