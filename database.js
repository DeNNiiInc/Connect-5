const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: 'oceprod.beyondcloud.solutions',
    user: 'appgconnect5_dbuser',
    password: 'REqTtHhZCKAlJAnznjLx8ZhOq',
    database: 'appgconnect5_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Initialize database schema
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        
        // Create players table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS players (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                total_wins INT DEFAULT 0,
                total_losses INT DEFAULT 0,
                total_draws INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_username (username)
            )
        `);
        
        // Create active sessions table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS active_sessions (
                session_id VARCHAR(100) PRIMARY KEY,
                player_id INT NOT NULL,
                username VARCHAR(50) NOT NULL,
                connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
            )
        `);
        
        // Create games table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS games (
                id INT AUTO_INCREMENT PRIMARY KEY,
                player1_id INT NOT NULL,
                player2_id INT NOT NULL,
                player1_username VARCHAR(50) NOT NULL,
                player2_username VARCHAR(50) NOT NULL,
                board_size INT DEFAULT 15,
                winner_id INT,
                game_state ENUM('pending', 'active', 'completed', 'abandoned') DEFAULT 'pending',
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP NULL,
                FOREIGN KEY (player1_id) REFERENCES players(id),
                FOREIGN KEY (player2_id) REFERENCES players(id),
                FOREIGN KEY (winner_id) REFERENCES players(id)
            )
        `);
        
        // Create game moves table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS game_moves (
                id INT AUTO_INCREMENT PRIMARY KEY,
                game_id INT NOT NULL,
                player_id INT NOT NULL,
                row_position INT NOT NULL,
                col_position INT NOT NULL,
                move_number INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
                FOREIGN KEY (player_id) REFERENCES players(id),
                INDEX idx_game (game_id)
            )
        `);
        
        connection.release();
        console.log('✅ Database schema initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    }
}

// Database query functions
const db = {
    // Create or get player
    async createPlayer(username) {
        try {
            const [result] = await pool.query(
                'INSERT INTO players (username) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
                [username]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error creating player:', error);
            throw error;
        }
    },
    
    // Get player by username
    async getPlayer(username) {
        const [rows] = await pool.query(
            'SELECT * FROM players WHERE username = ?',
            [username]
        );
        return rows[0];
    },
    
    // Get player by ID
    async getPlayerById(playerId) {
        const [rows] = await pool.query(
            'SELECT * FROM players WHERE id = ?',
            [playerId]
        );
        return rows[0];
    },
    
    // Add active session
    async addSession(sessionId, playerId, username) {
        await pool.query(
            'INSERT INTO active_sessions (session_id, player_id, username) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE last_heartbeat = CURRENT_TIMESTAMP',
            [sessionId, playerId, username]
        );
    },
    
    // Remove session
    async removeSession(sessionId) {
        await pool.query(
            'DELETE FROM active_sessions WHERE session_id = ?',
            [sessionId]
        );
    },
    
    // Get all active players
    async getActivePlayers() {
        const [rows] = await pool.query(`
            SELECT s.session_id, s.username, p.total_wins, p.total_losses, p.total_draws
            FROM active_sessions s
            JOIN players p ON s.player_id = p.id
            WHERE s.last_heartbeat > DATE_SUB(NOW(), INTERVAL 2 MINUTE)
        `);
        return rows;
    },
    
    // Create new game
    async createGame(player1Id, player2Id, player1Username, player2Username, boardSize) {
        const [result] = await pool.query(
            'INSERT INTO games (player1_id, player2_id, player1_username, player2_username, board_size, game_state) VALUES (?, ?, ?, ?, ?, ?)',
            [player1Id, player2Id, player1Username, player2Username, boardSize, 'active']
        );
        return result.insertId;
    },
    
    // Record move
    async recordMove(gameId, playerId, row, col, moveNumber) {
        await pool.query(
            'INSERT INTO game_moves (game_id, player_id, row_position, col_position, move_number) VALUES (?, ?, ?, ?, ?)',
            [gameId, playerId, row, col, moveNumber]
        );
    },
    
    // Complete game
    async completeGame(gameId, winnerId) {
        await pool.query(
            'UPDATE games SET game_state = ?, winner_id = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['completed', winnerId, gameId]
        );
        
        // Update player stats
        if (winnerId) {
            // Get game details
            const [game] = await pool.query('SELECT player1_id, player2_id FROM games WHERE id = ?', [gameId]);
            if (game.length > 0) {
                const loserId = game[0].player1_id === winnerId ? game[0].player2_id : game[0].player1_id;
                
                // Update winner
                await pool.query('UPDATE players SET total_wins = total_wins + 1 WHERE id = ?', [winnerId]);
                
                // Update loser
                await pool.query('UPDATE players SET total_losses = total_losses + 1 WHERE id = ?', [loserId]);
            }
        } else {
            // Draw - update both players
            const [game] = await pool.query('SELECT player1_id, player2_id FROM games WHERE id = ?', [gameId]);
            if (game.length > 0) {
                await pool.query('UPDATE players SET total_draws = total_draws + 1 WHERE id IN (?, ?)', 
                    [game[0].player1_id, game[0].player2_id]);
            }
        }
    },
    
    // Abandon game
    async abandonGame(gameId, winnerId) {
        await pool.query(
            'UPDATE games SET game_state = ?, winner_id = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['abandoned', winnerId, gameId]
        );
        
        // Update stats (winner gets win, other player gets loss)
        if (winnerId) {
            const [game] = await pool.query('SELECT player1_id, player2_id FROM games WHERE id = ?', [gameId]);
            if (game.length > 0) {
                const loserId = game[0].player1_id === winnerId ? game[0].player2_id : game[0].player1_id;
                await pool.query('UPDATE players SET total_wins = total_wins + 1 WHERE id = ?', [winnerId]);
                await pool.query('UPDATE players SET total_losses = total_losses + 1 WHERE id = ?', [loserId]);
            }
        }
    },
    
    // Update heartbeat
    async updateHeartbeat(sessionId) {
        await pool.query(
            'UPDATE active_sessions SET last_heartbeat = CURRENT_TIMESTAMP WHERE session_id = ?',
            [sessionId]
        );
    },
    
    // Clean up stale sessions
    async cleanupStaleSessions() {
        await pool.query(
            'DELETE FROM active_sessions WHERE last_heartbeat < DATE_SUB(NOW(), INTERVAL 2 MINUTE)'
        );
    }
};

module.exports = { pool, initializeDatabase, db };
