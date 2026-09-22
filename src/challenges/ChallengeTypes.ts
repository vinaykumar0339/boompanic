export const CHALLENGE_TYPES = [
  'QUICK_ANSWER', 'LETTER', 'CATEGORY', 'MATH', 'PATTERN', 'VISUAL', 'REACTION',
  'MEMORY', 'TRUE_FALSE', 'SPEED_TAP', 'ODD_ONE_OUT', 'WORD_SCRAMBLE',
] as const;

export type ChallengeType = (typeof CHALLENGE_TYPES)[number];
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'PANIC';
export type Challenge = {
  id: string;
  type: ChallengeType;
  category: string;
  difficulty: number;
  prompt: string;
  answer?: string;
  acceptedAnswers?: string[];
  options?: string[];
  metadata?: Record<string, string | number | boolean | string[]>;
};

export type ChallengeRequest = {
  playerId: string;
  difficulty: Difficulty;
  previousChallengeIds: string[];
  sequence: number;
};
