// Multiplayer Client Manager
class MultiplayerClient {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.playerId = null;
        this.username = null;
        this.currentGameId = null;
        this.isMultiplayer = false;
        this.activePlayers = [];
        this.pendingChallenges = new Map();
        this.selectedBoardSize = 15; // Default board size for multiplayer
    }
    
    
    // Connect to server
    async connect() {
        if (typeof io === 'undefined') {
            this.showMessage('Socket.io library not loaded. Please check your internet connection.', 'error');
            return;
        }

        // Show username modal immediately if not saved
        const savedUsername = localStorage.getItem('connect5_username');
        if (!savedUsername) {
            this.showUsernameModal();
        } else {
            this.username = savedUsername; // Pre-load username
        }

        // Dynamically construct proxy URLs based on current origin
        const targetUrl = window.location.origin;
        const servers = [
            targetUrl, // Primary (Production/Local)
            'http://localhost:3000' // Failover for local dev
        ];

        let connected = false;
        const loadingEl = document.querySelector('.loading');

        for (const serverUrl of servers) {
            if (connected) break;
            
            try {
                if (loadingEl) loadingEl.textContent = `Connecting to ${serverUrl}...`;
                console.log(`Attempting connection to: ${serverUrl}`);
                await this.tryConnect(serverUrl);
                connected = true;
                console.log(`✅ Successfully connected to: ${serverUrl}`);
                if (loadingEl) loadingEl.textContent = 'Connected! verifying functionality...';
            } catch (error) {
                console.warn(`❌ Failed to connect to ${serverUrl}:`, error);
            }
        }



        if (!connected) {
            this.showMessage('Failed to connect to any multiplayer server. Please try again later.', 'error');
            const loading = document.querySelector('.loading');
            if (loading) loading.textContent = 'Connection failed.';
        }
        
        // Setup board size selector buttons
        document.querySelectorAll('.size-btn-mp').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.size-btn-mp').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.selectedBoardSize = parseInt(e.target.dataset.size);
            });
        });
    }

    tryConnect(url) {
        return new Promise((resolve, reject) => {
            const socketOptions = {
                reconnection: false, // We handle reconnection manually for failover
                timeout: 5000,
                transports: ['websocket', 'polling']
            };

            const tempSocket = io(url, socketOptions);

            const timeout = setTimeout(() => {
                if (!tempSocket.connected) {
                    tempSocket.close();
                    reject(new Error('Connection timed out'));
                }
            }, 5000);

            tempSocket.on('connect', () => {
                clearTimeout(timeout);
                this.socket = tempSocket;
                this.setupSocketListeners();
                resolve();
            });

            tempSocket.on('connect_error', (err) => {
                clearTimeout(timeout);
                tempSocket.close();
                reject(err);
            });
        });
    }

    setupSocketListeners() {
        if (!this.socket) return;

        // Safety timeout: If we are connected but don't get a player list or login prompt within 5 seconds, warn the user.
        setTimeout(() => {
            const loading = document.querySelector('.loading');
            if (loading && loading.textContent.includes('Connecting')) {
                 loading.textContent = 'Connection successful, but server response is slow...';
            } else if (loading && loading.textContent === 'Loading players...') {
                 loading.innerHTML = 'Server not responding. <a href="#" onclick="multiplayerClient.connect()">Retry</a>';
            }
        }, 5000);

        this.socket.on('connect', () => {
            console.log('✅ Connected to multiplayer server');
            
            // If we have a username (from localStorage or recently entered), try to register
            const savedUsername = localStorage.getItem('connect5_username') || this.username;
            
            if (savedUsername) {
                console.log('Found saved username:', savedUsername);
                this.registerPlayer(savedUsername);
            } 
            // If no username yet, do nothing (user is seeing the modal and will call registerPlayer when they submit)
        });
        
        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            this.handleDisconnect();
        });
        
        this.socket.on('registration_result', (data) => {
            this.handleRegistration(data);
        });
        
        this.socket.on('active_players_update', (players) => {
            this.updateActivePlayers(players);
        });
        
        this.socket.on('challenge_received', (data) => {
            this.showChallengeNotification(data);
        });
        
        this.socket.on('challenge_result', (data) => {
            this.handleChallengeResult(data);
        });
        
        this.socket.on('challenge_declined', (data) => {
            this.showMessage(`${data.by} declined your challenge`, 'error');
        });
        
        this.socket.on('game_started', (data) => {
            this.startMultiplayerGame(data);
        });
        
        this.socket.on('opponent_move', (data) => {
            this.handleOpponentMove(data);
        });
        
        this.socket.on('move_result', (data) => {
            this.handleMoveResult(data);
        });
        
        this.socket.on('game_ended', (data) => {
            this.handleGameEnded(data);
        });
        
        this.socket.on('opponent_disconnected', (data) => {
            this.showMessage(data.message + '. Waiting for reconnection...', 'warning');
        });
        
        // Send heartbeat every 30 seconds
        setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('heartbeat');
            }
        }, 30000);
    }
    
    // Show username input modal
    showUsernameModal() {
        const modal = document.getElementById('usernameModal');
        if (modal) {
            modal.classList.add('active');
        }
    }
    
    // Register player
    registerPlayer(username) {
        this.username = username;
        localStorage.setItem('connect5_username', username);
        
        // Hide username modal immediately for better UX
        const modal = document.getElementById('usernameModal');
        if (modal) {
            modal.classList.remove('active');
        }

        // Show loading state if connecting
        const loading = document.querySelector('.loading');
        if (loading && !this.socket) {
             loading.textContent = 'Connecting to server...';
        }

        if (!this.socket || !this.socket.connected) {
            console.log('Socket not ready yet, username saved and will be sent on connect.');
            return;
        }
        
        this.socket.emit('register_player', { username });
    }
    
    // Handle registration response
    handleRegistration(data) {
        if (data.success) {
            this.playerId = data.player.id;
            this.username = data.player.username;
            
            // Save username to localStorage for auto-login
            localStorage.setItem('connect5_username', this.username);
            console.log('Username saved to localStorage');
            
            // Hide username modal (if visible)
            const modal = document.getElementById('usernameModal');
            if (modal) {
                modal.classList.remove('active');
            }
            
            // Show multiplayer panel
            const multiplayerPanel = document.getElementById('multiplayerPanel');
            if (multiplayerPanel) {
                multiplayerPanel.style.display = 'block';
            }
            
            // Update player stats display
            document.getElementById('playerUsername').textContent = this.username;
            document.getElementById('playerWins').textContent = data.player.stats.wins;
            document.getElementById('playerLosses').textContent = data.player.stats.losses;
            document.getElementById('playerDraws').textContent = data.player.stats.draws;
            
            this.showMessage(`Welcome back, ${this.username}!`, 'success');
            
            // Request active players
            this.socket.emit('request_active_players');
        } else {
            // Registration failed - clear saved username and show modal
            localStorage.removeItem('connect5_username');
            this.showMessage(data.error, 'error');
            this.showUsernameModal();
        }
    }
    
    // Update active players list
    updateActivePlayers(players) {
        this.activePlayers = players.filter(p => p.username !== this.username);
        
        const container = document.getElementById('activePlayersList');
        if (!container) return;
        
        if (this.activePlayers.length === 0) {
            container.innerHTML = '<div class="no-players">No other players online</div>';
            return;
        }
        
        container.innerHTML = this.activePlayers.map(player => `
            <div class="player-item">
                <div class="player-info">
                    <span class="player-name">${player.username}</span>
                    <span class="player-stats">${player.total_wins}W - ${player.total_losses}L - ${player.total_draws}D</span>
                </div>
                <button class="challenge-btn" onclick="multiplayerClient.sendChallenge('${player.username}')">
                    Challenge
                </button>
            </div>
        `).join('');
    }
    
    // Send challenge
    sendChallenge(targetUsername) {
        this.socket.emit('send_challenge', { 
            targetUsername, 
            boardSize: this.selectedBoardSize 
        });
        this.showMessage(`Challenge sent to ${targetUsername} (${this.selectedBoardSize}×${this.selectedBoardSize})`, 'info');
    }
    
    // Handle challenge result
    handleChallengeResult(data) {
        if (!data.success) {
            this.showMessage(data.error, 'error');
        }
    }
    
    // Show challenge notification
    showChallengeNotification(data) {
        this.pendingChallenges.set(data.challengeId, data);
        
        const notification = document.createElement('div');
        notification.className = 'challenge-notification';
        notification.innerHTML = `
            <div class="challenge-content">
                <h3>Challenge Received!</h3>
                <p><strong>${data.from}</strong> wants to play</p>
                <p>Board size: ${data.boardSize}×${data.boardSize}</p>
                <div class="challenge-actions">
                    <button class="accept-btn" onclick="multiplayerClient.acceptChallenge('${data.challengeId}')">
                        Accept
                    </button>
                    <button class="decline-btn" onclick="multiplayerClient.declineChallenge('${data.challengeId}')">
                        Decline
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('active'), 10);
    }
    
    // Accept challenge
    acceptChallenge(challengeId) {
        this.socket.emit('accept_challenge', { challengeId });
        this.pendingChallenges.delete(challengeId);
        
        // Remove notification
        const notifications = document.querySelectorAll('.challenge-notification');
        notifications.forEach(n => n.remove());
    }
    
    // Decline challenge
    declineChallenge(challengeId) {
        this.socket.emit('decline_challenge', { challengeId });
        this.pendingChallenges.delete(challengeId);
        
        // Remove notification
        const notifications = document.querySelectorAll('.challenge-notification');
        notifications.forEach(n => n.remove());
    }
    
    // Start multiplayer game
    startMultiplayerGame(data) {
        console.log('🎮 Starting multiplayer game:', data);
        this.isMultiplayer = true;
        this.currentGameId = data.gameId;
        this.mySymbol = data.yourSymbol;
        this.opponent = data.opponent;
        this.myTurn = data.yourTurn;
        
        // Update UI - hide multiplayer lobby, show game board
        document.getElementById('multiplayerPanel').style.display = 'none';
        document.getElementById('gameControls').style.display = 'grid';
        document.querySelector('.board-wrapper').style.display = 'flex';
        document.getElementById('statusMessage').style.display = 'block';
        
        // Set board size
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.size) === data.boardSize);
        });
        
        // Reset game board
        this.game.boardSize = data.boardSize;
        this.game.currentPlayer = this.mySymbol;  // Set to our symbol
        this.game.gameActive = true;
        this.game.initializeBoard();
        
        // Update current player display to show "YOU ARE X/O"
        const currentPlayerDisplay = document.getElementById('currentPlayer');
        currentPlayerDisplay.textContent = this.mySymbol;
        currentPlayerDisplay.parentElement.previousElementSibling.textContent = `You are:`;
        
        // Update player display colors based on symbol
        const playerDisplay = document.querySelector('.player-display');
        if (this.mySymbol === 'O') {
            playerDisplay.style.borderColor = 'hsl(195, 70%, 55%)';
            currentPlayerDisplay.style.color = 'hsl(195, 70%, 55%)';
        } else {
            playerDisplay.style.borderColor = 'hsl(270, 70%, 60%)';
            currentPlayerDisplay.style.color = 'hsl(270, 70%, 60%)';
        }
        
        // Update status
        const status = document.getElementById('statusMessage');
        if (this.myTurn) {
            status.textContent = `🎮 VS ${this.opponent} | YOUR TURN - You're playing as ${this.mySymbol}`;
            status.className = 'status-message success';
        } else {
            status.textContent = `🎮 VS ${this.opponent} | Waiting for ${this.opponent} to move - You're playing as ${this.mySymbol}`;
            status.className = 'status-message info';
        }
        
        console.log(`✅ Game started! You are ${this.mySymbol}, ${this.myTurn ? 'your turn' : 'waiting'}`);
    }
    
    // Make move in multiplayer game
    makeMove(row, col) {
        if (!this.isMultiplayer || !this.myTurn) return false;
        
        this.socket.emit('make_move', {
            gameId: this.currentGameId,
            row: row,
            col: col
        });
        
        return true;
    }
    
    // Handle move result from server
    handleMoveResult(data) {
        if (data.success) {
            this.myTurn = false;
            
            if (!data.gameOver) {
                const status = document.getElementById('statusMessage');
                status.textContent = `Playing against ${this.opponent} - Waiting for opponent...`;
            }
        } else {
            this.showMessage(data.error, 'error');
        }
    }
    
    // Handle opponent move
    handleOpponentMove(data) {
        // Place opponent's piece on board
        this.game.currentPlayer = data.symbol;
        const cellIndex = data.row * this.game.boardSize + data.col;
        const cell = this.game.boardElement.children[cellIndex];
        
        if (cell) {
            cell.classList.add('occupied', data.symbol.toLowerCase());
            this.game.board[data.row][data.col] = data.symbol;
        }
        
        // It's now my turn
        this.myTurn = true;
        this.game.currentPlayer = this.mySymbol;
        
        const status = document.getElementById('statusMessage');
        status.textContent = `Playing against ${this.opponent} - Your turn (${this.mySymbol})`;
    }
    
    // Handle game ended
    handleGameEnded(data) {
        this.isMultiplayer = false;
        this.currentGameId = null;
        
        let message = '';
        if (data.reason === 'win') {
            message = '🎉 You won!';
        } else if (data.reason === 'loss') {
            message = '😔 You lost!';
        } else if (data.reason === 'draw') {
            message = '🤝 It\'s a draw!';
        } else if (data.reason === 'opponent_abandoned') {
            message = '🏆 You won! Opponent disconnected';
        }
        
        // Update stats
        if (data.stats) {
            document.getElementById('playerWins').textContent = data.stats.wins;
            document.getElementById('playerLosses').textContent = data.stats.losses;
            document.getElementById('playerDraws').textContent = data.stats.draws;
        }
        
        this.showMessage(message, 'success');
        
        // Show multiplayer panel again
        setTimeout(() => {
            document.getElementById('multiplayerPanel').style.display = 'block';
            this.socket.emit('request_active_players');
        }, 3000);
    }
    
    // Handle disconnect
    handleDisconnect() {
        this.showMessage('Disconnected from server. Reconnecting...', 'error');
        
        // Try to reconnect
        setTimeout(() => {
            if (!this.socket || !this.socket.connected) {
                this.connect();
            }
        }, 2000);
    }
    
    // Return to lobby
    returnToLobby() {
        this.isMultiplayer = false;
        this.currentGameId = null;
        document.getElementById('multiplayerPanel').style.display = 'block';
        document.getElementById('gameControls').style.display = 'block';
        this.socket.emit('request_active_players');
    }
    
    // Show message to user
    showMessage(text, type = 'info') {
        const messageEl = document.getElementById('statusMessage');
        if (messageEl) {
            messageEl.textContent = text;
            messageEl.className = `status-message ${type}`;
        }
    }
}

// Initialize multiplayer client (will be used by game.js)
// Initialize multiplayer client (will be used by game.js)
window.multiplayerClient = null;
