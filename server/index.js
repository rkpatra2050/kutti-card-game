const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// ─── GAME HELPERS ─────────────────────────────────────────

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const RANK_DISPLAY = { 2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A' };
const SUIT_SYMBOLS = { spades:'♠', hearts:'♥', diamonds:'♦', clubs:'♣' };

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}-${suit}` });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getCardDisplay(card) {
  return `${RANK_DISPLAY[card.rank]}${SUIT_SYMBOLS[card.suit]}`;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─── ROOMS STATE ──────────────────────────────────────────

const rooms = new Map(); // roomCode -> RoomState

/*
  RoomState = {
    code: string,
    hostSocketId: string,
    players: [ { socketId, name, id, hand[], collectedCards[], isFinished, finishOrder } ],
    phase: 'waiting' | 'kutti-draw' | 'kutti-reveal' | 'kutti-wait-next' | 'playing' | 'trick-complete' | 'game-over',
    drawDeck: Card[],
    kuttiRoundCards: Map<playerId, Card>,
    kuttiTransfers: [],
    kuttiRoundNumber: number,
    kuttiTotalRounds: number,
    currentTrick: [],
    currentPlayerIndex: number,
    trickNumber: number,
    finishedPlayers: [],
    winner: null | Player,
    dock: null | Player,
    finishCounter: number,
    maxPlayers: number,
  }
*/

function createRoom(hostSocketId, hostName, maxPlayers) {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));

  const room = {
    code,
    hostSocketId,
    players: [{
      socketId: hostSocketId,
      name: hostName,
      id: 0,
      hand: [],
      collectedCards: [],
      isFinished: false,
      finishOrder: -1,
    }],
    phase: 'waiting',
    drawDeck: [],
    kuttiRoundCards: new Map(),
    kuttiTransfers: [],
    kuttiRoundNumber: 0,
    kuttiTotalRounds: 0,
    currentTrick: [],
    currentPlayerIndex: 0,
    trickNumber: 0,
    finishedPlayers: [],
    winner: null,
    dock: null,
    finishCounter: 0,
    maxPlayers: maxPlayers || 2,
  };

  rooms.set(code, room);
  return room;
}

function getPlayerBySocket(room, socketId) {
  return room.players.find(p => p.socketId === socketId);
}

function sortHand(hand) {
  return [...hand].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const suitOrder = ['spades', 'hearts', 'diamonds', 'clubs'];
    return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
  });
}

// Build a sanitized state for a specific player (hide other players' hands)
function getStateForPlayer(room, socketId) {
  const myPlayer = getPlayerBySocket(room, socketId);
  const myId = myPlayer ? myPlayer.id : -1;

  const players = room.players.map(p => ({
    id: p.id,
    name: p.name,
    handCount: p.hand.length,
    hand: p.socketId === socketId ? p.hand : [], // only show own hand
    collectedCards: p.collectedCards,
    isFinished: p.isFinished,
    finishOrder: p.finishOrder,
    isMe: p.socketId === socketId,
  }));

  // Convert kuttiRoundCards Map to object
  const kuttiCards = {};
  if (room.kuttiRoundCards) {
    for (const [playerId, card] of room.kuttiRoundCards) {
      kuttiCards[playerId] = card;
    }
  }

  return {
    code: room.code,
    phase: room.phase,
    players,
    myPlayerId: myId,
    currentPlayerIndex: room.currentPlayerIndex,
    currentTrick: room.currentTrick,
    trickNumber: room.trickNumber,
    kuttiRoundCards: kuttiCards,
    kuttiTransfers: room.kuttiTransfers,
    kuttiRoundNumber: room.kuttiRoundNumber,
    kuttiTotalRounds: room.kuttiTotalRounds,
    drawDeckSize: room.drawDeck.length,
    winner: room.winner ? { id: room.winner.id, name: room.winner.name } : null,
    dock: room.dock ? { id: room.dock.id, name: room.dock.name } : null,
    maxPlayers: room.maxPlayers,
    hostSocketId: room.hostSocketId,
    isHost: socketId === room.hostSocketId,
    message: room.message || '',
  };
}

function broadcastState(room) {
  for (const player of room.players) {
    io.to(player.socketId).emit('gameState', getStateForPlayer(room, player.socketId));
  }
}

// ─── KUTTI DISTRIBUTION LOGIC ────────────────────────────

function executeKuttiDraw(room) {
  const deck = room.drawDeck;
  room.kuttiRoundCards = new Map();

  for (const player of room.players) {
    if (deck.length === 0) break;
    const card = deck.pop();
    room.kuttiRoundCards.set(player.id, card);
  }

  room.phase = 'kutti-reveal';
  room.message = `Kutti Round ${room.kuttiRoundNumber}/${room.kuttiTotalRounds}: Cards revealed! Host clicks "Resolve Kutti" to check transfers.`;
  broadcastState(room);
}

function resolveKuttiTransfers(room) {
  const roundCards = room.kuttiRoundCards;
  const transfers = [];
  const entries = Array.from(roundCards.entries());
  const takenCards = new Set();

  for (let i = 0; i < entries.length; i++) {
    for (let j = 0; j < entries.length; j++) {
      if (i === j) continue;
      const [idHigh, cardHigh] = entries[i];
      const [idLow, cardLow] = entries[j];
      if (cardHigh.rank === cardLow.rank + 1 && !takenCards.has(idLow)) {
        transfers.push({ fromPlayerId: idLow, toPlayerId: idHigh, card: cardLow });
        takenCards.add(idLow);
      }
    }
  }

  // Give each player their drawn card (if not taken)
  for (const [playerId, card] of roundCards) {
    if (!takenCards.has(playerId)) {
      const player = room.players.find(p => p.id === playerId);
      player.hand.push(card);
    }
  }

  // Apply transfers
  for (const transfer of transfers) {
    const receiver = room.players.find(p => p.id === transfer.toPlayerId);
    receiver.hand.push(transfer.card);
  }

  // Sort hands
  for (const p of room.players) {
    p.hand = sortHand(p.hand);
  }

  // Build message
  let msg = '';
  if (transfers.length > 0) {
    const parts = transfers.map(t => {
      const from = room.players.find(p => p.id === t.fromPlayerId).name;
      const to = room.players.find(p => p.id === t.toPlayerId).name;
      return `${from} gives ${getCardDisplay(t.card)} to ${to}`;
    });
    msg = `🔄 Kutti! ${parts.join(' | ')}`;
  } else {
    msg = 'No Kutti transfers this round.';
  }

  const moreRounds = room.drawDeck.length >= room.players.length && room.kuttiRoundNumber < room.kuttiTotalRounds;
  room.kuttiTransfers = transfers;
  room.phase = 'kutti-wait-next';
  room.message = msg + (moreRounds ? '  👉 Host clicks "Next Round".' : '  👉 Host clicks "Start Playing!".');
  broadcastState(room);
}

function startPlayingPhase(room) {
  const players = room.players;
  const summary = players.map(p => `${p.name}: ${p.hand.length} cards`).join(' | ');

  // Find ♠Q holder
  let startIdx = -1;
  for (const p of players) {
    if (p.hand.some(c => c.suit === 'spades' && c.rank === 12)) {
      startIdx = p.id;
      break;
    }
  }
  if (startIdx === -1) {
    // Fallback: highest spade
    let highRank = -1;
    for (const p of players) {
      for (const c of p.hand) {
        if (c.suit === 'spades' && c.rank > highRank) {
          highRank = c.rank;
          startIdx = p.id;
        }
      }
    }
  }
  if (startIdx === -1) startIdx = 0;

  room.phase = 'playing';
  room.currentPlayerIndex = startIdx;
  room.currentTrick = [];
  room.trickNumber = 1;
  room.kuttiRoundCards = new Map();
  room.kuttiTransfers = [];
  room.message = `📊 ${summary}\n\n♠Q → ${players[startIdx].name} starts! Trick 1 begins.`;
  broadcastState(room);
}

function executePlay(room, playerId, card) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;

  // Remove card from hand
  player.hand = player.hand.filter(c => c.id !== card.id);

  room.currentTrick.push({ card, playerId });

  // Check if trick is complete
  const playersInTrick = room.players.filter(p =>
    !p.isFinished && (p.hand.length > 0 || room.currentTrick.some(t => t.playerId === p.id))
  );
  const trickComplete = room.currentTrick.length >= playersInTrick.length;

  if (trickComplete) {
    completeTrick(room);
  } else {
    const nextIdx = getNextActivePlayer(room.currentPlayerIndex, room.players);
    room.currentPlayerIndex = nextIdx;
    room.message = `${player.name} played ${getCardDisplay(card)}. ${room.players[nextIdx].name}'s turn.`;
    broadcastState(room);
  }
}

