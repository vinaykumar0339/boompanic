import type { Challenge } from '../ChallengeTypes';

export const localChallenges: Challenge[] = [
  { id: 'fruit', type: 'QUICK_ANSWER', category: 'quick answer', difficulty: 1, prompt: 'Name a fruit.', acceptedAnswers: ['apple', 'banana', 'mango', 'orange', 'grape', 'pear', 'peach', 'plum', 'melon', 'kiwi'] },
  { id: 'animal', type: 'QUICK_ANSWER', category: 'quick answer', difficulty: 1, prompt: 'Name an animal.', acceptedAnswers: ['cat', 'dog', 'lion', 'tiger', 'zebra', 'horse', 'rabbit', 'panda', 'monkey', 'elephant'] },
  { id: 'kitchen', type: 'CATEGORY', category: 'category', difficulty: 1, prompt: 'Name something found in a kitchen.', acceptedAnswers: ['spoon', 'fork', 'plate', 'knife', 'pan', 'pot', 'fridge', 'oven', 'cup', 'glass'] },
  { id: 'beach', type: 'CATEGORY', category: 'category', difficulty: 1, prompt: 'Name something found at the beach.', acceptedAnswers: ['sand', 'water', 'sea', 'ocean', 'shell', 'umbrella', 'towel', 'wave', 'sun'] },
  { id: 'letter-b', type: 'LETTER', category: 'letters', difficulty: 1, prompt: 'Name a fruit starting with “B”.', acceptedAnswers: ['banana', 'blackberry', 'blueberry'] },
  { id: 'letter-c', type: 'LETTER', category: 'letters', difficulty: 1, prompt: 'Name an animal starting with “C”.', acceptedAnswers: ['cat', 'camel', 'cow', 'cheetah', 'crocodile', 'crab'] },
  { id: 'true-earth', type: 'TRUE_FALSE', category: 'true or false', difficulty: 1, prompt: 'The Earth is larger than the Moon.', answer: 'true', options: ['TRUE', 'FALSE'] },
  { id: 'true-octopus', type: 'TRUE_FALSE', category: 'true or false', difficulty: 2, prompt: 'An octopus has three hearts.', answer: 'true', options: ['TRUE', 'FALSE'] },
  { id: 'visual-fruit', type: 'VISUAL', category: 'visual', difficulty: 2, prompt: 'Which emoji is different?', answer: '3', options: ['🍎', '🍎', '🍊', '🍎', '🍎'], metadata: { answerIndex: 2 } },
  { id: 'odd-pets', type: 'ODD_ONE_OUT', category: 'odd one out', difficulty: 2, prompt: 'Tap the different one.', answer: '3', options: ['🐶', '🐶', '🐱', '🐶', '🐶'], metadata: { answerIndex: 2 } },
  { id: 'reaction-red', type: 'REACTION', category: 'reaction', difficulty: 2, prompt: 'Tap the RED button.', answer: 'red', options: ['blue', 'red', 'yellow', 'green'] },
  { id: 'memory-third', type: 'MEMORY', category: 'memory', difficulty: 3, prompt: 'What was the third item?', answer: 'dog', metadata: { memoryItems: ['🍎', '🚗', '🐶', '🎸'], revealMs: 1600 } },
  { id: 'scramble-banana', type: 'WORD_SCRAMBLE', category: 'word scramble', difficulty: 2, prompt: 'Unscramble: ANANAB', answer: 'banana' },
  { id: 'scramble-planet', type: 'WORD_SCRAMBLE', category: 'word scramble', difficulty: 3, prompt: 'Unscramble: TLANEP', answer: 'planet' },
  { id: 'speed-five', type: 'SPEED_TAP', category: 'speed tap', difficulty: 2, prompt: 'Tap the button 5 times!', answer: '5', metadata: { targetTaps: 5 } },
];
