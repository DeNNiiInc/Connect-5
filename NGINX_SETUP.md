# Nginx Configuration for Connect-5 on CloudSticks

## Quick Setup (Automated)

```bash
cd /home/github2/apps/app-connect5
sudo bash setup-nginx.sh
```

That's it! The script will automatically configure everything.

---

## Manual Setup (If Needed)

### Step 1: Find Your Nginx Config

```bash
# Find config files
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/conf.d/

# Or search for your domain
grep -r "connect5.beyondcloud.technology" /etc/nginx/
```

### Step 2: Edit the Config

```bash
# Edit the config file (replace with your actual file)
sudo nano /etc/nginx/sites-available/connect5.beyondcloud.technology
```

### Step 3: Add Proxy Configuration

Add these `location` blocks **inside** your `server` block:

```nginx
server {
    listen 443 ssl;
    server_name connect5.beyondcloud.technology;
    
    # Your existing SSL and root configuration...
    
    # Add these proxy configurations:
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
}
```

### Step 4: Test and Reload

```bash
# Test configuration
sudo nginx -t

# If OK, reload Nginx
sudo systemctl reload nginx

# Test the API
curl https://connect5.beyondcloud.technology/api/db-status
```

---

## Troubleshooting

### Check if Nginx is Running
```bash
sudo systemctl status nginx
```

### Check Nginx Error Logs
```bash
sudo tail -f /var/log/nginx/error.log
```

### Check if Node.js is Running
```bash
ps aux | grep "node server.js"
```

### Test Local Node.js Server
```bash
curl http://localhost:3000/api/db-status
```

### Restart Everything
```bash
# Restart Node.js
pkill -f "node server.js"
cd /home/github2/apps/app-connect5
nohup node server.js > server.log 2>&1 &

# Reload Nginx
sudo systemctl reload nginx
```

---

## CloudSticks-Specific Notes

- CloudSticks uses **Nginx** (not Apache)
- Config files are usually in `/etc/nginx/sites-available/`
- CloudSticks auto-deploys from GitHub
- Node.js server needs to run continuously in background

---

## Verify It's Working

1. **Test API endpoint**:
   ```bash
   curl https://connect5.beyondcloud.technology/api/db-status
   ```
   Should return JSON with `"connected": true`

2. **Visit in browser**:
   https://connect5.beyondcloud.technology/
   
   Status bar should show:
   - SQL: Connected ✅
   - Latency: ~45ms
   - Write: Enabled ✅

3. **Test multiplayer**:
   - Click "Multiplayer"
   - Register a username
   - Should see "Welcome back, [username]!"