function completeTrick(room) {
  const trick = room.currentTrick;
  let winnerPlay = trick[0];
  for (const play of trick) {
    if (play.card.rank > winnerPlay.card.rank) {
      winnerPlay = play;
    }
  }

  const winnerId = winnerPlay.playerId;
  const trickCards = trick.map(t => t.card);
  const winnerPlayer = room.players.find(p => p.id === winnerId);
  winnerPlayer.collectedCards.push(...trickCards);

  // Check who finished
  const newlyFinished = [];
  for (const p of room.players) {
    if (p.hand.length === 0 && !p.isFinished) {
      room.finishCounter++;
      p.isFinished = true;
      p.finishOrder = room.finishCounter;
      room.finishedPlayers.push(p.id);
      newlyFinished.push(p);
      if (!room.winner) {
        room.winner = { id: p.id, name: p.name, collectedCards: p.collectedCards };
      }
    }
  }

  let finishMsg = '';
  if (newlyFinished.length > 0) {
    const names = newlyFinished.map(p => {
      if (p.id === room.winner?.id && p.finishOrder === 1) return `🏆 ${p.name} WINS!`;
      return `✅ ${p.name} finished (#${p.finishOrder})`;
    });
    finishMsg = '\n' + names.join(' ');
  }

  room.phase = 'trick-complete';
  room.message = `👑 ${winnerPlayer.name} wins trick with ${getCardDisplay(winnerPlay.card)}! Collects ${trick.length} cards.${finishMsg}`;
  broadcastState(room);

  // After delay, continue or end
  setTimeout(() => {
    const stillPlaying = room.players.filter(p => !p.isFinished && p.hand.length > 0);

    if (stillPlaying.length <= 1) {
      if (stillPlaying.length === 1) {
        const dockP = stillPlaying[0];
        room.finishCounter++;
        dockP.isFinished = true;
        dockP.finishOrder = room.finishCounter;
        room.dock = { id: dockP.id, name: dockP.name, collectedCards: dockP.collectedCards };
      }
      room.phase = 'game-over';
      let msg = '🎉 GAME OVER!\n\n';
      if (room.winner) msg += `🏆 WINNER: ${room.winner.name}\n`;
      if (room.dock) msg += `🐕 DOCK: ${room.dock.name}\n`;
      room.message = msg;
      broadcastState(room);
      return;
    }

    // Continue
    let leadPlayer = winnerId;
    if (winnerPlayer.isFinished || winnerPlayer.hand.length === 0) {
      leadPlayer = getNextActivePlayer(winnerId, room.players);
    }

    room.trickNumber++;
    room.currentPlayerIndex = leadPlayer;
    room.currentTrick = [];
    room.phase = 'playing';
    room.message = `Trick ${room.trickNumber}: ${room.players[leadPlayer].name} leads.`;
    broadcastState(room);
  }, 2500);
}

