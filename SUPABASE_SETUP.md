# Supabase Setup Guide for Connect-5

This guide will help you set up Supabase for the Connect-5 multiplayer game.

## Step 1: Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in the project details:
   - **Organization**: Select or create your organization (e.g., "DeNNiiInc's Org")
   - **Project name**: `Connect5`
   - **Database password**: `t1hWsackxbYzRIPD` (or your chosen password)
   - **Region**: Oceania (Sydney) - or closest to your users
   - **Pricing Plan**: Free tier is sufficient for development
5. Click "Create new project"
6. Wait for the project to be provisioned (takes 1-2 minutes)

## Step 2: Get Your Credentials

Once your project is ready:

1. Go to **Project Settings** (gear icon in sidebar)
2. Navigate to **API** section
3. Copy the following values:
   - **Project URL** (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon/public key** (long JWT token starting with `eyJ...`)

## Step 3: Configure Your Application

1. Open `db.config.js` in your project
2. Replace the placeholder values:

```javascript
module.exports = {
    supabaseUrl: 'https://YOUR_PROJECT_ID.supabase.co', // Paste your Project URL here
    supabaseAnonKey: 'YOUR_ANON_KEY_HERE', // Paste your anon key here
    supabasePassword: 't1hWsackxbYzRIPD', // Your database password
    
    // Optional: Direct PostgreSQL connection
    postgresConnectionString: 'postgresql://postgres:t1hWsackxbYzRIPD@db.YOUR_PROJECT_ID.supabase.co:5432/postgres'
};
```

## Step 4: Create Database Tables

1. In your Supabase dashboard, click on **SQL Editor** in the sidebar
2. Click **New Query**
3. Copy and paste the following SQL:

```sql
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
CREATE POLICY "Allow all operations on players" ON players FOR ALL USING (true);
CREATE POLICY "Allow all operations on active_sessions" ON active_sessions FOR ALL USING (true);
CREATE POLICY "Allow all operations on games" ON games FOR ALL USING (true);
CREATE POLICY "Allow all operations on game_moves" ON game_moves FOR ALL USING (true);
```

4. Click **Run** or press `Ctrl+Enter`
5. You should see "Success. No rows returned" message

## Step 5: Create Helper Functions

1. In the same SQL Editor, create a new query
2. Copy and paste the contents of `supabase-functions.sql`:

```sql
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
```

3. Click **Run**

## Step 6: Test Your Connection

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Check the console output for:
   - ✅ Database schema verified successfully
   - 🗄️ Database connected

4. Open your browser to `http://localhost:3000`
5. Check the bottom status bar - it should show:
   - **SQL**: Connected (green)
   - **Latency**: Should be reasonable (depends on your location to Sydney)
   - **Write**: Enabled (green)

## Troubleshooting

### "Invalid API key" Error
- Double-check your `supabaseAnonKey` in `db.config.js`
- Make sure you copied the **anon/public** key, not the service_role key

### "Cannot reach Supabase" Error
- Verify your `supabaseUrl` is correct
- Check your internet connection
- Ensure no firewall is blocking Supabase

### "Table 'players' does not exist" Error
- Make sure you ran the SQL schema in Step 4
- Check the SQL Editor for any error messages
- Verify all tables were created in the **Table Editor**

### High Latency
- This is normal if you're far from the Sydney region
- Consider changing the region when creating your project
- Latency doesn't significantly affect gameplay for turn-based games

## Security Notes

- The `db.config.js` file is in `.gitignore` and will NOT be committed to Git
- Never share your database password or anon key publicly
- The anon key is safe to use in client-side code (it's protected by RLS policies)
- For production, consider implementing more restrictive RLS policies

## Next Steps

Once connected, you can:
- Test multiplayer functionality
- Monitor your database in the Supabase dashboard
- View real-time data in the **Table Editor**
- Check logs in the **Logs** section
- Set up database backups (available in paid plans)
