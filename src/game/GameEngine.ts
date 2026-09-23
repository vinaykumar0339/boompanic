import { ChallengeEngine } from '@/challenges/ChallengeEngine';
import { isCorrectAnswer, normalizeAnswer } from '@/challenges/ChallengeValidator';
import type { Challenge, Difficulty } from '@/challenges/ChallengeTypes';
import { message, type GameMessage, type Player } from '@/network/GameProtocol';
import type { GameNetwork } from '@/network/GameNetwork';

export type RoundPhase = 'lobby' | 'countdown' | 'challenge_active' | 'answer_submitted' | 'ready_to_pass' | 'result';
export type PlayerRoundStats = { streak: number; correct: number; incorrect: number; longestStreak: number; fastestAnswerMs: number | null };
export type GameSnapshot = {
  phase: RoundPhase; players: Player[]; bombOwnerId: string | null; loserId: string | null; notice: string;
  challenge: Challenge | null; challengeDurationMs: number; challengeStartedAt: number | null; difficulty: Difficulty; bombStartedAt: number | null;
  playerStats: Record<string, PlayerRoundStats>; rematchPlayerIds: string[]; roundId: string | null; turnId: string | null;
};

const ROUND_MIN_MS = 20_000;
const ROUND_MAX_MS = 60_000;
const WRONG_PENALTY_MS = 1_500;
const challengeTime: Record<Difficulty, number> = { EASY: 8_000, MEDIUM: 6_000, HARD: 5_000, PANIC: 4_000 };
const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const emptyStats = (): PlayerRoundStats => ({ streak: 0, correct: 0, incorrect: 0, longestStreak: 0, fastestAnswerMs: null });

function isChallenge(value: unknown): value is Challenge {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.type === 'string' && typeof candidate.prompt === 'string' && typeof candidate.category === 'string' && typeof candidate.difficulty === 'number';
}

function isPlayerList(value: unknown): value is Player[] {
  return Array.isArray(value) && value.length === 2 && value.every((player) => !!player && typeof player === 'object' && typeof (player as Player).id === 'string' && typeof (player as Player).name === 'string' && typeof (player as Player).ready === 'boolean');
}

/** Host-authoritative round state. The network transport only carries its events. */
export class GameEngine {
  private snapshot: GameSnapshot;
  private listeners = new Set<(snapshot: GameSnapshot) => void>();
  private bombTimer: ReturnType<typeof setTimeout> | null = null;
  private challengeTimer: ReturnType<typeof setTimeout> | null = null;
  private delayedTimers: ReturnType<typeof setTimeout>[] = [];
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private lastPeerMessage = Date.now();
  private unsubscribe: () => void;
  private stateUnsubscribe: () => void;
  private bombDeadline = 0;
  private challengeIds: string[] = [];
  private turns = 0;

  constructor(private network: GameNetwork, readonly localPlayer: Player, private readonly isAuthority: boolean) {
    this.localPlayer.ready = false;
    const initialPlayer = { ...localPlayer, ready: false };
    this.snapshot = { phase: 'lobby', players: [initialPlayer], bombOwnerId: null, loserId: null, notice: 'Waiting for a rival…', challenge: null, challengeDurationMs: 0, challengeStartedAt: null, difficulty: 'EASY', bombStartedAt: null, playerStats: { [initialPlayer.id]: emptyStats() }, rematchPlayerIds: [], roundId: null, turnId: null };
    this.unsubscribe = network.onMessage((incoming) => this.receive(incoming));
    this.stateUnsubscribe = network.onConnectionStateChange((state, detail) => {
      if (state === 'DISCONNECTED' || state === 'FAILED') this.handlePeerDeparture(detail ?? 'Your rival left the game.');
    });
    this.heartbeat = setInterval(() => this.pulse(), 6_000);
  }

  getSnapshot() { return this.snapshot; }
  subscribe(listener: (snapshot: GameSnapshot) => void) { this.listeners.add(listener); listener(this.snapshot); return () => this.listeners.delete(listener); }
  private update(patch: Partial<GameSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach((listener) => listener(this.snapshot)); }
  private async transmit(type: GameMessage['type'], payload?: Record<string, unknown>) {
    try { await this.network.send(message(type, this.localPlayer.id, payload)); return true; }
    catch { this.update({ notice: 'Could not send that update. Check your internet connection.' }); return false; }
  }
  private async broadcastLobby() {
    if (!this.isAuthority) return;
    await this.transmit('LOBBY_STATE', { players: this.snapshot.players.map((player) => ({ id: player.id, name: player.name, ready: player.ready })) });
  }
  async announceJoin() { await this.transmit('PLAYER_JOINED', { name: this.localPlayer.name }); }
  async toggleReady() {
    if (this.snapshot.phase !== 'lobby' || this.snapshot.players.length !== 2) return;
    const ready = !this.localPlayer.ready; const next = { ...this.localPlayer, ready };
    this.localPlayer.ready = ready; this.replacePlayer(next);
    if (this.isAuthority) await this.broadcastLobby();
    else await this.transmit('PLAYER_READY', { playerId: this.localPlayer.id, ready });
  }