function getNextActivePlayer(currentIndex, players) {
  let next = (currentIndex + 1) % players.length;
  let safety = 0;
  while ((players[next].isFinished || players[next].hand.length === 0) && safety < players.length) {
    next = (next + 1) % players.length;
    safety++;
  }
  return next;
}

// ─── SOCKET HANDLERS ─────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // CREATE ROOM
  socket.on('createRoom', ({ playerName, maxPlayers }) => {
    const room = createRoom(socket.id, playerName || 'Player 1', maxPlayers || 2);
    socket.join(room.code);
    socket.roomCode = room.code;
    console.log(`Room ${room.code} created by ${playerName}`);
    socket.emit('roomCreated', { code: room.code });
    broadcastState(room);
  });

  // JOIN ROOM
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('joinError', { message: 'Room not found! Check the code and try again.' });
      return;
    }
    if (room.phase !== 'waiting') {
      socket.emit('joinError', { message: 'Game already started in this room!' });
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      socket.emit('joinError', { message: `Room is full! Max ${room.maxPlayers} players.` });
      return;
    }
    if (room.players.some(p => p.socketId === socket.id)) {
      socket.emit('joinError', { message: 'You are already in this room!' });
      return;
    }

    const newPlayer = {
      socketId: socket.id,
      name: playerName || `Player ${room.players.length + 1}`,
      id: room.players.length,
      hand: [],
      collectedCards: [],
      isFinished: false,
      finishOrder: -1,
    };

    room.players.push(newPlayer);
    socket.join(code);
    socket.roomCode = code;
    console.log(`${playerName} joined room ${code}`);
    socket.emit('roomJoined', { code });
    broadcastState(room);
  });

  // START GAME (host only)
  socket.on('startGame', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || socket.id !== room.hostSocketId) return;
    if (room.players.length < 2) {
      socket.emit('joinError', { message: 'Need at least 2 players to start!' });
      return;
    }

    const deck = shuffleDeck(createDeck());
    const totalRounds = Math.floor(52 / room.players.length);

    room.drawDeck = deck;
    room.kuttiRoundNumber = 1;
    room.kuttiTotalRounds = totalRounds;
    room.finishCounter = 0;
    room.finishedPlayers = [];
    room.winner = null;
    room.dock = null;
    room.phase = 'kutti-draw';
    room.message = `Kutti Round 1/${totalRounds}: Drawing cards...`;

    broadcastState(room);

    // Auto-draw after short delay
    setTimeout(() => executeKuttiDraw(room), 800);
  });

  // RESOLVE KUTTI (host clicks button)
  socket.on('resolveKutti', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || socket.id !== room.hostSocketId) return;
    if (room.phase !== 'kutti-reveal') return;
    resolveKuttiTransfers(room);
  });

  // PROCEED FROM KUTTI (next round or start playing)
  socket.on('proceedFromKutti', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || socket.id !== room.hostSocketId) return;
    if (room.phase !== 'kutti-wait-next') return;

    const moreRounds = room.drawDeck.length >= room.players.length && room.kuttiRoundNumber < room.kuttiTotalRounds;

    if (moreRounds) {
      room.kuttiRoundNumber++;
      room.kuttiRoundCards = new Map();
      room.kuttiTransfers = [];
      room.phase = 'kutti-draw';
      room.message = `Kutti Round ${room.kuttiRoundNumber}/${room.kuttiTotalRounds}: Drawing cards...`;
      broadcastState(room);
      setTimeout(() => executeKuttiDraw(room), 600);
    } else {
      startPlayingPhase(room);
    }
  });

  // PLAY CARD
  socket.on('playCard', ({ cardId }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.phase !== 'playing') return;

    const player = getPlayerBySocket(room, socket.id);
    if (!player || player.id !== room.currentPlayerIndex) return;
    if (player.isFinished) return;

    const card = player.hand.find(c => c.id === cardId);
    if (!card) return;

    executePlay(room, player.id, card);
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const code = socket.roomCode;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    // If in waiting phase, remove player
    if (room.phase === 'waiting') {
      room.players = room.players.filter(p => p.socketId !== socket.id);
      // Reassign IDs
      room.players.forEach((p, i) => { p.id = i; });
      if (room.players.length === 0) {
        rooms.delete(code);
        console.log(`Room ${code} deleted (empty)`);
      } else {
        // If host left, transfer host
        if (room.hostSocketId === socket.id) {
          room.hostSocketId = room.players[0].socketId;
        }
        broadcastState(room);
      }
    } else {
      // During game, mark as disconnected but keep in game
      room.message = `⚠️ A player disconnected! Game may not continue properly.`;
      broadcastState(room);
    }
  });
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Kutti Card Game Server Running', rooms: rooms.size });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🃏 Kutti Card Game Server running on port ${PORT}`);
});
