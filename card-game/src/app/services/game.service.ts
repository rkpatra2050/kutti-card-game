import { Injectable, signal, computed } from '@angular/core';
import {
  Card,
  Player,
  PlayedCard,
  GamePhase,
  GameState,
  Suit,
  Rank,
  createDeck,
  shuffleDeck,
  compareCards,
  getCardDisplay,
  SUIT_SYMBOLS,
  SUIT_COLORS,
  SuitColor,
} from '../models/card.model';

@Injectable({
  providedIn: 'root',
})
export class GameService {
  private _gameState = signal<GameState>({
    phase: GamePhase.Setup,
    players: [],
    currentPlayerIndex: 0,
    leadPlayerIndex: 0,
    currentTrick: [],
    leadSuit: null,
    trickNumber: 0,
    totalTricks: 0,
    message: 'Welcome to Kutti Card Game! Choose number of players to begin.',
    initialCards: new Map(),
    highlightedPlayerIndex: -1,
  });

  readonly gameState = this._gameState.asReadonly();

  readonly phase = computed(() => this._gameState().phase);
  readonly players = computed(() => this._gameState().players);
  readonly currentPlayerIndex = computed(() => this._gameState().currentPlayerIndex);
  readonly currentTrick = computed(() => this._gameState().currentTrick);
  readonly leadSuit = computed(() => this._gameState().leadSuit);
  readonly message = computed(() => this._gameState().message);
  readonly trickNumber = computed(() => this._gameState().trickNumber);
  readonly totalTricks = computed(() => this._gameState().totalTricks);
  readonly highlightedPlayerIndex = computed(() => this._gameState().highlightedPlayerIndex);

  readonly currentPlayer = computed(() => {
    const state = this._gameState();
    return state.players[state.currentPlayerIndex] ?? null;
  });

  readonly isHumanTurn = computed(() => {
    const player = this.currentPlayer();
    return player?.isHuman ?? false;
  });

  private deck: Card[] = [];
  private aiThinkingDelay = 800;

  // ─── GAME START ──────────────────────────────────────────

  startGame(playerCount: number): void {
    const players: Player[] = [];
    const playerNames = ['You', 'Bot Raju', 'Bot Meena', 'Bot Arjun', 'Bot Priya', 'Bot Kiran'];

    for (let i = 0; i < playerCount; i++) {
      players.push({
        id: i,
        name: playerNames[i],
        hand: [],
        collectedCards: [],
        isHuman: i === 0,
        isActive: true,
      });
    }

    this.deck = shuffleDeck(createDeck());

    // Deal cards evenly
    const cardsPerPlayer = Math.floor(52 / playerCount);
    const totalCardsDealt = cardsPerPlayer * playerCount;

    for (let i = 0; i < totalCardsDealt; i++) {
      const playerIndex = i % playerCount;
      players[playerIndex].hand.push(this.deck[i]);
    }

    // Sort each player's hand by suit then rank
    for (const player of players) {
      player.hand = this.sortHand(player.hand);
    }

    this._gameState.set({
      phase: GamePhase.InitialDraw,
      players,
      currentPlayerIndex: 0,
      leadPlayerIndex: 0,
      currentTrick: [],
      leadSuit: null,
      trickNumber: 0,
      totalTricks: cardsPerPlayer,
      message: 'Each player reveals one card to decide who starts...',
      initialCards: new Map(),
      highlightedPlayerIndex: -1,
    });

    this.performInitialDraw(players);
  }

  // ─── INITIAL DRAW: Highest Spade ♠ starts ────────────────