  async leave() { try { await this.transmit('PLAYER_DISCONNECTED'); } catch { /* The peer may already be gone. */ } }

  async start() {
    if (!this.isAuthority || this.snapshot.players.length !== 2 || !this.snapshot.players.every((player) => player.ready)) return;
    await this.beginRound();
  }

  private async beginRound() {
    this.clearRoundTimers(); this.challengeIds = []; this.turns = 0;
    const owner = this.snapshot.players[Math.floor(Math.random() * this.snapshot.players.length)]!.id;
    const roundId = newId('round');
    const stats = Object.fromEntries(this.snapshot.players.map((player) => [player.id, emptyStats()])) as Record<string, PlayerRoundStats>;
    this.update({ phase: 'countdown', bombOwnerId: owner, loserId: null, notice: '3', challenge: null, roundId, turnId: null, playerStats: stats, rematchPlayerIds: [], bombStartedAt: null });
    if (!await this.transmit('GAME_START', { owner, roundId })) return;
    [2, 1].forEach((count, index) => this.delayedTimers.push(setTimeout(() => this.update({ notice: String(count) }), (index + 1) * 1_000)));
    this.delayedTimers.push(setTimeout(() => {
      if (this.snapshot.roundId !== roundId || this.snapshot.phase !== 'countdown') return;
      const duration = ROUND_MIN_MS + Math.floor(Math.random() * (ROUND_MAX_MS - ROUND_MIN_MS + 1));
      this.bombDeadline = Date.now() + duration;
      this.update({ bombStartedAt: Date.now(), notice: '💣 BOOMPANIC! Solve it, then pass it.' }); this.scheduleBomb();
      void this.assignChallenge(owner);
    }, 3_000));
  }

  async submitAnswer(answer: string) {
    const { challenge, turnId, roundId } = this.snapshot;
    if (!challenge || !turnId || !roundId || this.snapshot.phase !== 'challenge_active' || this.snapshot.bombOwnerId !== this.localPlayer.id) return;
    const value = answer.slice(0, 64); if (!normalizeAnswer(value)) return;
    if (this.isAuthority) await this.answer(this.localPlayer.id, roundId, turnId, value);
    else await this.transmit('ANSWER_SUBMITTED', { roundId, turnId, answer: value });
  }

  async requestPass() {
    if (this.snapshot.phase !== 'ready_to_pass' || this.snapshot.bombOwnerId !== this.localPlayer.id || !this.snapshot.roundId || !this.snapshot.turnId) return;
    if (this.isAuthority) await this.pass(this.localPlayer.id, this.snapshot.roundId, this.snapshot.turnId);
    else await this.transmit('BOMB_PASS_REQUEST', { roundId: this.snapshot.roundId, turnId: this.snapshot.turnId });
  }

  private currentDifficulty(): Difficulty { return this.turns >= 10 ? 'PANIC' : this.turns >= 6 ? 'HARD' : this.turns >= 3 ? 'MEDIUM' : 'EASY'; }

  private async assignChallenge(owner: string, notice = '💣 Your bomb. Answer fast!') {
    if (!this.isAuthority || this.snapshot.phase === 'result' || this.snapshot.bombOwnerId !== owner || !this.snapshot.roundId) return;
    this.clearChallengeTimer(); this.turns += 1;
    const difficulty = this.currentDifficulty();
    const challenge = ChallengeEngine.getNextChallenge({ playerId: owner, difficulty, previousChallengeIds: this.challengeIds, sequence: this.turns });
    this.challengeIds.push(challenge.id); if (this.challengeIds.length > 18) this.challengeIds.shift();
    const turnId = newId('turn'); const duration = challengeTime[difficulty]; const startedAt = Date.now();
    this.update({ phase: 'challenge_active', challenge, turnId, difficulty, challengeDurationMs: duration, challengeStartedAt: startedAt, notice });
    this.challengeTimer = setTimeout(() => void this.challengeExpired(turnId), duration);
    await this.transmit('CHALLENGE_ASSIGNED', { owner, roundId: this.snapshot.roundId, turnId, challenge, difficulty, duration, startedAt, notice });
  }

