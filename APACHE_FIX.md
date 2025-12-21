# Quick Fix for CloudSticks Apache Proxy

## Problem
The Node.js server is running on port 3000, but Apache is not forwarding `/api` and `/socket.io` requests to it.

## Solution

### Step 1: Enable Apache Proxy Modules

Run these commands on your CloudSticks server:

```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
```

### Step 2: Find Your Apache Config File

CloudSticks likely uses one of these locations:
```bash
# Check which file exists:
ls -la /etc/apache2/sites-available/connect5*
ls -la /etc/apache2/sites-available/000-default-le-ssl.conf
ls -la /etc/apache2/sites-available/default-ssl.conf
```

### Step 3: Edit the Config File

```bash
# Use nano or vi to edit (replace with your actual file):
sudo nano /etc/apache2/sites-available/connect5.conf
```

### Step 4: Add These Lines

Add these lines **inside** your `<VirtualHost *:443>` block (before `</VirtualHost>`):

```apache
# Proxy API and Socket.io to Node.js
ProxyPreserveHost On
ProxyPass /api http://localhost:3000/api
ProxyPassReverse /api http://localhost:3000/api
ProxyPass /socket.io http://localhost:3000/socket.io
ProxyPassReverse /socket.io http://localhost:3000/socket.io

# WebSocket support
RewriteEngine On
RewriteCond %{HTTP:Upgrade} =websocket [NC]
RewriteRule /(.*)           ws://localhost:3000/$1 [P,L]
```

### Step 5: Test and Restart Apache

```bash
# Test configuration
sudo apache2ctl configtest

# If OK, restart Apache
sudo systemctl restart apache2
```

### Step 6: Verify It Works

```bash
# Test API endpoint
curl https://connect5.beyondcloud.technology/api/db-status

# Should return JSON with "connected": true
```

Then visit https://connect5.beyondcloud.technology/ in your browser!

---

## Alternative: Quick .htaccess Method

If you can't edit the Apache config, try adding this to `.htaccess` in your project root:

```apache
RewriteEngine On

# Proxy API requests
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^api/(.*)$ http://localhost:3000/api/$1 [P,L]

# Proxy Socket.io requests
RewriteCond %{REQUEST_URI} ^/socket\.io/
RewriteRule ^socket\.io/(.*)$ http://localhost:3000/socket.io/$1 [P,L]
```

**Note**: This requires `AllowOverride All` in your Apache config.

---

## Troubleshooting

### Check if Node.js is Running
```bash
ps aux | grep "node server.js"
curl http://localhost:3000/api/db-status
```

### Check Apache Error Logs
```bash
sudo tail -f /var/log/apache2/error.log
```

### Check if Modules are Enabled
```bash
apache2ctl -M | grep proxy
```

Should show:
- proxy_module
- proxy_http_module
- proxy_wstunnel_module
