// Connect-5 Game Logic
class Connect5Game {
  constructor() {
    this.boardSize = 15;
    this.board = [];
    this.currentPlayer = "X";
    this.gameActive = true;
    this.scores = { X: 0, O: 0 };

    this.boardElement = document.getElementById("gameBoard");
    this.statusMessage = document.getElementById("statusMessage");
    this.currentPlayerDisplay = document.getElementById("currentPlayer");
    this.victoryOverlay = document.getElementById("victoryOverlay");
    this.victoryTitle = document.getElementById("victoryTitle");
    this.scoreXDisplay = document.getElementById("scoreX");
    this.scoreODisplay = document.getElementById("scoreO");

    this.initializeEventListeners();
    this.initializeBoard();
  }

  initializeEventListeners() {
    // Size selector buttons
    document.querySelectorAll(".size-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document
          .querySelectorAll(".size-btn")
          .forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        this.boardSize = parseInt(e.target.dataset.size);
        this.resetGame();
      });
    });

    // Reset button
    document.getElementById("resetBtn").addEventListener("click", () => {
      this.resetGame();
    });

    // Play again button
    document.getElementById("playAgainBtn").addEventListener("click", () => {
      this.hideVictoryOverlay();
      this.resetGame();
    });
  }

  initializeBoard() {
    // Create empty board array
    this.board = Array(this.boardSize)
      .fill(null)
      .map(() => Array(this.boardSize).fill(null));

    // Clear and create board UI
    this.boardElement.innerHTML = "";
    this.boardElement.setAttribute("data-size", this.boardSize);

    // Create cells
    for (let row = 0; row < this.boardSize; row++) {
      for (let col = 0; col < this.boardSize; col++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.addEventListener("click", () => this.handleCellClick(row, col));
        this.boardElement.appendChild(cell);
      }
    }

    this.updateStatus();
  }

  handleCellClick(row, col) {
    if (!this.gameActive || this.board[row][col] !== null) {
      return;
    }

    // Check if in multiplayer mode and if it's our turn
    if (multiplayerClient && multiplayerClient.isMultiplayer) {
      if (!multiplayerClient.myTurn) {
        return; // Not our turn in multiplayer
      }
      
      // Send move to server
      const moveSent = multiplayerClient.makeMove(row, col);
      if (!moveSent) return;
    }

    // Place piece
    this.board[row][col] = this.currentPlayer;

    // Update UI
    const cellIndex = row * this.boardSize + col;
    const cell = this.boardElement.children[cellIndex];
    cell.classList.add("occupied", this.currentPlayer.toLowerCase());

    // In local mode only, check for win/draw and switch player
    if (!multiplayerClient || !multiplayerClient.isMultiplayer) {
      // Check for win
      if (this.checkWin(row, col)) {
        this.gameActive = false;
        this.scores[this.currentPlayer]++;
        this.updateScores();
        this.showVictoryOverlay();
        return;
      }

      // Check for draw
      if (this.checkDraw()) {
        this.gameActive = false;
        this.statusMessage.textContent = "It's a draw! Board is full.";
        return;
      }

      // Switch player
      this.currentPlayer = this.currentPlayer === "X" ? "O" : "X";
      this.updateStatus();
    }
  }

  checkWin(row, col) {
    const directions = [
      [0, 1], // Horizontal (right)
      [1, 0], // Vertical (down)
      [1, 1], // Diagonal (down-right)
      [1, -1], // Diagonal (down-left)
    ];

    for (const [dx, dy] of directions) {
      const count =
        1 +
        this.countDirection(row, col, dx, dy) +
        this.countDirection(row, col, -dx, -dy);

      if (count >= 5) {
        this.highlightWinningCells(row, col, dx, dy);
        return true;
      }
    }

    return false;
  }

  countDirection(row, col, dx, dy) {
    const player = this.board[row][col];
    let count = 0;
    let r = row + dx;
    let c = col + dy;

    while (
      r >= 0 &&
      r < this.boardSize &&
      c >= 0 &&
      c < this.boardSize &&
      this.board[r][c] === player
    ) {
      count++;
      r += dx;
      c += dy;
    }

    return count;
  }

  highlightWinningCells(row, col, dx, dy) {
    const cells = [];
    const player = this.board[row][col];

    // Find all cells in this direction
    cells.push({ row, col });

    // Forward direction
    let r = row + dx;
    let c = col + dy;
    while (
      r >= 0 &&
      r < this.boardSize &&
      c >= 0 &&
      c < this.boardSize &&
      this.board[r][c] === player
    ) {
      cells.push({ row: r, col: c });
      r += dx;
      c += dy;
    }

    // Backward direction
    r = row - dx;
    c = col - dy;
    while (
      r >= 0 &&
      r < this.boardSize &&
      c >= 0 &&
      c < this.boardSize &&
      this.board[r][c] === player
    ) {
      cells.push({ row: r, col: c });
      r -= dx;
      c -= dy;
    }

    // Highlight cells
    cells.forEach(({ row, col }) => {
      const cellIndex = row * this.boardSize + col;
      this.boardElement.children[cellIndex].classList.add("winning");
    });
  }

  checkDraw() {
    return this.board.every((row) => row.every((cell) => cell !== null));
  }

  updateStatus() {
    this.statusMessage.textContent = `Player ${this.currentPlayer}'s turn`;
    this.currentPlayerDisplay.textContent = this.currentPlayer;

    // Update the player display style
    const playerDisplay = document.querySelector(".player-display");
    if (this.currentPlayer === "O") {
      playerDisplay.style.borderColor = "hsl(195, 70%, 55%)";
      this.currentPlayerDisplay.style.color = "hsl(195, 70%, 55%)";
    } else {
      playerDisplay.style.borderColor = "hsl(270, 70%, 60%)";
      this.currentPlayerDisplay.style.color = "hsl(270, 70%, 60%)";
    }
  }

  updateScores() {
    this.scoreXDisplay.textContent = this.scores.X;
    this.scoreODisplay.textContent = this.scores.O;
  }

  showVictoryOverlay() {
    this.victoryTitle.textContent = `Player ${this.currentPlayer} Wins!`;
    this.victoryOverlay.classList.add("active");
    this.statusMessage.textContent = `🎉 Player ${this.currentPlayer} achieved 5 in a row!`;
  }

  hideVictoryOverlay() {
    this.victoryOverlay.classList.remove("active");
  }

  resetGame() {
    this.currentPlayer = "X";
    this.gameActive = true;
    this.hideVictoryOverlay();
    this.initializeBoard();
  }
}

// Initialize game when DOM is loaded
// Initialize game when DOM is loaded
window.game = null;
document.addEventListener("DOMContentLoaded", () => {
  window.game = new Connect5Game();
});
