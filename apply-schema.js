// Quick script to apply postgres-schema.sql to the database
// Run with: node apply-schema.js

const fs = require('fs');
const { Pool } = require('pg');
const dbConfig = require('./db.config.js');

const pool = new Pool({
    host: dbConfig.HOST,
    user: dbConfig.USER,
    password: dbConfig.PASSWORD,
    database: dbConfig.DB,
    port: 5432
});

async function applySchema() {
    try {
        console.log('📄 Reading postgres-schema.sql...');
        const schema = fs.readFileSync('./postgres-schema.sql', 'utf8');
        
        console.log('🔗 Connecting to PostgreSQL...');
        console.log(`   Host: ${dbConfig.HOST}`);
        console.log(`   Database: ${dbConfig.DB}`);
        
        console.log('⚙️  Applying schema...');
        await pool.query(schema);
        
        console.log('✅ Schema applied successfully!');
        
        // Verify tables were created
        console.log('\n🔍 Verifying tables...');
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('players', 'active_sessions', 'games', 'game_moves')
            ORDER BY table_name;
        `);
        
        console.log(`✅ Found ${result.rows.length} tables:`);
        result.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });
        
        if (result.rows.length === 4) {
            console.log('\n🎉 Database setup complete! You can now run: npm start');
        } else {
            console.log('\n⚠️  Warning: Expected 4 tables but found', result.rows.length);
        }
        
    } catch (error) {
        console.error('❌ Error applying schema:', error.message);
        console.error('\nDetails:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

applySchema();
