# Production Deployment Guide

## Quick Deployment

### Option 1: Automated Script (Recommended)

1. **Upload the deployment script** to your production server:
   ```bash
   scp deploy-production.sh user@connect5.beyondcloud.technology:/tmp/
   ```

2. **SSH into your server**:
   ```bash
   ssh user@connect5.beyondcloud.technology
   ```

3. **Update the script path** (if needed):
   ```bash
   nano /tmp/deploy-production.sh
   # Change PROJECT_DIR to your actual path
   ```

4. **Make it executable and run**:
   ```bash
   chmod +x /tmp/deploy-production.sh
   sudo /tmp/deploy-production.sh
   ```

---

### Option 2: Manual Steps

If you prefer manual deployment:

1. **SSH into production server**:
   ```bash
   ssh user@connect5.beyondcloud.technology
   ```

2. **Navigate to project**:
   ```bash
   cd /var/www/html/connect5.beyondcloud.technology  # Your actual path
   ```

3. **Pull latest code**:
   ```bash
   git pull origin main
   npm install
   ```

4. **Create db.config.js**:
   ```bash
   nano db.config.js
   ```
   
   Paste:
   ```javascript
   module.exports = {
       supabaseUrl: 'https://wxtirlphaphwbrgsjyop.supabase.co',
       supabaseAnonKey: 'sb_publishable_Onh4nNYCV99d2eGidQIpqA_9PBkY8zs',
       supabasePassword: 't1hWsackxbYzRIPD',
       postgresConnectionString: 'postgresql://postgres:t1hWsackxbYzRIPD@db.wxtirlphaphwbrgsjyop.supabase.co:5432/postgres'
   };
   ```
   
   Save with `Ctrl+X`, `Y`, `Enter`

5. **Restart server**:
   ```bash
   pm2 restart connect5
   # or if not running:
   pm2 start server.js --name connect5
   pm2 save
   ```

6. **Check status**:
   ```bash
   pm2 status
   pm2 logs connect5
   ```

---

## Verification

### 1. Test API Endpoint
```bash
curl https://connect5.beyondcloud.technology/api/db-status
```

Should return JSON like:
```json
{
  "connected": true,
  "latency": 45,
  "writeCapable": true,
  "database": "Supabase PostgreSQL"
}
```

### 2. Test in Browser

1. Visit https://connect5.beyondcloud.technology/
2. Check status bar at bottom:
   - **SQL**: Connected (green)
   - **Latency**: ~45ms
   - **Write**: Enabled (green)
3. Click "Multiplayer"
4. Enter a username
5. Should see "Welcome back, [username]!"

### 3. Test Multiplayer

1. Open two browser windows
2. Register different usernames in each
3. Send a challenge from one to the other
4. Accept and play a game
5. Verify stats update after game ends

---

## Troubleshooting

### API Returns 404

**Check if Node.js is running**:
```bash
pm2 status
```

**Check Apache proxy**:
```bash
sudo nano /etc/apache2/sites-available/connect5.conf
```

Should have:
```apache
ProxyPass /api http://localhost:3000/api
ProxyPassReverse /api http://localhost:3000/api
ProxyPass /socket.io http://localhost:3000/socket.io
ProxyPassReverse /socket.io http://localhost:3000/socket.io
```

**Restart Apache**:
```bash
sudo systemctl restart apache2
```

### WebSocket Connection Fails

**Enable Apache modules**:
```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
sudo systemctl restart apache2
```

### Database Connection Fails

**Check Supabase credentials**:
```bash
cat db.config.js
```

**Test connection**:
```bash
node -e "const {supabase} = require('./database'); supabase.from('players').select('id').limit(1).then(console.log)"
```

### Server Won't Start

**Check logs**:
```bash
pm2 logs connect5 --lines 50
```

**Check port availability**:
```bash
sudo netstat -tlnp | grep 3000
```

---

## Post-Deployment

### Monitor Server
```bash
pm2 monit
```

### View Logs
```bash
pm2 logs connect5 --lines 100
```

### Restart if Needed
```bash
pm2 restart connect5
```

### Update Later
```bash
cd /var/www/html/connect5.beyondcloud.technology
git pull origin main
npm install
pm2 restart connect5
```

---

## Apache Configuration Reference

If you need to set up Apache proxy from scratch:

```apache
<VirtualHost *:443>
    ServerName connect5.beyondcloud.technology
    
    DocumentRoot /var/www/html/connect5.beyondcloud.technology
    
    <Directory /var/www/html/connect5.beyondcloud.technology>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
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
    
    # SSL
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/connect5.beyondcloud.technology/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/connect5.beyondcloud.technology/privkey.pem
</VirtualHost>
```

Apply changes:
```bash
sudo systemctl restart apache2
```
