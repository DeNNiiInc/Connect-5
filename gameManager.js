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
        this.activeGames = new Map(); // gameId -> gameData
        this.playerSockets = new Map(); // playerId -> socketId
        this.rematches = new Map(); // rematchId -> rematchData
        this.disconnectTimeouts = new Map(); // playerId -> timeoutId
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
            
            const response = {
                success: true,
                player: {
                    id: playerId,
                    username: username,
                    stats: {
                        wins: player.total_wins,
                        losses: player.total_losses,
                        draws: player.total_draws
                    }
                },
                activeGame: null // Will be populated if they are reconnecting
            };

            // Check if player is in an active game (reconnection)
            for (const [gameId, game] of this.activeGames.entries()) {
                if (game.state === 'active' && (game.player1Id === playerId || game.player2Id === playerId)) {
                    // Restore game state for player
                    const playerEntry = this.players.get(socket.id);
                    if (playerEntry) {
                        playerEntry.currentGameId = gameId;
                    }
                    
                    // Clear any pending disconnect timeout
                    if (this.disconnectTimeouts.has(playerId)) {
                        clearTimeout(this.disconnectTimeouts.get(playerId));
                        this.disconnectTimeouts.delete(playerId);
                    }
                    
                    // Notify opponent of reconnection
                    const opponentId = game.player1Id === playerId ? game.player2Id : game.player1Id;
                    const opponentSocket = this.playerSockets.get(opponentId);
                    if (opponentSocket) {
                        this.io.to(opponentSocket).emit('opponent_reconnected', {
                            message: `${username} reconnected!`
                        });
                    }

                    // Add game data to response so client can restore board
                    response.activeGame = {
                        gameId: gameId,
                        opponent: game.player1Id === playerId ? game.player2Username : game.player1Username,
                        opponentId: game.player1Id === playerId ? game.player2Id : game.player1Id,
                        yourSymbol: game.player1Id === playerId ? game.player1Symbol : game.player2Symbol,
                        boardSize: game.boardSize,
                        yourTurn: game.currentTurn === playerId,
                        board: game.board,
                        currentTurnSymbol: game.currentTurn === game.player1Id ? game.player1Symbol : game.player2Symbol
                    };
                    break;
                }
            }
            
            return response;
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
                const timeoutId = setTimeout(async () => {
                    // Check if player has reconnected (is in playerSockets)
                    // We check this.playerSockets because if they reconnected, registerPlayer 
                    // would have put them back in there.
                    const hasReconnected = this.playerSockets.has(player.id);
                    
                    if (!hasReconnected && game.state === 'active') {
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
                    
                    this.disconnectTimeouts.delete(player.id);
                }, 30000); // 30 second grace period
                
                this.disconnectTimeouts.set(player.id, timeoutId);
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
                opponentId: challenge.targetId,
                yourSymbol: gameData.player1Symbol,
                boardSize: challenge.boardSize,
                yourTurn: true
            });
        }
        
        this.io.to(socket.id).emit('game_started', {
            gameId: gameId,
            opponent: challenge.challengerUsername,
            opponentId: challenge.challengerId,
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

    // Handle player surrender
    async handleSurrender(socket, data) {
        const player = this.players.get(socket.id);
        if (!player) {
            socket.emit('error', { message: 'Player not found' });
            return;
        }

        const game = this.activeGames.get(data.gameId);
        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }

        if (game.state !== 'active') {
            socket.emit('error', { message: 'Game is already ending' });
            return;
        }

        // Set state immediately to prevent double-surrender race conditions
        game.state = 'completed';

        // Determine winner (the opponent)
        const winnerId = game.player1Id === player.id ? game.player2Id : game.player1Id;
        
        // Update database - mark as completed with winner
        try {
            await this.db.abandonGame(data.gameId, winnerId);
            
            // Get updated stats
            const loserStats = await this.db.getPlayerById(player.id);
            const winnerStats = await this.db.getPlayerById(winnerId);
            
            // Find opponent socket
            const opponentSocket = this.playerSockets.get(winnerId);
            
            // Notify both players
            socket.emit('game_ended', {
                reason: 'surrender',
                message: 'You surrendered',
                stats: {
                    wins: loserStats.total_wins,
                    losses: loserStats.total_losses,
                    draws: loserStats.total_draws
                }
            });
            
            if (opponentSocket) {
                this.io.to(opponentSocket).emit('game_ended', {
                    reason: 'win',
                    message: `${player.username} surrendered`,
                    stats: {
                        wins: winnerStats.total_wins,
                        losses: winnerStats.total_losses,
                        draws: winnerStats.total_draws
                    }
                });
            }
            
            // Clean up
            this.activeGames.delete(data.gameId);
            if (this.players.has(socket.id)) this.players.get(socket.id).currentGameId = null;
            if (opponentSocket && this.players.has(opponentSocket)) {
                this.players.get(opponentSocket).currentGameId = null;
            }
            
        } catch (error) {
            console.error('Error handling surrender:', error);
            socket.emit('error', { message: 'Failed to process surrender' });
        }
    }

    // Send rematch request
    sendRematch(socket, data) {
        const player = this.players.get(socket.id);
        if (!player) return;

        // Find opponent's socket
        const opponentSocket = this.playerSockets.get(data.opponentId);

        if (!opponentSocket) {
            socket.emit('error', { message: 'Opponent not online' });
            return;
        }

        const rematchId = `rematch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        if (!this.rematches) {
            this.rematches = new Map();
        }
        
        this.rematches.set(rematchId, {
            rematchId,
            challenger: player.id,
            challengerUsername: player.username,
            challenged: data.opponentId,
            boardSize: data.boardSize || 15,
            timestamp: Date.now()
        });

        this.io.to(opponentSocket).emit('rematch_request', {
            rematchId,
            from: player.username,
            boardSize: data.boardSize || 15
        });
    }

    // Accept rematch
    async acceptRematch(socket, data) {
        const player = this.players.get(socket.id);
        if (!player) return;

        const rematch = this.rematches.get(data.rematchId);
        if (!rematch) {
            socket.emit('error', { message: 'Rematch request expired' });
            return;
        }

        // Verify players are not already in a game
        if (player.currentGameId) {
            socket.emit('error', { message: 'You are already in a game' });
            return;
        }

        // Verify this player is the challenged one
        if (rematch.challenged !== player.id) {
            socket.emit('error', { message: 'Invalid rematch accept' });
            return;
        }

        // Find challenger's socket
        const challengerSocket = this.playerSockets.get(rematch.challenger);

        if (!challengerSocket) {
            socket.emit('error', { message: 'Challenger no longer online' });
            this.rematches.delete(data.rematchId);
            return;
        }

        const challenger = this.players.get(challengerSocket);
        if (challenger && challenger.currentGameId) {
            socket.emit('error', { message: 'Challenger is already in a game' });
            this.rematches.delete(data.rematchId);
            return;
        }

        // Create new game (similar to acceptChallenge logic)
        try {
            const gameId = await this.db.createGame(
                rematch.challenger,
                player.id,
                rematch.challengerUsername,
                player.username,
                rematch.boardSize
            );

            // Randomly assign symbols
            const player1IsX = Math.random() < 0.5;

            const gameState = {
                id: gameId,
                player1Id: rematch.challenger,
                player2Id: player.id,
                player1Username: rematch.challengerUsername,
                player2Username: player.username,
                player1Symbol: player1IsX ? 'X' : 'O',
                player2Symbol: player1IsX ? 'O' : 'X',
                currentTurn: rematch.challenger,
                boardSize: rematch.boardSize,
                state: 'active',
                board: Array(rematch.boardSize).fill(null).map(() => Array(rematch.boardSize).fill(null)),
                moveCount: 0
            };

            this.activeGames.set(gameId, gameState);

            // Update players' current game
            const challenger = this.players.get(challengerSocket);
            const accepter = this.players.get(socket.id);
            if (challenger) challenger.currentGameId = gameId;
            if (accepter) accepter.currentGameId = gameId;

            // Notify both players
            this.io.to(challengerSocket).emit('rematch_accepted', {
                gameId: gameId,
                opponent: player.username,
                opponentId: player.id,
                yourSymbol: gameState.player1Symbol,
                yourTurn: true,
                boardSize: rematch.boardSize
            });

            this.io.to(socket.id).emit('game_started', {
                gameId: gameId,
                opponent: rematch.challengerUsername,
                opponentId: rematch.challenger,
                yourSymbol: gameState.player2Symbol,
                yourTurn: false,
                boardSize: rematch.boardSize
            });

            this.rematches.delete(data.rematchId);

        } catch (error) {
            console.error('Error accepting rematch:', error);
            socket.emit('error', { message: 'Failed to start rematch' });
        }
    }

    // Decline rematch
    declineRematch(socket, data) {
        const player = this.players.get(socket.id);
        if (!player) return;

        const rematch = this.rematches.get(data.rematchId);
        if (!rematch) return;

        // Find challenger's socket
        const challengerSocket = this.playerSockets.get(rematch.challenger);

        if (challengerSocket) {
            this.io.to(challengerSocket).emit('rematch_declined', {
                by: player.username
            });
        }

        this.rematches.delete(data.rematchId);
    }
}

module.exports = GameManager;
