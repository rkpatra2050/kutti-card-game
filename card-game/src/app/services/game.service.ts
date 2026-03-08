import { Injectable, signal, computed } from '@angular/core';
import {
  Card,
  Player,
  PlayedCard,
  GamePhase,
  GameState,
  Suit,
  Rank,
  KuttiTransfer,
  createDeck,
  shuffleDeck,
  getCardDisplay,
  RANK_DISPLAY,
  SUIT_SYMBOLS,
} from '../models/card.model';

@Injectable({
  providedIn: 'root',
})
export class GameService {
  // ─── STATE ──────────────────────────────────────────────────

  private _gameState = signal<GameState>(this.getInitialState());

  readonly gameState = this._gameState.asReadonly();
  readonly phase = computed(() => this._gameState().phase);
  readonly players = computed(() => this._gameState().players);
  readonly currentPlayerIndex = computed(() => this._gameState().currentPlayerIndex);
  readonly currentTrick = computed(() => this._gameState().currentTrick);
  readonly leadSuit = computed(() => this._gameState().leadSuit);
  readonly message = computed(() => this._gameState().message);
  readonly trickNumber = computed(() => this._gameState().trickNumber);
  readonly highlightedPlayerIndex = computed(() => this._gameState().highlightedPlayerIndex);
  readonly kuttiRoundCards = computed(() => this._gameState().kuttiRoundCards);
  readonly kuttiTransfers = computed(() => this._gameState().kuttiTransfers);
  readonly kuttiRoundNumber = computed(() => this._gameState().kuttiRoundNumber);
  readonly kuttiTotalRounds = computed(() => this._gameState().kuttiTotalRounds);
  readonly drawDeckSize = computed(() => this._gameState().drawDeck.length);
  readonly finishedPlayers = computed(() => this._gameState().finishedPlayers);
  readonly winner = computed(() => this._gameState().winner);
  readonly dock = computed(() => this._gameState().dock);

  readonly currentPlayer = computed(() => {
    const state = this._gameState();
    return state.players[state.currentPlayerIndex] ?? null;
  });

  readonly isHumanTurn = computed(() => {
    const cp = this.currentPlayer();
    return cp?.isHuman && !cp.isFinished;
  });

  private aiDelay = 800;
  private finishCounter = 0;

  // ─── INITIAL STATE ──────────────────────────────────────────

