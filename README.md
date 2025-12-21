# Connect-5 🎮

<div align="center">

**Premium Real-Time Multiplayer Gomoku Game**

[![Play Online](https://img.shields.io/badge/🎮_Play_Online-connect5.beyondcloud.technology-9333ea?style=for-the-badge)](https://connect5.beyondcloud.technology/)

A beautiful, feature-rich implementation of the classic Connect-5 (Gomoku) game with real-time multiplayer support, built with modern web technologies.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.0+-blue.svg)](https://socket.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E.svg)](https://supabase.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Play Now](https://connect5.beyondcloud.technology/) • [Features](#features) • [Installation](#installation) • [Usage](#usage) • [Multiplayer](#multiplayer) • [Tech Stack](#tech-stack)

</div>

---

## ✨ Features

### 🎯 Game Modes
- **Local Play**: Play against friends on the same device
- **Real-Time Multiplayer**: Challenge players online with instant move synchronization
- **Multiple Board Sizes**: Choose from 15×15, 20×20, 25×25, or 50×50 grids

### 🎨 Premium Design
- **Graphing Paper Aesthetic**: Beautiful dark theme with clean lines
- **Smooth Animations**: Polished piece placement and victory effects
- **Glassmorphism UI**: Modern, translucent interface elements
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### 🌐 Multiplayer Features
- **Player Lobby**: See all online players in real-time
- **Challenge System**: Send and receive game invitations
- **Player Statistics**: Track wins, losses, and draws
- **Auto-Login**: Username persistence across sessions
- **Session Management**: Automatic reconnection handling
- **Profanity Filter**: Safe and family-friendly usernames

### 🎲 Gameplay
- **8-Direction Win Detection**: Horizontal, vertical, and diagonal
- **Turn-Based System**: Clear turn indicators
- **Win Highlighting**: Animated winning sequence display
- **Draw Detection**: Automatic board-full detection
- **Score Tracking**: Persistent score tracking in local and multiplayer modes

---

## 📸 Screenshots

<div align="center">

### Local Game Mode
![Local Game](screenshots/local-game.png)

### Different Board Sizes
![Board Sizes](screenshots/board-sizes.png)

### Victory Screen
![Victory Screen](screenshots/victory-screen.png)

</div>

---

## 🚀 Installation

### Prerequisites
- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Supabase Account** (Free tier available at [supabase.com](https://supabase.com/))
- **Git** ([Download](https://git-scm.com/))

### Quick Start

```bash
# Clone the repository
git clone https://github.com/DeNNiiInc/Connect-5.git
cd Connect-5

# Install dependencies
npm install

# Configure database
# 1. Create a Supabase project at https://supabase.com
# 2. Copy db.config.example.js to db.config.js
cp db.config.example.js db.config.js

# 3. Edit db.config.js with your Supabase credentials
# 4. Run the SQL schema in Supabase SQL Editor (see SUPABASE_SETUP.md)

# Start the server
npm start
```

The server will start on **http://localhost:3000**

For detailed setup instructions, see [SUPABASE_SETUP.md](SUPABASE_SETUP.md)

---

## 🎮 Usage

### Local Play

1. Open **http://localhost:3000** in your browser
2. Click **"🎮 Local Play"**
3. Select your preferred board size (15×15, 20×20, 25×25, or 50×50)
4. Start playing! Player X goes first
5. Get 5 in a row to win (horizontal, vertical, or diagonal)

### Multiplayer

1. Click **"🌐 Multiplayer"**
2. Enter your username (3-20 characters, family-friendly)
3. Select your preferred board size
4. Click **"Challenge"** next to any online player
5. Wait for them to accept
6. Game starts automatically!

### Keyboard Shortcuts

- **Enter**: Submit username in multiplayer mode
- **Click**: Place piece on board
- **Refresh**: Return to lobby after game ends

---

## 🌐 Multiplayer System

### Architecture

```
┌─────────────┐         WebSocket          ┌──────────────┐
│   Client    │◄─────────────────────────►│   Server     │
│  (Browser)  │     Socket.io Events       │  (Node.js)   │
└─────────────┘                             └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │   Supabase   │
                                            │  PostgreSQL  │
                                            └──────────────┘
```

### Database Schema

**Players Table**
- Player information and statistics
- Unique usernames with constraints
- Win/Loss/Draw tracking

**Active Sessions Table**
- Online player monitoring
- Heartbeat-based connection tracking
- Automatic cleanup of stale sessions

**Games Table**
- Game state and history
- Player assignments (X/O)
- Winner recording

**Game Moves Table**
- Complete move history
- Position tracking for each move
- Replay capability support

### Real-Time Features

- **Instant Updates**: Move synchronization in real-time
- **Challenge System**: Send and accept game invitations
- **Player Presence**: Live online/offline status
- **Disconnect Handling**: 30-second grace period for reconnection
- **Auto-Reconnect**: Seamless session restoration

---

## 🛠️ Tech Stack

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Advanced styling with CSS Grid and Flexbox
- **Vanilla JavaScript**: Pure ES6+ without frameworks
- **Socket.io Client**: Real-time communication

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web application framework
- **Socket.io**: WebSocket library for real-time bidirectional communication
- **Supabase Client**: PostgreSQL database client with real-time capabilities

### Database
- **Supabase**: Managed PostgreSQL database with real-time subscriptions
- **Row Level Security**: Built-in security policies
- **Auto-generated APIs**: RESTful and real-time APIs

### Dependencies
```json
{
  "express": "^4.18.2",
  "socket.io": "^4.6.1",
  "@supabase/supabase-js": "^2.39.0",
  "bad-words": "^3.0.4",
  "cors": "^2.8.5",
  "nodemon": "^2.0.22"
}
```

---

## 📁 Project Structure

```
Connect-5/
├── 📄 index.html           # Main HTML file
├── 🎨 styles.css           # Game styling
├── 🎨 multiplayer-styles.css  # Multiplayer UI styles
├── 🎮 game.js              # Game logic (local & multiplayer)
├── 🌐 multiplayer.js       # Multiplayer client logic
├── 🖼️ Logo.png             # BCT logo
├── 🔧 server.js            # Express & Socket.io server
├── 💾 database.js          # MySQL connection & queries
├── 🎯 gameManager.js       # Multiplayer game management
├── 📦 package.json         # Dependencies
└── 📚 README.md            # This file
```

---

## ⚙️ Configuration

### Database Configuration

Create `db.config.js` from the example:

```bash
cp db.config.example.js db.config.js
```

Edit `db.config.js`:

```javascript
module.exports = {
    supabaseUrl: 'https://your-project.supabase.co',
    supabaseAnonKey: 'your-anon-key-here',
    supabasePassword: 'your-database-password',
    postgresConnectionString: 'postgresql://postgres:password@...'
};
```

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for detailed setup instructions.

### Server Configuration

Edit `server.js` to change the port:

```javascript
const PORT = process.env.PORT || 3000;
```

---

## 🚀 Production Deployment

For production deployment, use the automated deployment script:

```bash
sudo bash deploy.sh
```

The script will:
- ✅ Prompt for project directory
- ✅ Request Supabase credentials
- ✅ Configure database connection
- ✅ Install dependencies
- ✅ Detect and configure web server (Nginx/Apache)
- ✅ Start Node.js server
- ✅ Test endpoints

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

---

## 🎯 Game Rules

### Objective
Be the first player to get **5 pieces in a row** (horizontally, vertically, or diagonally).

### How to Play
1. Players take turns placing their pieces (X or O) on the board
2. Click any empty cell to place your piece
3. The game checks for wins in all 8 directions
4. First player to connect 5 wins!
5. If the board fills up with no winner, it's a draw

### Winning Sequences
- **Horizontal**: ●●●●●
- **Vertical**: Stacked 5 pieces
- **Diagonal**: 5 pieces in a diagonal line (both directions)

---

## 🔧 Development

### Running in Development Mode

```bash
# Start with auto-reload
npm start

# The server uses nodemon for automatic restarts on file changes
```

### Testing Multiplayer Locally

1. Open two browser windows/tabs
2. Navigate to `http://localhost:3000` in both
3. Click "Multiplayer" in each window
4. Enter different usernames
5. Send a challenge from one window
6. Accept it in the other window
7. Play the game!

---

## 🐛 Troubleshooting

### Connection Refused Error
**Problem**: Cannot connect to Supabase database  
**Solution**: Verify credentials in `db.config.js` and check Supabase dashboard

### Port Already in Use
**Problem**: Port 3000 is already occupied  
**Solution**: Change the PORT in `server.js` or stop the other application

### Players Not Showing in Lobby
**Problem**: Online players list is empty  
**Solution**: Check database connection and ensure both users are logged in

### Username Already Taken
**Problem**: Username registration fails  
**Solution**: Try a different username or check the database for duplicates

### Database Disconnected
**Problem**: Status bar shows "Disconnected"  
**Solution**: Check `db.config.js` credentials and Supabase project status

For more troubleshooting, see [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Inspired by the classic Gomoku game
- Built with ❤️ by [Beyond Cloud Technology](https://www.youtube.com/@beyondcloudtechnology)
- Special thanks to the open-source community

---

## 📧 Contact

**Beyond Cloud Technology**  
- YouTube: [@beyondcloudtechnology](https://www.youtube.com/@beyondcloudtechnology)
- Repository: [DeNNiiInc/Connect-5](https://github.com/DeNNiiInc/Connect-5)

---

<div align="center">

**Made with 💜 by Beyond Cloud Technology**

⭐ Star this repository if you found it helpful!

</div>
