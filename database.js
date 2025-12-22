const { Pool } = require('pg');

// Import database configuration from external file
// This file (db.config.js) is not committed to git for security
// Use db.config.example.js as a template
const dbConfig = require('./db.config.js');

// Create PostgreSQL connection pool
const pool = new Pool({
    host: dbConfig.HOST,
    user: dbConfig.USER,
    password: dbConfig.PASSWORD,
    database: dbConfig.DB,
    port: 5432,
    max: dbConfig.pool.max,
    min: dbConfig.pool.min,
    acquireTimeoutMillis: dbConfig.pool.acquire,
    idleTimeoutMillis: dbConfig.pool.idle
});

// Handle pool errors
pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
});

// Initialize database schema
async function initializeDatabase() {
    try {
        console.log('🔄 Initializing PostgreSQL database schema...');
        
        // Check if tables exist by trying to query them
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'players'
            );
        `);
        
        if (!result.rows[0].exists) {
            console.log('⚠️  Tables not found. Please run the following SQL in your PostgreSQL database:');
            console.log(`
Run the postgres-schema.sql file in your PostgreSQL database:
psql -h ${dbConfig.HOST} -U ${dbConfig.USER} -d ${dbConfig.DB} -f postgres-schema.sql
            `);
            throw new Error('Database tables not initialized. Please run postgres-schema.sql first.');
        }
        
        console.log('✅ Database schema verified successfully');
    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
        throw error;
    }
}

// Database query functions
const db = {
    // Create or get player
    async createPlayer(username) {
        try {
            // First try to get existing player
            const selectResult = await pool.query(
                'SELECT id FROM players WHERE username = $1',
                [username]
            );
            
            if (selectResult.rows.length > 0) {
                return selectResult.rows[0].id;
            }
            
            // If not found, create new player
            const insertResult = await pool.query(
                'INSERT INTO players (username) VALUES ($1) RETURNING id',
                [username]
            );
            
            return insertResult.rows[0].id;
        } catch (error) {
            console.error('Error creating player:', error);
            throw error;
        }
    },
    
    // Get player by username
    async getPlayer(username) {
        const result = await pool.query(
            'SELECT * FROM players WHERE username = $1',
            [username]
        );
        
        return result.rows[0] || null;
    },
    
    // Get player by ID
    async getPlayerById(playerId) {
        const result = await pool.query(
            'SELECT * FROM players WHERE id = $1',
            [playerId]
        );
        
        return result.rows[0] || null;
    },
    
    // Add active session
    async addSession(sessionId, playerId, username) {
        await pool.query(
            `INSERT INTO active_sessions (session_id, player_id, username, last_heartbeat)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (session_id) 
             DO UPDATE SET last_heartbeat = NOW()`,
            [sessionId, playerId, username]
        );
    },
    
    // Remove session
    async removeSession(sessionId) {
        await pool.query(
            'DELETE FROM active_sessions WHERE session_id = $1',
            [sessionId]
        );
    },
    
    // Get all active players
    async getActivePlayers() {
        const result = await pool.query(
            `SELECT 
                s.session_id,
                s.username,
                p.total_wins,
                p.total_losses,
                p.total_draws
             FROM active_sessions s
             INNER JOIN players p ON s.player_id = p.id
             WHERE s.last_heartbeat > NOW() - INTERVAL '2 minutes'`
        );
        
        return result.rows;
    },
    
    // Create new game
    async createGame(player1Id, player2Id, player1Username, player2Username, boardSize) {
        const result = await pool.query(
            `INSERT INTO games (player1_id, player2_id, player1_username, player2_username, board_size, game_state)
             VALUES ($1, $2, $3, $4, $5, 'active')
             RETURNING id`,
            [player1Id, player2Id, player1Username, player2Username, boardSize]
        );
        
        return result.rows[0].id;
    },
    
    // Record move
    async recordMove(gameId, playerId, row, col, moveNumber) {
        await pool.query(
            `INSERT INTO game_moves (game_id, player_id, row_position, col_position, move_number)
             VALUES ($1, $2, $3, $4, $5)`,
            [gameId, playerId, row, col, moveNumber]
        );
    },
    
    // Complete game
    async completeGame(gameId, winnerId) {
        // Update game status
        await pool.query(
            `UPDATE games 
             SET game_state = 'completed', winner_id = $1, completed_at = NOW()
             WHERE id = $2`,
            [winnerId, gameId]
        );
        
        // Update player stats
        if (winnerId) {
            // Get game details
            const gameResult = await pool.query(
                'SELECT player1_id, player2_id FROM games WHERE id = $1',
                [gameId]
            );
            
            if (gameResult.rows.length > 0) {
                const game = gameResult.rows[0];
                const loserId = game.player1_id === winnerId ? game.player2_id : game.player1_id;
                
                // Update winner
                await pool.query('SELECT increment_wins($1)', [winnerId]);
                
                // Update loser
                await pool.query('SELECT increment_losses($1)', [loserId]);
            }
        } else {
            // Draw - update both players
            const gameResult = await pool.query(
                'SELECT player1_id, player2_id FROM games WHERE id = $1',
                [gameId]
            );
            
            if (gameResult.rows.length > 0) {
                const game = gameResult.rows[0];
                await pool.query('SELECT increment_draws($1)', [game.player1_id]);
                await pool.query('SELECT increment_draws($1)', [game.player2_id]);
            }
        }
    },
    
    // Abandon game
    async abandonGame(gameId, winnerId) {
        // Update game status
        await pool.query(
            `UPDATE games 
             SET game_state = 'abandoned', winner_id = $1, completed_at = NOW()
             WHERE id = $2`,
            [winnerId, gameId]
        );
        
        // Update stats (winner gets win, other player gets loss)
        if (winnerId) {
            const gameResult = await pool.query(
                'SELECT player1_id, player2_id FROM games WHERE id = $1',
                [gameId]
            );
            
            if (gameResult.rows.length > 0) {
                const game = gameResult.rows[0];
                const loserId = game.player1_id === winnerId ? game.player2_id : game.player1_id;
                await pool.query('SELECT increment_wins($1)', [winnerId]);
                await pool.query('SELECT increment_losses($1)', [loserId]);
            }
        }
    },
    
    // Update heartbeat
    async updateHeartbeat(sessionId) {
        await pool.query(
            'UPDATE active_sessions SET last_heartbeat = NOW() WHERE session_id = $1',
            [sessionId]
        );
    },
    
    // Clean up stale sessions
    async cleanupStaleSessions() {
        await pool.query(
            `DELETE FROM active_sessions 
             WHERE last_heartbeat < NOW() - INTERVAL '2 minutes'`
        );
    }
};

module.exports = { pool, initializeDatabase, db };
