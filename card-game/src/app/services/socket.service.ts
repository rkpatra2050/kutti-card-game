import { Injectable, signal, computed } from '@angular/core';
import { io, Socket } from 'socket.io-client';

export interface MultiplayerPlayer {
  id: number;
  name: string;
  hand: any[];
  handCount: number;
  collectedCards: any[];
  isFinished: boolean;
  finishOrder: number;
  isMe: boolean;
}

export interface MultiplayerState {
  code: string;
  phase: string;
  players: MultiplayerPlayer[];
  myPlayerId: number;
  currentPlayerIndex: number;
  currentTrick: any[];
  trickNumber: number;
  kuttiRoundCards: Record<number, any>;
  kuttiTransfers: any[];
  kuttiRoundNumber: number;
  kuttiTotalRounds: number;
  drawDeckSize: number;
  winner: { id: number; name: string } | null;
  dock: { id: number; name: string } | null;
  maxPlayers: number;
  hostSocketId: string;
  isHost: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket | null = null;

  private _state = signal<MultiplayerState | null>(null);
  private _roomCode = signal<string>('');
  private _error = signal<string>('');
  private _connected = signal(false);
  private _screen = signal<'menu' | 'create' | 'join' | 'lobby' | 'game'>('menu');

  readonly state = this._state.asReadonly();
  readonly roomCode = this._roomCode.asReadonly();
  readonly error = this._error.asReadonly();
  readonly connected = this._connected.asReadonly();
  readonly screen = this._screen.asReadonly();

  readonly isHost = computed(() => this._state()?.isHost ?? false);
  readonly players = computed(() => this._state()?.players ?? []);
  readonly myPlayer = computed(() => this._state()?.players.find(p => p.isMe) ?? null);
  readonly phase = computed(() => this._state()?.phase ?? 'waiting');

  connect(serverUrl: string = 'http://localhost:3000'): void {
    if (this.socket?.connected) return;

    this.socket = io(serverUrl, { transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => {
      this._connected.set(true);
      this._error.set('');
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      this._connected.set(false);
      console.log('Disconnected from server');
    });

    this.socket.on('roomCreated', ({ code }: { code: string }) => {
      this._roomCode.set(code);
      this._screen.set('lobby');
      this._error.set('');
    });

    this.socket.on('roomJoined', ({ code }: { code: string }) => {
      this._roomCode.set(code);
      this._screen.set('lobby');
      this._error.set('');
    });

    this.socket.on('gameState', (state: MultiplayerState) => {
      this._state.set(state);
      // If game started (not waiting), show game screen
      if (state.phase !== 'waiting') {
        this._screen.set('game');
      }
    });

    this.socket.on('error', ({ message }: { message: string }) => {
      this._error.set(message);
      setTimeout(() => this._error.set(''), 5000);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this._state.set(null);
    this._roomCode.set('');
    this._connected.set(false);
    this._screen.set('menu');
    this._error.set('');
  }

  setScreen(screen: 'menu' | 'create' | 'join' | 'lobby' | 'game'): void {
    this._screen.set(screen);
  }

  createRoom(playerName: string, maxPlayers: number): void {
    this.socket?.emit('createRoom', { playerName, maxPlayers });
  }

  joinRoom(roomCode: string, playerName: string): void {
    this.socket?.emit('joinRoom', { roomCode, playerName });
  }

  startGame(): void {
    this.socket?.emit('startGame');
  }

  resolveKutti(): void {
    this.socket?.emit('resolveKutti');
  }

  proceedFromKutti(): void {
    this.socket?.emit('proceedFromKutti');
  }

  playCard(cardId: string): void {
    this.socket?.emit('playCard', { cardId });
  }
}
