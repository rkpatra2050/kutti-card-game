import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-setup-screen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './setup-screen.component.html',
  styleUrl: './setup-screen.component.scss',
})
export class SetupScreenComponent {
  @Output() startGame = new EventEmitter<number>();

  playerOptions = [2, 3, 4, 5, 6];
  selectedPlayers = 4;

  onSelectPlayers(count: number): void {
    this.selectedPlayers = count;
  }

  onStartGame(): void {
    this.startGame.emit(this.selectedPlayers);
  }

  getCardsPerPlayer(count: number): number {
    return Math.floor(52 / count);
  }
}
