const { createClient } = require('@supabase/supabase-js');

// Import database configuration from external file
// This file (db.config.js) is not committed to git for security
// Use db.config.example.js as a template
const dbConfig = require('./db.config.js');

// Create Supabase client
const supabase = createClient(dbConfig.supabaseUrl, dbConfig.supabaseAnonKey);

// Initialize database schema
async function initializeDatabase() {
    try {
        console.log('🔄 Initializing Supabase database schema...');
        
        // Create players table
        const { error: playersError } = await supabase.rpc('create_players_table', {});
        
        // Since we can't run raw SQL directly with the JS client in the same way,
        // we'll use Supabase's SQL editor or migrations
        // For now, we'll check if tables exist by trying to query them
        
        const { data: playersCheck, error: playersCheckError } = await supabase
            .from('players')
            .select('id')
            .limit(1);
        
        if (playersCheckError && playersCheckError.code === '42P01') {
            console.log('⚠️  Tables not found. Please run the following SQL in your Supabase SQL Editor:');
            console.log(`
-- Create players table
CREATE TABLE IF NOT EXISTS players (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    total_wins INT DEFAULT 0,
    total_losses INT DEFAULT 0,
    total_draws INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_username ON players(username);

-- Create active sessions table
CREATE TABLE IF NOT EXISTS active_sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    player_id BIGINT NOT NULL,
    username VARCHAR(50) NOT NULL,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Create game state enum type
DO $$ BEGIN
    CREATE TYPE game_state_enum AS ENUM ('pending', 'active', 'completed', 'abandoned');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create games table
CREATE TABLE IF NOT EXISTS games (
    id BIGSERIAL PRIMARY KEY,
    player1_id BIGINT NOT NULL,
    player2_id BIGINT NOT NULL,
    player1_username VARCHAR(50) NOT NULL,
    player2_username VARCHAR(50) NOT NULL,
    board_size INT DEFAULT 15,
    winner_id BIGINT,
    game_state game_state_enum DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (player1_id) REFERENCES players(id),
    FOREIGN KEY (player2_id) REFERENCES players(id),
    FOREIGN KEY (winner_id) REFERENCES players(id)
);

-- Create game moves table
CREATE TABLE IF NOT EXISTS game_moves (
    id BIGSERIAL PRIMARY KEY,
    game_id BIGINT NOT NULL,
    player_id BIGINT NOT NULL,
    row_position INT NOT NULL,
    col_position INT NOT NULL,
    move_number INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id)
);
CREATE INDEX IF NOT EXISTS idx_game ON game_moves(game_id);

-- Enable Row Level Security (RLS) - Optional but recommended
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust based on your security needs)
CREATE POLICY "Allow all operations on players" ON players FOR ALL USING (true);
CREATE POLICY "Allow all operations on active_sessions" ON active_sessions FOR ALL USING (true);
CREATE POLICY "Allow all operations on games" ON games FOR ALL USING (true);
CREATE POLICY "Allow all operations on game_moves" ON game_moves FOR ALL USING (true);
            `);
            throw new Error('Database tables not initialized. Please run the SQL above in Supabase SQL Editor.');
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
            const { data: existingPlayer, error: selectError } = await supabase
                .from('players')
                .select('id')
                .eq('username', username)
                .single();
            
            if (existingPlayer) {
                return existingPlayer.id;
            }
            
            // If not found, create new player
            const { data, error } = await supabase
                .from('players')
                .insert([{ username }])
                .select('id')
                .single();
            
            if (error) throw error;
            return data.id;
        } catch (error) {
            console.error('Error creating player:', error);
            throw error;
        }
    },
    
    // Get player by username
    async getPlayer(username) {
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .eq('username', username)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
        return data;
    },
    
    // Get player by ID
    async getPlayerById(playerId) {
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .eq('id', playerId)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },
    
    // Add active session
    async addSession(sessionId, playerId, username) {
        const { error } = await supabase
            .from('active_sessions')
            .upsert([{
                session_id: sessionId,
                player_id: playerId,
                username: username,
                last_heartbeat: new Date().toISOString()
            }], {
                onConflict: 'session_id'
            });
        
        if (error) throw error;
    },
    
    // Remove session
    async removeSession(sessionId) {
        const { error } = await supabase
            .from('active_sessions')
            .delete()
            .eq('session_id', sessionId);
        
        if (error) throw error;
    },
    
    // Get all active players
    async getActivePlayers() {
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        
        const { data, error } = await supabase
            .from('active_sessions')
            .select(`
                session_id,
                username,
                players!inner(total_wins, total_losses, total_draws)
            `)
            .gt('last_heartbeat', twoMinutesAgo);
        
        if (error) throw error;
        
        // Flatten the response to match the old format
        return data.map(row => ({
            session_id: row.session_id,
            username: row.username,
            total_wins: row.players.total_wins,
            total_losses: row.players.total_losses,
            total_draws: row.players.total_draws
        }));
    },
    
    // Create new game
    async createGame(player1Id, player2Id, player1Username, player2Username, boardSize) {
        const { data, error } = await supabase
            .from('games')
            .insert([{
                player1_id: player1Id,
                player2_id: player2Id,
                player1_username: player1Username,
                player2_username: player2Username,
                board_size: boardSize,
                game_state: 'active'
            }])
            .select('id')
            .single();
        
        if (error) throw error;
        return data.id;
    },
    
    // Record move
    async recordMove(gameId, playerId, row, col, moveNumber) {
        const { error } = await supabase
            .from('game_moves')
            .insert([{
                game_id: gameId,
                player_id: playerId,
                row_position: row,
                col_position: col,
                move_number: moveNumber
            }]);
        
        if (error) throw error;
    },
    
    // Complete game
    async completeGame(gameId, winnerId) {
        // Update game status
        const { error: gameError } = await supabase
            .from('games')
            .update({
                game_state: 'completed',
                winner_id: winnerId,
                completed_at: new Date().toISOString()
            })
            .eq('id', gameId);
        
        if (gameError) throw gameError;
        
        // Update player stats
        if (winnerId) {
            // Get game details
            const { data: game, error: selectError } = await supabase
                .from('games')
                .select('player1_id, player2_id')
                .eq('id', gameId)
                .single();
            
            if (selectError) throw selectError;
            
            if (game) {
                const loserId = game.player1_id === winnerId ? game.player2_id : game.player1_id;
                
                // Update winner
                await supabase.rpc('increment_wins', { player_id: winnerId });
                
                // Update loser
                await supabase.rpc('increment_losses', { player_id: loserId });
            }
        } else {
            // Draw - update both players
            const { data: game, error: selectError } = await supabase
                .from('games')
                .select('player1_id, player2_id')
                .eq('id', gameId)
                .single();
            
            if (selectError) throw selectError;
            
            if (game) {
                await supabase.rpc('increment_draws', { player_id: game.player1_id });
                await supabase.rpc('increment_draws', { player_id: game.player2_id });
            }
        }
    },
    
    // Abandon game
    async abandonGame(gameId, winnerId) {
        // Update game status
        const { error: gameError } = await supabase
            .from('games')
            .update({
                game_state: 'abandoned',
                winner_id: winnerId,
                completed_at: new Date().toISOString()
            })
            .eq('id', gameId);
        
        if (gameError) throw gameError;
        
        // Update stats (winner gets win, other player gets loss)
        if (winnerId) {
            const { data: game, error: selectError } = await supabase
                .from('games')
                .select('player1_id, player2_id')
                .eq('id', gameId)
                .single();
            
            if (selectError) throw selectError;
            
            if (game) {
                const loserId = game.player1_id === winnerId ? game.player2_id : game.player1_id;
                await supabase.rpc('increment_wins', { player_id: winnerId });
                await supabase.rpc('increment_losses', { player_id: loserId });
            }
        }
    },
    
    // Update heartbeat
    async updateHeartbeat(sessionId) {
        const { error } = await supabase
            .from('active_sessions')
            .update({ last_heartbeat: new Date().toISOString() })
            .eq('session_id', sessionId);
        
        if (error) throw error;
    },
    
    // Clean up stale sessions
    async cleanupStaleSessions() {
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        
        const { error } = await supabase
            .from('active_sessions')
            .delete()
            .lt('last_heartbeat', twoMinutesAgo);
        
        if (error) throw error;
    }
};

module.exports = { supabase, initializeDatabase, db };
