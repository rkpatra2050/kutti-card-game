import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from './services/game.service';
import { SocketService } from './services/socket.service';
import { GamePhase } from './models/card.model';
import { SetupScreenComponent } from './components/setup-screen/setup-screen.component';
import { GameBoardComponent } from './components/game-board/game-board.component';
import { MultiplayerBoardComponent } from './components/multiplayer-board/multiplayer-board.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SetupScreenComponent, GameBoardComponent, MultiplayerBoardComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private gameService = inject(GameService);
  readonly socketService = inject(SocketService);
  readonly phase = this.gameService.phase;
  readonly GamePhase = GamePhase;
  readonly multiplayerScreen = this.socketService.screen;

  onStartGame(playerCount: number): void {
    this.gameService.startGame(playerCount);
  }
}
