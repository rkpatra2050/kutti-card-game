import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Card, Player } from '../../models/card.model';
import { CardComponent } from '../card/card.component';

@Component({
  selector: 'app-player-hand',
  standalone: true,
  imports: [CommonModule, CardComponent],
  templateUrl: './player-hand.component.html',
  styleUrl: './player-hand.component.scss',
})
export class PlayerHandComponent {
  @Input({ required: true }) player!: Player;
  @Input() isCurrentTurn = false;
  @Input() validCards: Card[] = [];
  @Output() cardPlayed = new EventEmitter<Card>();

  isCardPlayable(card: Card): boolean {
    if (!this.player.isHuman || !this.isCurrentTurn) return false;
    return this.validCards.some(c => c.id === card.id);
  }

  onCardClick(card: Card): void {
    if (this.isCardPlayable(card)) {
      this.cardPlayed.emit(card);
    }
  }
}
