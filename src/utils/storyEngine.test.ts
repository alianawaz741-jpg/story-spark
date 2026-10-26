import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenizeStoryText,
  findActiveWordIndex,
  estimateReadingTimeSeconds,
  generateSceneVisuals,
} from './storyEngine.ts';

test('tokenizeStoryText breaks sentence into words with accurate character offsets', () => {
  const text = 'Once upon a time in space!';
  const tokens = tokenizeStoryText(text);

  assert.equal(tokens.length, 6);
  assert.equal(tokens[0].word, 'Once');
  assert.equal(tokens[0].charStart, 0);
  assert.equal(tokens[0].charEnd, 4);

  assert.equal(tokens[5].word, 'space!');
  assert.equal(tokens[5].cleanWord, 'space');
  assert.equal(tokens[5].charStart, 20);
  assert.equal(tokens[5].charEnd, 26);
});

test('tokenizeStoryText handles empty strings safely', () => {
  assert.deepEqual(tokenizeStoryText(''), []);
});

test('findActiveWordIndex correctly locates token for given speech character index', () => {
  const text = 'Leo the little lion';
  const tokens = tokenizeStoryText(text);

  // 'Leo' is [0, 3]
  assert.equal(findActiveWordIndex(tokens, 0), 0);
  assert.equal(findActiveWordIndex(tokens, 2), 0);

  // 'the' is [4, 7]
  assert.equal(findActiveWordIndex(tokens, 4), 1);
  assert.equal(findActiveWordIndex(tokens, 6), 1);

  // 'little' is [8, 14]
  assert.equal(findActiveWordIndex(tokens, 10), 2);

  // Past the end should return last index
  assert.equal(findActiveWordIndex(tokens, 99), 3);
});

test('estimateReadingTimeSeconds calculates expected duration', () => {
  // 100 words at 100 wpm = 60s
  assert.equal(estimateReadingTimeSeconds(100, '6-8'), 60);
  // 70 words at 70 wpm for toddlers = 60s
  assert.equal(estimateReadingTimeSeconds(70, '3-5'), 60);
});

test('generateSceneVisuals categorizes theme based on text keywords', () => {
  const cosmic = generateSceneVisuals('Astronaut puppy in nebula', 'looking at starry galaxy');
  assert.equal(cosmic.themeStyle, 'cosmic');
  assert.equal(cosmic.starsOrParticles, true);

  const forest = generateSceneVisuals('Enchanted deep forest', 'a friendly dragon appeared behind the tree');
  assert.equal(forest.themeStyle, 'magical');

  const night = generateSceneVisuals('Bedtime story', 'tucked in bed looking at the moon');
  assert.equal(night.themeStyle, 'night');

  const daytime = generateSceneVisuals('Picnic on a sunny meadow', 'eating apples and playing tag');
  assert.equal(daytime.themeStyle, 'day');
});
