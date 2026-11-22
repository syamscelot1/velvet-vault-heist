// logic.test.js — Node tests for the heist rules (node --test).
// The world is pure: no DOM, no drawing, so the same code the browser runs
// is what these tests drive. Run with: node tests/logic.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom } from '../game/src/random.js';
import { LEVELS } from '../game/src/levels.js';
import {
  createWorld,
  EVENT_CAUGHT,
  EVENT_LEVEL,
  EVENT_LOOT,
} from '../game/src/world.js';
import { stageShot } from '../game/src/shots.js';
import { STEP, WALK_SPEED, SNEAK_SPEED, PLAYER_R } from '../game/src/config.js';

const STEPS = (seconds) => Math.round(seconds / STEP);

function stepN(world, n, intent = {}) {
  let events = 0;
  for (let i = 0; i < n; i++) events = world.step(STEP, intent);
  return events;
}

function snapshot(world) {
  const round = (v) => Math.round(v * 1000) / 1000;
  return {
    x: round(world.player.x),
    y: round(world.player.y),
    alarm: round(world.alarm),
    score: world.score,
    lives: world.lives,
    guards: world.guards.map((g) => ({ x: round(g.x), y: round(g.y), state: g.state })),
  };
}

test('RNG is deterministic for a seed', () => {
  const a = createRandom(20261122);
  const b = createRandom(20261122);
  const c = createRandom(7);
  const seqA = [a(), a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b(), b()];
  const seqC = [c(), c(), c(), c(), c()];
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
});

test('walk and sneak speeds match the config', () => {
  const world = createWorld();
  stepN(world, 60, { dx: 1, dy: 0 });
  assert.ok(Math.abs(world.player.x - (120 + WALK_SPEED)) < 1, `walked to ${world.player.x}`);
  assert.equal(world.player.y, 640);

  const sneaky = createWorld();
  stepN(sneaky, 60, { dx: 1, dy: 0, sneak: true });
  assert.ok(Math.abs(sneaky.player.x - (120 + SNEAK_SPEED)) < 1, `sneaked to ${sneaky.player.x}`);
});

test('walls and cover block movement', () => {
  const world = createWorld();
  stepN(world, 120, { dx: -1, dy: 0 });
  // The left wall is 24 px thick and the thief is 13 px across: x stops at 37.
  assert.ok(world.player.x >= 37 && world.player.x < 41, `stopped at ${world.player.x}`);

  const cover = createWorld();
  // South of the middle case at (592, 280, 96, 64), clear of every cone:
  // Rook's patrol lane is 20 px south and he is 420 px west at the start.
  cover.player.x = 640;
  cover.player.y = 400;
  stepN(cover, 60, { dx: 0, dy: -1 });
  // The case ends at y 344: the thief stops at 357.
  assert.ok(cover.player.y >= 357 && cover.player.y <= 361, `stopped at ${cover.player.y}`);
});

test('alarm: grace, then rise, then decay', () => {
  const world = createWorld();
  // Point the first camera straight at the thief and stop it sweeping, so
  // the sighting is steady and no guard can interfere.
  const cam = world.cameras[0];
  cam.sweep = 0;
  cam.base = Math.atan2(130 - cam.y, 300 - cam.x);
  cam.phase = 0;
  world.player.x = 300;
  world.player.y = 130;

  stepN(world, STEPS(0.5));
  assert.equal(world.alarm, 0, 'the 0.7 s grace holds the meter at zero');
  assert.ok(world.seenByCamera, 'the camera sees the thief');
  stepN(world, STEPS(1));
  assert.ok(world.alarm > 15 && world.alarm < 35, `alarm rose to ${world.alarm}`);

  // Out of sight, the meter drains.
  const before = world.alarm;
  world.player.x = 120;
  world.player.y = 640;
  stepN(world, STEPS(2));
  assert.ok(world.alarm < before, `alarm decayed to ${world.alarm}`);
});

test('smoke hides the thief', () => {
  const world = createWorld();
  world.player.x = 400;
  world.player.y = 420; // in Rook's cone, 180 px ahead of him
  stepN(world, 5);
  assert.ok(world.seenByGuard, 'Rook sees the thief before the smoke');
  world.step(STEP, { smoke: true });
  assert.equal(world.smokeLeft, 1, 'one pellet spent');
  assert.ok(!world.seenByGuard, 'the smoke cloud hides the thief');
  assert.equal(world.alarm, 0, 'no alarm while hidden');
});

