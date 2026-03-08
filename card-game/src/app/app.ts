import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from './services/game.service';
import { GamePhase } from './models/card.model';
import { SetupScreenComponent } from './components/setup-screen/setup-screen.component';
import { GameBoardComponent } from './components/game-board/game-board.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SetupScreenComponent, GameBoardComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private gameService = inject(GameService);
  readonly phase = this.gameService.phase;
  readonly GamePhase = GamePhase;

  onStartGame(playerCount: number): void {
    this.gameService.startGame(playerCount);
  }
}
