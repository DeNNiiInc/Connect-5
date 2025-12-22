// Global helper functions for surrender and rematch features

// Show surrender confirmation
function confirmSurrender() {
    if (!window.multiplayerClient || !window.multiplayerClient.isMultiplayer) {
        return;
    }
    
    const modal = document.getElementById('surrenderModal');
    if (modal) {
        modal.classList.add('active');
    }
}

// Cancel surrender
function cancelSurrender() {
    const modal = document.getElementById('surrenderModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Execute surrender
function executeSurrender() {
    const modal = document.getElementById('surrenderModal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    if (window.multiplayerClient) {
        window.multiplayerClient.socket.emit('surrender', { 
            gameId: window.multiplayerClient.currentGameId 
        });
    }
}

// Request rematch
function requestRematch() {
    if (!window.multiplayerClient || !window.multiplayerClient.opponent) {
        return;
    }
    
    window.multiplayerClient.socket.emit('send_rematch', {
        opponentId: window.multiplayerClient.opponentId,
        boardSize: window.multiplayerClient.selectedBoardSize ||  15
    });
    
    if (window.multiplayerClient.showMessage) {
        window.multiplayerClient.showMessage(`Rematch request sent to ${window.multiplayerClient.opponent}`, 'info');
    }
    
    const modal = document.getElementById('gameOverModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Return to lobby from game over modal
function returnToLobby() {
    if (window.multiplayerClient) {
        window.multiplayerClient.returnToLobby();
    }
    
    const modal = document.getElementById('gameOverModal');
    if (modal) {
        modal.classList.remove('active');
    }
}
