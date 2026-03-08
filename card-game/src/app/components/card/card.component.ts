import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Card,
  RANK_DISPLAY,
  SUIT_SYMBOLS,
  SUIT_COLORS,
  SuitColor,
} from '../../models/card.model';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class CardComponent {
  @Input({ required: true }) card!: Card;
  @Input() faceUp = true;
  @Input() playable = false;
  @Input() highlighted = false;
  @Input() small = false;
  @Output() cardClick = new EventEmitter<Card>();

  get rankDisplay(): string {
    return RANK_DISPLAY[this.card.rank];
  }

  get suitSymbol(): string {
    return SUIT_SYMBOLS[this.card.suit];
  }

  get isRed(): boolean {
    return SUIT_COLORS[this.card.suit] === SuitColor.Red;
  }

  get cardClasses(): Record<string, boolean> {
    return {
      card: true,
      'face-up': this.faceUp,
      'face-down': !this.faceUp,
      playable: this.playable,
      highlighted: this.highlighted,
      red: this.isRed,
      black: !this.isRed,
      small: this.small,
    };
  }

  onClick(): void {
    if (this.playable) {
      this.cardClick.emit(this.card);
    }
  }
}
