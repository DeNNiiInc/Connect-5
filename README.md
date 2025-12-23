# Connect-5 🎮

<div align="center">

**Premium Real-Time Multiplayer Gomoku Game**

[![Play Online](https://img.shields.io/badge/🎮_Play_Online-connect5.beyondcloud.technology-9333ea?style=for-the-badge)](https://connect5.beyondcloud.technology/)

A beautiful, feature-rich implementation of the classic Connect-5 (Gomoku) game with real-time multiplayer support, built with modern web technologies.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.0+-blue.svg)](https://socket.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-3ECF8E.svg)](https://postgresql.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Play Now](https://connect5.beyondcloud.technology/) • [Features](#features) • [Installation](#installation) • [Usage](#usage) • [Multiplayer](#multiplayer) • [Deployment](#production-deployment)

</div>

---

## ✨ Features

### 🎯 Game Modes
- **Local Play**: Play against friends on the same device with smooth turn-based gameplay
- **Real-Time Multiplayer**: Challenge players worldwide with <50ms move synchronization
- **Multiple Board Sizes**: Tactical variety with 15×15, 20×20, 25×25, or epic 50×50 grids
- **Smart Matchmaking**: Player lobby with live stats (Wins/Losses/Draws) for informed challenges

### 🌐 Multiplayer Features (NEW & ENHANCED)

#### Core Multiplayer
- **Live Player Lobby**: See all online players with real-time presence indicators
- **Challenge System**: Send and receive game invitations with instant notifications
- **Player Statistics**: Track your performance with persistent win/loss/draw records
- **Auto-Login**: Username persistence across sessions with 30-day cookie storage
- **Profanity Filter**: Family-friendly environment with bad-words filtering

#### 🏳️ Surrender & Rematch (NEW)
- **Graceful Surrender**: End hopeless games early with the Surrender button
  - Confirmation modal prevents accidental surrenders
  - Immediate stats update (counts as loss for surrenderer, win for opponent)
  - Both players notified instantly
- **Instant Rematch**: Challenge the same opponent immediately after any game
  - "Challenge Again" button in Game Over modal
  - Full negotiation flow (accept/decline)
  - Preserves board size preference
  - No need to return to lobby between rematches

#### 🛡️ Reliability & State Management (NEW)
- **Smart Disconnect Handling**: 30-second grace period for network blips
  - Automatic reconnection on internet restoration
  - Full board state restoration (all moves preserved)
  - Seamless resume even with new socket connection
- **Game State Protection**: No more abandoned games from accidental refreshes
- **Race Condition Prevention**: Server-side state locks prevent double-actions
- **Session Recovery**: Resume active games automatically on page reload

### 🎨 Premium Design
- **Graphing Paper Aesthetic**: Beautiful dark theme with precision grid lines
- **Smooth Animations**: 
  - Polished piece placement with scale effects
  - Victory sequence highlighting with glow effects
  - Modal transitions with glassmorphism
- **Modern UI Components**:
  - Glassmorphism overlays with backdrop blur
  - Gradient accents and hover states
  - Responsive button designs
- **Cross-Platform**: Flawless experience on desktop, tablet, and mobile

### 🎲 Gameplay Excellence
- **8-Direction Win Detection**: Scan horizontal, vertical, and both diagonals
- **Turn Indicators**: Clear visual feedback showing whose turn it is
- **Win Highlighting**: Animated display of the winning 5-piece sequence
- **Draw Detection**: Automatic detection when board is full
- **Move Validation**: Client and server-side validation prevents invalid moves
- **Persistent Scoring**: All games saved to PostgreSQL with complete move history

---

## 📸 Screenshots

<div align="center">

### Multiplayer Lobby
![Multiplayer Lobby](screenshots/multiplayer_lobby.png)
*Challenge players in real-time from the lobby*

### Local Game Mode
![Local Game](screenshots/local-game.png)

### Different Board Sizes
![Board Sizes](screenshots/board-sizes.png)

### Victory Screen
![Victory Screen](screenshots/victory-screen.png)

### Surrender Modal
![Surrender Modal](screenshots/surrender-modal.png)
*Gracefully end games with the new confirmation modal*

</div>

---

## 🚀 Installation

### Prerequisites
- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** Database ([Download](https://www.postgresql.org/download/))
- **Git** ([Download](https://git-scm.com/))

### Quick Start

```bash
# Clone the repository
git clone https://github.com/DeNNiiInc/Connect-5.git
cd Connect-5

# Install dependencies
npm install

# Configure database
# 1. Create database: CREATE DATABASE connect5;
# 2. Setup config:
cp db.config.example.js db.config.js
# 3. Edit db.config.js with your credentials

# 4. Initialize Database Schema
# (Check update-dbschema.js if psql is not available)
psql -h HOST -U postgres -d connect5 -f postgres-schema.sql

# Start the server
npm start
```

The server will start on **http://localhost:3000**

---

## 🎮 Usage

### Multiplayer Instructions

1.  Click **"🌐 Multiplayer"**.
2.  Enter your username (3-20 characters).
3.  **Lobby**: See online players and their stats (Wins/Losses).
4.  **Challenge**: Click "Challenge" next to a player.
5.  **Game On**: Once accepted, the board loads for both of you.

### In-Game Controls

-   **Place Piece**: Click any empty intersection.
-   **Surrender**: Click the "Surrender" button (Game Controls area) to forfeit.
-   **Rematch**: After the game, click "Challenge Again" to keep playing the same opponent.

---

## 🚀 Production Deployment (Proxmox + TurnKey Linux)

We recommend using a **Proxmox TurnKey Node.js Container** for production.

### ✅ 1. One-Click Remote Deployment (Windows)
Easily deploy from your local Windows machine to the remote server using the included PowerShell script.

**Pre-requisite:** Create `deploy-config.json` in your project root (this file is ignored by git):
```json
{
  "host": "172.16.69.214",
  "username": "root",
  "password": "YOUR_SSH_PASSWORD",
  "remotePath": "/var/www/connect5",
  "gitToken": "YOUR_GITHUB_TOKEN"
}
```

**To Deploy or Update:**
```powershell
.\deploy-remote.ps1
```
*This script automatically updates code, installs dependencies, and restarts the service.*

### 🔄 2. Automated Updates (Cron Job)
The server is configured to **automatically pull updates from GitHub every 5 minutes**.
- **No changes?** Nothing happens.
- **New code?** The server pulls changes, runs `npm install`, and restarts the app using the `post-merge` hook.

### 🛡️ 3. Cloudflare Tunnel (Secure Access)
The application is securely exposed using a Cloudflare Tunnel, eliminating the need to open router ports.

**Service Status:**
```bash
systemctl status connect5
```

**Logs:**
```bash
journalctl -u connect5 -f
```

### 🔒 4. Security & Configuration
- **Systemd**: The app runs as a `systemd` service (`connect5`), ensuring it auto-starts on boot.
- **Nginx**: Configured as a reverse proxy on Port 80.
- **Secrets**: Database credentials are stored in `db.config.js` and excluded from source control.

See [PROXMOX_DEPLOY_TEMPLATE.md](PROXMOX_DEPLOY_TEMPLATE.md) for the manual setup guide.

---

## 🛠️ Tech Stack

### Frontend
- **HTML5/CSS3**: Custom Glassmorphism design
- **Vanilla JS**: No frameworks, pure performance
- **Socket.io Client**: Real-time events

### Backend
- **Node.js + Express**: Robust server
- **Socket.io**: WebSocket management
- **PostgreSQL**: Rigid data persistence (Players, Games, Moves, Sessions)

### Database Schema
- **Reliability First**: Games are stored with status (`active`, `completed`, `abandoned`).
- **Data Integrity**: Players and Moves are linked via Foreign Keys.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Database Disconnected** | Check `db.config.js`. If on production, run `bash setup-auto-deploy.sh` to fix sync issues. |
| **"Function not found"** | Run `node update-dbschema.js` to patch missing SQL functions. |
| **Cannot Connect** | Ensure port 3000 is open. |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📧 Contact

**Beyond Cloud Technology**
- YouTube: [@beyondcloudtechnology](https://www.youtube.com/@beyondcloudtechnology)
- Repository: [DeNNiiInc/Connect-5](https://github.com/DeNNiiInc/Connect-5)

<div align="center">
Made with 💜 by Beyond Cloud Technology
</div>
