import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayedCard, Player, SUIT_SYMBOLS, Suit } from '../../models/card.model';
import { CardComponent } from '../card/card.component';

@Component({
  selector: 'app-trick-area',
  standalone: true,
  imports: [CommonModule, CardComponent],
  templateUrl: './trick-area.component.html',
  styleUrl: './trick-area.component.scss',
})
export class TrickAreaComponent {
  @Input() currentTrick: PlayedCard[] = [];
  @Input() players: Player[] = [];
  @Input() leadSuit: Suit | null = null;
  @Input() trickNumber = 0;
  @Input() totalTricks = 0;

  get leadSuitSymbol(): string {
    return this.leadSuit ? SUIT_SYMBOLS[this.leadSuit] : '';
  }

  getPlayerName(playerId: number): string {
    return this.players.find(p => p.id === playerId)?.name ?? `Player ${playerId + 1}`;
  }
}
