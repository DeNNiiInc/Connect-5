const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const { initializeDatabase, db } = require('./database');
const GameManager = require('./gameManager');

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

// Database health check endpoint
app.get('/api/db-status', async (req, res) => {
    const startTime = Date.now();
    let status = {
        connected: false,
        latency: 0,
        writeCapable: false,
        timestamp: new Date().toISOString(),
        error: null
    };

    try {
        // Test connection with a simple query
        const [result] = await db.pool.query('SELECT 1 as test');
        const latency = Date.now() - startTime;
        
        if (result && result[0].test === 1) {
            status.connected = true;
            status.latency = latency;

            // Test write capability
            try {
                const testTableName = '_health_check_test';
                
                // Create test table if it doesn't exist
                await db.pool.query(`
                    CREATE TABLE IF NOT EXISTS ${testTableName} (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        test_value VARCHAR(50),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                
                // Try to insert a test record
                const testValue = `test_${Date.now()}`;
                await db.pool.query(
                    `INSERT INTO ${testTableName} (test_value) VALUES (?)`,
                    [testValue]
                );
                
                // Clean up old test records (keep only last 10)
                await db.pool.query(`
                    DELETE FROM ${testTableName} 
                    WHERE id NOT IN (
                        SELECT id FROM (
                            SELECT id FROM ${testTableName} 
                            ORDER BY created_at DESC 
                            LIMIT 10
                        ) AS keep_records
                    )
                `);
                
                status.writeCapable = true;
            } catch (writeError) {
                console.error('Write test failed:', writeError.message);
                status.writeCapable = false;
                status.error = `Write test failed: ${writeError.message}`;
            }
        }
    } catch (error) {
        console.error('Database health check failed:', error.message);
        status.connected = false;
        status.latency = Date.now() - startTime;
        status.error = error.message;
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
