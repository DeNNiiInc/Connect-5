const Filter = require('bad-words');
const filter = new Filter();

class GameManager {
    constructor(io, db) {
        this.io = io;
        this.db = db;
        this.players = new Map(); // socketId -> playerData
        this.challenges = new Map(); // challengeId -> challengeData
        this.activeGames = new Map(); // gameId -> gameData
        this.playerSockets = new Map(); // playerId -> socketId
    }
    
    // Validate and register player
    async registerPlayer(socket, username) {
        try {
            // Validate username
            if (!username || typeof username !== 'string') {
                return { success: false, error: 'Invalid username' };
            }
            
            // Clean and validate length
            username = username.trim();
            if (username.length < 3 || username.length > 20) {
                return { success: false, error: 'Username must be 3-20 characters' };
            }
            
            // Check for profanity
            if (filter.isProfane(username)) {
                return { success: false, error: 'Please use a family-friendly username' };
            }
            
            // Check alphanumeric plus basic chars
            if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
                return { success: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
            }
            
            // Create or get player from database
            const playerId = await this.db.createPlayer(username);
            const player = await this.db.getPlayerById(playerId);
            
            // Add session to database
            await this.db.addSession(socket.id, playerId, username);
            
            // Store in memory
            this.players.set(socket.id, {
                id: playerId,
                username: username,
                socketId: socket.id,
                currentGameId: null
            });
            
            this.playerSockets.set(playerId, socket.id);
            
            // Broadcast updated player list
            await this.broadcastActivePlayers();
            
            return {
                success: true,
                player: {
                    id: playerId,
                    username: username,
                    stats: {
                        wins: player.total_wins,
                        losses: player.total_losses,
                        draws: player.total_draws
                    }
                }
            };
        } catch (error) {
            console.error('Error registering player:', error);
            return { success: false, error: 'Registration failed' };
        }
    }
    
    // Handle player disconnect
    async handleDisconnect(socket) {
        const player = this.players.get(socket.id);
        if (!player) return;
        
        // Check if player is in an active game
        if (player.currentGameId) {
            const game = this.activeGames.get(player.currentGameId);
            if (game && game.state === 'active') {
                // Notify opponent
                const opponentId = game.player1Id === player.id ? game.player2Id : game.player1Id;
                const opponentSocketId = this.playerSockets.get(opponentId);
                
                if (opponentSocketId) {
                    this.io.to(opponentSocketId).emit('opponent_disconnected', {
                        message: `${player.username} disconnected`,
                        waitTime: 30
                    });
                }
                
                // Set timeout for game abandonment
                setTimeout(async () => {
                    const stillDisconnected = !this.players.has(socket.id);
                    if (stillDisconnected && game.state === 'active') {
                        // Award win to opponent
                        await this.db.abandonGame(player.currentGameId, opponentId);
                        
                        if (opponentSocketId) {
                            const opponentPlayer = await this.db.getPlayerById(opponentId);
                            this.io.to(opponentSocketId).emit('game_ended', {
                                reason: 'opponent_abandoned',
                                winner: opponentId,
                                stats: {
                                    wins: opponentPlayer.total_wins,
                                    losses: opponentPlayer.total_losses,
                                    draws: opponentPlayer.total_draws
                                }
                            });
                        }
                        
                        this.activeGames.delete(player.currentGameId);
                    }
                }, 30000); // 30 second grace period
            }
        }
        
        // Remove from active lists
        await this.db.removeSession(socket.id);
        this.players.delete(socket.id);
        this.playerSockets.delete(player.id);
        
        // Broadcast updated player list
        await this.broadcastActivePlayers();
    }
    
    // Broadcast active players to all connected clients
    async broadcastActivePlayers() {
        try {
            const activePlayers = await this.db.getActivePlayers();
            this.io.emit('active_players_update', activePlayers);
        } catch (error) {
            console.error('Error broadcasting active players:', error);
        }
    }
    
