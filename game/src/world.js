// world.js — the pure rules of the heist. No DOM, no drawing, no sound:
// create a world, feed it step(dt, intent) sixty times a second, read the
// event flags it returns. The browser shell, the tests and the shot
// autopilot all drive the same code, so a staged screenshot is the real game.

import {
  ALARM_CAMERA_RATE,
  ALARM_DECAY,
  ALARM_GUARD_RATE,
  ALARM_MAX,
  CAMERA_FOV,
  CAMERA_RANGE,
  CAMERA_SWEEP_TIME,
  CATCH_RADIUS,
  EMP_TIME,
  FIELD_H,
  FIELD_W,
  GUARD_CHASE_SPEED,
  GUARD_FOV,
  GUARD_RANGE,
  GUARD_RETURN_SPEED,
  GUARD_SEARCH_SPEED,
  HUNT_ALARM,
  LIVES,
  LOOT_RADIUS,
  PLAYER_R,
  SCORE_GHOST,
  SCORE_LIFE,
  SCORE_TIME_PER_SEC,
  SEARCH_TIME,
  SEED,
  SMOKE_RADIUS,
  SMOKE_TIME,
  SNEAK_ALARM,
  SNEAK_SPEED,
  SPOT_GRACE,
  TURN_SPEED,
  WALL,
  WALK_SPEED,
} from './config.js';
import { LEVELS } from './levels.js';
import { createRandom } from './random.js';
import { angleDiff, canSee } from './vision.js';

// Event flags returned by step(): several can fire in the same step.
export const EVENT_LOOT = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_LEVEL = 8;
export const EVENT_SMOKE = 16;
export const EVENT_EMP = 32;

// The four border walls, as rectangles.
export function wallRects() {
  return [
    { x: 0, y: 0, w: FIELD_W, h: WALL },
    { x: 0, y: FIELD_H - WALL, w: FIELD_W, h: WALL },
    { x: 0, y: 0, w: WALL, h: FIELD_H },
    { x: FIELD_W - WALL, y: 0, w: WALL, h: FIELD_H },
  ];
}

// Does a circle of the thief's radius at (cx, cy) touch any rectangle?
function circleHitsRects(cx, cy, rects) {
  for (const r of rects) {
    const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
    const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
    const dx = cx - nx;
    const dy = cy - ny;
    if (dx * dx + dy * dy < PLAYER_R * PLAYER_R) return true;
  }
  return false;
}

// Move a circle axis by axis, sliding along anything it touches instead of
// sticking: the x step is kept when it is free, then the y step is tried
// from the new x. This is what lets the thief slide along a velvet rope.
function moveCircle(x, y, dx, dy, blockers) {
  let nx = x + dx;
  if (circleHitsRects(nx, y, blockers)) nx = x;
  let ny = y + dy;
  if (circleHitsRects(nx, ny, blockers)) ny = y;
  return { x: nx, y: ny };
}

