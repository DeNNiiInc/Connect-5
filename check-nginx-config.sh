#!/bin/bash
# Check CloudSticks Nginx configuration structure

echo "🔍 Checking CloudSticks Nginx Configuration"
echo "============================================"
echo ""

echo "1. Main nginx.conf location:"
ls -la /etc/nginx-cs/nginx.conf 2>/dev/null || echo "Not found"
echo ""

echo "2. Checking what nginx.conf includes:"
grep -n "include" /etc/nginx-cs/nginx.conf 2>/dev/null || echo "No includes found"
echo ""

echo "3. Directory structure:"
ls -la /etc/nginx-cs/ 2>/dev/null
echo ""

echo "4. Checking for vhosts directories:"
ls -la /etc/nginx-cs/vhosts.d/ 2>/dev/null || echo "No vhosts.d"
ls -la /etc/nginx-cs/sites-available/ 2>/dev/null || echo "No sites-available"
ls -la /etc/nginx-cs/sites-enabled/ 2>/dev/null || echo "No sites-enabled"
echo ""

echo "5. Our proxy config:"
ls -la /etc/nginx-cs/conf.d/connect5-proxy.conf 2>/dev/null || echo "Proxy config not found"
echo ""

echo "6. Nginx process:"
ps aux | grep nginx | grep -v grep
echo ""

echo "7. Listening ports:"
netstat -tlnp 2>/dev/null | grep :443 || ss -tlnp | grep :443
