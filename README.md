# 🃏 Kutti Card Game

A trick-taking card game built with **Angular 19** featuring smooth animations, AI opponents, and a beautiful dark theme.

![Angular](https://img.shields.io/badge/Angular-19-red?logo=angular)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎮 Play Now

👉 **[Play Kutti Card Game](https://YOUR_GITHUB_USERNAME.github.io/kutti-card-game/)**

*(Update this link after deploying)*

## 📜 Game Rules

| Rule | Description |
|------|-------------|
| 👥 **Players** | 3 to 6 players (you + AI bots) |
| 🃏 **Cards** | Standard 52-card deck, dealt equally |
| ♠ **Who Starts** | Player with the highest Spade in the initial draw |
| 🎯 **Follow Suit** | You MUST play the lead suit if you have it |
| 👑 **Trick Winner** | Highest card of the **lead suit** wins (off-suit cards can't win!) |
| 📦 **Collection** | Winner collects ALL cards from the trick |
| 🏆 **Winner** | Player with the **fewest collected cards** |
| 🐕 **Dog (Loser)** | Player with the **most collected cards** |

### Strategy Tips
- **Play low** when following suit to avoid collecting cards
- **Dump high cards** when you can't follow suit (they can't win anyway!)
- **Lead with low cards** to minimize risk of winning tricks

## 🛠️ Tech Stack

- **Framework:** Angular 19 (Standalone Components)
- **Language:** TypeScript 5
- **Styling:** SCSS with animations
- **State Management:** Angular Signals
- **AI:** Custom strategy-based AI opponents
- **Deployment:** GitHub Pages via GitHub Actions

## 🚀 Run Locally

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/kutti-card-game.git
cd kutti-card-game/card-game

# Install dependencies
npm install

# Start dev server
npx ng serve

# Open http://localhost:4200
```

## 📁 Project Structure

```
card-game/src/app/
├── models/
│   └── card.model.ts           # Card, Player, GameState types
├── services/
│   └── game.service.ts         # Game engine + AI logic
├── components/
│   ├── card/                   # Individual playing card
│   ├── setup-screen/           # Player count selection + rules
│   ├── player-hand/            # Your hand (clickable cards)
│   ├── trick-area/             # Center table (current trick)
│   ├── scoreboard/             # Live player scores
│   └── game-board/             # Main game layout
├── app.ts                      # Root component
└── styles.scss                 # Global dark theme
```

## 📝 License

MIT License - feel free to use, modify, and share!

---

Made with ❤️ and Angular