  private performInitialDraw(players: Player[]): void {
    const initialCards = new Map<number, Card>();

    // Each player draws one random card from their hand to show
    for (const player of players) {
      const randomIndex = Math.floor(Math.random() * player.hand.length);
      initialCards.set(player.id, player.hand[randomIndex]);
    }

    // Find who has the highest Spade ♠
    let startPlayerId = -1;
    let highestSpadeRank = -1;

    for (const [playerId, card] of initialCards) {
      if (card.suit === Suit.Spades && card.rank > highestSpadeRank) {
        highestSpadeRank = card.rank;
        startPlayerId = playerId;
      }
    }

    // If nobody drew a Spade, find highest card of any black suit (Spades or Clubs)
    if (startPlayerId === -1) {
      let highestBlackRank = -1;
      for (const [playerId, card] of initialCards) {
        if ((card.suit === Suit.Spades || card.suit === Suit.Clubs) && card.rank > highestBlackRank) {
          highestBlackRank = card.rank;
          startPlayerId = playerId;
        }
      }
    }

    // If still nobody (all drew red), just pick highest rank overall
    if (startPlayerId === -1) {
      let highestRank = -1;
      for (const [playerId, card] of initialCards) {
        if (card.rank > highestRank) {
          highestRank = card.rank;
          startPlayerId = playerId;
        }
      }
    }

    const startCard = initialCards.get(startPlayerId)!;

    // Show reveal phase briefly, then start playing
    this._gameState.update(state => ({
      ...state,
      phase: GamePhase.Reveal,
      initialCards,
      highlightedPlayerIndex: startPlayerId,
      message: `Revealing cards... ${players[startPlayerId].name} drew ${getCardDisplay(startCard)} — highest Spade ♠! They start!`,
    }));

    setTimeout(() => {
      this._gameState.update(state => ({
        ...state,
        phase: GamePhase.Playing,
        currentPlayerIndex: startPlayerId,
        leadPlayerIndex: startPlayerId,
        trickNumber: 1,
        highlightedPlayerIndex: startPlayerId,
        message: `Trick 1: ${players[startPlayerId].name} leads. Play any card to start!`,
      }));

      // If AI starts, trigger AI play
      if (!players[startPlayerId].isHuman) {
        setTimeout(() => this.aiPlay(), this.aiThinkingDelay + 500);
      }
    }, 2500);
  }

  // ─── HUMAN PLAYS A CARD ───────────────────────────────────

  playCard(card: Card): void {
    const state = this._gameState();
    if (state.phase !== GamePhase.Playing) return;

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer.isHuman) return;

    // Validate: must follow lead suit if you have cards of that suit
    if (!this.isValidPlay(card, currentPlayer, state.leadSuit)) {
      this._gameState.update(s => ({
        ...s,
        message: `⚠️ You must follow suit! Play a ${SUIT_SYMBOLS[state.leadSuit!]} card — you have one in your hand.`,
      }));
      return;
    }

