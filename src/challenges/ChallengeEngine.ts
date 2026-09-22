import { localChallenges } from './data/library';
import type { Challenge, ChallengeRequest, Difficulty } from './ChallengeTypes';

const level: Record<Difficulty, number> = { EASY: 1, MEDIUM: 2, HARD: 3, PANIC: 4 };
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]!;

function generatedMath(difficulty: Difficulty, sequence: number): Challenge {
  const hard = level[difficulty] >= 3;
  const left = hard ? 12 + (sequence * 7) % 38 : 3 + (sequence * 5) % 16;
  const right = hard ? 2 + (sequence * 3) % 9 : 2 + (sequence * 2) % 8;
  const useMultiply = level[difficulty] >= 2 && sequence % 2 === 0;
  const answer = useMultiply ? left * right : left + right;
  return { id: `math-${difficulty}-${left}-${right}-${useMultiply ? 'x' : 'plus'}`, type: 'MATH', category: 'math', difficulty: level[difficulty], prompt: `${left} ${useMultiply ? '×' : '+'} ${right} = ?`, answer: String(answer) };
}

function generatedPattern(difficulty: Difficulty, sequence: number): Challenge {
  const start = 2 + sequence % 4;
  const multiplier = level[difficulty] >= 3 ? 3 : 2;
  const values = [start, start * multiplier, start * multiplier ** 2];
  return { id: `pattern-${start}-${multiplier}`, type: 'PATTERN', category: 'pattern', difficulty: level[difficulty], prompt: `${values.join(', ')}, ?`, answer: String(start * multiplier ** 3) };
}

export class ChallengeEngine {
  static getNextChallenge(request: ChallengeRequest): Challenge {
    const generated = request.sequence % 4 === 0 ? generatedMath(request.difficulty, request.sequence) : request.sequence % 7 === 0 ? generatedPattern(request.difficulty, request.sequence) : null;
    if (generated && !request.previousChallengeIds.includes(generated.id)) return generated;
    const eligible = localChallenges.filter((challenge) => challenge.difficulty <= level[request.difficulty] && !request.previousChallengeIds.includes(challenge.id));
    const pool = eligible.length > 0 ? eligible : localChallenges.filter((challenge) => challenge.id !== request.previousChallengeIds.at(-1));
    const selected = pick(pool);
    return { ...selected, options: selected.options ? [...selected.options] : undefined };
  }
}