test('cameras see the thief, and the EMP blinds them', () => {
  const world = createWorld();
  const cam = world.cameras[0];
  cam.sweep = 0;
  cam.base = Math.atan2(130 - cam.y, 300 - cam.x);
  cam.phase = 0;
  world.player.x = 300;
  world.player.y = 130;
  stepN(world, 5);
  assert.ok(world.seenByCamera, 'the camera sees the thief');
  world.step(STEP, { emp: true });
  assert.equal(world.empLeft, 0, 'the one EMP charge is spent');
  assert.ok(world.cameras[0].empTimer > 0, 'the camera is dark');
  stepN(world, 5);
  assert.ok(!world.seenByCamera, 'a dark camera sees nothing');
});

test('guard chases what it sees, then searches the last seen spot', () => {
  const world = createWorld();
  world.player.x = 400;
  world.player.y = 420;
  stepN(world, 40);
  const rook = world.guards[0];
  assert.equal(rook.state, 'chase', 'Rook chases the thief he sees');
  world.player.x = 120;
  world.player.y = 640;
  stepN(world, 5);
  assert.equal(rook.state, 'search', 'having lost the thief, Rook searches the last seen spot');
});

test('loot opens the exit and the exit clears the room', () => {
  const world = createWorld();
  world.player.x = 640;
  world.player.y = 130; // within 44 px of the sapphire, clear of its pedestal
  const events = world.step(STEP, {});
  assert.ok(events & EVENT_LOOT, 'lifting the sapphire fires EVENT_LOOT');
  assert.equal(world.score, 500);
  assert.ok(world.exitOpen, 'the last piece opens the exit');

  world.player.x = 1180;
  world.player.y = 660;
  const cleared = world.step(STEP, {});
  assert.ok(cleared & EVENT_LEVEL, 'reaching the open exit clears the room');
  assert.ok(world.levelDone);
  // 500 loot + 740 time bonus (74 whole seconds left of par 75) + 300 ghost.
  assert.equal(world.score, 1540, `score is ${world.score}`);
  assert.equal(world.advance(), 'next');
  assert.equal(world.levelIndex, 1);
  assert.equal(world.player.x, 120);
  assert.equal(world.player.y, 640);
});

test('ghost bonus only for a room cleared unseen', () => {
  const world = createWorld();
  const cam = world.cameras[0];
  cam.sweep = 0;
  cam.base = Math.atan2(130 - cam.y, 300 - cam.x);
  cam.phase = 0;
  world.player.x = 300;
  world.player.y = 130;
  stepN(world, STEPS(1.5)); // seen: the alarm rises, the ghost is gone
  assert.ok(world.maxAlarm > 0);
  world.player.x = 640;
  world.player.y = 130;
  world.step(STEP, {});
  world.player.x = 1180;
  world.player.y = 660;
  world.step(STEP, {});
  assert.ok(world.levelDone);
  assert.equal(world.lastClear.ghostBonus, 0, 'a spotted room pays no ghost bonus');
  assert.ok(world.lastClear.timeBonus > 0);
});

test('alarm at 100 costs a life and resets the room', () => {
  const world = createWorld();
  world.alarm = 99;
  world.player.x = 400;
  world.player.y = 420;
  let events = 0;
  for (let i = 0; i < 200 && !(events & EVENT_CAUGHT); i++) {
    events = world.step(STEP, {});
  }
  assert.ok(events & EVENT_CAUGHT, 'the alarm hitting 100 is a caught moment');
  assert.equal(world.lives, 2, 'one life gone');
  assert.equal(world.score, 0, 'the score rolls back to the start of the room');
  assert.equal(world.lootTaken, 0, 'the loot goes back');
  assert.equal(world.player.x, 120, 'the thief is back at the start');
  assert.equal(world.player.y, 640);
});

test('a guard touching the thief costs a life', () => {
  const world = createWorld();
  const rook = world.guards[0];
  rook.x = 140;
  rook.y = 640; // 20 px from the thief: inside the 26 px catch radius
  const events = world.step(STEP, {});
  assert.ok(events & EVENT_CAUGHT);
  assert.equal(world.lives, 2);
});

test('the same inputs play the same heist', () => {
  const script = [
    [{ dx: 1, dy: 0 }, 120],
    [{ dx: 0, dy: -1 }, 60],
    [{ dx: -1, dy: 0, sneak: true }, 60],
    [{ dx: 0, dy: 1 }, 30],
  ];
  const run = () => {
    const world = createWorld();
    for (const [intent, n] of script) stepN(world, n, intent);
    return snapshot(world);
  };
  assert.deepEqual(run(), run());
});

