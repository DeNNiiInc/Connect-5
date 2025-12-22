# Connect-5 Production Deployment Guide

Complete guide for deploying Connect-5 to production with PostgreSQL database.

## Quick Deploy

```bash
# On your production server
cd /path/to/Connect-5
sudo bash deploy.sh
```

The script will:
1. ✅ Prompt for project directory (or use current)
2. ✅ Request PostgreSQL credentials
3. ✅ Create `db.config.js`
4. ✅ Install dependencies
5. ✅ Detect and configure web server (Nginx/Apache)
6. ✅ Start Node.js server
7. ✅ Test endpoints

---

## Prerequisites

### 1. PostgreSQL Database Setup

1. Ensure PostgreSQL server is running and accessible
2. Create the database: `CREATE DATABASE connect5;`
3. Run the SQL schema from [postgres-schema.sql](postgres-schema.sql):
   ```bash
   psql -h HOST -U postgres -d connect5 -f postgres-schema.sql
   ```
4. Ensure your PostgreSQL server accepts remote connections (if deploying remotely)

See [README_DB_CONFIG.md](README_DB_CONFIG.md) for database configuration details.

### 2. Server Requirements

- Node.js 14+ installed
- Nginx or Apache web server
- SSL certificate configured
- Port 3000 available for Node.js

---

## Manual Deployment

If you prefer manual deployment or the script doesn't work for your environment:

### Step 1: Update Code

```bash
cd /path/to/Connect-5
git pull origin main
npm install
```

### Step 2: Configure Database

Create `db.config.js`:

```javascript
module.exports = {
    HOST: 'your-postgres-host',
    USER: 'postgres',
    PASSWORD: 'your-database-password',
    DB: 'connect5',
    dialect: 'postgres',
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};
```

### Step 3: Configure Web Server

#### For CloudSticks Nginx

Edit `/etc/nginx-cs/vhosts.d/app-yourproject.conf` and add inside the `server` block:

```nginx
# Connect-5 API Proxy
location /api {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Connect-5 Socket.io Proxy
location /socket.io {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Restart Nginx:
```bash
sudo systemctl restart nginx-cs
```

#### For Standard Nginx

Add to your site config in `/etc/nginx/sites-available/yoursite`:

```nginx
location /api {
    proxy_pass http://localhost:3000;
    # ... same proxy headers as above
}

location /socket.io {
    proxy_pass http://localhost:3000;
    # ... same proxy headers as above
}
```

Restart:
```bash
sudo systemctl restart nginx
```

#### For Apache

Enable modules:
```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite
```

Add to your VirtualHost:
```apache
ProxyPreserveHost On
ProxyPass /api http://localhost:3000/api
ProxyPassReverse /api http://localhost:3000/api
ProxyPass /socket.io http://localhost:3000/socket.io
ProxyPassReverse /socket.io http://localhost:3000/socket.io

RewriteEngine On
RewriteCond %{HTTP:Upgrade} =websocket [NC]
RewriteRule /(.*)           ws://localhost:3000/$1 [P,L]
```

Restart:
```bash
sudo systemctl restart apache2
```

### Step 4: Start Node.js Server

```bash
cd /path/to/Connect-5
nohup node server.js > server.log 2>&1 &
```

Or use PM2:
```bash
pm2 start server.js --name connect5
pm2 save
```

---

## Verification

### 1. Test API Endpoint

```bash
curl https://yourdomain.com/api/db-status
```

Should return:
```json
{
  "connected": true,
  "latency": 45,
  "writeCapable": true,
  "connectionType": "PostgreSQL Direct Connection"
}
```

### 2. Check Website

Visit `https://yourdomain.com/` and verify:
- ✅ Status bar shows "Connected" (green)
- ✅ Latency is displayed (~45ms)
- ✅ "Write: Enabled" shows (green)

### 3. Test Multiplayer

1. Click "Multiplayer"
2. Register a username
3. Should see "Welcome back, [username]!"
4. Online players list should populate
5. Try creating/joining a game

---

## Troubleshooting

### API Returns 404

