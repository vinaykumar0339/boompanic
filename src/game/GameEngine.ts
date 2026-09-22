import { message, type GameMessage, type Player } from '@/network/GameProtocol';
import type { GameNetwork } from '@/network/GameNetwork';

export type RoundPhase = 'lobby' | 'countdown' | 'playing' | 'result';
export type GameSnapshot = { phase: RoundPhase; players: Player[]; bombOwnerId: string | null; loserId: string | null; notice: string };

const ROUND_MIN_MS = 20_000;
const ROUND_MAX_MS = 60_000;

export class GameEngine {
  private snapshot: GameSnapshot;
  private listeners = new Set<(snapshot: GameSnapshot) => void>();
  private bombTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimers: ReturnType<typeof setTimeout>[] = [];
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private lastPeerMessage = Date.now();
  private unsubscribe: () => void;
  private stateUnsubscribe: () => void;

  constructor(private network: GameNetwork, readonly localPlayer: Player, private readonly isAuthority: boolean) {
    this.snapshot = { phase: 'lobby', players: [localPlayer], bombOwnerId: null, loserId: null, notice: 'Waiting for a rival…' };
    this.unsubscribe = network.onMessage((incoming) => this.receive(incoming));
    this.stateUnsubscribe = network.onConnectionStateChange((state, detail) => {
      if (state === 'DISCONNECTED' || state === 'FAILED') this.update({ notice: detail ?? 'Connection lost.' });
    });
    this.heartbeat = setInterval(() => this.pulse(), 6_000);
  }
  getSnapshot() { return this.snapshot; }
  subscribe(listener: (snapshot: GameSnapshot) => void) { this.listeners.add(listener); listener(this.snapshot); return () => this.listeners.delete(listener); }
  private update(patch: Partial<GameSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach((listener) => listener(this.snapshot)); }
  private async transmit(type: GameMessage['type'], payload?: Record<string, unknown>) { await this.network.send(message(type, this.localPlayer.id, payload)); }
  async announceJoin() { await this.transmit('PLAYER_JOINED', { name: this.localPlayer.name }); }
  async toggleReady() { const ready = !this.localPlayer.ready; this.localPlayer.ready = ready; this.replacePlayer(this.localPlayer); await this.transmit('PLAYER_READY', { ready }); }
  async start() {
    if (!this.isAuthority || this.snapshot.players.length !== 2 || !this.snapshot.players.every((player) => player.ready)) return;
    await this.beginRound();
  }
  private async beginRound() {
    this.clearTimers();
    const owner = this.snapshot.players[Math.floor(Math.random() * this.snapshot.players.length)]!.id;
    this.update({ phase: 'countdown', bombOwnerId: owner, loserId: null, notice: '3' });
    await this.transmit('GAME_START', { owner });
    [2, 1].forEach((count, index) => this.countdownTimers.push(setTimeout(() => this.update({ notice: String(count) }), (index + 1) * 1_000)));
    this.countdownTimers.push(setTimeout(() => {
      this.update({ phase: 'playing', notice: 'Pass it. Don’t hold BOOM.' });
      const duration = ROUND_MIN_MS + Math.floor(Math.random() * (ROUND_MAX_MS - ROUND_MIN_MS));
      this.bombTimer = setTimeout(() => this.explode(), duration);
    }, 3_000));
  }
  async requestPass() {
    if (this.snapshot.phase !== 'playing' || this.snapshot.bombOwnerId !== this.localPlayer.id) return;
    if (this.isAuthority) await this.pass(this.localPlayer.id); else await this.transmit('BOMB_PASS_REQUEST');
  }
  private async pass(senderId: string) {
    if (this.snapshot.phase !== 'playing' || this.snapshot.bombOwnerId !== senderId) return;
    const owner = this.snapshot.players.find((player) => player.id !== senderId)?.id;
    if (!owner) return;
    this.update({ bombOwnerId: owner, notice: 'The bomb moved.' });
    await this.transmit('BOMB_PASS', { owner });
  }
  private async explode() {
    const loser = this.snapshot.bombOwnerId; if (!loser) return;
    this.clearTimers(); this.update({ phase: 'result', loserId: loser, notice: '💥 BOOM' });
    await this.transmit('BOMB_EXPLODED', { loser });
  }
  async rematch() { if (this.isAuthority) await this.beginRound(); else await this.transmit('REMATCH'); }
  private receive(incoming: GameMessage) {
    if (incoming.senderId === this.localPlayer.id || Math.abs(Date.now() - incoming.timestamp) > 60_000) return;
    this.lastPeerMessage = Date.now();
    switch (incoming.type) {
      case 'PING': void this.transmit('PONG'); return;
      case 'PONG': return;
      case 'PLAYER_JOINED': {
        const name = typeof incoming.payload?.name === 'string' ? incoming.payload.name.slice(0, 18) : 'Rival';
        if (!this.isAuthority) {
          if (this.snapshot.players.length === 1) this.update({ players: [...this.snapshot.players, { id: incoming.senderId, name, ready: false }], notice: 'Rival connected.' });
          return;
        }
        if (this.snapshot.players.length > 1) return;
        this.update({ players: [...this.snapshot.players, { id: incoming.senderId, name, ready: false }], notice: 'Rival connected.' });
        void this.transmit('PLAYER_JOINED', { name: this.localPlayer.name }); return;
      }
      case 'PLAYER_READY': {
        const targetId = typeof incoming.payload?.playerId === 'string' ? incoming.payload.playerId : incoming.senderId;
        if (!this.snapshot.players.some((player) => player.id === targetId)) return;
        if (this.isAuthority && targetId !== incoming.senderId) return;
        const ready = incoming.payload?.ready === true;
        this.replacePlayer({ ...this.snapshot.players.find((p) => p.id === targetId)!, ready });
        if (this.isAuthority) void this.transmit('PLAYER_READY', { playerId: targetId, ready });
        return;
      }
      case 'GAME_START': {
        const owner = incoming.payload?.owner;
        if (this.isAuthority || typeof owner !== 'string' || !this.snapshot.players.some((player) => player.id === owner)) return;
        this.clearTimers(); this.update({ phase: 'countdown', bombOwnerId: owner, loserId: null, notice: '3' });
        [2, 1].forEach((count, index) => this.countdownTimers.push(setTimeout(() => this.update({ notice: String(count) }), (index + 1) * 1_000)));
        this.countdownTimers.push(setTimeout(() => this.update({ phase: 'playing', notice: 'Pass it. Don’t hold BOOM.' }), 3_000)); return;
      }
      case 'BOMB_PASS_REQUEST': if (this.isAuthority) void this.pass(incoming.senderId); return;
      case 'BOMB_PASS': {
        const owner = incoming.payload?.owner;
        if (this.isAuthority || typeof owner !== 'string' || !this.snapshot.players.some((player) => player.id === owner) || this.snapshot.phase !== 'playing') return;
        this.update({ bombOwnerId: owner, notice: 'The bomb moved.' }); return;
      }
      case 'BOMB_EXPLODED': {
        const loser = incoming.payload?.loser;
        if (this.isAuthority || typeof loser !== 'string' || !this.snapshot.players.some((player) => player.id === loser)) return;
        this.clearTimers(); this.update({ phase: 'result', loserId: loser, notice: '💥 BOOM' }); return;
      }
      case 'REMATCH': if (this.isAuthority) void this.beginRound(); return;
      default: return;
    }
  }
  private replacePlayer(next: Player) { this.update({ players: this.snapshot.players.map((player) => player.id === next.id ? next : player) }); }
  private pulse() { if (Date.now() - this.lastPeerMessage > 22_000 && this.snapshot.players.length > 1) this.update({ notice: 'Connection seems quiet. Trying to reconnect…' }); else void this.transmit('PING').catch(() => undefined); }
  private clearTimers() { if (this.bombTimer) clearTimeout(this.bombTimer); this.bombTimer = null; this.countdownTimers.forEach(clearTimeout); this.countdownTimers = []; }
  dispose() { this.clearTimers(); if (this.heartbeat) clearInterval(this.heartbeat); this.unsubscribe(); this.stateUnsubscribe(); }
}
