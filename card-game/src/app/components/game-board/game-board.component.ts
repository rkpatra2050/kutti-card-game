import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../../services/game.service';
import { Card, GamePhase, Player, KuttiTransfer, getCardDisplay, RANK_DISPLAY, SUIT_SYMBOLS } from '../../models/card.model';
import { PlayerHandComponent } from '../player-hand/player-hand.component';
import { TrickAreaComponent } from '../trick-area/trick-area.component';
import { ScoreboardComponent } from '../scoreboard/scoreboard.component';
import { CardComponent } from '../card/card.component';

@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [CommonModule, PlayerHandComponent, TrickAreaComponent, ScoreboardComponent, CardComponent],
  templateUrl: './game-board.component.html',
  styleUrl: './game-board.component.scss',
})
export class GameBoardComponent {
  private gameService = inject(GameService);

  readonly gameState = this.gameService.gameState;
  readonly phase = this.gameService.phase;
  readonly players = this.gameService.players;
  readonly currentPlayerIndex = this.gameService.currentPlayerIndex;
  readonly currentTrick = this.gameService.currentTrick;
  readonly message = this.gameService.message;
  readonly trickNumber = this.gameService.trickNumber;
  readonly highlightedPlayerIndex = this.gameService.highlightedPlayerIndex;
  readonly isHumanTurn = this.gameService.isHumanTurn;
  readonly kuttiRoundCards = this.gameService.kuttiRoundCards;
  readonly kuttiTransfers = this.gameService.kuttiTransfers;
  readonly kuttiRoundNumber = this.gameService.kuttiRoundNumber;
  readonly kuttiTotalRounds = this.gameService.kuttiTotalRounds;
  readonly drawDeckSize = this.gameService.drawDeckSize;
  readonly winner = this.gameService.winner;
  readonly dock = this.gameService.dock;

  readonly GamePhase = GamePhase;

  get humanPlayer(): Player | null {
    return this.players().find(p => p.isHuman) ?? null;
  }

  get aiPlayers(): Player[] {
    return this.players().filter(p => !p.isHuman);
  }

  get sortedPlayers(): Player[] {
    return [...this.players()].sort((a, b) => {
      if (a.isFinished && b.isFinished) return a.finishOrder - b.finishOrder;
      if (a.isFinished) return -1;
      if (b.isFinished) return 1;
      return a.hand.length - b.hand.length;
    });
  }

  get isKuttiPhase(): boolean {
    const p = this.phase();
    return p === GamePhase.KuttiDraw || p === GamePhase.KuttiReveal || p === GamePhase.KuttiTransfer;
  }

  getPlayableCards(player: Player): Card[] {
    return this.gameService.getPlayableCards(player);
  }

  getKuttiCard(playerId: number): Card | null {
    return this.kuttiRoundCards().get(playerId) ?? null;
  }

  getCardDisplay(card: Card): string {
    return getCardDisplay(card);
  }

  getPlayerTransfer(playerId: number): KuttiTransfer | null {
    const transfers = this.kuttiTransfers();
    return transfers.find(t => t.fromPlayerId === playerId || t.toPlayerId === playerId) ?? null;
  }

  isTransferGiver(playerId: number): boolean {
    return this.kuttiTransfers().some(t => t.fromPlayerId === playerId);
  }

  isTransferReceiver(playerId: number): boolean {
    return this.kuttiTransfers().some(t => t.toPlayerId === playerId);
  }

  onCardPlayed(card: Card): void {
    this.gameService.playCard(card);
  }

  onNewGame(): void {
    this.gameService.resetGame();
  }
}
