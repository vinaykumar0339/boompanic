import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { GameEngine, type GameSnapshot } from './GameEngine';
import type { Player } from '@/network/GameProtocol';
import type { ConnectionState, GameNetwork } from '@/network/GameNetwork';
import { LocalNetwork } from '@/network/local/LocalNetwork';
import { OnlineNetwork } from '@/network/online/OnlineNetwork';

export type GameMode = 'local' | 'online';
export type GameRole = 'host' | 'client';

type GameSession = {
  mode: GameMode | null;
  role: GameRole | null;
  localPlayerId: string;
  displayName: string;
  connection: ConnectionState;
  connectionDetail: string;
  localAddress: string;
  invitation: string;
  snapshot: GameSnapshot | null;
  setDisplayName(name: string): Promise<void>;
  createLocalHost(): Promise<void>;
  joinLocal(address: string): Promise<void>;
  createOnlineHost(): Promise<void>;
  createOnlineAnswer(offer: string): Promise<void>;
  acceptOnlineAnswer(answer: string): Promise<void>;
  ready(): Promise<void>;
  start(): Promise<void>;
  answer(value: string): Promise<void>;
  pass(): Promise<void>;
  rematch(): Promise<void>;
  cancel(): void;
};

const GameSessionContext = createContext<GameSession | null>(null);
const playerId = () => `player_${Math.random().toString(36).slice(2, 8)}`;

