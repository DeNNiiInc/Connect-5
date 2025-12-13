# Database Configuration Setup

## Overview
Database credentials are stored in a separate configuration file (`db.config.js`) that is **NOT committed to GitHub** for security reasons.

## Files

### 1. `db.config.example.js` (Committed to Git)
Template file showing the required configuration structure.

### 2. `db.config.js` (NOT Committed - in .gitignore)
Contains actual database credentials. This file must be created manually.

### 3. `.gitignore`
Ensures `db.config.js` is never committed to the repository.

## Setup Instructions

### For Local Development

1. **Copy the example file:**
   ```bash
   cp db.config.example.js db.config.js
   ```

2. **Edit `db.config.js` with your credentials:**
   ```javascript
   module.exports = {
       host: 'localhost',  // or your database host
       user: 'your_username',
       password: 'your_password',
       database: 'appgconnect5_db',
       waitForConnections: true,
       connectionLimit: 10,
       queueLimit: 0
   };
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

### For Production Deployment

1. **Pull the latest code on your server:**
   ```bash
   git pull origin main
   ```

2. **Create `db.config.js` on the production server:**
   ```bash
   nano db.config.js
   # or
   vi db.config.js
   ```

3. **Add your production database credentials:**
   ```javascript
   module.exports = {
       host: 'your-production-db-host.com',
       user: 'production_user',
       password: 'secure_production_password',
       database: 'appgconnect5_db',
       waitForConnections: true,
       connectionLimit: 10,
       queueLimit: 0
   };
   ```

4. **Save and restart the server:**
   ```bash
   pm2 restart connect5
   # or your restart command
   ```

## Security Features

✅ **Credentials not in git** - `db.config.js` is in `.gitignore`  
✅ **Template provided** - `db.config.example.js` shows the structure  
✅ **Comments in code** - Clear instructions in `database.js`  
✅ **Separate config** - Easy to update without touching main code  

## Troubleshooting

### Error: Cannot find module './db.config.js'

**Solution:** You need to create the `db.config.js` file:
```bash
cp db.config.example.js db.config.js
# Then edit with your credentials
```

### Error: Access denied for user

**Solution:** Check your credentials in `db.config.js`:
- Verify username
- Verify password  
- Check host address
- Ensure user has proper permissions

### Connection timeout

**Solution:**
- Check if MySQL server is running
- Verify firewall allows connection
- Check host address is correct

## Important Notes

⚠️ **NEVER commit `db.config.js` to git**  
⚠️ **Keep production credentials secure**  
⚠️ **Use different credentials for dev/prod**  
⚠️ **Regularly rotate passwords**  

## File Structure

```
Connect-5/
├── db.config.example.js  ← Template (in git)
├── db.config.js          ← Your credentials (NOT in git)
├── .gitignore            ← Protects db.config.js
├── database.js           ← Imports from db.config.js
└── README_DB_CONFIG.md   ← This file
```