  private async answer(senderId: string, roundId: string, turnId: string, answer: string) {
    const { challenge } = this.snapshot;
    if (!this.isAuthority || !challenge || this.snapshot.phase !== 'challenge_active' || this.snapshot.bombOwnerId !== senderId || this.snapshot.roundId !== roundId || this.snapshot.turnId !== turnId) return;
    if (Date.now() >= this.bombDeadline) { await this.explode(); return; }
    this.clearChallengeTimer(); const correct = isCorrectAnswer(challenge, answer); const stats = this.snapshot.playerStats[senderId] ?? emptyStats();
    if (correct) {
      const elapsed = this.snapshot.challengeStartedAt ? Math.max(0, Date.now() - this.snapshot.challengeStartedAt) : null;
      const next = { ...stats, streak: stats.streak + 1, correct: stats.correct + 1, longestStreak: Math.max(stats.longestStreak, stats.streak + 1), fastestAnswerMs: elapsed !== null && (stats.fastestAnswerMs === null || elapsed < stats.fastestAnswerMs) ? elapsed : stats.fastestAnswerMs };
      this.update({ phase: 'ready_to_pass', playerStats: { ...this.snapshot.playerStats, [senderId]: next }, notice: `✅ CORRECT! ${next.streak > 1 ? `${next.streak}× STREAK!` : 'PASS IT NOW!'}` });
      await this.transmit('ANSWER_RESULT', { owner: senderId, roundId, turnId, correct: true, answer: normalizeAnswer(answer), stats: next }); return;
    }
    const next = { ...stats, streak: 0, incorrect: stats.incorrect + 1 };
    this.update({ phase: 'answer_submitted', playerStats: { ...this.snapshot.playerStats, [senderId]: next }, notice: '❌ WRONG! New challenge. -1.5 sec.' });
    if (await this.transmit('ANSWER_RESULT', { owner: senderId, roundId, turnId, correct: false, stats: next })) this.applyPenaltyAndReplace(senderId);
  }

  private async challengeExpired(turnId: string) {
    if (!this.isAuthority || this.snapshot.phase !== 'challenge_active' || this.snapshot.turnId !== turnId || !this.snapshot.bombOwnerId) return;
    const owner = this.snapshot.bombOwnerId; const stats = this.snapshot.playerStats[owner] ?? emptyStats(); const next = { ...stats, streak: 0, incorrect: stats.incorrect + 1 };
    this.update({ phase: 'answer_submitted', playerStats: { ...this.snapshot.playerStats, [owner]: next }, notice: '⌛ Challenge expired! -1.5 sec.' });
    if (await this.transmit('ANSWER_RESULT', { owner, roundId: this.snapshot.roundId!, turnId, correct: false, expired: true, stats: next })) this.applyPenaltyAndReplace(owner);
  }

  private applyPenaltyAndReplace(owner: string) {
    this.bombDeadline -= WRONG_PENALTY_MS; this.scheduleBomb();
    this.delayedTimers.push(setTimeout(() => { if (Date.now() >= this.bombDeadline) { void this.explode(); return; } void this.assignChallenge(owner, '❌ Wrong. Fresh challenge — move!'); }, 450));
  }

  private async pass(senderId: string, roundId: string, turnId: string) {
    if (!this.isAuthority || this.snapshot.phase !== 'ready_to_pass' || this.snapshot.bombOwnerId !== senderId || this.snapshot.roundId !== roundId || this.snapshot.turnId !== turnId) return;
    if (Date.now() >= this.bombDeadline) { await this.explode(); return; }
    const owner = this.snapshot.players.find((player) => player.id !== senderId)?.id; if (!owner) return;
    this.clearChallengeTimer(); this.update({ bombOwnerId: owner, challenge: null, turnId: null, challengeDurationMs: 0, challengeStartedAt: null, notice: '💣 The bomb moved!' });
    await this.transmit('BOMB_PASS', { owner, roundId }); await this.assignChallenge(owner);
  }

  private scheduleBomb() { if (this.bombTimer) clearTimeout(this.bombTimer); this.bombTimer = setTimeout(() => void this.explode(), Math.max(0, this.bombDeadline - Date.now())); }
  private async explode() {
    const loser = this.snapshot.bombOwnerId; if (!loser || this.snapshot.phase === 'result') return;
    this.clearRoundTimers(); this.update({ phase: 'result', loserId: loser, challenge: null, turnId: null, challengeStartedAt: null, challengeDurationMs: 0, notice: '💥 BOOOOOOM!' });
    if (this.isAuthority) await this.transmit('BOMB_EXPLODED', { loser, roundId: this.snapshot.roundId });
  }