export function GameSessionProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [role, setRole] = useState<GameRole | null>(null);
  const [displayName, setDisplayNameState] = useState('Player');
  const [connection, setConnection] = useState<ConnectionState>('IDLE');
  const [connectionDetail, setConnectionDetail] = useState('');
  const [localAddress, setLocalAddress] = useState('');
  const [invitation, setInvitation] = useState('');
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const player = useRef<Player>({ id: playerId(), name: 'Player', ready: false });
  const network = useRef<GameNetwork | null>(null);
  const engine = useRef<GameEngine | null>(null);
  const announced = useRef(false);
  const unsubscribeNetwork = useRef<(() => void) | null>(null);
  const recordedResult = useRef<string | null>(null);

  useEffect(() => { void AsyncStorage.getItem('boompanic.name').then((saved) => { if (saved) { player.current.name = saved; setDisplayNameState(saved); } }); }, []);
  useEffect(() => () => { engine.current?.dispose(); unsubscribeNetwork.current?.(); void network.current?.disconnect(); }, []);
  useEffect(() => {
    if (!snapshot?.loserId) { recordedResult.current = null; return; }
    if (recordedResult.current === snapshot.loserId) return;
    recordedResult.current = snapshot.loserId;
    void AsyncStorage.getItem('boompanic.stats').then((raw) => {
      const defaults = { games: 0, wins: 0, losses: 0, bombsSurvived: 0, bombsExploded: 0, correctAnswers: 0, incorrectAnswers: 0, longestStreak: 0, fastestAnswerMs: null as number | null };
      const saved = raw ? JSON.parse(raw) as Partial<typeof defaults> : {};
      const stats = { ...defaults, ...saved };
      const round = snapshot.playerStats[player.current.id];
      stats.games += 1;
      if (snapshot.loserId === player.current.id) { stats.losses += 1; stats.bombsExploded += 1; } else { stats.wins += 1; stats.bombsSurvived += 1; }
      if (round) {
        stats.correctAnswers += round.correct; stats.incorrectAnswers += round.incorrect; stats.longestStreak = Math.max(stats.longestStreak, round.longestStreak);
        if (round.fastestAnswerMs !== null && (stats.fastestAnswerMs === null || round.fastestAnswerMs < stats.fastestAnswerMs)) stats.fastestAnswerMs = round.fastestAnswerMs;
      }
      return AsyncStorage.setItem('boompanic.stats', JSON.stringify(stats));
    }).catch(() => undefined);
  }, [snapshot?.loserId]);

  const setDisplayName = useCallback(async (name: string) => {
    const next = name.trim().slice(0, 18) || 'Player';
    player.current.name = next; setDisplayNameState(next); await AsyncStorage.setItem('boompanic.name', next);
  }, []);
  const makeEngine = useCallback((authority: boolean) => {
    if (!network.current || engine.current) return;
    const next = new GameEngine(network.current, player.current, authority);
    engine.current = next; next.subscribe(setSnapshot);
  }, []);
  const cancel = useCallback(() => {
    engine.current?.dispose(); engine.current = null;
    unsubscribeNetwork.current?.(); unsubscribeNetwork.current = null;
    void network.current?.disconnect(); network.current = null; announced.current = false;
    setMode(null); setRole(null); setConnection('IDLE'); setConnectionDetail(''); setLocalAddress(''); setInvitation(''); setSnapshot(null);
  }, []);
  const attachNetwork = useCallback((next: GameNetwork, authority: boolean) => {
    unsubscribeNetwork.current?.();
    unsubscribeNetwork.current = next.onConnectionStateChange((state, detail) => {
      setConnection(state); setConnectionDetail(detail ?? '');
      if (state === 'CONNECTED') {
        makeEngine(authority);
        if (!authority && !announced.current) { announced.current = true; void engine.current?.announceJoin().catch(() => undefined); }
      }
    });
  }, [makeEngine]);
  const fail = useCallback((error: unknown, fallback: string) => { setConnection('FAILED'); setConnectionDetail(error instanceof Error ? error.message : fallback); }, []);
  const createLocalHost = useCallback(async () => {
    cancel(); setMode('local'); setRole('host'); setConnection('CREATING');
    try {
      const port = 45454 + Math.floor(Math.random() * 1_000);
      const next = new LocalNetwork('host', { host: '0.0.0.0', port }); network.current = next; attachNetwork(next, true); makeEngine(true);
      await next.connect(); const ip = await Network.getIpAddressAsync();
      if (ip === '0.0.0.0') throw new Error('Could not find this phone’s Wi-Fi address.');
      setLocalAddress(`${ip}:${port}`); setInvitation(`boompanic://local/${ip}:${port}`);
    } catch (error) { fail(error, 'Could not create a local game.'); }
  }, [attachNetwork, cancel, fail, makeEngine]);
  const joinLocal = useCallback(async (address: string) => {
    const normalized = address.trim().replace('boompanic://local/', ''); const match = normalized.match(/^([^:\s]+):(\d{1,5})$/);
    if (!match || Number(match[2]) > 65535) { fail(new Error('Enter an address like 192.168.1.12:45454.'), 'Invalid address.'); return; }
    cancel(); setMode('local'); setRole('client'); setConnection('CONNECTING');
    try { const next = new LocalNetwork('client', { host: match[1]!, port: Number(match[2]) }); network.current = next; attachNetwork(next, false); await next.connect(); }
    catch (error) { fail(error, 'Could not connect.'); }
  }, [attachNetwork, cancel, fail]);
  const createOnlineHost = useCallback(async () => {
    cancel(); setMode('online'); setRole('host'); setConnection('CREATING');
    try { const next = new OnlineNetwork(); network.current = next; attachNetwork(next, true); makeEngine(true); await next.connect(); setInvitation(await next.createOffer()); }
    catch (error) { fail(error, 'Could not create invitation.'); }
  }, [attachNetwork, cancel, fail, makeEngine]);
  const createOnlineAnswer = useCallback(async (offer: string) => {
    cancel(); setMode('online'); setRole('client'); setConnection('CONNECTING');
    try { const next = new OnlineNetwork(); network.current = next; attachNetwork(next, false); await next.connect(); setInvitation(await next.acceptOffer(offer)); }
    catch (error) { fail(error, 'Could not read invitation.'); }
  }, [attachNetwork, cancel, fail]);
  const acceptOnlineAnswer = useCallback(async (answer: string) => {
    if (!(network.current instanceof OnlineNetwork)) return;
    try { await network.current.acceptAnswer(answer); } catch (error) { fail(error, 'Could not use response.'); }
  }, [fail]);
  return <GameSessionContext.Provider value={{ mode, role, localPlayerId: player.current.id, displayName, connection, connectionDetail, localAddress, invitation, snapshot, setDisplayName, createLocalHost, joinLocal, createOnlineHost, createOnlineAnswer, acceptOnlineAnswer, ready: async () => engine.current?.toggleReady(), start: async () => engine.current?.start(), answer: async (value) => engine.current?.submitAnswer(value), pass: async () => engine.current?.requestPass(), rematch: async () => engine.current?.rematch(), cancel }}>{children}</GameSessionContext.Provider>;
}

export function useGameSession() { const context = useContext(GameSessionContext); if (!context) throw new Error('useGameSession must be inside GameSessionProvider.'); return context; }
