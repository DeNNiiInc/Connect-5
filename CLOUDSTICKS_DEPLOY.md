# CloudSticks Deployment Guide

## Quick Setup (No PM2 Required)

Since CloudSticks auto-deploys from GitHub, you only need to set up the database config and ensure the server is running.

### Option 1: Use the CloudSticks Deployment Script

```bash
cd /home/github2/apps/app-connect5
chmod +x deploy-cloudsticks.sh
./deploy-cloudsticks.sh
```

This will:
- ✅ Install dependencies
- ✅ Create `db.config.js` with Supabase credentials
- ✅ Attempt to restart the server (systemd or PM2 if available)
- ✅ Test the API endpoint

---

### Option 2: Manual Setup

If you prefer manual setup:

```bash
cd /home/github2/apps/app-connect5

# Install dependencies
npm install

# Create db.config.js
cat > db.config.js << 'EOF'
module.exports = {
    supabaseUrl: 'https://wxtirlphaphwbrgsjyop.supabase.co',
    supabaseAnonKey: 'sb_publishable_Onh4nNYCV99d2eGidQIpqA_9PBkY8zs',
    supabasePassword: 't1hWsackxbYzRIPD',
    postgresConnectionString: 'postgresql://postgres:t1hWsackxbYzRIPD@db.wxtirlphaphwbrgsjyop.supabase.co:5432/postgres'
};
EOF

# Check if server is running
ps aux | grep "node server.js"

# If not running, start it
nohup node server.js > server.log 2>&1 &

# Or if CloudSticks uses systemd:
sudo systemctl restart connect5
```

---

## Verify Deployment

### 1. Check if Node.js is Running

```bash
ps aux | grep node
```

Should show `node server.js` running

### 2. Test API Locally

```bash
curl http://localhost:3000/api/db-status
```

Should return JSON with `"connected": true`

### 3. Test in Browser

Visit: https://connect5.beyondcloud.technology/

Check status bar shows:
- **SQL**: Connected ✅
- **Latency**: ~45ms
- **Write**: Enabled ✅

---

## Troubleshooting

### Server Not Running

**Start the server**:
```bash
cd /home/github2/apps/app-connect5
node server.js > server.log 2>&1 &
```

**Check logs**:
```bash
tail -f server.log
```

### API Returns 404

**Check Apache/Nginx proxy**:
The web server needs to proxy `/api/*` and `/socket.io/*` to `localhost:3000`

**For Apache**, ensure you have:
```apache
ProxyPass /api http://localhost:3000/api
ProxyPassReverse /api http://localhost:3000/api
ProxyPass /socket.io http://localhost:3000/socket.io
ProxyPassReverse /socket.io http://localhost:3000/socket.io
```

### Database Connection Fails

**Verify credentials**:
```bash
cat db.config.js
```

**Test Supabase connection**:
```bash
node -e "const {supabase} = require('./database'); supabase.from('players').select('id').limit(1).then(console.log).catch(console.error)"
```

---

## CloudSticks-Specific Notes

- **Auto-Deploy**: CloudSticks automatically pulls from GitHub when you push
- **No PM2**: CloudSticks may not have PM2 installed - use systemd or direct node
- **Logs**: Check `server.log` for application logs
- **Restart**: After code changes, restart the Node.js process

---

## Keep Server Running

### Option 1: Using nohup (Simple)
```bash
nohup node server.js > server.log 2>&1 &
```

### Option 2: Using systemd (Recommended)

Create `/etc/systemd/system/connect5.service`:
```ini
[Unit]
Description=Connect-5 Multiplayer Server
After=network.target

[Service]
Type=simple
User=github2
WorkingDirectory=/home/github2/apps/app-connect5
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable connect5
sudo systemctl start connect5
sudo systemctl status connect5
```

---

## Future Updates

When you push to GitHub:
1. CloudSticks auto-deploys the code
2. Run: `./deploy-cloudsticks.sh` (or restart server manually)
3. Verify at https://connect5.beyondcloud.technology/