  async rematch() { if (this.snapshot.phase !== 'result') return; if (this.isAuthority) await this.registerRematch(this.localPlayer.id); else await this.transmit('REMATCH', { roundId: this.snapshot.roundId }); }
  private async registerRematch(playerId: string) {
    if (!this.isAuthority || this.snapshot.phase !== 'result' || !this.snapshot.players.some((player) => player.id === playerId)) return;
    const rematchPlayerIds = [...new Set([...this.snapshot.rematchPlayerIds, playerId])];
    this.update({ rematchPlayerIds, notice: rematchPlayerIds.length === 2 ? 'Rematch loading…' : 'Rematch requested — waiting for rival.' });
    await this.transmit('REMATCH_STATUS', { players: rematchPlayerIds, roundId: this.snapshot.roundId }); if (rematchPlayerIds.length === 2) await this.beginRound();
  }

  private receive(incoming: GameMessage) {
    if (incoming.senderId === this.localPlayer.id || Math.abs(Date.now() - incoming.timestamp) > 60_000) return; this.lastPeerMessage = Date.now();
    switch (incoming.type) {
      case 'PING': void this.transmit('PONG').catch(() => undefined); return;
      case 'PONG': return;
      case 'PLAYER_JOINED': {
        const name = typeof incoming.payload?.name === 'string' ? incoming.payload.name.slice(0, 18) : 'Rival'; if (this.snapshot.players.length > 1) return;
        const rival = { id: incoming.senderId, name, ready: false }; this.update({ players: [...this.snapshot.players, rival], playerStats: { ...this.snapshot.playerStats, [rival.id]: emptyStats() }, notice: 'Rival connected.' });
        if (this.isAuthority) { void this.transmit('PLAYER_JOINED', { name: this.localPlayer.name }); void this.broadcastLobby(); } return;
      }
      case 'PLAYER_READY': {
        const targetId = typeof incoming.payload?.playerId === 'string' ? incoming.payload.playerId : incoming.senderId;
        if (!this.snapshot.players.some((player) => player.id === targetId) || (this.isAuthority && targetId !== incoming.senderId)) return;
        const ready = incoming.payload?.ready === true; this.replacePlayer({ ...this.snapshot.players.find((player) => player.id === targetId)!, ready }); if (this.isAuthority) void this.broadcastLobby(); return;
      }
      case 'LOBBY_STATE': {
        const players = incoming.payload?.players;
        if (this.isAuthority || this.snapshot.phase !== 'lobby' || !isPlayerList(players) || !players.some((player) => player.id === this.localPlayer.id)) return;
        const local = players.find((player) => player.id === this.localPlayer.id)!;
        this.localPlayer.ready = local.ready;
        const playerStats = Object.fromEntries(players.map((player) => [player.id, this.snapshot.playerStats[player.id] ?? emptyStats()])) as Record<string, PlayerRoundStats>;
        this.update({ phase: 'lobby', players: players.map((player) => ({ ...player, name: player.name.slice(0, 18) })), playerStats, notice: players.every((player) => player.ready) ? 'Both players are ready. Host can start the round.' : 'Waiting for both players to be ready.' });
        return;
      }
      case 'PLAYER_DISCONNECTED': {
        if (!this.snapshot.players.some((player) => player.id === incoming.senderId)) return;
        this.handlePeerDeparture('Your rival left the game.');
        return;
      }
      case 'GAME_START': {
        const owner = incoming.payload?.owner; const roundId = incoming.payload?.roundId;
        if (this.isAuthority || typeof owner !== 'string' || typeof roundId !== 'string' || !this.snapshot.players.some((player) => player.id === owner)) return;
        this.clearRoundTimers(); this.update({ phase: 'countdown', bombOwnerId: owner, loserId: null, notice: '3', challenge: null, roundId, turnId: null, rematchPlayerIds: [], bombStartedAt: null });
        [2, 1].forEach((count, index) => this.delayedTimers.push(setTimeout(() => this.update({ notice: String(count) }), (index + 1) * 1_000))); return;
      }
      case 'CHALLENGE_ASSIGNED': {
        const { owner, roundId, turnId, challenge, difficulty, duration, startedAt, notice } = incoming.payload ?? {};
        if (this.isAuthority || typeof owner !== 'string' || typeof roundId !== 'string' || typeof turnId !== 'string' || !isChallenge(challenge) || !['EASY', 'MEDIUM', 'HARD', 'PANIC'].includes(String(difficulty)) || typeof duration !== 'number' || typeof startedAt !== 'number' || this.snapshot.roundId !== roundId) return;
        this.update({ phase: 'challenge_active', bombOwnerId: owner, challenge, turnId, difficulty: difficulty as Difficulty, challengeDurationMs: duration, challengeStartedAt: startedAt, bombStartedAt: this.snapshot.bombStartedAt ?? startedAt, notice: typeof notice === 'string' ? notice : 'Solve it, then pass it.' }); return;
      }
      case 'ANSWER_SUBMITTED': {
        const { roundId, turnId, answer } = incoming.payload ?? {}; if (this.isAuthority && typeof roundId === 'string' && typeof turnId === 'string' && typeof answer === 'string') void this.answer(incoming.senderId, roundId, turnId, answer); return;
      }
      case 'ANSWER_RESULT': {
        const { owner, roundId, turnId, correct, stats } = incoming.payload ?? {};
        if (this.isAuthority || typeof owner !== 'string' || typeof roundId !== 'string' || typeof turnId !== 'string' || typeof correct !== 'boolean' || this.snapshot.roundId !== roundId || this.snapshot.turnId !== turnId) return;
        const playerStats = stats && typeof stats === 'object' ? { ...this.snapshot.playerStats, [owner]: stats as PlayerRoundStats } : this.snapshot.playerStats;
        this.update({ phase: correct ? 'ready_to_pass' : 'answer_submitted', playerStats, notice: correct ? '✅ CORRECT! PASS IT NOW!' : '❌ WRONG! Fresh challenge incoming.' }); return;
      }
      case 'BOMB_PASS_REQUEST': {
        const { roundId, turnId } = incoming.payload ?? {}; if (this.isAuthority && typeof roundId === 'string' && typeof turnId === 'string') void this.pass(incoming.senderId, roundId, turnId); return;
      }
      case 'BOMB_PASS': {
        const { owner, roundId } = incoming.payload ?? {};
        if (this.isAuthority || typeof owner !== 'string' || typeof roundId !== 'string' || this.snapshot.roundId !== roundId || !this.snapshot.players.some((player) => player.id === owner)) return;
        this.update({ bombOwnerId: owner, challenge: null, turnId: null, challengeDurationMs: 0, challengeStartedAt: null, notice: '💣 The bomb moved!' }); return;
      }
      case 'BOMB_EXPLODED': {
        const { loser, roundId } = incoming.payload ?? {};
        if (this.isAuthority || typeof loser !== 'string' || typeof roundId !== 'string' || this.snapshot.roundId !== roundId || !this.snapshot.players.some((player) => player.id === loser)) return;
        this.clearRoundTimers(); this.update({ phase: 'result', loserId: loser, challenge: null, turnId: null, challengeStartedAt: null, challengeDurationMs: 0, notice: '💥 BOOOOOOM!' }); return;
      }
      case 'REMATCH': {
        const roundId = incoming.payload?.roundId;
        if (this.isAuthority && typeof roundId === 'string' && roundId === this.snapshot.roundId) void this.registerRematch(incoming.senderId);
        return;
      }
      case 'REMATCH_STATUS': {
        const players = incoming.payload?.players; const roundId = incoming.payload?.roundId;
        if (!this.isAuthority && roundId === this.snapshot.roundId && Array.isArray(players) && players.every((id) => typeof id === 'string')) this.update({ rematchPlayerIds: players, notice: players.length === 2 ? 'Rematch loading…' : 'Rival wants a rematch.' }); return;
      }
      default: return;
    }
  }