    this.executePlay(card);
  }

  // ─── EXECUTE A CARD PLAY (human or AI) ────────────────────

  private executePlay(card: Card): void {
    const state = this._gameState();
    const currentPlayer = state.players[state.currentPlayerIndex];

    // Remove card from player's hand
    const updatedPlayers = state.players.map(p => {
      if (p.id === currentPlayer.id) {
        return { ...p, hand: p.hand.filter(c => c.id !== card.id) };
      }
      return p;
    });

    const newTrick = [...state.currentTrick, { card, playerId: currentPlayer.id }];
    const isLeadPlay = state.currentTrick.length === 0;
    const newLeadSuit = isLeadPlay ? card.suit : state.leadSuit;

    // Count how many active players (with cards) are in this round
    // A trick is complete when every player has played once
    const playersInTrick = state.players.filter(p => p.hand.length > 0 || state.currentTrick.some(t => t.playerId === p.id));
    const trickComplete = newTrick.length >= playersInTrick.length;

    if (trickComplete) {
      this.completeTrick(updatedPlayers, newTrick, newLeadSuit!);
    } else {
      // Move to next active player (who still has cards)
      const nextPlayerIndex = this.getNextActivePlayer(state.currentPlayerIndex, updatedPlayers);

      const offSuitNote = (!isLeadPlay && card.suit !== newLeadSuit)
        ? ` (off-suit — can't win!)`
        : '';

      this._gameState.update(s => ({
        ...s,
        players: updatedPlayers,
        currentTrick: newTrick,
        leadSuit: newLeadSuit,
        currentPlayerIndex: nextPlayerIndex,
        highlightedPlayerIndex: nextPlayerIndex,
        message: `${currentPlayer.name} played ${getCardDisplay(card)}${offSuitNote}. ${updatedPlayers[nextPlayerIndex].name}'s turn.`,
      }));

      // If next player is AI, trigger AI play
      if (!updatedPlayers[nextPlayerIndex].isHuman) {
        setTimeout(() => this.aiPlay(), this.aiThinkingDelay);
      }
    }
  }

  // ─── TRICK COMPLETE: determine winner ─────────────────────

  private completeTrick(players: Player[], trick: PlayedCard[], leadSuit: Suit): void {
    // RULE: Only cards of the LEAD SUIT can win.
    // The HIGHEST card of the lead suit takes ALL cards in the trick.
    // Off-suit cards (even King, Ace) CANNOT win — they're just dumped.

    const leadSuitPlays = trick.filter(t => t.card.suit === leadSuit);

    let winnerPlay: PlayedCard;

    if (leadSuitPlays.length > 0) {
      // Highest lead-suit card wins
      winnerPlay = leadSuitPlays[0];
      for (const play of leadSuitPlays) {
        if (play.card.rank > winnerPlay.card.rank) {
          winnerPlay = play;
        }
      }
    } else {
      // Edge case: if somehow no lead suit cards (shouldn't happen since leader played one)
      winnerPlay = trick[0];
    }

    const winnerId = winnerPlay.playerId;
    const trickCards = trick.map(t => t.card);

    // Winner collects ALL cards from the trick
    const updatedPlayers = players.map(p => {
      if (p.id === winnerId) {
        return { ...p, collectedCards: [...p.collectedCards, ...trickCards] };
      }
      return p;
    });

    const state = this._gameState();

    // Build a helpful message
    const offSuitCount = trick.filter(t => t.card.suit !== leadSuit).length;
    const offSuitMsg = offSuitCount > 0
      ? ` (${offSuitCount} off-suit card${offSuitCount > 1 ? 's' : ''} didn't count!)`
      : '';

    this._gameState.update(s => ({
      ...s,
      players: updatedPlayers,
      phase: GamePhase.TrickComplete,
      highlightedPlayerIndex: winnerId,
      message: `🃏 ${updatedPlayers[winnerId].name} wins with ${getCardDisplay(winnerPlay.card)} (highest ${SUIT_SYMBOLS[leadSuit]})! Collects ${trick.length} cards.${offSuitMsg}`,
    }));

    // After a pause, start next trick or end game
    setTimeout(() => {
      const totalCardsLeft = updatedPlayers.reduce((sum, p) => sum + p.hand.length, 0);

      if (totalCardsLeft === 0) {
        // All cards played — game over!
        this.endGame(updatedPlayers);
        return;
      }

      // Check: if only 1 player still has cards, they're stuck holding them = Dog!
      const playersWithCards = updatedPlayers.filter(p => p.hand.length > 0);
      if (playersWithCards.length <= 1) {
        // The remaining player with cards is the Dog
        if (playersWithCards.length === 1) {
          const dogPlayer = playersWithCards[0];
          // Add their remaining hand to their collected pile (they're stuck with them)
          const finalPlayers = updatedPlayers.map(p => {
            if (p.id === dogPlayer.id) {
              return {
                ...p,
                collectedCards: [...p.collectedCards, ...p.hand],
                hand: [],
              };
            }
            return p;
          });
          this.endGame(finalPlayers);
        } else {
          this.endGame(updatedPlayers);
        }
        return;
      }

      // Next trick: winner leads
      const newTrickNumber = state.trickNumber + 1;

      // If the winner has no cards left, find next player who does
      let leadPlayer = winnerId;
      if (updatedPlayers[winnerId].hand.length === 0) {
        leadPlayer = this.getNextActivePlayer(winnerId, updatedPlayers);
      }

      this._gameState.update(s => ({
        ...s,
        players: updatedPlayers,
        phase: GamePhase.Playing,
        currentPlayerIndex: leadPlayer,
        leadPlayerIndex: leadPlayer,
        currentTrick: [],
        leadSuit: null,
        trickNumber: newTrickNumber,
        highlightedPlayerIndex: leadPlayer,
        message: `Trick ${newTrickNumber}: ${updatedPlayers[leadPlayer].name} leads.`,
      }));

      // If AI leads, trigger AI play
      if (!updatedPlayers[leadPlayer].isHuman) {
        setTimeout(() => this.aiPlay(), this.aiThinkingDelay);
      }
    }, 2200);
  }

  // ─── GAME OVER: least cards = winner, most cards = Dog 🐕 ─

  private endGame(players: Player[]): void {
    const sorted = [...players].sort((a, b) => a.collectedCards.length - b.collectedCards.length);
    const winner = sorted[0];
    const loser = sorted[sorted.length - 1];

    this._gameState.update(s => ({
      ...s,
      phase: GamePhase.GameOver,
      players,
      message: `🏆 ${winner.name} WINS with only ${winner.collectedCards.length} cards! 🐕 ${loser.name} is the DOG with ${loser.collectedCards.length} cards!`,
    }));
  }

  // ─── AI LOGIC ─────────────────────────────────────────────

  private aiPlay(): void {
    const state = this._gameState();
    if (state.phase !== GamePhase.Playing) return;

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.isHuman || currentPlayer.hand.length === 0) return;

    const card = this.chooseAICard(currentPlayer, state);
    this.executePlay(card);
  }

  private chooseAICard(player: Player, state: GameState): Card {
    const hand = player.hand;
    const leadSuit = state.leadSuit;

    // LEADING (no lead suit yet) — play lowest card to minimize risk
    if (!leadSuit) {
      return hand[0]; // hand is sorted, first is lowest
    }

    // FOLLOWING — must play lead suit if you have it
    const suitCards = hand.filter(c => c.suit === leadSuit);

    if (suitCards.length > 0) {
      // Has matching suit cards
      const currentHighest = this.getCurrentTrickHighest(state.currentTrick, leadSuit);

      if (currentHighest) {
        const beaters = suitCards.filter(c => c.rank > currentHighest.rank);

        // AI Strategy: try to LOSE (play low) to avoid collecting cards
        // Only play high if we're forced to or if it's strategic
        if (Math.random() > 0.6 && beaters.length > 0) {
          // Sometimes play lowest beater (unavoidable win)
          return beaters[0];
        }
        // Mostly play lowest card of suit (try to duck under)
        return suitCards[0];
      }

      // First follower — play lowest
      return suitCards[0];
    }

    // CAN'T FOLLOW SUIT — dump highest card (it can't win anyway, off-suit never wins)
    // This is a great chance to get rid of dangerous high cards!
    return hand[hand.length - 1];
  }

  private getCurrentTrickHighest(trick: PlayedCard[], leadSuit: Suit): Card | null {
    if (trick.length === 0) return null;

    let highest: Card | null = null;
    for (const play of trick) {
      if (play.card.suit === leadSuit) {
        if (!highest || play.card.rank > highest.rank) {
          highest = play.card;
        }
      }
    }
    return highest;
  }

  // ─── VALIDATION ───────────────────────────────────────────

  private isValidPlay(card: Card, player: Player, leadSuit: Suit | null): boolean {
    // Leading? Any card is fine
    if (!leadSuit) return true;

    // Following lead suit? Always valid
    if (card.suit === leadSuit) return true;

    // Playing off-suit? Only valid if you have NO cards of the lead suit
    const hasSuitCards = player.hand.some(c => c.suit === leadSuit);
    return !hasSuitCards;
  }

  // ─── HELPERS ──────────────────────────────────────────────

  private getNextActivePlayer(currentIndex: number, players: Player[]): number {
    let next = (currentIndex + 1) % players.length;
    let safety = 0;
    while (players[next].hand.length === 0 && safety < players.length) {
      next = (next + 1) % players.length;
      safety++;
    }
    return next;
  }

  private sortHand(hand: Card[]): Card[] {
    return hand.sort((a, b) => {
      const suitOrder = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
      const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      if (suitDiff !== 0) return suitDiff;
      return a.rank - b.rank;
    });
  }

  getValidCards(player: Player): Card[] {
    const state = this._gameState();
    return player.hand.filter(c => this.isValidPlay(c, player, state.leadSuit));
  }

  resetGame(): void {
    this._gameState.set({
      phase: GamePhase.Setup,
      players: [],
      currentPlayerIndex: 0,
      leadPlayerIndex: 0,
      currentTrick: [],
      leadSuit: null,
      trickNumber: 0,
      totalTricks: 0,
      message: 'Welcome to Kutti Card Game! Choose number of players to begin.',
      initialCards: new Map(),
      highlightedPlayerIndex: -1,
    });
  }
}
