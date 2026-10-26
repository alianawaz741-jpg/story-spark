export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  isGrounded: boolean;
  coyoteTimer: number; // seconds remaining to legal jump after leaving ledge
  jumpBufferTimer: number; // seconds remaining for buffered jump input
  hp: number;
  maxHp: number;
  invulnerableTimer: number;
  facing: 1 | -1;
}

export interface GameMetrics {
  stars: number;
  pagesCollected: number;
  targetPages: number;
  score: number;
  combo: number;
  comboTimer: number;
}

export const GAME_CONSTANTS = {
  GRAVITY: 980, // px/s^2
  JUMP_VELOCITY: -460, // px/s
  MOVE_SPEED: 260, // px/s
  COYOTE_TIME: 0.10, // seconds
  JUMP_BUFFER: 0.12, // seconds
  MAX_HP: 3,
  INVULNERABLE_TIME: 1.2, // seconds
  COMBO_TIMEOUT: 2.5, // seconds
  MAX_DT: 0.05, // 50ms clamp
};

/**
 * Clamps simulation delta time to prevent tunneling and physics instability.
 */
export function clampDt(rawDt: number): number {
  if (isNaN(rawDt) || rawDt <= 0) return 0;
  return Math.min(rawDt, GAME_CONSTANTS.MAX_DT);
}

/**
 * Checks axis-aligned bounding box intersection.
 */
export function checkAABB(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * Updates coyote and jump buffer timers.
 */
export function updateTimers(
  player: PlayerState,
  dt: number,
  jumpJustPressed: boolean
): { canJump: boolean; consumeBuffer: boolean } {
  let coyoteTimer = player.isGrounded ? GAME_CONSTANTS.COYOTE_TIME : Math.max(0, player.coyoteTimer - dt);
  let jumpBufferTimer = jumpJustPressed
    ? GAME_CONSTANTS.JUMP_BUFFER
    : Math.max(0, player.jumpBufferTimer - dt);

  const canJump = (player.isGrounded || coyoteTimer > 0) && jumpBufferTimer > 0;

  return {
    canJump,
    consumeBuffer: canJump,
  };
}

/**
 * Applies variable jump cut when the jump button is released early.
 */
export function applyJumpCut(vy: number): number {
  if (vy < 0) {
    return vy * 0.45;
  }
  return vy;
}

/**
 * Calculates score earned for star gem pickups with combo multiplier.
 */
export function collectStar(current: GameMetrics): GameMetrics {
  const newCombo = current.combo + 1;
  const points = 50 * newCombo;
  return {
    ...current,
    stars: current.stars + 1,
    combo: newCombo,
    comboTimer: GAME_CONSTANTS.COMBO_TIMEOUT,
    score: current.score + points,
  };
}

/**
 * Collects a lost storybook page.
 */
export function collectStoryPage(current: GameMetrics): GameMetrics {
  const points = 250;
  return {
    ...current,
    pagesCollected: current.pagesCollected + 1,
    score: current.score + points,
  };
}

/**
 * Ticks combo timer down.
 */
export function tickCombo(current: GameMetrics, dt: number): GameMetrics {
  if (current.comboTimer <= 0) {
    return current.combo > 1 ? { ...current, combo: 1, comboTimer: 0 } : current;
  }
  const nextTimer = Math.max(0, current.comboTimer - dt);
  return {
    ...current,
    comboTimer: nextTimer,
    combo: nextTimer <= 0 ? 1 : current.combo,
  };
}

/**
 * Applies damage to player, respecting invulnerability frame.
 */
export function applyDamage(
  player: PlayerState,
  damage: number = 1
): { player: PlayerState; hit: boolean } {
  if (player.invulnerableTimer > 0) {
    return { player, hit: false };
  }
  const newHp = Math.max(0, player.hp - damage);
  return {
    player: {
      ...player,
      hp: newHp,
      invulnerableTimer: GAME_CONSTANTS.INVULNERABLE_TIME,
    },
    hit: true,
  };
}

/**
 * Returns vitality pip socket state for HUD rendering.
 */
export type PipState = 'full' | 'cracked' | 'empty';

export function getVitalityPipStates(hp: number, maxHp: number = 3): PipState[] {
  const pips: PipState[] = [];
  for (let i = 1; i <= maxHp; i++) {
    if (hp >= i) {
      pips.push('full');
    } else if (hp === i - 0.5) {
      pips.push('cracked');
    } else {
      pips.push('empty');
    }
  }
  return pips;
}

/**
 * Checks victory condition: all required lost pages collected and reached portal.
 */
export function checkVictory(pagesCollected: number, targetPages: number, reachedPortal: boolean): boolean {
  return pagesCollected >= targetPages && reachedPortal;
}

/**
 * Checks defeat condition: player HP drops to 0.
 */
export function checkDefeat(hp: number): boolean {
  return hp <= 0;
}