    // Send challenge
    async sendChallenge(socket, targetUsername, boardSize) {
        const challenger = this.players.get(socket.id);
        if (!challenger) {
            return { success: false, error: 'Not registered' };
        }
        
        // Find target player
        const target = Array.from(this.players.values()).find(p => p.username === targetUsername);
        if (!target) {
            return { success: false, error: 'Player not found' };
        }
        
        if (target.currentGameId) {
            return { success: false, error: 'Player is already in a game' };
        }
        
        // Create challenge
        const challengeId = `${challenger.id}-${target.id}-${Date.now()}`;
        this.challenges.set(challengeId, {
            id: challengeId,
            challengerId: challenger.id,
            challengerUsername: challenger.username,
            targetId: target.id,
            targetUsername: target.username,
            boardSize: boardSize,
            timestamp: Date.now()
        });
        
        // Send challenge to target
        this.io.to(target.socketId).emit('challenge_received', {
            challengeId: challengeId,
            from: challenger.username,
            boardSize: boardSize
        });
        
        return { success: true, message: 'Challenge sent' };
    }
    
    // Accept challenge
    async acceptChallenge(socket, challengeId) {
        const player = this.players.get(socket.id);
        const challenge = this.challenges.get(challengeId);
        
        if (!player || !challenge) {
            return { success: false, error: 'Invalid challenge' };
        }
        
        if (challenge.targetId !== player.id) {
            return { success: false, error: 'Not your challenge' };
        }
        
        // Remove challenge from pending
        this.challenges.delete(challengeId);
        
        // Create game in database
        const gameId = await this.db.createGame(
            challenge.challengerId,
            challenge.targetId,
            challenge.challengerUsername,
            challenge.targetUsername,
            challenge.boardSize
        );
        
        // Randomly assign X and O
        const player1IsX = Math.random() < 0.5;
        
        // Create game in memory
        const gameData = {
            id: gameId,
            player1Id: challenge.challengerId,
            player2Id: challenge.targetId,
            player1Username: challenge.challengerUsername,
            player2Username: challenge.targetUsername,
            player1Symbol: player1IsX ? 'X' : 'O',
            player2Symbol: player1IsX ? 'O' : 'X',
            boardSize: challenge.boardSize,
            currentTurn: challenge.challengerId, // Challenger goes first
            state: 'active',
            board: Array(challenge.boardSize).fill(null).map(() => Array(challenge.boardSize).fill(null)),
            moveCount: 0
        };
        
        this.activeGames.set(gameId, gameData);
        
        // Update players' current game
        const challenger = this.players.get(this.playerSockets.get(challenge.challengerId));
        const accepter = this.players.get(socket.id);
        if (challenger) challenger.currentGameId = gameId;
        if (accepter) accepter.currentGameId = gameId;
        
        // Notify both players
        const challengerSocket = this.playerSockets.get(challenge.challengerId);
        if (challengerSocket) {
            this.io.to(challengerSocket).emit('game_started', {
                gameId: gameId,
                opponent: challenge.targetUsername,
                yourSymbol: gameData.player1Symbol,
                boardSize: challenge.boardSize,
                yourTurn: true
            });
        }
        
        this.io.to(socket.id).emit('game_started', {
            gameId: gameId,
            opponent: challenge.challengerUsername,
            yourSymbol: gameData.player2Symbol,
            boardSize: challenge.boardSize,
            yourTurn: false
        });
        
        return { success: true };
    }
    
    // Decline challenge
    declineChallenge(socket, challengeId) {
        const challenge = this.challenges.get(challengeId);
        if (!challenge) return;
        
        this.challenges.delete(challengeId);
        
        // Notify challenger
        const challengerSocket = this.playerSockets.get(challenge.challengerId);
        if (challengerSocket) {
            this.io.to(challengerSocket).emit('challenge_declined', {
                by: challenge.targetUsername
            });
        }
    }
    
