import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocketService, MultiplayerPlayer } from '../../services/socket.service';
import { CardComponent } from '../card/card.component';
import { Card, GamePhase, RANK_DISPLAY, SUIT_SYMBOLS } from '../../models/card.model';

@Component({
  selector: 'app-multiplayer-board',
  standalone: true,
  imports: [CommonModule, CardComponent],
  templateUrl: './multiplayer-board.component.html',
  styleUrl: './multiplayer-board.component.scss',
})
export class MultiplayerBoardComponent {
  private socketService = inject(SocketService);

  readonly state = this.socketService.state;
  readonly isHost = this.socketService.isHost;
  readonly myPlayer = this.socketService.myPlayer;

  get phase(): string {
    return this.state()?.phase ?? 'waiting';
  }

  get players(): MultiplayerPlayer[] {
    return this.state()?.players ?? [];
  }

  get otherPlayers(): MultiplayerPlayer[] {
    return this.players.filter(p => !p.isMe);
  }

  get currentPlayerIndex(): number {
    return this.state()?.currentPlayerIndex ?? -1;
  }

  get currentTrick(): any[] {
    return this.state()?.currentTrick ?? [];
  }

  get trickNumber(): number {
    return this.state()?.trickNumber ?? 0;
  }

  get message(): string {
    return this.state()?.message ?? '';
  }

  get isMyTurn(): boolean {
    const s = this.state();
    const me = this.myPlayer();
    if (!s || !me) return false;
    return s.phase === 'playing' && s.currentPlayerIndex === me.id && !me.isFinished;
  }

  get isKuttiPhase(): boolean {
    const p = this.phase;
    return p === 'kutti-draw' || p === 'kutti-reveal' || p === 'kutti-wait-next';
  }

  get kuttiRoundCards(): Record<number, any> {
    return this.state()?.kuttiRoundCards ?? {};
  }

  get kuttiTransfers(): any[] {
    return this.state()?.kuttiTransfers ?? [];
  }

  get hasMoreKuttiRounds(): boolean {
    const s = this.state();
    if (!s) return false;
    return s.drawDeckSize >= s.players.length && s.kuttiRoundNumber < s.kuttiTotalRounds;
  }

  getKuttiCard(playerId: number): any {
    return this.kuttiRoundCards[playerId] ?? null;
  }

  getCardDisplay(card: any): string {
    if (!card) return '';
    const rd: Record<number, string> = { 2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A' };
    const ss: Record<string, string> = { spades:'♠', hearts:'♥', diamonds:'♦', clubs:'♣' };
    return `${rd[card.rank] || card.rank}${ss[card.suit] || card.suit}`;
  }

  isTransferGiver(playerId: number): boolean {
    return this.kuttiTransfers.some((t: any) => t.fromPlayerId === playerId);
  }

  isTransferReceiver(playerId: number): boolean {
    return this.kuttiTransfers.some((t: any) => t.toPlayerId === playerId);
  }

  getPlayerName(playerId: number): string {
    return this.players.find(p => p.id === playerId)?.name ?? `Player ${playerId + 1}`;
  }

  isCardPlayable(card: any): boolean {
    return this.isMyTurn;
  }

  onCardClick(card: any): void {
    if (!this.isMyTurn) return;
    this.socketService.playCard(card.id);
  }

  onResolveKutti(): void {
    this.socketService.resolveKutti();
  }

  onProceedFromKutti(): void {
    this.socketService.proceedFromKutti();
  }

  onLeave(): void {
    this.socketService.disconnect();
  }

  get sortedPlayers(): MultiplayerPlayer[] {
    return [...this.players].sort((a, b) => {
      if (a.isFinished && b.isFinished) return a.finishOrder - b.finishOrder;
      if (a.isFinished) return -1;
      if (b.isFinished) return 1;
      return (a.hand?.length ?? a.handCount) - (b.hand?.length ?? b.handCount);
    });
  }

  get winner() { return this.state()?.winner ?? null; }
  get dock() { return this.state()?.dock ?? null; }
}
