#!/bin/bash
# Connect-5 Auto-Start Setup Script
# This script configures the application to start automatically on boot using systemd

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔧 Connect-5 Auto-Start Configuration${NC}"

# Check root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

# Get project directory
PROJECT_DIR=$(pwd)
SERVICE_FILE="connect5.service"
SYSTEMD_PATH="/etc/systemd/system/connect5.service"

echo -e "${BLUE}📂 Working directory: $PROJECT_DIR${NC}"

# Check for service file
if [ ! -f "$SERVICE_FILE" ]; then
    echo -e "${RED}❌ $SERVICE_FILE not found in current directory${NC}"
    exit 1
fi

# Update WorkingDirectory in service file to match current location
echo "Updating WorkingDirectory path..."
sed -i "s|WorkingDirectory=.*|WorkingDirectory=$PROJECT_DIR|g" "$SERVICE_FILE"

# Copy service file
echo "Installing systemd service..."
cp "$SERVICE_FILE" "$SYSTEMD_PATH"
chmod 644 "$SYSTEMD_PATH"

# Enable PostgreSQL to start on boot
echo "Enabling PostgreSQL auto-start..."
if systemctl enable postgresql; then
    echo -e "${GREEN}✅ PostgreSQL set to auto-start${NC}"
else
    echo -e "${RED}⚠️  Could not enable PostgreSQL (is it installed?)${NC}"
fi

# Reload systemd
echo "Reloading systemd daemon..."
systemctl daemon-reload

# Enable and start Connect-5 service
echo "Enabling Connect-5 service..."
systemctl enable connect5
systemctl restart connect5

# Check status
echo "Checking service status..."
sleep 2

if systemctl is-active --quiet connect5; then
    echo -e "${GREEN}✅ Connect-5 service is RUNNING and enabled!${NC}"
    echo "The app will now restart automatically if the server reboots."
else
    echo -e "${RED}❌ Service failed to start. Checking logs...${NC}"
    journalctl -u connect5 -n 10 --no-pager
fi