  private getInitialState(): GameState {
    return {
      phase: GamePhase.Setup,
      players: [],
      currentPlayerIndex: 0,
      leadPlayerIndex: 0,
      currentTrick: [],
      leadSuit: null,
      trickNumber: 0,
      message: 'Welcome to Kutti Card Game! Choose number of players to begin.',
      drawDeck: [],
      kuttiRoundCards: new Map(),
      kuttiTransfers: [],
      kuttiRoundNumber: 0,
      kuttiTotalRounds: 0,
      highlightedPlayerIndex: -1,
      finishedPlayers: [],
      winner: null,
      dock: null,
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  PHASE 1: KUTTI DISTRIBUTION
  // ═══════════════════════════════════════════════════════════

  startGame(playerCount: number): void {
    const playerNames = ['You', 'Bot Raju', 'Bot Meena', 'Bot Arjun', 'Bot Priya', 'Bot Kiran'];
    const players: Player[] = [];

    for (let i = 0; i < playerCount; i++) {
      players.push({
        id: i,
        name: playerNames[i],
        hand: [],
        collectedCards: [],
        isHuman: i === 0,
        isActive: true,
        isFinished: false,
        finishOrder: -1,
      });
    }

    const deck = shuffleDeck(createDeck());
    const totalRounds = Math.floor(52 / playerCount);

    this._gameState.set({
      ...this.getInitialState(),
      phase: GamePhase.KuttiDraw,
      players,
      drawDeck: deck,
      kuttiRoundNumber: 1,
      kuttiTotalRounds: totalRounds,
      message: `Kutti Round 1/${totalRounds}: Each player draws a card...`,
    });

    this.finishCounter = 0;
    setTimeout(() => this.executeKuttiDraw(), 800);
  }

  /** Each player draws one card from the deck */
  private executeKuttiDraw(): void {
    const state = this._gameState();
    const deck = [...state.drawDeck];
    const roundCards = new Map<number, Card>();

    for (const player of state.players) {
      if (deck.length === 0) break;
      const card = deck.pop()!;
      roundCards.set(player.id, card);
    }

    // Show revealed cards — wait for human to click "Resolve Kutti"
    this._gameState.update(s => ({
      ...s,
      phase: GamePhase.KuttiReveal,
      drawDeck: deck,
      kuttiRoundCards: roundCards,
      message: `Kutti Round ${s.kuttiRoundNumber}/${s.kuttiTotalRounds}: Cards revealed! Click "Resolve Kutti" to check transfers.`,
    }));
  }

  /** Called by the human clicking "Resolve Kutti" button */
  resolveKutti(): void {
    const state = this._gameState();
    if (state.phase !== GamePhase.KuttiReveal) return;
    this.resolveKuttiTransfers();
  }

  /** Kutti Rule: if card A rank is exactly 1 higher than card B rank, B gives card to A */
  private resolveKuttiTransfers(): void {
    const state = this._gameState();
    const roundCards = state.kuttiRoundCards;
    const transfers: KuttiTransfer[] = [];

    // Build array of [playerId, card] for easy comparison
    const entries = Array.from(roundCards.entries());

    // For each pair, check if one is exactly 1 rank higher
    const takenCards = new Set<number>(); // player IDs whose cards get taken

    for (let i = 0; i < entries.length; i++) {
      for (let j = 0; j < entries.length; j++) {
        if (i === j) continue;
        const [idHigh, cardHigh] = entries[i];
        const [idLow, cardLow] = entries[j];

        // Check: cardHigh.rank === cardLow.rank + 1 (exactly one rank higher)
        if (cardHigh.rank === cardLow.rank + 1 && !takenCards.has(idLow)) {
          transfers.push({
            fromPlayerId: idLow,
            toPlayerId: idHigh,
            card: cardLow,
          });
          takenCards.add(idLow);
        }
      }
    }

    // Apply transfers: cards go to the higher player's hand
    const updatedPlayers = state.players.map(p => ({ ...p, hand: [...p.hand] }));

    // First, give each player their own drawn card (if not taken)
    for (const [playerId, card] of roundCards) {
      if (!takenCards.has(playerId)) {
        const player = updatedPlayers.find(p => p.id === playerId)!;
        player.hand.push(card);
      }
    }

    // Then apply transfers: lower card goes to higher player
    for (const transfer of transfers) {
      const receiver = updatedPlayers.find(p => p.id === transfer.toPlayerId)!;
      receiver.hand.push(transfer.card);
    }

    // Sort hands
    for (const p of updatedPlayers) {
      p.hand = this.sortHand(p.hand);
    }

    // Build transfer message
    let transferMsg = '';
    if (transfers.length > 0) {
      const parts = transfers.map(t => {
        const from = updatedPlayers.find(p => p.id === t.fromPlayerId)!.name;
        const to = updatedPlayers.find(p => p.id === t.toPlayerId)!.name;
        return `${from} gives ${getCardDisplay(t.card)} to ${to}`;
      });
      transferMsg = `🔄 Kutti! ${parts.join(' | ')}`;
    } else {
      transferMsg = 'No Kutti transfers this round.';
    }

    // Determine if more rounds remain
    const moreRounds = state.drawDeck.length >= state.players.length && state.kuttiRoundNumber < state.kuttiTotalRounds;

    this._gameState.update(s => ({
      ...s,
      phase: GamePhase.KuttiWaitNext,
      players: updatedPlayers,
      kuttiTransfers: transfers,
      message: transferMsg + (moreRounds ? '  👉 Click "Next Round" to continue.' : '  👉 Click "Start Playing!" to begin the game.'),
    }));
  }

  /** Called by the human clicking "Next Round" or "Start Playing" */
  proceedFromKutti(): void {
    const state = this._gameState();
    if (state.phase !== GamePhase.KuttiWaitNext) return;

    const moreRounds = state.drawDeck.length >= state.players.length && state.kuttiRoundNumber < state.kuttiTotalRounds;

    if (moreRounds) {
      this._gameState.update(st => ({
        ...st,
        phase: GamePhase.KuttiDraw,
        kuttiRoundNumber: st.kuttiRoundNumber + 1,
        kuttiRoundCards: new Map(),
        kuttiTransfers: [],
        message: `Kutti Round ${st.kuttiRoundNumber + 1}/${st.kuttiTotalRounds}: Drawing cards...`,
      }));
      setTimeout(() => this.executeKuttiDraw(), 600);
    } else {
      this.startPlayingPhase();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  PHASE 2: FIND STARTING PLAYER (♠Q)
  // ═══════════════════════════════════════════════════════════

  private startPlayingPhase(): void {
    const state = this._gameState();
    const players = state.players;

    // Show card distribution summary
    const summary = players.map(p => `${p.name}: ${p.hand.length} cards`).join(' | ');

    // Find player with Queen of Spades ♠Q
    let startPlayerId = -1;
    for (const player of players) {
      const hasQueenSpades = player.hand.some(
        c => c.suit === Suit.Spades && c.rank === Rank.Queen
      );
      if (hasQueenSpades) {
        startPlayerId = player.id;
        break;
      }
    }

    // Fallback: if ♠Q wasn't dealt (extra cards), pick player with highest spade
    if (startPlayerId === -1) {
      let highestRank = -1;
      for (const player of players) {
        for (const card of player.hand) {
          if (card.suit === Suit.Spades && card.rank > highestRank) {
            highestRank = card.rank;
            startPlayerId = player.id;
          }
        }
      }
    }
    if (startPlayerId === -1) startPlayerId = 0;

    this._gameState.update(s => ({
      ...s,
      phase: GamePhase.Playing,
      currentPlayerIndex: startPlayerId,
      leadPlayerIndex: startPlayerId,
      currentTrick: [],
      leadSuit: null,
      trickNumber: 1,
      kuttiRoundCards: new Map(),
      kuttiTransfers: [],
      highlightedPlayerIndex: startPlayerId,
      message: `📊 ${summary}\n\n♠Q → ${players[startPlayerId].name} has the Queen of Spades and starts! Trick 1 begins.`,
    }));

    // If AI starts, play
    if (!players[startPlayerId].isHuman) {
      setTimeout(() => this.aiPlay(), this.aiDelay + 500);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  PHASE 3: TRICK PLAYING
  // ═══════════════════════════════════════════════════════════

  /** Human plays a card */
  playCard(card: Card): void {
    const state = this._gameState();
    if (state.phase !== GamePhase.Playing) return;

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer.isHuman || currentPlayer.isFinished) return;

    this.executePlay(card);
  }

  private executePlay(card: Card): void {
    const state = this._gameState();
    const currentPlayer = state.players[state.currentPlayerIndex];

    // Remove card from hand
    const updatedPlayers = state.players.map(p => {
      if (p.id === currentPlayer.id) {
        return { ...p, hand: p.hand.filter(c => c.id !== card.id) };
      }
      return p;
    });

    const newTrick = [...state.currentTrick, { card, playerId: currentPlayer.id }];

    // Count how many active (non-finished) players should play in this trick
    const activePlayers = state.players.filter(p => !p.isFinished && p.hand.length > 0);
    // Also count players who already played in this trick
    const playersWhoPlayed = newTrick.length;
    // Players who had cards at trick start (including current player before removing)
    const playersInTrick = state.players.filter(p =>
      !p.isFinished && (p.hand.length > 0 || newTrick.some(t => t.playerId === p.id))
    );
    const trickComplete = newTrick.length >= playersInTrick.length;

    if (trickComplete) {
      this.completeTrick(updatedPlayers, newTrick);
    } else {
      const nextIdx = this.getNextActivePlayer(state.currentPlayerIndex, updatedPlayers);

      this._gameState.update(s => ({
        ...s,
        players: updatedPlayers,
        currentTrick: newTrick,
        currentPlayerIndex: nextIdx,
        highlightedPlayerIndex: nextIdx,
        message: `${currentPlayer.name} played ${getCardDisplay(card)}. ${updatedPlayers[nextIdx].name}'s turn.`,
      }));

      if (!updatedPlayers[nextIdx].isHuman) {
        setTimeout(() => this.aiPlay(), this.aiDelay);
      }
    }
  }

  private completeTrick(players: Player[], trick: PlayedCard[]): void {
    // RULE: Highest rank card wins (regardless of suit)
    let winnerPlay = trick[0];
    for (const play of trick) {
      if (play.card.rank > winnerPlay.card.rank) {
        winnerPlay = play;
      }
    }

    const winnerId = winnerPlay.playerId;
    const trickCards = trick.map(t => t.card);

    // Winner collects all cards
    let updatedPlayers = players.map(p => {
      if (p.id === winnerId) {
        return { ...p, collectedCards: [...p.collectedCards, ...trickCards] };
      }
      return p;
    });

    // Check if any player just ran out of cards → they finished!
    const newFinished = [...this._gameState().finishedPlayers];
    let winnerRef = this._gameState().winner;

    updatedPlayers = updatedPlayers.map(p => {
      if (p.hand.length === 0 && !p.isFinished) {
        this.finishCounter++;
        const updated = { ...p, isFinished: true, finishOrder: this.finishCounter };
        newFinished.push(p.id);
        // First player to finish = WINNER!
        if (!winnerRef) {
          winnerRef = updated;
        }
        return updated;
      }
      return p;
    });

    const state = this._gameState();
    const winnerName = updatedPlayers.find(p => p.id === winnerId)!.name;

    // Build finish announcements
    const newlyFinished = updatedPlayers.filter(
      p => p.isFinished && !state.finishedPlayers.includes(p.id) && newFinished.includes(p.id)
    );
    let finishMsg = '';
    if (newlyFinished.length > 0) {
      const names = newlyFinished.map(p => {
        if (p.id === winnerRef?.id && p.finishOrder === 1) return `🏆 ${p.name} WINS (first to finish)!`;
        return `✅ ${p.name} finished (rank #${p.finishOrder})!`;
      });
      finishMsg = '\n' + names.join(' ');
    }

    this._gameState.update(s => ({
      ...s,
      players: updatedPlayers,
      phase: GamePhase.TrickComplete,
      highlightedPlayerIndex: winnerId,
      finishedPlayers: newFinished,
      winner: winnerRef,
      message: `👑 ${winnerName} wins trick with ${getCardDisplay(winnerPlay.card)}! Collects ${trick.length} cards.${finishMsg}`,
    }));

    // Check game over or continue
    setTimeout(() => {
      const s = this._gameState();
      const playersStillPlaying = s.players.filter(p => !p.isFinished && p.hand.length > 0);

      // Game over: 0 or 1 player left with cards
      if (playersStillPlaying.length <= 1) {
        let dockPlayer: Player | null = null;
        let finalPlayers = s.players;

        if (playersStillPlaying.length === 1) {
          // Last player holding cards = Dock (loser)
          dockPlayer = playersStillPlaying[0];
          this.finishCounter++;
          finalPlayers = s.players.map(p => {
            if (p.id === dockPlayer!.id) {
              return { ...p, isFinished: true, finishOrder: this.finishCounter };
            }
            return p;
          });
        }

        this._gameState.update(st => ({
          ...st,
          phase: GamePhase.GameOver,
          players: finalPlayers,
          dock: dockPlayer,
          message: this.buildGameOverMessage(finalPlayers, s.winner, dockPlayer),
        }));
        return;
      }

      // Continue: winner of trick leads next (if they still have cards)
      let leadPlayer = winnerId;
      if (updatedPlayers[winnerId].isFinished || updatedPlayers[winnerId].hand.length === 0) {
        leadPlayer = this.getNextActivePlayer(winnerId, updatedPlayers);
      }

      const newTrick = s.trickNumber + 1;

      this._gameState.update(st => ({
        ...st,
        players: updatedPlayers,
        phase: GamePhase.Playing,
        currentPlayerIndex: leadPlayer,
        leadPlayerIndex: leadPlayer,
        currentTrick: [],
        leadSuit: null,
        trickNumber: newTrick,
        highlightedPlayerIndex: leadPlayer,
        message: `Trick ${newTrick}: ${updatedPlayers[leadPlayer].name} leads.`,
      }));

      if (!updatedPlayers[leadPlayer].isHuman) {
        setTimeout(() => this.aiPlay(), this.aiDelay);
      }
    }, 2200);
  }

  private buildGameOverMessage(players: Player[], winner: Player | null, dock: Player | null): string {
    const ranked = [...players].sort((a, b) => a.finishOrder - b.finishOrder);
    let msg = '🎉 GAME OVER!\n\n';
    if (winner) msg += `🏆 WINNER: ${winner.name} (finished first!)\n`;
    if (dock) msg += `🐕 DOCK: ${dock.name} (last player with cards!)\n`;
    return msg;
  }

  // ─── AI ──────────────────────────────────────────────────

  private aiPlay(): void {
    const state = this._gameState();
    if (state.phase !== GamePhase.Playing) return;

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.isHuman || currentPlayer.isFinished || currentPlayer.hand.length === 0) return;

    const card = this.chooseAICard(currentPlayer, state);
    this.executePlay(card);
  }

  private chooseAICard(player: Player, state: GameState): Card {
    const hand = player.hand;

    // Strategy: play lowest card to empty hand fastest
    // But sometimes play high to win trick and control game

    if (state.currentTrick.length === 0) {
      // Leading: play lowest card
      return hand[0];
    }

    // Following: check what's been played
    const highestInTrick = Math.max(...state.currentTrick.map(t => t.card.rank));

    // If we have cards lower than the highest → play lowest (try to lose trick)
    const lowerCards = hand.filter(c => c.rank < highestInTrick);
    if (lowerCards.length > 0) {
      return lowerCards[0]; // play lowest
    }

    // All our cards are higher → play lowest of what we have (still try to minimize)
    return hand[0];
  }

  // ─── HELPERS ──────────────────────────────────────────────

  private getNextActivePlayer(currentIndex: number, players: Player[]): number {
    let next = (currentIndex + 1) % players.length;
    let safety = 0;
    while ((players[next].isFinished || players[next].hand.length === 0) && safety < players.length) {
      next = (next + 1) % players.length;
      safety++;
    }
    return next;
  }

  private sortHand(hand: Card[]): Card[] {
    return [...hand].sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const suitOrder = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
      return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    });
  }

  /** All cards in hand are valid to play (no suit restriction) */
  getPlayableCards(player: Player): Card[] {
    if (player.isFinished || player.hand.length === 0) return [];
    return player.hand;
  }

  resetGame(): void {
    this._gameState.set(this.getInitialState());
    this.finishCounter = 0;
  }
}
