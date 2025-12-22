# Database Configuration Setup - PostgreSQL

## Overview
Database credentials are stored in a separate configuration file (`db.config.js`) that is **NOT committed to GitHub** for security reasons.

This project uses **PostgreSQL** for persistent data storage.

## Files

### 1. `db.config.example.js` (Committed to Git)
Template file showing the required PostgreSQL configuration structure.

### 2. `db.config.js` (NOT Committed - in .gitignore)
Contains actual PostgreSQL credentials. This file must be created manually.

### 3. `.gitignore`
Ensures `db.config.js` is never committed to the repository.

## Quick Setup

### Quick Start

1. **Ensure PostgreSQL is running** on your server
2. **Create the database:** `CREATE DATABASE connect5;`
3. **Run the schema:** `psql -h HOST -U postgres -d connect5 -f postgres-schema.sql`
4. **Create `db.config.js`:**
   ```javascript
   module.exports = {
       HOST: '202.171.184.108',
       USER: 'postgres',
       PASSWORD: 'your-password',
       DB: 'connect5',
       dialect: 'postgres',
       pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
   };
   ```
5. **Start server:** `npm start`

## Security Features

✅ **Credentials not in git** - `db.config.js` is in `.gitignore`  
✅ **Template provided** - `db.config.example.js` shows the structure  
✅ **Connection pooling** - Efficient database connection management  
✅ **Separate config** - Easy to update without touching main code  

## Troubleshooting

### Error: Cannot find module './db.config.js'

**Solution:** Create the `db.config.js` file:
```bash
cp db.config.example.js db.config.js
# Then edit with your PostgreSQL credentials
```

### Error: ECONNREFUSED or connection timeout

**Solution:** Check your credentials in `db.config.js`:
- Verify `HOST` is accessible
- Verify `USER` and `PASSWORD` are correct
- Ensure PostgreSQL server is running: `sudo systemctl status postgresql`
- Check firewall allows connection to port 5432

### Error: Table 'players' does not exist

**Solution:**
- Run the SQL schema: `psql -h HOST -U postgres -d connect5 -f postgres-schema.sql`
- See README.md for setup instructions

## Important Notes

⚠️ **NEVER commit `db.config.js` to git**  
⚠️ **Keep credentials secure**  
⚠️ **Use different databases for dev/prod**  
⚠️ **Configure PostgreSQL firewall rules appropriately**  

## File Structure

```
Connect-5/
├── db.config.example.js     ← Template (in git)
├── db.config.js             ← Your credentials (NOT in git)
├── .gitignore               ← Protects db.config.js
├── database.js              ← Imports from db.config.js
├── postgres-schema.sql      ← Database schema
└── README_DB_CONFIG.md      ← This file
```
