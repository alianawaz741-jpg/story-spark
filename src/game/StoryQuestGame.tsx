import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  type GameMetrics,
  GAME_CONSTANTS,
} from './rules.ts';
import { soundManager } from '../utils/audioSynth.ts';

interface StoryQuestGameProps {
  onReturnToStorybook: () => void;
  autostart?: boolean;
}

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

interface CollectibleItem {
  id: string;
  type: 'star' | 'page';
  x: number;
  y: number;
  w: number;
  h: number;
  collected: boolean;
  bobOffset: number;
}

interface Enemy {
  id: string;
  type: 'bramble' | 'bat' | 'shadow';
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  baseY: number;
  facing: 1 | -1;
  state: 'patrol' | 'windup' | 'dash' | 'recovering';
  timer: number;
  hp: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  active: boolean;
}

const PARTICLE_POOL_SIZE = 80;

export const StoryQuestGame: React.FC<StoryQuestGameProps> = ({
  onReturnToStorybook,
  autostart = false,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // High-level game state
  const [gameState, setGameState] = useState<'title' | 'playing' | 'paused' | 'victory' | 'gameover'>(
    autostart ? 'playing' : 'title'
  );

  // HUD stats for React display (throttled to discrete changes)
  const [hudHp, setHudHp] = useState<number>(3);
  const [hudPages, setHudPages] = useState<number>(0);
  const [hudTargetPages] = useState<number>(3);
  const [hudStars, setHudStars] = useState<number>(0);
  const [hudScore, setHudScore] = useState<number>(0);
  const [hudCombo, setHudCombo] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.getMuted());

  // Frozen snapshot for victory / defeat modals
  const [runStats, setRunStats] = useState<{
    score: number;
    stars: number;
    pages: number;
    timeSeconds: number;
  }>({ score: 0, stars: 0, pages: 0, timeSeconds: 0 });

  // References to keep 60fps loop decoupled from React re-renders
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  const metricsRef = useRef<GameMetrics>({
    stars: 0,
    pagesCollected: 0,
    targetPages: 3,
    score: 0,
    combo: 1,
    comboTimer: 0,
  });

  const playerRef = useRef<PlayerState>({
    x: 80,
    y: 350,
    vx: 0,
    vy: 0,
    w: 36,
    h: 36,
    isGrounded: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    hp: 3,
    maxHp: 3,
    invulnerableTimer: 0,
    facing: 1,
  });

  const playerVisualRef = useRef({
    scaleX: 1,
    scaleY: 1,
    squashSpeed: 12,
  });

  // Level geometry
  const platformsRef = useRef<Platform[]>([
    { x: 0, y: 480, w: 1600, h: 80, color: '#166534' }, // ground
    { x: 180, y: 390, w: 140, h: 24, color: '#15803d' },
    { x: 380, y: 320, w: 160, h: 24, color: '#15803d' },
    { x: 600, y: 250, w: 140, h: 24, color: '#15803d' },
    { x: 790, y: 340, w: 180, h: 24, color: '#15803d' },
    { x: 1040, y: 270, w: 160, h: 24, color: '#15803d' },
    { x: 1250, y: 200, w: 180, h: 24, color: '#15803d' },
    { x: 1460, y: 360, w: 140, h: 24, color: '#15803d' },
  ]);

  const goalPortalRef = useRef({ x: 1350, y: 130, w: 50, h: 70 });

  // Collectibles
  const collectiblesRef = useRef<CollectibleItem[]>([
    { id: 's1', type: 'star', x: 230, y: 340, w: 24, h: 24, collected: false, bobOffset: 0 },
    { id: 'p1', type: 'page', x: 440, y: 260, w: 32, h: 32, collected: false, bobOffset: 1 },
    { id: 's2', type: 'star', x: 650, y: 190, w: 24, h: 24, collected: false, bobOffset: 2 },
    { id: 'p2', type: 'page', x: 860, y: 280, w: 32, h: 32, collected: false, bobOffset: 3 },
    { id: 's3', type: 'star', x: 1100, y: 210, w: 24, h: 24, collected: false, bobOffset: 4 },
    { id: 'p3', type: 'page', x: 1320, y: 140, w: 32, h: 32, collected: false, bobOffset: 5 },
    { id: 's4', type: 'star', x: 700, y: 440, w: 24, h: 24, collected: false, bobOffset: 6 },
    { id: 's5', type: 'star', x: 1000, y: 440, w: 24, h: 24, collected: false, bobOffset: 7 },
  ]);

  // Enemies / Hazards
  const enemiesRef = useRef<Enemy[]>([
    {
      id: 'e1',
      type: 'bramble',
      x: 400,
      y: 444,
      w: 36,
      h: 36,
      vx: -70,
      vy: 0,
      baseY: 444,
      facing: -1,
      state: 'patrol',
      timer: 0,
      hp: 1,
    },
    {
      id: 'e2',
      type: 'bat',
      x: 720,
      y: 200,
      w: 32,
      h: 28,
      vx: -90,
      vy: 0,
      baseY: 200,
      facing: -1,
      state: 'patrol',
      timer: 0,
      hp: 1,
    },
    {
      id: 'e3',
      type: 'shadow',
      x: 1140,
      y: 228,
      w: 34,
      h: 34,
      vx: 0,
      vy: 0,
      baseY: 228,
      facing: -1,
      state: 'patrol',
      timer: 0,
      hp: 1,
    },
  ]);

  // Camera & Screen Shake
  const cameraRef = useRef({ x: 0, y: 0, trauma: 0 });
  const hitstopTimerRef = useRef(0);
  const timeElapsedRef = useRef(0);

  // Pre-allocated Particle Pool (Zero GC inside requestAnimationFrame)
  const particlePoolRef = useRef<Particle[]>(
    Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      color: '#fbbf24',
      size: 4,
      alpha: 1,
      life: 0,
      maxLife: 0.5,
      active: false,
    }))
  );

  const spawnParticles = (x: number, y: number, color: string, count: number = 8) => {
    const pool = particlePoolRef.current;
    let spawned = 0;
    for (let i = 0; i < pool.length && spawned < count; i++) {
      if (!pool[i].active) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 140;
        pool[i].x = x;
        pool[i].y = y;
        pool[i].vx = Math.cos(angle) * speed;
        pool[i].vy = Math.sin(angle) * speed - 50;
        pool[i].color = color;
        pool[i].size = 3 + Math.random() * 5;
        pool[i].alpha = 1;
        pool[i].life = 0;
        pool[i].maxLife = 0.3 + Math.random() * 0.35;
        pool[i].active = true;
        spawned++;
      }
    }
  };

  // Unified Input System: edge triggers vs held keys
  const keysHeld = useRef<Record<string, boolean>>({});
  const keysJustPressed = useRef<Record<string, boolean>>({});

  // Sync state to body dataset for verification inspection
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Reset game state
  const resetGame = useCallback(() => {
    metricsRef.current = {
      stars: 0,
      pagesCollected: 0,
      targetPages: 3,
      score: 0,
      combo: 1,
      comboTimer: 0,
    };
    playerRef.current = {
      x: 80,
      y: 350,
      vx: 0,
      vy: 0,
      w: 36,
      h: 36,
      isGrounded: false,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      hp: 3,
      maxHp: 3,
      invulnerableTimer: 0,
      facing: 1,
    };
    collectiblesRef.current.forEach((c) => (c.collected = false));
    cameraRef.current = { x: 0, y: 0, trauma: 0 };
    hitstopTimerRef.current = 0;
    timeElapsedRef.current = 0;

    setHudHp(3);
    setHudPages(0);
    setHudStars(0);
    setHudScore(0);
    setHudCombo(1);
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    setGameState('playing');
    document.body.dataset.state = 'playing';
    soundManager.playSound('fanfare');
  }, [resetGame]);

  const pauseGame = useCallback(() => {
    if (stateRef.current === 'playing') {
      setGameState('paused');
      document.body.dataset.state = 'paused';
    }
  }, []);

  const resumeGame = useCallback(() => {
    if (stateRef.current === 'paused') {
      setGameState('playing');
      document.body.dataset.state = 'playing';
    }
  }, []);

  // Keyboard Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const code = e.code;
      if (!keysHeld.current[code]) {
        keysJustPressed.current[code] = true;
      }
      keysHeld.current[code] = true;

      // Title screen: Enter or Space starts game
      if (stateRef.current === 'title' && (code === 'Enter' || code === 'Space')) {
        e.preventDefault();
        startGame();
        return;
      }

      // Playing screen: Escape or P pauses
      if (stateRef.current === 'playing' && (code === 'Escape' || code === 'KeyP')) {
        e.preventDefault();
        pauseGame();
        return;
      }

      // Paused screen: Escape resumes
      if (stateRef.current === 'paused' && (code === 'Escape' || code === 'KeyP')) {
        e.preventDefault();
        resumeGame();
        return;
      }

      // Prevent scrolling on Space or Arrow keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      keysHeld.current[code] = false;

      // Variable jump cut when jump key released
      if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
        playerRef.current.vy = applyJumpCut(playerRef.current.vy);
      }
    };

    const onBlur = () => {
      keysHeld.current = {};
      keysJustPressed.current = {};
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onBlur);
    };
  }, [startGame, pauseGame, resumeGame]);

  // Main 60 FPS Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const rawDt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      const dt = clampDt(rawDt);

      const currentState = stateRef.current;

      // If in hitstop, decrement hitstop timer while freezing physics
      if (hitstopTimerRef.current > 0) {
        hitstopTimerRef.current = Math.max(0, hitstopTimerRef.current - dt);
      }

      if (currentState === 'playing' && hitstopTimerRef.current <= 0) {
        timeElapsedRef.current += dt;

        // --- 1. Input Processing ---
        const moveLeft = keysHeld.current['ArrowLeft'] || keysHeld.current['KeyA'];
        const moveRight = keysHeld.current['ArrowRight'] || keysHeld.current['KeyD'];
        const jumpPressed =
          keysJustPressed.current['Space'] ||
          keysJustPressed.current['ArrowUp'] ||
          keysJustPressed.current['KeyW'];

        const player = playerRef.current;

        // Horizontal velocity
        if (moveLeft && !moveRight) {
          player.vx = -GAME_CONSTANTS.MOVE_SPEED;
          player.facing = -1;
        } else if (moveRight && !moveLeft) {
          player.vx = GAME_CONSTANTS.MOVE_SPEED;
          player.facing = 1;
        } else {
          player.vx *= 0.75; // ground friction
        }

        // Jump timers & coyote time
        const { canJump } = updateTimers(player, dt, !!jumpPressed);

        if (canJump) {
          player.vy = GAME_CONSTANTS.JUMP_VELOCITY;
          player.isGrounded = false;
          player.coyoteTimer = 0;
          player.jumpBufferTimer = 0;

          // Squash & stretch on takeoff
          playerVisualRef.current.scaleX = 0.82;
          playerVisualRef.current.scaleY = 1.25;

          soundManager.playSound('jump');
          spawnParticles(player.x + player.w / 2, player.y + player.h, '#ffffff', 4);
        }

        // Apply Gravity
        player.vy += GAME_CONSTANTS.GRAVITY * dt;

        // Integrate Position
        player.x += player.vx * dt;
        player.y += player.vy * dt;

        // Platform Collisions (AABB)
        let groundedThisFrame = false;
        const platforms = platformsRef.current;

        for (const plat of platforms) {
          if (checkAABB(player, plat)) {
            // Check top landing
            const prevY = player.y - player.vy * dt;
            if (prevY + player.h <= plat.y + 12 && player.vy >= 0) {
              player.y = plat.y - player.h;
              player.vy = 0;
              groundedThisFrame = true;

              // Landing squash
              if (!player.isGrounded) {
                playerVisualRef.current.scaleX = 1.28;
                playerVisualRef.current.scaleY = 0.76;
                spawnParticles(player.x + player.w / 2, player.y + player.h, '#ffffff', 3);
              }
            }
          }
        }

        player.isGrounded = groundedThisFrame;
        if (player.isGrounded) {
          player.coyoteTimer = GAME_CONSTANTS.COYOTE_TIME;
        } else {
          player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
        }
        player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);

        // Invulnerability decay
        if (player.invulnerableTimer > 0) {
          player.invulnerableTimer = Math.max(0, player.invulnerableTimer - dt);
        }

        // Boundaries
        if (player.x < 0) player.x = 0;
        if (player.x > 1560) player.x = 1560;

        // Fall into pit check
        if (player.y > 600) {
          const res = applyDamage(player, 1);
          player.x = 80;
          player.y = 350;
          player.vy = 0;
          setHudHp(res.player.hp);
          soundManager.playSound('hit');
          if (checkDefeat(res.player.hp)) {
            setRunStats({
              score: metricsRef.current.score,
              stars: metricsRef.current.stars,
              pages: metricsRef.current.pagesCollected,
              timeSeconds: Math.round(timeElapsedRef.current),
            });
            setGameState('gameover');
          }
        }

        // --- 2. Collectibles Update ---
        const collectibles = collectiblesRef.current;
        for (const item of collectibles) {
          if (!item.collected && checkAABB(player, item)) {
            item.collected = true;
            if (item.type === 'star') {
              const updated = collectStar(metricsRef.current);
              metricsRef.current = updated;
              setHudStars(updated.stars);
              setHudScore(updated.score);
              setHudCombo(updated.combo);
              soundManager.playSound('star', { pitchOffset: Math.min(updated.combo * 2, 12) });
              spawnParticles(item.x + item.w / 2, item.y + item.h / 2, '#fbbf24', 10);
            } else if (item.type === 'page') {
              const updated = collectStoryPage(metricsRef.current);
              metricsRef.current = updated;
              setHudPages(updated.pagesCollected);
              setHudScore(updated.score);
              soundManager.playSound('pageFlip');
              soundManager.playSound('sparkle');
              spawnParticles(item.x + item.w / 2, item.y + item.h / 2, '#60a5fa', 14);
            }
          }
        }

        // --- 3. Combo Decay ---
        const decayedMetrics = tickCombo(metricsRef.current, dt);
        if (decayedMetrics.combo !== metricsRef.current.combo) {
          metricsRef.current = decayedMetrics;
          setHudCombo(decayedMetrics.combo);
        }

        // --- 4. Enemies Update ---
        const enemies = enemiesRef.current;
        for (const enemy of enemies) {
          if (enemy.type === 'bramble') {
            enemy.x += enemy.vx * dt;
            if (enemy.x < 360) {
              enemy.x = 360;
              enemy.vx = 70;
              enemy.facing = 1;
            } else if (enemy.x > 620) {
              enemy.x = 620;
              enemy.vx = -70;
              enemy.facing = -1;
            }
          } else if (enemy.type === 'bat') {
            enemy.x += enemy.vx * dt;
            enemy.y = enemy.baseY + Math.sin(timeElapsedRef.current * 4) * 35;
            if (enemy.x < 650) {
              enemy.vx = 90;
              enemy.facing = 1;
            } else if (enemy.x > 900) {
              enemy.vx = -90;
              enemy.facing = -1;
            }
          } else if (enemy.type === 'shadow') {
            // Shadow enemy with telegraph and dash
            enemy.timer += dt;
            if (enemy.state === 'patrol') {
              if (Math.abs(player.x - enemy.x) < 220 && Math.abs(player.y - enemy.y) < 60) {
                enemy.state = 'windup';
                enemy.timer = 0;
                soundManager.playSound('bell');
              }
            } else if (enemy.state === 'windup') {
              if (enemy.timer > 0.4) {
                // Dash telegraph ends, lunge forward!
                enemy.state = 'dash';
                enemy.facing = player.x < enemy.x ? -1 : 1;
                enemy.vx = enemy.facing * 260;
                enemy.timer = 0;
                soundManager.playSound('woosh');
              }
            } else if (enemy.state === 'dash') {
              enemy.x += enemy.vx * dt;
              if (enemy.timer > 0.45) {
                enemy.state = 'patrol';
                enemy.vx = 0;
                enemy.timer = 0;
              }
            }
          }

          // Player vs Enemy Collision
          if (checkAABB(player, enemy)) {
            // Jump stomp from above!
            if (player.vy > 0 && player.y + player.h < enemy.y + enemy.h * 0.6) {
              player.vy = GAME_CONSTANTS.JUMP_VELOCITY * 0.75;
              soundManager.playSound('pop');
              spawnParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#f87171', 12);
              // Displace enemy briefly
              enemy.x += (player.facing || 1) * 60;
            } else {
              // Player takes damage
              const res = applyDamage(player, 1);
              if (res.hit) {
                setHudHp(res.player.hp);
                hitstopTimerRef.current = 0.05; // 50ms sim hitstop
                cameraRef.current.trauma = 0.6; // camera shake
                soundManager.playSound('hit');
                spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ef4444', 16);

                // Check defeat
                if (checkDefeat(res.player.hp)) {
                  setRunStats({
                    score: metricsRef.current.score,
                    stars: metricsRef.current.stars,
                    pages: metricsRef.current.pagesCollected,
                    timeSeconds: Math.round(timeElapsedRef.current),
                  });
                  setGameState('gameover');
                }
              }
            }
          }
        }

        // --- 5. Goal / Victory Check ---
        const reachedPortal = checkAABB(player, goalPortalRef.current);
        if (checkVictory(metricsRef.current.pagesCollected, metricsRef.current.targetPages, reachedPortal)) {
          setRunStats({
            score: metricsRef.current.score + 500,
            stars: metricsRef.current.stars,
            pages: metricsRef.current.pagesCollected,
            timeSeconds: Math.round(timeElapsedRef.current),
          });
          setGameState('victory');
          soundManager.playSound('fanfare');
        }

        // Camera Tracking
        const targetCamX = player.x - 300;
        cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.1;
        cameraRef.current.x = Math.max(0, Math.min(cameraRef.current.x, 800));

        // Screen Shake decay
        if (cameraRef.current.trauma > 0) {
          cameraRef.current.trauma = Math.max(0, cameraRef.current.trauma - dt * 2.5);
        }

        // Squash-and-stretch damping back to 1
        const vis = playerVisualRef.current;
        vis.scaleX += (1 - vis.scaleX) * vis.squashSpeed * dt;
        vis.scaleY += (1 - vis.scaleY) * vis.squashSpeed * dt;
      }

      // --- 6. Particles Update ---
      const pool = particlePoolRef.current;
      for (const p of pool) {
        if (p.active) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life += dt;
          p.alpha = Math.max(0, 1 - p.life / p.maxLife);
          if (p.life >= p.maxLife) {
            p.active = false;
          }
        }
      }

      // --- 7. Rendering Pass ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      // Apply Camera & Shake
      const shakeAmount = cameraRef.current.trauma * cameraRef.current.trauma * 14;
      const shakeX = (Math.random() * 2 - 1) * shakeAmount;
      const shakeY = (Math.random() * 2 - 1) * shakeAmount;
      ctx.translate(-cameraRef.current.x + shakeX, shakeY);

      // Sky gradient background
      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      skyGrad.addColorStop(0, '#0f172a');
      skyGrad.addColorStop(0.5, '#1e1b4b');
      skyGrad.addColorStop(1, '#2e1065');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(cameraRef.current.x, 0, canvas.width, canvas.height);

      // Parallax Stars in background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 53 + (timeElapsedRef.current * 10)) % 1600);
        const sy = (i * 29) % 400;
        ctx.beginPath();
        ctx.arc(sx, sy, (i % 2) + 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Platforms
      for (const plat of platformsRef.current) {
        // Platform top grass
        ctx.fillStyle = plat.color;
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        // Platform highlight edge
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(plat.x, plat.y, plat.w, 4);

        // Earth stone texture underneath
        ctx.fillStyle = '#14532d';
        ctx.fillRect(plat.x, plat.y + 4, plat.w, plat.h - 4);
      }

      // Draw Goal Portal
      const portal = goalPortalRef.current;
      const portalPulse = Math.sin(timeElapsedRef.current * 4) * 4;
      ctx.fillStyle = metricsRef.current.pagesCollected >= metricsRef.current.targetPages ? '#38bdf8' : '#64748b';
      ctx.beginPath();
      ctx.ellipse(
        portal.x + portal.w / 2,
        portal.y + portal.h / 2,
        portal.w / 2 + portalPulse,
        portal.h / 2 + portalPulse,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Portal icon / label
      ctx.font = '24px sans-serif';
      ctx.fillText('🚪', portal.x + 10, portal.y + 45);

      // Draw Collectibles
      for (const item of collectiblesRef.current) {
        if (!item.collected) {
          const bob = Math.sin(timeElapsedRef.current * 5 + item.bobOffset) * 6;
          ctx.font = item.type === 'star' ? '22px sans-serif' : '26px sans-serif';
          ctx.fillText(item.type === 'star' ? '⭐' : '📜', item.x, item.y + 20 + bob);
        }
      }

      // Draw Enemies
      for (const enemy of enemiesRef.current) {
        ctx.save();
        ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
        if (enemy.facing === 1) ctx.scale(-1, 1);

        if (enemy.type === 'bramble') {
          ctx.font = '28px sans-serif';
          ctx.fillText('🦔', -14, 10);
        } else if (enemy.type === 'bat') {
          ctx.font = '26px sans-serif';
          ctx.fillText('🦇', -13, 8);
        } else if (enemy.type === 'shadow') {
          if (enemy.state === 'windup') {
            // Emissive red telegraph ring!
            ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
            ctx.beginPath();
            ctx.arc(0, 0, 26, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.font = '28px sans-serif';
          ctx.fillText('👻', -14, 10);
        }
        ctx.restore();
      }

      // Draw Player Hero (Dragon / Bunny sprite with Squash & Stretch)
      const p = playerRef.current;
      const vis = playerVisualRef.current;

      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.scale(p.facing * vis.scaleX, vis.scaleY);

      // Invulnerable flicker
      if (p.invulnerableTimer > 0 && Math.floor(p.invulnerableTimer * 20) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }

      // Hero sprite
      ctx.font = '32px sans-serif';
      ctx.fillText('🐲', -16, 12);

      ctx.restore();

      // Draw Particles
      for (const pt of particlePoolRef.current) {
        if (pt.active) {
          ctx.save();
          ctx.globalAlpha = pt.alpha;
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore();

      // Reset single-frame inputs
      keysJustPressed.current = {};

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Compute Vitality Pip States
  const vitalityPips = getVitalityPipStates(hudHp, 3);

  return (
    <div
      ref={mountRef}
      className="relative w-full h-screen bg-slate-950 overflow-hidden select-none font-sans"
    >
      {/* Isolated Canvas Viewport */}
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        className="w-full h-full object-cover block"
      />

      {/* Low-Occlusion HUD Overlay (>85% clear, pointer-events: none on wrapper) */}
      <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 z-10">
        {/* Top Perimeter Cluster */}
        <header className="flex items-center justify-between w-full">
          {/* Top-Left: Vitality Hearts + Avatar */}
          <div className="flex items-center gap-2 bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-2.5 px-3.5 shadow-lg">
            <span className="text-2xl mr-1">🐲</span>
            <div className="flex items-center gap-1.5" aria-label={`Vitality ${hudHp} of 3`}>
              {vitalityPips.map((pip, idx) => (
                <span
                  key={idx}
                  className={`text-xl transition-transform ${
                    pip === 'full' ? 'scale-100 filter drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]' : 'scale-90 opacity-30 grayscale'
                  }`}
                >
                  ❤️
                </span>
              ))}
            </div>
            <span className="text-[11px] font-extrabold uppercase text-emerald-400 tracking-wider ml-1">
              HP
            </span>
          </div>

          {/* Top-Center: Rescued Pages Tracker */}
          <div className="bg-slate-900/80 border border-blue-500/30 rounded-2xl py-2 px-4 shadow-lg flex items-center gap-2">
            <span className="text-xl">📜</span>
            <span className="text-xs uppercase font-bold text-blue-300">Rescued Pages:</span>
            <span className="text-base font-extrabold text-blue-400 tabular-nums">
              {hudPages} / {hudTargetPages}
            </span>
          </div>

          {/* Top-Right: Star Gems & Controls */}
          <div className="flex items-center gap-2.5 pointer-events-auto">
            <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl py-2 px-3.5 shadow-lg flex items-center gap-2">
              <span className="text-xl">⭐</span>
              <span className="text-base font-extrabold text-amber-300 tabular-nums">
                {hudStars}
              </span>
              {hudCombo > 1 && (
                <span className="text-xs font-black text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded-md animate-pulse">
                  x{hudCombo}
                </span>
              )}
            </div>

            {/* Mute Button */}
            <button
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                const m = !isMuted;
                soundManager.setMuted(m);
                setIsMuted(m);
              }}
              className="w-10 h-10 rounded-2xl bg-slate-900/80 border border-slate-700 hover:bg-slate-800 text-slate-200 flex items-center justify-center cursor-pointer shadow-lg active:scale-95"
              aria-label="Toggle sound"
            >
              {isMuted ? '🔇' : '🔊'}
            </button>

            {/* Pause Button */}
            <button
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                pauseGame();
              }}
              className="w-10 h-10 rounded-2xl bg-slate-900/80 border border-slate-700 hover:bg-slate-800 text-slate-200 flex items-center justify-center cursor-pointer shadow-lg active:scale-95 font-bold text-xs"
              aria-label="Pause Game"
            >
              ⏸
            </button>
          </div>
        </header>

        {/* Bottom Bar: Score and Return CTA */}
        <footer className="flex items-center justify-between w-full pointer-events-auto">
          <div className="bg-slate-900/70 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white/80 font-mono">
            SCORE: <span className="font-bold text-amber-300 tabular-nums">{hudScore}</span>
          </div>

          <button
            onClick={onReturnToStorybook}
            className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-bold text-xs shadow-lg active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>📖 Return to Storybook</span>
          </button>
        </footer>
      </div>

      {/* --- TITLE SCREEN MODAL --- */}
      {gameState === 'title' && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-30">
          <div className="max-w-md w-full text-center space-y-6">
            {/* Bespoke SVG Title Lockup over 35% negative space */}
            <div className="flex justify-center mb-2">
              <svg viewBox="0 0 400 90" className="w-full max-w-sm drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]">
                <defs>
                  <linearGradient id="titleGold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                </defs>
                <text
                  x="200"
                  y="40"
                  textAnchor="middle"
                  fill="url(#titleGold)"
                  fontSize="32"
                  fontWeight="900"
                  letterSpacing="3"
                  className="font-serif uppercase"
                >
                  STORY QUEST
                </text>
                <text
                  x="200"
                  y="72"
                  textAnchor="middle"
                  fill="#60a5fa"
                  fontSize="16"
                  fontWeight="700"
                  letterSpacing="4"
                  className="uppercase tracking-widest"
                >
                  PAGE HOPPER ADVENTURE
                </text>
              </svg>
            </div>

            <p className="text-amber-100 text-sm font-medium">
              Lost story pages scattered across the kingdom! Leap over brambles, collect star gems, and reach the Magic Portal!
            </p>

            {/* Primary Start CTA */}
            <div className="pt-2">
              <button
                data-start="true"
                onClick={startGame}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-amber-950 font-black text-lg shadow-2xl transition-all active:scale-95 cursor-pointer ring-4 ring-amber-300/40"
              >
                START QUEST [Enter / Space]
              </button>
            </div>

            {/* Flat Control Hints */}
            <div className="text-stone-400 text-xs font-mono tracking-wide pt-2">
              WASD / Arrows Move · Space Jump · Esc / P Pause
            </div>
          </div>
        </div>
      )}

      {/* --- PAUSE MODAL --- */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-6 z-30">
          <div className="max-w-sm w-full bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <h2 className="text-2xl font-extrabold text-amber-400 font-serif">Game Paused</h2>
            <p className="text-slate-300 text-xs">Take a breath, brave reader!</p>
            <div className="space-y-2.5 pt-2">
              <button
                onClick={resumeGame}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-sm shadow-md active:scale-95 cursor-pointer"
              >
                Resume
              </button>
              <button
                onClick={startGame}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-600 active:scale-95 cursor-pointer"
              >
                Restart Level
              </button>
              <button
                onClick={onReturnToStorybook}
                className="w-full py-2.5 rounded-xl text-amber-300 hover:text-amber-200 font-semibold text-xs active:scale-95 cursor-pointer"
              >
                Return to Storybook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- VICTORY MODAL --- */}
      {gameState === 'victory' && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-6 z-30">
          <div className="max-w-md w-full bg-slate-900 border-2 border-emerald-500 rounded-3xl p-6 md:p-8 text-center space-y-4 shadow-2xl">
            <div className="text-5xl animate-bounce">🎉</div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-emerald-400 font-serif">
              Chapter Rescued!
            </h2>
            <p className="text-emerald-100/90 text-sm">
              You found all 3 lost story pages and unlocked the secret chapter!
            </p>

            {/* Run Mastery Metrics */}
            <div className="grid grid-cols-3 gap-2 py-3 bg-emerald-950/40 rounded-2xl border border-emerald-500/20">
              <div>
                <div className="text-[10px] text-emerald-300 uppercase font-bold">Time</div>
                <div className="text-lg font-black text-white tabular-nums">{runStats.timeSeconds}s</div>
              </div>
              <div>
                <div className="text-[10px] text-emerald-300 uppercase font-bold">Stars</div>
                <div className="text-lg font-black text-amber-300 tabular-nums">{runStats.stars}</div>
              </div>
              <div>
                <div className="text-[10px] text-emerald-300 uppercase font-bold">Score</div>
                <div className="text-lg font-black text-emerald-400 tabular-nums">{runStats.score}</div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                data-start="true"
                onClick={startGame}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-emerald-950 font-black text-base shadow-xl active:scale-95 cursor-pointer"
              >
                Play Again
              </button>
              <button
                onClick={onReturnToStorybook}
                className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 active:scale-95 cursor-pointer"
              >
                Read Stories Now 📖
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- GAME OVER MODAL --- */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-6 z-30">
          <div className="max-w-md w-full bg-slate-900 border-2 border-red-500/60 rounded-3xl p-6 md:p-8 text-center space-y-4 shadow-2xl">
            <div className="text-4xl">🌟</div>
            <h2 className="text-2xl font-extrabold text-red-400 font-serif">Keep Trying Little Hero!</h2>
            <p className="text-slate-300 text-xs md:text-sm">
              The forest is full of surprises! You gathered {runStats.pages} pages and {runStats.stars} stars.
            </p>

            {/* Run Progress Metrics */}
            <div className="grid grid-cols-2 gap-3 py-3 bg-red-950/20 rounded-2xl border border-red-500/20">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Pages Found</div>
                <div className="text-lg font-black text-blue-300 tabular-nums">{runStats.pages} / 3</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Score</div>
                <div className="text-lg font-black text-amber-300 tabular-nums">{runStats.score}</div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                data-start="true"
                onClick={startGame}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-amber-950 font-black text-base shadow-xl active:scale-95 cursor-pointer"
              >
                Try Again
              </button>
              <button
                onClick={onReturnToStorybook}
                className="w-full py-2.5 rounded-xl text-stone-400 hover:text-white font-medium text-xs active:scale-95 cursor-pointer"
              >
                Back to Storybook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
