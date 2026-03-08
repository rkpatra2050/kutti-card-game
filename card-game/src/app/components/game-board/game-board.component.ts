import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../../services/game.service';
import { Card, GamePhase, Player } from '../../models/card.model';
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
  readonly leadSuit = this.gameService.leadSuit;
  readonly message = this.gameService.message;
  readonly trickNumber = this.gameService.trickNumber;
  readonly totalTricks = this.gameService.totalTricks;
  readonly highlightedPlayerIndex = this.gameService.highlightedPlayerIndex;
  readonly isHumanTurn = this.gameService.isHumanTurn;

  readonly GamePhase = GamePhase;

  get humanPlayer(): Player | null {
    return this.players().find(p => p.isHuman) ?? null;
  }

  get aiPlayers(): Player[] {
    return this.players().filter(p => !p.isHuman);
  }

  get sortedPlayers(): Player[] {
    return [...this.players()].sort((a, b) => a.collectedCards.length - b.collectedCards.length);
  }

  getValidCards(player: Player): Card[] {
    return this.gameService.getValidCards(player);
  }

  getInitialCard(playerId: number): Card | null {
    const state = this.gameState();
    return state.initialCards.get(playerId) ?? null;
  }

  onCardPlayed(card: Card): void {
    this.gameService.playCard(card);
  }

  onNewGame(): void {
    this.gameService.resetGame();
  }

  getMinCollected(): number {
    return Math.min(...this.players().map(p => p.collectedCards.length));
  }

  getMaxCollected(): number {
    return Math.max(...this.players().map(p => p.collectedCards.length));
  }
}
