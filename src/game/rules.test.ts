import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampDt,
  checkAABB,
  applyJumpCut,
  collectStar,
  collectStoryPage,
  tickCombo,
  applyDamage,
  getVitalityPipStates,
  checkVictory,
  checkDefeat,
  updateTimers,
  type PlayerState,
} from './rules.ts';

test('clampDt clamps large deltas to 50ms', () => {
  assert.equal(clampDt(0.1), 0.05);
  assert.equal(clampDt(0.016), 0.016);
  assert.equal(clampDt(-0.5), 0);
  assert.equal(clampDt(NaN), 0);
});

test('checkAABB correctly determines overlapping rectangles', () => {
  const box1 = { x: 0, y: 0, w: 20, h: 20 };
  const box2 = { x: 10, y: 10, w: 20, h: 20 };
  const box3 = { x: 50, y: 50, w: 20, h: 20 };

  assert.equal(checkAABB(box1, box2), true);
  assert.equal(checkAABB(box1, box3), false);
});

test('applyJumpCut cuts ascending jump velocity', () => {
  assert.equal(applyJumpCut(-400), -180);
  assert.equal(applyJumpCut(200), 200); // falling velocity should not change
});

test('collectStar increments star count, builds combo, and scales points', () => {
  const initial = {
    stars: 0,
    pagesCollected: 0,
    targetPages: 3,
    score: 0,
    combo: 1,
    comboTimer: 0,
  };

  const next = collectStar(initial);
  assert.equal(next.stars, 1);
  assert.equal(next.combo, 2);
  assert.equal(next.score, 100); // 50 * 2
  assert.equal(next.comboTimer, 2.5);
});

test('collectStoryPage rewards pages and points', () => {
  const initial = {
    stars: 2,
    pagesCollected: 1,
    targetPages: 3,
    score: 100,
    combo: 1,
    comboTimer: 0,
  };

  const next = collectStoryPage(initial);
  assert.equal(next.pagesCollected, 2);
  assert.equal(next.score, 350);
});

test('tickCombo decrements combo timer and resets combo to 1 on timeout', () => {
  const metrics = {
    stars: 5,
    pagesCollected: 2,
    targetPages: 3,
    score: 500,
    combo: 4,
    comboTimer: 1.0,
  };

  const ticked = tickCombo(metrics, 0.5);
  assert.equal(ticked.combo, 4);
  assert.equal(ticked.comboTimer, 0.5);

  const expired = tickCombo(ticked, 0.6);
  assert.equal(expired.combo, 1);
  assert.equal(expired.comboTimer, 0);
});

test('applyDamage respects invulnerability and clamps HP', () => {
  const freshPlayer: PlayerState = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    w: 32,
    h: 32,
    isGrounded: true,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    hp: 3,
    maxHp: 3,
    invulnerableTimer: 0,
    facing: 1,
  };

  const damaged = applyDamage(freshPlayer, 1);
  assert.equal(damaged.hit, true);
  assert.equal(damaged.player.hp, 2);
  assert.ok(damaged.player.invulnerableTimer > 0);

  // During invulnerability, subsequent damage is blocked
  const blocked = applyDamage(damaged.player, 1);
  assert.equal(blocked.hit, false);
  assert.equal(blocked.player.hp, 2);
});

test('getVitalityPipStates returns accurate visual sockets', () => {
  assert.deepEqual(getVitalityPipStates(3, 3), ['full', 'full', 'full']);
  assert.deepEqual(getVitalityPipStates(2, 3), ['full', 'full', 'empty']);
  assert.deepEqual(getVitalityPipStates(1.5, 3), ['full', 'cracked', 'empty']);
  assert.deepEqual(getVitalityPipStates(0, 3), ['empty', 'empty', 'empty']);
});

test('checkVictory and checkDefeat conditions', () => {
  assert.equal(checkVictory(3, 3, true), true);
  assert.equal(checkVictory(2, 3, true), false);
  assert.equal(checkVictory(3, 3, false), false);

  assert.equal(checkDefeat(0), true);
  assert.equal(checkDefeat(-1), true);
  assert.equal(checkDefeat(1), false);
});

test('updateTimers handles coyote time and jump buffering', () => {
  const groundedPlayer: PlayerState = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    w: 32,
    h: 32,
    isGrounded: true,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    hp: 3,
    maxHp: 3,
    invulnerableTimer: 0,
    facing: 1,
  };

  const res = updateTimers(groundedPlayer, 0.016, true);
  assert.equal(res.canJump, true);
});
