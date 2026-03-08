import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-setup-screen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setup-screen.component.html',
  styleUrl: './setup-screen.component.scss',
})
export class SetupScreenComponent {
  @Output() startGame = new EventEmitter<number>();

  readonly socketService = inject(SocketService);

  // Mode: 'choose' | 'bot' | 'create' | 'join' | 'lobby'
  mode: 'choose' | 'bot' | 'create' | 'join' | 'lobby' = 'choose';

  // Bot mode
  playerOptions = [2, 3, 4, 5, 6];
  selectedPlayers = 4;

  // Multiplayer
  playerName = '';
  maxPlayers = 4;
  joinCode = '';

  onSelectPlayers(count: number): void {
    this.selectedPlayers = count;
  }

  onStartBotGame(): void {
    this.startGame.emit(this.selectedPlayers);
  }

  getCardsPerPlayer(count: number): number {
    return Math.floor(52 / count);
  }

  onChooseBot(): void {
    this.mode = 'bot';
  }

  onChooseFriend(): void {
    this.mode = 'create';
  }

  onBack(): void {
    if (this.mode === 'lobby') {
      this.socketService.disconnect();
    }
    this.mode = 'choose';
  }

  onShowJoin(): void {
    this.mode = 'join';
  }

  onShowCreate(): void {
    this.mode = 'create';
  }

  onCreateRoom(): void {
    if (!this.playerName.trim()) return;
    this.socketService.connect();
    // Small delay for connection
    setTimeout(() => {
      this.socketService.createRoom(this.playerName.trim(), this.maxPlayers);
      this.mode = 'lobby';
    }, 500);
  }

  onJoinRoom(): void {
    if (!this.playerName.trim() || !this.joinCode.trim()) return;
    this.socketService.connect();
    setTimeout(() => {
      this.socketService.joinRoom(this.joinCode.trim().toUpperCase(), this.playerName.trim());
      this.mode = 'lobby';
    }, 500);
  }

  onStartMultiplayerGame(): void {
    this.socketService.startGame();
  }
}
