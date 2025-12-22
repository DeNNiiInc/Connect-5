-- ============================================
-- Connect-5 PostgreSQL Database Schema
-- Run this on your PostgreSQL server at:
-- 202.171.184.108
-- Database: connect5
-- ============================================

-- INSTRUCTIONS:
-- 1. Connect to your PostgreSQL server
-- 2. Ensure database 'connect5' exists (CREATE DATABASE connect5;)
-- 3. Connect to the connect5 database
-- 4. Run this entire script

-- ============================================
-- Create Tables
-- ============================================

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

-- ============================================
-- Create Functions
-- ============================================

-- Function to increment wins
CREATE OR REPLACE FUNCTION increment_wins(player_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE players SET total_wins = total_wins + 1 WHERE id = player_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to increment losses
CREATE OR REPLACE FUNCTION increment_losses(player_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE players SET total_losses = total_losses + 1 WHERE id = player_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to increment draws
CREATE OR REPLACE FUNCTION increment_draws(player_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE players SET total_draws = total_draws + 1 WHERE id = player_id_param;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Verification
-- ============================================

-- Verify tables were created
SELECT 
    'Tables Created Successfully!' as status,
    COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('players', 'active_sessions', 'games', 'game_moves');

-- Expected result: table_count = 4
