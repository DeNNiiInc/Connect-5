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
- **Local Play**: Play against friends on the same device.
- **Real-Time Multiplayer**: Challenge players online with instant move synchronization.
- **Multiple Board Sizes**: Choose from 15×15, 20×20, 25×25, or 50×50 grids.

### 🏳️ Surrender & Rematch (NEW)
- **Surrender Option**: Realizing you're beaten? gracefully forfeit the game with the "Surrender" button to save time.
- **Instant Rematch**: After a game ends, challenge your opponent to a rematch instantly from the Game Over screen.
- **Seamless Flow**: Both players are kept in sync during surrender or rematch negotiations.

### 🛡️ Reliability (NEW)
- **Smart Reconnects**: If you lose internet or refresh the page, you are **instantly placed back in your active game** with the board restored.
- **Game State Protection**: No more abandoned games due to minor connection blips.
- **Race Condition Handling**: Robust server-logic preventing errors during rapid interactions.

### 🎨 Premium Design
- **Graphing Paper Aesthetic**: Beautiful dark theme with clean lines.
- **Smooth Animations**: Polished piece placement and victory effects.
- **Glassmorphism UI**: Modern, translucent interface elements.
- **Responsive Design**: Works seamlessly on desktop and mobile devices.

---

## 📸 Screenshots

<div align="center">

### Local Game Mode
![Local Game](screenshots/local-game.png)

### Different Board Sizes
![Board Sizes](screenshots/board-sizes.png)

### Victory Screen
![Victory Screen](screenshots/victory-screen.png)

### Surrender Feature
![Surrender UI](screenshots/surrender_ui.png)

### Rematch Feature
![Rematch Modal](screenshots/rematch_modal.png)

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

## 🚀 Production Deployment

We support **Zero-Downtime Reliability** and **Auto-Start**.

### 1. Automated Deployment
Use our deployment script to setup Nginx/Apache and Node.js automatically:

```bash
sudo bash deploy.sh
```

### 2. Auto-Start on Reboot (Systemd)
Never worry about server restarts again. Install the systemd service:

```bash
sudo bash setup-auto-start.sh
```
*This ensures the app starts automatically and waits for the database to be ready.*

### 3. Auto-Deploy (Git Hooks)
Enable automatic updates when you `git pull`:

```bash
bash setup-auto-deploy.sh
```
*This installs a hook to restart the service automatically after code changes.*

See [DEPLOYMENT.md](DEPLOYMENT.md) for full details.

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
