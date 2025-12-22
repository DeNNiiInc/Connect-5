const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dbConfig = require('./db.config.js');

const pool = new Pool({
    host: dbConfig.HOST,
    user: dbConfig.USER,
    password: dbConfig.PASSWORD,
    database: dbConfig.DB,
    port: 5432,
    ssl: false // Assuming internal connection based on previous context
});

async function applySchema() {
    console.log('🔌 Connecting to database...');
    try {
        const client = await pool.connect();
        console.log('✅ Connected successfully.');

        console.log('📖 Reading schema file...');
        const schemaPath = path.join(__dirname, 'postgres-schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('⚙️ Applying schema updates...');
        // We split by standard semicolons might be risky for functions, 
        // but passing the whole file string to pool.query usually works for Postgres 
        // as it supports multiple statements if configured or via simple query.
        // However, pg-node sometimes strictly executes one statement.
        // PRO TIP: The functions contain semicolons. The safest way is to execute the whole block.
        
        await client.query(schema);
        
        console.log('✅ Schema applied successfully!');
        console.log('   - Tables verified/created');
        console.log('   - Stored procedures (increment_wins, etc.) updated');
        
        client.release();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error applying schema:', err);
        process.exit(1);
    }
}

applySchema();
