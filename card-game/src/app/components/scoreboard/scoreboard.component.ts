import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Player } from '../../models/card.model';

@Component({
  selector: 'app-scoreboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scoreboard.component.html',
  styleUrl: './scoreboard.component.scss',
})
export class ScoreboardComponent {
  @Input() players: Player[] = [];
  @Input() currentPlayerIndex = -1;
  @Input() highlightedPlayerIndex = -1;

  get sortedByCollected(): Player[] {
    return [...this.players].sort((a, b) => a.collectedCards.length - b.collectedCards.length);
  }
}