    // Handle game move
    async handleMove(socket, moveData) {
        const player = this.players.get(socket.id);
        if (!player) return { success: false, error: 'Not registered' };
        
        const game = this.activeGames.get(moveData.gameId);
        if (!game) return { success: false, error: 'Game not found' };
        
        if (game.state !== 'active') return { success: false, error: 'Game not active' };
        
        // Validate it's player's turn
        if (game.currentTurn !== player.id) {
            return { success: false, error: 'Not your turn' };
        }
        
        // Validate move
        const { row, col } = moveData;
        if (row < 0 || row >= game.boardSize || col < 0 || col >= game.boardSize) {
            return { success: false, error: 'Invalid position' };
        }
        
        if (game.board[row][col] !== null) {
            return { success: false, error: 'Cell occupied' };
        }
        
        // Determine player's symbol
        const playerSymbol = game.player1Id === player.id ? game.player1Symbol : game.player2Symbol;
        
        // Make move
        game.board[row][col] = playerSymbol;
        game.moveCount++;
        
        // Record move in database
        await this.db.recordMove(game.id, player.id, row, col, game.moveCount);
        
        // Broadcast move to opponent
        const opponentId = game.player1Id === player.id ? game.player2Id : game.player1Id;
        const opponentSocket = this.playerSockets.get(opponentId);
        
        if (opponentSocket) {
            this.io.to(opponentSocket).emit('opponent_move', {
                row: row,
                col: col,
                symbol: playerSymbol
            });
        }
        
        // Check for win
        const winner = this.checkWin(game, row, col, playerSymbol);
        if (winner) {
            game.state = 'completed';
            await this.db.completeGame(game.id, player.id);
            
            const winnerPlayer = await this.db.getPlayerById(player.id);
            const loserPlayer = await this.db.getPlayerById(opponentId);
            
            // Notify both players
            this.io.to(socket.id).emit('game_ended', {
                reason: 'win',
                winner: player.id,
                stats: {
                    wins: winnerPlayer.total_wins,
                    losses: winnerPlayer.total_losses,
                    draws: winnerPlayer.total_draws
                }
            });
            
            if (opponentSocket) {
                this.io.to(opponentSocket).emit('game_ended', {
                    reason: 'loss',
                    winner: player.id,
                    stats: {
                        wins: loserPlayer.total_wins,
                        losses: loserPlayer.total_losses,
                        draws: loserPlayer.total_draws
                    }
                });
            }
            
            // Clean up
            this.activeGames.delete(game.id);
            if (this.players.has(socket.id)) this.players.get(socket.id).currentGameId = null;
            if (opponentSocket && this.players.has(opponentSocket)) {
                this.players.get(opponentSocket).currentGameId = null;
            }
            
            return { success: true, gameOver: true, winner: true };
        }
        
        // Check for draw
        if (game.moveCount === game.boardSize * game.boardSize) {
            game.state = 'completed';
            await this.db.completeGame(game.id, null);
            
            const player1Data = await this.db.getPlayerById(game.player1Id);
            const player2Data = await this.db.getPlayerById(game.player2Id);
            
            this.io.to(socket.id).emit('game_ended', {
                reason: 'draw',
                stats: {
                    wins: player.id === game.player1Id ? player1Data.total_wins : player2Data.total_wins,
                    losses: player.id === game.player1Id ? player1Data.total_losses : player2Data.total_losses,
                    draws: player.id === game.player1Id ? player1Data.total_draws : player2Data.total_draws
                }
            });
            
            if (opponentSocket) {
                this.io.to(opponentSocket).emit('game_ended', {
                    reason: 'draw',
                    stats: {
                        wins: opponentId === game.player1Id ? player1Data.total_wins : player2Data.total_wins,
                        losses: opponentId === game.player1Id ? player1Data.total_losses : player2Data.total_losses,
                        draws: opponentId === game.player1Id ? player1Data.total_draws : player2Data.total_draws
                    }
                });
            }
            
            this.activeGames.delete(game.id);
            if (this.players.has(socket.id)) this.players.get(socket.id).currentGameId = null;
            if (opponentSocket && this.players.has(opponentSocket)) {
                this.players.get(opponentSocket).currentGameId = null;
            }
            
            return { success: true, gameOver: true, draw: true };
        }
        
        // Switch turn
        game.currentTurn = opponentId;
        
        return { success: true, gameOver: false };
    }
    
    // Check win condition (same as frontend logic)
    checkWin(game, row, col, symbol) {
        const directions = [
            [0, 1],   // Horizontal
            [1, 0],   // Vertical
            [1, 1],   // Diagonal \
            [1, -1]   // Diagonal /
        ];
        
        for (const [dx, dy] of directions) {
            let count = 1;
            count += this.countDirection(game, row, col, dx, dy, symbol);
            count += this.countDirection(game, row, col, -dx, -dy, symbol);
            
            if (count >= 5) {
                return true;
            }
        }
        
        return false;
    }
    
    countDirection(game, row, col, dx, dy, symbol) {
        let count = 0;
        let r = row + dx;
        let c = col + dy;
        
        while (
            r >= 0 && r < game.boardSize &&
            c >= 0 && c < game.boardSize &&
            game.board[r][c] === symbol
        ) {
            count++;
            r += dx;
            c += dy;
        }
        
        return count;
    }
    
    // Heartbeat to keep session alive
    async heartbeat(socket) {
        const player = this.players.get(socket.id);
        if (player) {
            await this.db.updateHeartbeat(socket.id);
        }
    }
}

module.exports = GameManager;
