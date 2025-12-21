#!/bin/bash
# Quick script to find and list Apache config files

echo "🔍 Finding Apache configuration files..."
echo ""

echo "SSL-enabled sites:"
ls -lh /etc/apache2/sites-enabled/ 2>/dev/null | grep -v "^total" | grep -v "^d"

echo ""
echo "Available sites:"
ls -lh /etc/apache2/sites-available/ 2>/dev/null | grep -v "^total" | grep -v "^d"

echo ""
echo "Checking for connect5 or beyondcloud in configs:"
grep -l "connect5\|beyondcloud" /etc/apache2/sites-available/* 2>/dev/null
grep -l "connect5\|beyondcloud" /etc/apache2/sites-enabled/* 2>/dev/null

echo ""
echo "Checking main Apache config:"
grep -n "Include" /etc/apache2/apache2.conf | grep sites

echo ""
echo "Current VirtualHosts:"
apache2ctl -S 2>/dev/null | grep -A 2 "443\|beyondcloud\|connect5"
