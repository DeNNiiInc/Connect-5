-- Complete Supabase Schema for Connect-5
-- Copy and paste this entire file into Supabase SQL Editor and run it

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

-- Enable Row Level Security (RLS)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust based on your security needs)
DROP POLICY IF EXISTS "Allow all operations on players" ON players;
CREATE POLICY "Allow all operations on players" ON players FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on active_sessions" ON active_sessions;
CREATE POLICY "Allow all operations on active_sessions" ON active_sessions FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on games" ON games;
CREATE POLICY "Allow all operations on games" ON games FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on game_moves" ON game_moves;
CREATE POLICY "Allow all operations on game_moves" ON game_moves FOR ALL USING (true);

-- Helper Functions
CREATE OR REPLACE FUNCTION increment_wins(player_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE players 
    SET total_wins = total_wins + 1 
    WHERE id = player_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_losses(player_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE players 
    SET total_losses = total_losses + 1 
    WHERE id = player_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_draws(player_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE players 
    SET total_draws = total_draws + 1 
    WHERE id = player_id;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Connect-5 database schema created successfully!';
END $$;
