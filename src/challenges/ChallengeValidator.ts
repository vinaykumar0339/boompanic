import type { Challenge } from './ChallengeTypes';

export function normalizeAnswer(value: string) {
  return value.toLocaleLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function isCorrectAnswer(challenge: Challenge, answer: string) {
  const submitted = normalizeAnswer(answer);
  if (!submitted) return false;
  const expected = [challenge.answer, ...(challenge.acceptedAnswers ?? [])].filter((value): value is string => typeof value === 'string');
  return expected.some((value) => normalizeAnswer(value) === submitted);
}