**Problem**: Web server not proxying to Node.js

**Solution**:
1. Check web server config has proxy rules
2. Restart web server
3. Verify Node.js is running: `ps aux | grep "node server.js"`

### Database Disconnected

**Problem**: PostgreSQL credentials incorrect or server unreachable

**Solution**:
1. Check `db.config.js` has correct HOST, USER, PASSWORD, and DB
2. Verify PostgreSQL server is running: `sudo systemctl status postgresql`
3. Check server.log: `tail -f server.log`
4. Test direct connection: `psql -h HOST -U postgres -d connect5`

### WebSocket Connection Failed

**Problem**: Proxy not configured for WebSocket upgrade

**Solution**:
1. For Nginx: Add `proxy_set_header Upgrade $http_upgrade`
2. For Apache: Add `RewriteCond %{HTTP:Upgrade} =websocket`
3. Restart web server

### Node.js Server Won't Start

**Problem**: Port 3000 in use or database connection failed

**Solution**:
1. Check port: `netstat -tlnp | grep 3000`
2. Check logs: `tail -f server.log`
3. Verify PostgreSQL credentials in `db.config.js`
4. Test database: `curl http://localhost:3000/api/db-status`

---

## CloudSticks-Specific Notes

CloudSticks uses custom Nginx setup:
- Config location: `/etc/nginx-cs/`
- Vhosts: `/etc/nginx-cs/vhosts.d/`
- Service name: `nginx-cs`
- Restart: `sudo systemctl restart nginx-cs`

The deployment script automatically detects CloudSticks and configures accordingly.

---

## Environment-Specific Configuration

### Development
```bash
npm start
# Runs on http://localhost:3000
```

### Production
- Uses web server proxy (Nginx/Apache)
- HTTPS enabled
- Node.js runs in background
- Logs to `server.log`

---

## Maintenance

### Update Application

```bash
cd /path/to/Connect-5
git pull origin main
npm install
pkill -f "node server.js"
nohup node server.js > server.log 2>&1 &
```

### View Logs

```bash
# Node.js logs
tail -f /path/to/Connect-5/server.log

# Nginx logs
sudo tail -f /var/log/nginx/error.log

# Apache logs
sudo tail -f /var/log/apache2/error.log
```

### Restart Services

```bash
# Node.js
pkill -f "node server.js"
cd /path/to/Connect-5
nohup node server.js > server.log 2>&1 &

# Nginx (CloudSticks)
sudo systemctl restart nginx-cs

# Nginx (Standard)
sudo systemctl restart nginx

# Apache
sudo systemctl restart apache2
```

---

## Security Notes

- `db.config.js` is in `.gitignore` (never commit credentials)
- Use environment variables for sensitive data in production
- Configure PostgreSQL firewall rules to restrict access
- Keep dependencies updated: `npm audit fix`
- Use HTTPS only (no HTTP)
- Use strong PostgreSQL passwords

---

## 🔁 Auto-Restart & Auto-Deploy

### 1. Enable Auto-Start on Boot (Systemd)

To ensure your application starts automatically when the server reboots:

```bash
cd /path/to/Connect-5
sudo bash setup-auto-start.sh
```

This script will:
*   Install `connect5.service` to systemd
*   Configure the service to wait for PostgreSQL
*   Enable it to start on boot
*   Auto-restart the app if it crashes (10s delay)

### 2. Enable Auto-Deploy (Git Hooks)

To automatically restart the database and server every time you `git pull`:

```bash
cd /path/to/Connect-5
bash setup-auto-deploy.sh
```

This installs a git `post-merge` hook that:
*   Detects when code is pulled
*   Runs `npm install` (only if package.json changed)
*   Restarts the `connect5` service
*   Ensures the connection is refreshed properly

This prevents "Database Disconnected" errors after updates.

---

## Support

For issues:
1. Check this deployment guide
2. Review [README_DB_CONFIG.md](README_DB_CONFIG.md)
3. Check server logs
4. Verify PostgreSQL server status: `sudo systemctl status postgresql`
5. Test local endpoint: `curl http://localhost:3000/api/db-status`
