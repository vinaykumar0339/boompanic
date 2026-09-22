export const GAME_MESSAGE_TYPES = [
  'PLAYER_JOINED', 'PLAYER_READY', 'GAME_START', 'CHALLENGE_ASSIGNED',
  'ANSWER_SUBMITTED', 'ANSWER_RESULT', 'BOMB_PASS_REQUEST', 'BOMB_PASS',
  'BOMB_EXPLODED', 'REMATCH', 'REMATCH_STATUS', 'PING', 'PONG', 'PLAYER_DISCONNECTED',
] as const;

export type GameMessageType = (typeof GAME_MESSAGE_TYPES)[number];
export type GameMessage = {
  type: GameMessageType;
  senderId: string;
  timestamp: number;
  payload?: Record<string, unknown>;
};

export type Player = { id: string; name: string; ready: boolean };

export function isGameMessage(value: unknown): value is GameMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return typeof message.senderId === 'string' && message.senderId.length > 0 &&
    typeof message.timestamp === 'number' && Number.isFinite(message.timestamp) &&
    typeof message.type === 'string' && (GAME_MESSAGE_TYPES as readonly string[]).includes(message.type) &&
    (message.payload === undefined || (typeof message.payload === 'object' && message.payload !== null && !Array.isArray(message.payload)));
}

export function decodeGameMessage(raw: string): GameMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isGameMessage(value) ? value : null;
  } catch {
    return null;
  }
}

export function message(type: GameMessageType, senderId: string, payload?: Record<string, unknown>): GameMessage {
  return { type, senderId, timestamp: Date.now(), payload };
}
