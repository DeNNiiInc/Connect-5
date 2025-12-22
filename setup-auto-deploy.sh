#!/bin/bash
# Auto-Deploy Setup Script
# Run this once to set up automatic service restarts after git pull

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Connect-5 Auto-Deploy Setup                            ║"
echo "║     Fixes: Database connection after git pull              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
HOOKS_DIR="$PROJECT_DIR/.git/hooks"

echo -e "${BLUE}📁 Project Directory:${NC} $PROJECT_DIR"
echo ""

# Check if .git directory exists
if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo -e "${RED}❌ Error: .git directory not found${NC}"
    echo "This doesn't appear to be a git repository"
    exit 1
fi

# Create hooks directory if it doesn't exist
if [ ! -d "$HOOKS_DIR" ]; then
    echo -e "${YELLOW}Creating hooks directory...${NC}"
    mkdir -p "$HOOKS_DIR"
fi

# Copy the post-merge hook
echo -e "${BLUE}📄 Installing git post-merge hook...${NC}"

if [ -f "$PROJECT_DIR/git-hooks/post-merge" ]; then
    cp "$PROJECT_DIR/git-hooks/post-merge" "$HOOKS_DIR/post-merge"
    chmod +x "$HOOKS_DIR/post-merge"
    echo -e "${GREEN}✅ Hook installed: .git/hooks/post-merge${NC}"
else
    echo -e "${RED}❌ Error: git-hooks/post-merge file not found${NC}"
    exit 1
fi

# Test which service manager is available
echo ""
echo -e "${BLUE}🔍 Detecting service manager...${NC}"

SERVICE_TYPE="none"

if command -v pm2 &> /dev/null; then
    SERVICE_TYPE="pm2"
    echo -e "${GREEN}✅ Detected: PM2${NC}"
    echo "   The hook will use: pm2 restart"
elif systemctl list-units --full --all 2>/dev/null | grep -q 'connect5.service'; then
    SERVICE_TYPE="systemd"
    echo -e "${GREEN}✅ Detected: Systemd service${NC}"
    echo "   The hook will use: systemctl restart connect5"
else
    SERVICE_TYPE="manual"
    echo -e "${YELLOW}⚠️  No service manager detected${NC}"
    echo "   The hook will use: pkill + restart"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete!                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✅ Auto-deploy is now configured!${NC}"
echo ""
echo "How it works:"
echo "1. Git auto-pulls changes to your server"
echo "2. The post-merge hook automatically runs"
echo "3. If package.json changed, it runs: npm install"
echo "4. It restarts the Node.js service automatically"
echo "5. Database reconnects without manual intervention"
echo ""
echo "To test it:"
echo "1. Make a change to your code"
echo "2. Git push from your local machine"
echo "3. Wait for auto-pull on server"
echo "4. Service should restart automatically!"
echo ""
echo -e "${BLUE}ℹ️  Service type detected:${NC} $SERVICE_TYPE"
echo ""

# Optional: Test run the hook
read -p "Do you want to test the hook now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}🧪 Testing hook...${NC}"
    echo ""
    bash "$HOOKS_DIR/post-merge"
fi

echo ""
echo -e "${GREEN}🎉 You're all set!${NC}"
echo "You won't need to run deploy.sh manually anymore."
echo ""
