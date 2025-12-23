#!/bin/bash
# TurnKey NodeJS Provisioning Script for Connect-5
# Run this script on your TurnKey NodeJS appliance to set up PostgreSQL and prepare for deployment.

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    Connect-5 TurnKey Provisioning Script     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root${NC}"
    exit 1
fi

# 1. Update and Install PostgreSQL
echo -e "${BLUE}📦 Updating system and installing PostgreSQL...${NC}"
apt-get update
apt-get install -y postgresql postgresql-contrib git

# 2. Start PostgreSQL
echo -e "${BLUE}🚀 Starting PostgreSQL service...${NC}"
systemctl start postgresql
systemctl enable postgresql

# 3. Configure Database
echo -e "${BLUE}🔐 Configuring Database...${NC}"
echo "Please enter a password for the 'postgres' database user:"
read -s -p "Password: " DB_PASSWORD
echo ""

# Switch to postgres user to run commands
su - postgres <<EOF
# Set password
psql -c "ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';"

# Create database if it doesn't exist
if ! psql -lqt | cut -d \| -f 1 | grep -qw connect5; then
    psql -c "CREATE DATABASE connect5;"
    echo "Database 'connect5' created."
else
    echo "Database 'connect5' already exists."
fi
EOF

echo -e "${GREEN}✅ Database configured successfully!${NC}"
echo ""

# 4. Clone Repository (Optional helper)
echo -e "${BLUE}📂 Project Setup${NC}"
read -p "Would you like to clone the git repository now? (y/n): " CLONE_CONFIRM

if [[ "$CLONE_CONFIRM" =~ ^[Yy]$ ]]; then
    read -p "Enter Git Repository URL: " REPO_URL
    if [ ! -z "$REPO_URL" ]; then
        git clone "$REPO_URL" connect-5
        cd connect-5
        echo -e "${GREEN}✅ Repository cloned to $(pwd)${NC}"
        
        echo -e "${BLUE}🚀 Launching Deployment Script...${NC}"
        bash deploy.sh
    else
        echo "Skipping clone."
    fi
else
    echo "Skipping clone. You can manually upload your files later."
fi

echo ""
echo -e "${GREEN}🎉 Provisioning Complete!${NC}"
echo "If you haven't run deploy.sh yet, navigate to your project folder and run:"
echo "sudo bash deploy.sh"
