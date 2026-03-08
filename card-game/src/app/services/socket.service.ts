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
  private _connectPromise: Promise<void> | null = null;

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

  /** Connect and return a promise that resolves when actually connected */
  connect(serverUrl: string = 'http://localhost:3000'): Promise<void> {
    // Already connected
    if (this.socket?.connected) {
      return Promise.resolve();
    }

    // Connection in progress — return existing promise
    if (this._connectPromise && this.socket) {
      return this._connectPromise;
    }

    this._connectPromise = new Promise<void>((resolve, reject) => {
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        this._connected.set(true);
        this._error.set('');
        console.log('Connected to server:', this.socket?.id);
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        console.error('Connection error:', err.message);
        this._error.set('Cannot connect to server. Make sure the server is running.');
        this._connected.set(false);
        reject(err);
      });

      this.socket.on('disconnect', () => {
        this._connected.set(false);
        this._connectPromise = null;
        console.log('Disconnected from server');
      });

      this.socket.on('roomCreated', ({ code }: { code: string }) => {
        this._roomCode.set(code);
        this._screen.set('lobby');
        this._error.set('');
        console.log('Room created:', code);
      });

      this.socket.on('roomJoined', ({ code }: { code: string }) => {
        this._roomCode.set(code);
        this._screen.set('lobby');
        this._error.set('');
        console.log('Room joined:', code);
      });

      this.socket.on('gameState', (state: MultiplayerState) => {
        this._state.set(state);
        // If game started (not waiting), show game screen
        if (state.phase !== 'waiting') {
          this._screen.set('game');
        }
      });

      this.socket.on('joinError', ({ message }: { message: string }) => {
        this._error.set(message);
        console.error('Server error:', message);
        setTimeout(() => this._error.set(''), 5000);
      });

      // Timeout fallback
      setTimeout(() => {
        if (!this.socket?.connected) {
          this._error.set('Connection timed out. Is the server running?');
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });

    return this._connectPromise;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this._connectPromise = null;
    this._state.set(null);
    this._roomCode.set('');
    this._connected.set(false);
    this._screen.set('menu');
    this._error.set('');
  }

  setScreen(screen: 'menu' | 'create' | 'join' | 'lobby' | 'game'): void {
    this._screen.set(screen);
  }

  async createRoom(playerName: string, maxPlayers: number): Promise<void> {
    try {
      await this.connect();
      this.socket?.emit('createRoom', { playerName, maxPlayers });
    } catch {
      this._error.set('Failed to connect to server.');
    }
  }

  async joinRoom(roomCode: string, playerName: string): Promise<void> {
    try {
      await this.connect();
      this.socket?.emit('joinRoom', { roomCode, playerName });
    } catch {
      this._error.set('Failed to connect to server.');
    }
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
