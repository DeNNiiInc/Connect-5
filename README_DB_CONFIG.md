# Database Configuration Setup - Supabase

## Overview
Database credentials are stored in a separate configuration file (`db.config.js`) that is **NOT committed to GitHub** for security reasons.

This project now uses **Supabase** (PostgreSQL) instead of MySQL.

## Files

### 1. `db.config.example.js` (Committed to Git)
Template file showing the required Supabase configuration structure.

### 2. `db.config.js` (NOT Committed - in .gitignore)
Contains actual Supabase credentials. This file must be created manually.

### 3. `.gitignore`
Ensures `db.config.js` is never committed to the repository.

## Quick Setup

See **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** for detailed step-by-step instructions.

### Quick Start

1. **Create Supabase project** at [app.supabase.com](https://app.supabase.com)
2. **Copy credentials** from Project Settings → API
3. **Update `db.config.js`:**
   ```javascript
   module.exports = {
       supabaseUrl: 'https://xxxxx.supabase.co',
       supabaseAnonKey: 'eyJhbGci...',
       supabasePassword: 't1hWsackxbYzRIPD'
   };
   ```
4. **Run SQL schema** in Supabase SQL Editor (see SUPABASE_SETUP.md)
5. **Start server:** `npm start`

## Security Features

✅ **Credentials not in git** - `db.config.js` is in `.gitignore`  
✅ **Template provided** - `db.config.example.js` shows the structure  
✅ **Supabase RLS** - Row Level Security policies protect data  
✅ **Separate config** - Easy to update without touching main code  

## Troubleshooting

### Error: Cannot find module './db.config.js'

**Solution:** Create the `db.config.js` file:
```bash
cp db.config.example.js db.config.js
# Then edit with your Supabase credentials
```

### Error: Invalid API key

**Solution:** Check your credentials in `db.config.js`:
- Verify `supabaseUrl` is correct
- Verify `supabaseAnonKey` (should start with `eyJ...`)
- Get credentials from Supabase dashboard → Project Settings → API

### Error: Table 'players' does not exist

**Solution:**
- Run the SQL schema in Supabase SQL Editor
- See SUPABASE_SETUP.md Step 4 for the complete schema

## Important Notes

⚠️ **NEVER commit `db.config.js` to git**  
⚠️ **Keep credentials secure**  
⚠️ **Use different projects for dev/prod**  
⚠️ **The anon key is safe for client-side use** (protected by RLS)  

## File Structure

```
Connect-5/
├── db.config.example.js     ← Template (in git)
├── db.config.js             ← Your credentials (NOT in git)
├── .gitignore               ← Protects db.config.js
├── database.js              ← Imports from db.config.js
├── supabase-functions.sql   ← Helper functions for Supabase
├── SUPABASE_SETUP.md        ← Detailed setup guide
└── README_DB_CONFIG.md      ← This file
```
