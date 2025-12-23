const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const { initializeDatabase, db, pool } = require('./database');
const GameManager = require('./gameManager');

const { execSync } = require('child_process');

// Capture Git Version Info at Startup
let gitVersion = { hash: 'dev', timestamp: Date.now() / 1000 };
try {
    const hash = execSync('git log -1 --format=%h').toString().trim();
    const timestamp = parseInt(execSync('git log -1 --format=%ct').toString().trim());
    gitVersion = { hash, timestamp };
    console.log(`📦 Version: ${hash} (${new Date(timestamp * 1000).toISOString()})`);
} catch (e) {
    console.warn('⚠️ Failed to get git version:', e.message);
}

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Version Endpoint
app.get('/api/version', (req, res) => {
    res.json(gitVersion);
});

// Database health check endpoint with detailed diagnostics
app.get('/api/db-status', async (req, res) => {
    const startTime = Date.now();
    const dbConfig = require('./db.config.js');
    
    let status = {
        connected: false,
        latency: 0,
        writeCapable: false,
        timestamp: new Date().toISOString(),
        error: null,
        // Additional diagnostic info
        host: dbConfig.HOST || 'unknown',
        database: dbConfig.DB || 'unknown',
        connectionType: 'PostgreSQL Direct Connection'
    };

    try {
        console.log(`[DB-STATUS] Testing PostgreSQL connection to ${status.host}:5432/${status.database}...`);
        
        // Test connection with a simple query
        const result = await pool.query('SELECT id FROM players LIMIT 1');
        
        const latency = Date.now() - startTime;
        
        status.connected = true;
        status.latency = latency;
        console.log(`[DB-STATUS] ✅ Connection successful (${latency}ms)`);

        // Test write capability
        try {
            console.log(`[DB-STATUS] Testing write capability...`);
            
            // Try to insert a test record
            const testUsername = `_test_${Date.now()}`;
            const insertResult = await pool.query(
                'INSERT INTO players (username) VALUES ($1) RETURNING id',
                [testUsername]
            );
            
            if (insertResult.rows.length > 0) {
                // Clean up test record
                await pool.query(
                    'DELETE FROM players WHERE id = $1',
                    [insertResult.rows[0].id]
                );
                
                status.writeCapable = true;
                console.log(`[DB-STATUS] ✅ Write test successful`);
            }
        } catch (writeError) {
            console.error(`[DB-STATUS] ❌ Write test failed:`, writeError.message);
            status.writeCapable = false;
            status.error = `Write test failed: ${writeError.message}`;
        }
    } catch (error) {
        console.error(`[DB-STATUS] ❌ Connection failed:`, error.message);
        console.error(`[DB-STATUS] Error details:`, error);
        
        status.connected = false;
        status.latency = Date.now() - startTime;
        
        // Provide more detailed error messages
        let errorMessage = error.message;
        if (error.code === '42P01') {
            errorMessage = `Table 'players' does not exist. Please run postgres-schema.sql.`;
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = `Cannot connect to PostgreSQL at ${dbConfig.HOST}:5432. Check if PostgreSQL is running.`;
        } else if (error.code === '28P01') {
            errorMessage = `Authentication failed. Check username/password in db.config.js.`;
        } else if (error.code === '3D000') {
            errorMessage = `Database '${dbConfig.DB}' does not exist. Please create it first.`;
        }
        
        status.error = errorMessage;
    }

    res.json(status);
});

// Initialize game manager
const gameManager = new GameManager(io, db);

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`✅ Player connected: ${socket.id}`);
    
    // Player registration
    socket.on('register_player', async (data) => {
        console.log('📝 Registration request from', socket.id, 'username:', data.username);
        const result = await gameManager.registerPlayer(socket, data.username);
        console.log('📝 Registration result:', result);
        socket.emit('registration_result', result);
    });
    
    // Send challenge
    socket.on('send_challenge', async (data) => {
        const result = await gameManager.sendChallenge(socket, data.targetUsername, data.boardSize);
        socket.emit('challenge_result', result);
    });
    
    // Accept challenge
    socket.on('accept_challenge', async (data) => {
        const result = await gameManager.acceptChallenge(socket, data.challengeId);
        if (result.success) {
            socket.emit('challenge_accepted', result);
        } else {
            socket.emit('challenge_error', result);
        }
    });
    
    // Decline challenge
    socket.on('decline_challenge', (data) => {
        gameManager.declineChallenge(socket, data.challengeId);
    });
    
    // Make move
    socket.on('make_move', async (data) => {
        const result = await gameManager.handleMove(socket, data);
        socket.emit('move_result', result);
    });
    
    // Heartbeat to keep session alive
    socket.on('heartbeat', async () => {
        await gameManager.heartbeat(socket);
    });

    // Surrender
    socket.on('surrender', async (data) => {
        await gameManager.handleSurrender(socket, data);
    });

    // Rematch
    socket.on('send_rematch', (data) => {
        gameManager.sendRematch(socket, data);
    });

    socket.on('accept_rematch', async (data) => {
        await gameManager.acceptRematch(socket, data);
    });

    socket.on('decline_rematch', (data) => {
        gameManager.declineRematch(socket, data);
    });
    
    // Request active players
    socket.on('request_active_players', async () => {
        const activePlayers = await db.getActivePlayers();
        socket.emit('active_players_update', activePlayers);
    });
    
    // Disconnect
    socket.on('disconnect', async () => {
        console.log(`❌ Player disconnected: ${socket.id}`);
        await gameManager.handleDisconnect(socket);
    });
});

// Cleanup stale sessions periodically
setInterval(async () => {
    await db.cleanupStaleSessions();
}, 60000); // Every minute

// Error handling
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// Initialize database and start server
async function startServer() {
    try {
        await initializeDatabase();
        
        server.listen(PORT, () => {
            console.log('');
            console.log('═══════════════════════════════════════════════════');
            console.log('🎮 Connect-5 Multiplayer Server');
            console.log('═══════════════════════════════════════════════════');
            console.log(`🌐 Server running on port ${PORT}`);
            console.log(`📡 WebSocket server ready`);
            console.log(`🗄️  Database connected`);
            console.log('');
            console.log(`🎯 Open your browser to: http://localhost:${PORT}`);
            console.log('═══════════════════════════════════════════════════');
            console.log('');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