test('every room is laid out fairly', () => {
  // A point is clear when a circle of the thief's radius there touches no
  // blocker (walls, cover, ropes).
  function pointClear(world, x, y) {
    for (const r of world.moveBlockers()) {
      const nx = Math.max(r.x, Math.min(x, r.x + r.w));
      const ny = Math.max(r.y, Math.min(y, r.y + r.h));
      if (Math.hypot(x - nx, y - ny) < PLAYER_R) return false;
    }
    return true;
  }

  for (let i = 0; i < LEVELS.length; i++) {
    const world = createWorld();
    world.loadLevel(i);
    const level = LEVELS[i];
    // Every patrol leg, sampled every 8 px, stays clear of every blocker.
    for (const g of level.guards) {
      for (let w = 0; w + 1 < g.waypoints.length; w++) {
        const [x1, y1] = g.waypoints[w];
        const [x2, y2] = g.waypoints[w + 1];
        const len = Math.hypot(x2 - x1, y2 - y1);
        for (let d = 0; d <= len; d += 8) {
          const x = x1 + ((x2 - x1) * d) / len;
          const y = y1 + ((y2 - y1) * d) / len;
          assert.ok(pointClear(world, x, y), `level ${i + 1}: ${g.name}'s leg is blocked at (${Math.round(x)}, ${Math.round(y)})`);
        }
      }
    }
    // Every loot piece has a reachable stand within the 44 px pickup range.
    for (const loot of level.loot) {
      let stand = false;
      for (const r of [30, 36, 42, 44]) {
        for (let a = 0; a < 16 && !stand; a++) {
          const ang = (a / 16) * Math.PI * 2;
          if (pointClear(world, loot.x + Math.cos(ang) * r, loot.y + Math.sin(ang) * r)) stand = true;
        }
      }
      assert.ok(stand, `level ${i + 1}: no reachable stand for ${loot.name}`);
    }
    // The start and the exit are clear of every blocker.
    assert.ok(pointClear(world, level.start.x, level.start.y), `level ${i + 1}: start is blocked`);
    const e = level.exit;
    assert.ok(pointClear(world, e.x + e.w / 2, e.y + e.h / 2), `level ${i + 1}: exit is blocked`);
  }
});

test('the four shots stage', () => {
  const cover = createWorld();
  const coverShot = stageShot('play', cover);
  assert.equal(coverShot.screen, 'play');
  assert.ok(Math.abs(cover.player.x - 716) < 25, `cover thief at (${Math.round(cover.player.x)}, ${Math.round(cover.player.y)})`);
  assert.ok(Math.abs(cover.player.y - 370) < 25);
  assert.ok(cover.alarm > 25 && cover.alarm < 50, `cover alarm ${cover.alarm}`);
  assert.ok(cover.guards.some((g) => g.state === 'chase'), 'a guard is chasing in the cover shot');
  assert.equal(cover.loot[0].taken, false, 'the sapphire is still on its pedestal');
  assert.equal(cover.score, 0);

  const title = createWorld();
  assert.equal(stageShot('start', title).screen, 'title');
  assert.equal(title.alarm, 0);
  assert.ok(title.guards.every((g) => g.state === 'patrol'), 'the guards are patrolling under the title');

  const alert = createWorld();
  stageShot('alert', alert);
  assert.ok(alert.alarm >= 70 || alert.lives < 3, `alert alarm ${alert.alarm}, lives ${alert.lives}`);
  assert.ok(alert.player.y > 180 && alert.player.y < 215, `alert thief pressed against the rope at y ${Math.round(alert.player.y)}`);
  assert.ok(alert.guards.some((g) => g.state === 'chase' || g.state === 'search'), 'a guard is alerted');

  const win = createWorld();
  const winShot = stageShot('win', win);
  assert.equal(winShot.screen, 'level');
  assert.ok(win.levelDone, 'the win shot clears the room');
  assert.equal(win.lootTaken, 1, 'the sapphire is lifted');
  assert.ok(win.score >= 1000, `win score ${win.score}`);
  assert.equal(win.maxAlarm, 0, 'the win shot is a ghost run');
  assert.equal(win.smokeLeft, 1, 'the cautious pilot spent one smoke pellet');
});