export function createWorld(random = createRandom(SEED)) {
  const world = {
    levelIndex: 0,
    level: LEVELS[0],
    player: { x: 0, y: 0, angle: 0 },
    guards: [],
    cameras: [],
    smokes: [],
    alarm: 0,
    maxAlarm: 0,
    lives: LIVES,
    score: 0,
    roomScoreStart: 0,
    elapsed: 0,
    smokeLeft: 0,
    empLeft: 0,
    lootTaken: 0,
    exitOpen: false,
    levelDone: false,
    heistDone: false,
    gameOver: false,
    lastSeen: null,
    seenByGuard: false,
    seenByCamera: false,
    lastClear: null,

    // Rectangles that stop movement: walls, cover and the velvet ropes.
    moveBlockers() {
      return [...wallRects(), ...this.level.cover, ...this.level.ropes];
    },

    // Rectangles that stop sight: walls and cover only. Ropes block feet,
    // never eyes — a guard can watch the thief straight over a rope.
    sightBlockers() {
      return [...wallRects(), ...this.level.cover];
    },

    // The cone a guard is casting right now, for the renderer and the pilot.
    guardCone(g) {
      return {
        x: g.x, y: g.y, angle: g.angle,
        range: GUARD_RANGE, fov: GUARD_FOV,
        alerted: g.state === 'chase' || g.state === 'search',
      };
    },

    // The cone a camera is casting right now (dark while the EMP holds).
    cameraCone(c) {
      return {
        x: c.x, y: c.y, angle: c.current,
        range: c.range, fov: CAMERA_FOV, dark: c.empTimer > 0,
      };
    },

    // Would any watcher see the thief standing at (x, y)? The shot
    // autopilot probes one step ahead with this before it moves.
    isSeenAt(x, y, sneaking) {
      const blockers = this.sightBlockers();
      for (const g of this.guards) {
        if (canSee(this.guardCone(g), x, y, blockers, this.smokes, sneaking)) return true;
      }
      for (const c of this.cameras) {
        if (c.empTimer > 0) continue;
        if (canSee(this.cameraCone(c), x, y, blockers, this.smokes, sneaking)) return true;
      }
      return false;
    },

    timeLeft() {
      return Math.max(0, this.level.par - this.elapsed);
    },

    loadLevel(i) {
      this.levelIndex = i;
      this.level = LEVELS[i];
      this.player.x = this.level.start.x;
      this.player.y = this.level.start.y;
      this.player.angle = -Math.PI / 2;
      this.guards = this.level.guards.map((g) => ({
        name: g.name,
        x: g.waypoints[0][0],
        y: g.waypoints[0][1],
        angle: Math.atan2(
          g.waypoints[1][1] - g.waypoints[0][1],
          g.waypoints[1][0] - g.waypoints[0][0],
        ),
        waypoints: g.waypoints,
        wpIndex: 1,
        wpDir: 1,
        speed: g.speed,
        state: 'patrol',
        tx: g.waypoints[1][0],
        ty: g.waypoints[1][1],
        stareTimer: 0,
        scanDir: 1,
      }));
      this.cameras = this.level.cameras.map((c) => ({
        ...c,
        base: c.angle,
        current: c.angle,
        phase: random() * Math.PI * 2,
        empTimer: 0,
      }));
      this.smokes = [];
      this.alarm = 0;
      this.maxAlarm = 0;
      this.elapsed = 0;
      // A fresh copy of the loot: taking a piece must never mark the shared
      // level data, or a restarted room would find its loot already gone.
      this.loot = this.level.loot.map((l) => ({ ...l, taken: false }));
      this.smokeLeft = this.level.tools.smoke;
      this.empLeft = this.level.tools.emp;
      this.lootTaken = 0;
      this.exitOpen = false;
      this.levelDone = false;
      this.lastSeen = null;
      this.seenByGuard = false;
      this.seenByCamera = false;
      this.lastClear = null;
      this.graceTimer = 0;
      this.prevSeen = false;
      this.roomScoreStart = this.score;
    },

    // A caught thief loses a life and the room resets: the loot goes back,
    // the score rolls back to the start of the room, so a failed room can
    // never be farmed for points.
    restartLevel() {
      this.score = this.roomScoreStart;
      this.loadLevel(this.levelIndex);
    },

    reset() {
      this.score = 0;
      this.lives = LIVES;
      this.heistDone = false;
      this.gameOver = false;
      this.loadLevel(0);
    },

    // Called when the player dismisses the level-clear panel: the next room,
    // or the getaway that ends the heist.
    advance() {
      if (!this.levelDone) return 'play';
      if (this.levelIndex < LEVELS.length - 1) {
        this.loadLevel(this.levelIndex + 1);
        return 'next';
      }
      this.heistDone = true;
      this.score += SCORE_LIFE * this.lives;
      return 'heist';
    },

    step(dt, intent = {}) {
      if (this.levelDone || this.heistDone || this.gameOver) return 0;
      let events = 0;
      this.elapsed += dt;

      // --- the thief -------------------------------------------------
      let mx = intent.dx || 0;
      let my = intent.dy || 0;
      if (intent.moveTarget) {
        const dx = intent.moveTarget.x - this.player.x;
        const dy = intent.moveTarget.y - this.player.y;
        const d = Math.hypot(dx, dy);
        if (d > 8) {
          mx = dx / d;
          my = dy / d;
        }
      }
      const mag = Math.hypot(mx, my);
      if (mag > 1) {
        mx /= mag;
        my /= mag;
      }
      const sneaking = !!intent.sneak;
      this.sneaking = sneaking;
      const speed = sneaking ? SNEAK_SPEED : WALK_SPEED;
      if (mag > 0.01) {
        const moved = moveCircle(
          this.player.x, this.player.y,
          mx * speed * dt, my * speed * dt,
          this.moveBlockers(),
        );
        this.player.x = moved.x;
        this.player.y = moved.y;
        this.player.angle = Math.atan2(my, mx);
      }

      // --- tools ------------------------------------------------------
      if (intent.smoke && this.smokeLeft > 0) {
        this.smokes.push({
          x: this.player.x, y: this.player.y, r: SMOKE_RADIUS, t: SMOKE_TIME,
        });
        this.smokeLeft -= 1;
        events |= EVENT_SMOKE;
      }
      if (intent.emp && this.empLeft > 0) {
        for (const c of this.cameras) c.empTimer = EMP_TIME;
        this.empLeft -= 1;
        events |= EVENT_EMP;
      }
      for (const s of this.smokes) s.t -= dt;
      this.smokes = this.smokes.filter((s) => s.t > 0);

      // --- cameras sweep ----------------------------------------------
      for (const c of this.cameras) {
        if (c.empTimer > 0) c.empTimer -= dt;
        c.current = c.base + c.sweep * Math.sin(
          (Math.PI * 2 * this.elapsed) / CAMERA_SWEEP_TIME + c.phase,
        );
      }

      // --- detection ---------------------------------------------------
      const blockers = this.sightBlockers();
      let seenGuard = false;
      let seenCamera = false;
      for (const g of this.guards) {
        if (canSee(this.guardCone(g), this.player.x, this.player.y, blockers, this.smokes, sneaking)) {
          seenGuard = true;
          break;
        }
      }
      for (const c of this.cameras) {
        if (c.empTimer > 0) continue;
        if (canSee(this.cameraCone(c), this.player.x, this.player.y, blockers, this.smokes, sneaking)) {
          seenCamera = true;
          break;
        }
      }
      const seen = seenGuard || seenCamera;
      this.seenByGuard = seenGuard;
      this.seenByCamera = seenCamera;
      if (seen) {
        this.lastSeen = { x: this.player.x, y: this.player.y };
        if (!this.prevSeen) {
          this.graceTimer = SPOT_GRACE;
          events |= EVENT_SPOTTED;
        }
      }
      this.prevSeen = seen;

      // --- guard minds --------------------------------------------------
      for (const g of this.guards) {
        const sees = canSee(
          this.guardCone(g), this.player.x, this.player.y,
          blockers, this.smokes, sneaking,
        );
        if (sees && g.state !== 'chase') {
          g.state = 'chase';
        } else if (!sees && g.state === 'chase') {
          g.state = 'search';
          g.stareTimer = -1; // moving to the last seen spot
          g.tx = this.lastSeen.x;
          g.ty = this.lastSeen.y;
        } else if (g.state === 'patrol' && this.alarm >= HUNT_ALARM && this.lastSeen) {
          // The alarm is high: every guard leaves its patrol and hunts.
          g.state = 'search';
          g.stareTimer = -1;
          g.tx = this.lastSeen.x;
          g.ty = this.lastSeen.y;
        }

        let heading = g.angle;
        let spd = 0;
        if (g.state === 'patrol') {
          g.tx = g.waypoints[g.wpIndex][0];
          g.ty = g.waypoints[g.wpIndex][1];
          spd = g.speed;
        } else if (g.state === 'chase') {
          g.tx = this.player.x;
          g.ty = this.player.y;
          spd = GUARD_CHASE_SPEED;
        } else if (g.state === 'search') {
          if (g.stareTimer === -1) {
            spd = GUARD_SEARCH_SPEED;
          } else if (g.stareTimer > 0) {
            g.stareTimer -= dt;
            g.angle += g.scanDir * 1.2 * dt; // stare, sweeping the room
            if (g.stareTimer <= 0) {
              g.state = 'return';
              let best = 0;
              let bestD = Infinity;
              g.waypoints.forEach((w, i) => {
                const d = Math.hypot(w[0] - g.x, w[1] - g.y);
                if (d < bestD) {
                  bestD = d;
                  best = i;
                }
              });
              g.wpIndex = best;
              g.tx = g.waypoints[best][0];
              g.ty = g.waypoints[best][1];
            }
            continue;
          }
        } else if (g.state === 'return') {
          spd = GUARD_RETURN_SPEED;
        }

        const dx = g.tx - g.x;
        const dy = g.ty - g.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 4 && spd > 0) {
          heading = Math.atan2(dy, dx);
          const moved = moveCircle(g.x, g.y, (dx / dist) * spd * dt, (dy / dist) * spd * dt, this.moveBlockers());
          g.x = moved.x;
          g.y = moved.y;
        } else if (g.state === 'patrol') {
          // Reached a waypoint: turn around the ping-pong.
          g.wpIndex += g.wpDir;
          if (g.wpIndex >= g.waypoints.length) {
            g.wpIndex = g.waypoints.length - 2;
            g.wpDir = -1;
          } else if (g.wpIndex < 0) {
            g.wpIndex = 1;
            g.wpDir = 1;
          }
        } else if (g.state === 'search' && g.stareTimer === -1) {
          g.stareTimer = SEARCH_TIME; // arrived: stare for a while
        } else if (g.state === 'return') {
          g.state = 'patrol';
        }

        // Turn the head toward where the feet are going, at most TURN_SPEED.
        const turn = Math.max(-TURN_SPEED * dt, Math.min(TURN_SPEED * dt, angleDiff(g.angle, heading)));
        g.angle += turn;
      }

      // --- the alarm ----------------------------------------------------
      if (seen) {
        if (this.graceTimer > 0) {
          this.graceTimer -= dt;
        } else {
          const rate = seenGuard ? ALARM_GUARD_RATE : ALARM_CAMERA_RATE;
          this.alarm += rate * (sneaking ? SNEAK_ALARM : 1) * dt;
        }
      } else {
        this.graceTimer = 0;
        this.alarm = Math.max(0, this.alarm - ALARM_DECAY * dt);
      }
      this.alarm = Math.min(ALARM_MAX, this.alarm);
      if (this.alarm > this.maxAlarm) this.maxAlarm = this.alarm;

      // --- caught? -------------------------------------------------------
      let caught = this.alarm >= ALARM_MAX;
      if (!caught) {
        for (const g of this.guards) {
          if (Math.hypot(g.x - this.player.x, g.y - this.player.y) <= CATCH_RADIUS) {
            caught = true;
            break;
          }
        }
      }
      if (caught) {
        this.lives -= 1;
        events |= EVENT_CAUGHT;
        if (this.lives <= 0) {
          this.gameOver = true;
        } else {
          this.restartLevel();
        }
        return events;
      }

      // --- loot -----------------------------------------------------------
      for (const loot of this.loot) {
        if (loot.taken) continue;
        if (Math.hypot(loot.x - this.player.x, loot.y - this.player.y) <= LOOT_RADIUS) {
          loot.taken = true;
          this.lootTaken += 1;
          this.score += loot.value;
          events |= EVENT_LOOT;
        }
      }
      if (this.lootTaken === this.loot.length) this.exitOpen = true;

      // --- the exit --------------------------------------------------------
      if (this.exitOpen) {
        const e = this.level.exit;
        const nx = Math.max(e.x, Math.min(this.player.x, e.x + e.w));
        const ny = Math.max(e.y, Math.min(this.player.y, e.y + e.h));
        if (Math.hypot(this.player.x - nx, this.player.y - ny) <= PLAYER_R) {
          const timeBonus = Math.max(0, Math.floor(this.level.par - this.elapsed)) * SCORE_TIME_PER_SEC;
          const ghostBonus = this.maxAlarm === 0 ? SCORE_GHOST : 0;
          this.score += timeBonus + ghostBonus;
          this.lastClear = { timeBonus, ghostBonus, lootValue: this.level.loot.reduce((s, l) => s + l.value, 0) };
          this.levelDone = true;
          events |= EVENT_LEVEL;
        }
      }
      return events;
    },
  };

  world.reset();
  return world;
}
