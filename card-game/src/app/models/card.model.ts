export enum Suit {
  Spades = 'spades',
  Hearts = 'hearts',
  Diamonds = 'diamonds',
  Clubs = 'clubs',
}

export enum SuitColor {
  Black = 'black',
  Red = 'red',
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Spades]: '♠',
  [Suit.Hearts]: '♥',
  [Suit.Diamonds]: '♦',
  [Suit.Clubs]: '♣',
};

export const SUIT_COLORS: Record<Suit, SuitColor> = {
  [Suit.Spades]: SuitColor.Black,
  [Suit.Hearts]: SuitColor.Red,
  [Suit.Diamonds]: SuitColor.Red,
  [Suit.Clubs]: SuitColor.Black,
};

export const SUIT_NAMES: Record<Suit, string> = {
  [Suit.Spades]: 'Spades',
  [Suit.Hearts]: 'Hearts',
  [Suit.Diamonds]: 'Diamonds',
  [Suit.Clubs]: 'Clubs',
};

export enum Rank {
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
  Ace = 14,
}

export const RANK_DISPLAY: Record<Rank, string> = {
  [Rank.Two]: '2',
  [Rank.Three]: '3',
  [Rank.Four]: '4',
  [Rank.Five]: '5',
  [Rank.Six]: '6',
  [Rank.Seven]: '7',
  [Rank.Eight]: '8',
  [Rank.Nine]: '9',
  [Rank.Ten]: '10',
  [Rank.Jack]: 'J',
  [Rank.Queen]: 'Q',
  [Rank.King]: 'K',
  [Rank.Ace]: 'A',
};

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export interface PlayedCard {
  card: Card;
  playerId: number;
}

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  collectedCards: Card[];
  isHuman: boolean;
  isActive: boolean;
  isFinished: boolean;
  finishOrder: number;
}

export interface KuttiTransfer {
  fromPlayerId: number;
  toPlayerId: number;
  card: Card;
}

export enum GamePhase {
  Setup = 'setup',
  KuttiDraw = 'kutti-draw',
  KuttiReveal = 'kutti-reveal',
  KuttiTransfer = 'kutti-transfer',
  KuttiWaitNext = 'kutti-wait-next',
  Playing = 'playing',
  TrickComplete = 'trick-complete',
  GameOver = 'game-over',
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  leadPlayerIndex: number;
  currentTrick: PlayedCard[];
  leadSuit: Suit | null;
  trickNumber: number;
  message: string;
  // Kutti phase
  drawDeck: Card[];
  kuttiRoundCards: Map<number, Card>;
  kuttiTransfers: KuttiTransfer[];
  kuttiRoundNumber: number;
  kuttiTotalRounds: number;
  // General
  highlightedPlayerIndex: number;
  finishedPlayers: number[];
  winner: Player | null;
  dock: Player | null;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  const suits = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
  const ranks = [
    Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six,
    Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten,
    Rank.Jack, Rank.Queen, Rank.King, Rank.Ace,
  ];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        suit,
        rank,
        id: `${rank}-${suit}`,
      });
    }
  }

  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getCardDisplay(card: Card): string {
  return `${RANK_DISPLAY[card.rank]}${SUIT_SYMBOLS[card.suit]}`;
}

export function getCardColor(card: Card): SuitColor {
  return SUIT_COLORS[card.suit];
}

export function compareCards(a: Card, b: Card, leadSuit: Suit): number {
  // ONLY cards of the lead suit can win the trick
  const aIsLead = a.suit === leadSuit;
  const bIsLead = b.suit === leadSuit;

  // Lead suit always beats non-lead suit
  if (aIsLead && !bIsLead) return 1;
  if (!aIsLead && bIsLead) return -1;

  // Both are lead suit — higher rank wins
  if (aIsLead && bIsLead) return a.rank - b.rank;

  // Neither is lead suit — they are both irrelevant, treat as equal (neither can win)
  return 0;
}
