#!/bin/bash
# Production Deployment Script for Connect-5 Supabase Migration
# Run this on your production server

set -e  # Exit on error

echo "🚀 Connect-5 Production Deployment"
echo "===================================="
echo ""

# Configuration
PROJECT_DIR="/home/github2/apps/app-connect5"  # Production server path
NODE_PORT=3000
PM2_APP_NAME="connect5"

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

# Step 4: Restart Node.js server with PM2
echo "🔄 Restarting Node.js server..."
if pm2 list | grep -q "$PM2_APP_NAME"; then
    echo "Restarting existing PM2 process..."
    pm2 restart "$PM2_APP_NAME" || { echo -e "${RED}❌ PM2 restart failed!${NC}"; exit 1; }
else
    echo "Starting new PM2 process..."
    pm2 start server.js --name "$PM2_APP_NAME" || { echo -e "${RED}❌ PM2 start failed!${NC}"; exit 1; }
fi

pm2 save
echo -e "${GREEN}✅ Server restarted${NC}"
echo ""

# Step 5: Show server status
echo "📊 Server Status:"
pm2 status
echo ""

# Step 6: Test API endpoint
echo "🧪 Testing API endpoint..."
sleep 2  # Give server time to start
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$NODE_PORT/api/db-status)

if [ "$API_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ API endpoint responding (HTTP $API_RESPONSE)${NC}"
else
    echo -e "${YELLOW}⚠️  API endpoint returned HTTP $API_RESPONSE${NC}"
    echo "Check logs with: pm2 logs $PM2_APP_NAME"
fi
echo ""

# Step 7: Show recent logs
echo "📋 Recent server logs:"
pm2 logs "$PM2_APP_NAME" --lines 20 --nostream
echo ""

# Final instructions
echo "===================================="
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Visit https://connect5.beyondcloud.technology/"
echo "2. Check the status bar shows 'Connected'"
echo "3. Test multiplayer functionality"
echo ""
echo "Useful commands:"
echo "  pm2 logs $PM2_APP_NAME     - View server logs"
echo "  pm2 restart $PM2_APP_NAME  - Restart server"
echo "  pm2 stop $PM2_APP_NAME     - Stop server"
echo "===================================="
