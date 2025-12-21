# Connect-5 Production Deployment Guide

Complete guide for deploying Connect-5 to production with Supabase database.

## Quick Deploy

```bash
# On your production server
cd /path/to/Connect-5
sudo bash deploy.sh
```

The script will:
1. ✅ Prompt for project directory (or use current)
2. ✅ Request Supabase credentials
3. ✅ Create `db.config.js`
4. ✅ Install dependencies
5. ✅ Detect and configure web server (Nginx/Apache)
6. ✅ Start Node.js server
7. ✅ Test endpoints

---

## Prerequisites

### 1. Supabase Setup

1. Create project at [app.supabase.com](https://app.supabase.com)
2. Run the SQL schema from [supabase-schema-complete.sql](supabase-schema-complete.sql)
3. Get your credentials:
   - Project URL
   - Anon/Public API key
   - Database password

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for detailed instructions.

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
    supabaseUrl: 'https://your-project.supabase.co',
    supabaseAnonKey: 'your-anon-key',
    supabasePassword: 'your-db-password',
    postgresConnectionString: 'postgresql://postgres:password@db.project.supabase.co:5432/postgres'
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
  "database": "Supabase PostgreSQL"
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

**Problem**: Supabase credentials incorrect

**Solution**:
1. Check `db.config.js` has correct URL and key
2. Verify credentials in Supabase dashboard
3. Check server.log: `tail -f server.log`

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
3. Verify Supabase credentials
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
- Enable Supabase Row Level Security (RLS) policies
- Keep dependencies updated: `npm audit fix`
- Use HTTPS only (no HTTP)

---

## Support

For issues:
1. Check this deployment guide
2. Review [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
3. Check server logs
4. Verify Supabase dashboard shows activity
5. Test local endpoint: `curl http://localhost:3000/api/db-status`
