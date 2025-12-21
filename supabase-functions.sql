-- Supabase SQL Helper Functions for Connect-5
-- Run this in your Supabase SQL Editor after creating the tables

-- Function to increment wins
CREATE OR REPLACE FUNCTION increment_wins(player_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE players 
    SET total_wins = total_wins + 1 
    WHERE id = player_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment losses
CREATE OR REPLACE FUNCTION increment_losses(player_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE players 
    SET total_losses = total_losses + 1 
    WHERE id = player_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment draws
CREATE OR REPLACE FUNCTION increment_draws(player_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE players 
    SET total_draws = total_draws + 1 
    WHERE id = player_id;
END;
$$ LANGUAGE plpgsql;

-- Optional: Function to get player stats
CREATE OR REPLACE FUNCTION get_player_stats(player_username VARCHAR)
RETURNS TABLE (
    id BIGINT,
    username VARCHAR,
    total_wins INT,
    total_losses INT,
    total_draws INT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.username, p.total_wins, p.total_losses, p.total_draws, p.created_at
    FROM players p
    WHERE p.username = player_username;
END;
$$ LANGUAGE plpgsql;