  private replacePlayer(next: Player) { this.update({ players: this.snapshot.players.map((player) => player.id === next.id ? next : player) }); }
  private handlePeerDeparture(notice: string) {
    this.clearRoundTimers(); this.localPlayer.ready = false;
    this.update({ phase: 'lobby', players: [{ ...this.localPlayer, ready: false }], bombOwnerId: null, challenge: null, challengeDurationMs: 0, challengeStartedAt: null, roundId: null, turnId: null, notice });
  }
  private pulse() {
    if (this.snapshot.players.length < 2) return;
    if (Date.now() - this.lastPeerMessage > 22_000) this.update({ notice: 'Connection seems quiet. Trying to reconnect…' });
    else void this.transmit('PING').catch(() => undefined);
  }
  private clearChallengeTimer() { if (this.challengeTimer) clearTimeout(this.challengeTimer); this.challengeTimer = null; }
  private clearRoundTimers() { if (this.bombTimer) clearTimeout(this.bombTimer); this.bombTimer = null; this.clearChallengeTimer(); this.delayedTimers.forEach(clearTimeout); this.delayedTimers = []; }
  dispose() { this.clearRoundTimers(); if (this.heartbeat) clearInterval(this.heartbeat); this.unsubscribe(); this.stateUnsubscribe(); }
}
