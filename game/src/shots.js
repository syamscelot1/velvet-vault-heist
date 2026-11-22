// shots.js — the four screenshots, staged by playing the real rules.
// stageShot(name, world) runs a fresh world forward with an autopilot and
// returns the screen main.js should draw for that one frame. Nothing here
// is faked: the thief moves, the guards patrol and chase, the alarm fills,
// all through world.step — so a screenshot is the game itself, mid-heist.
//
// A waypoint is [x, y] or [x, y, arrival radius]. The loot stop uses a
// radius of 4, so the thief really steps up to the pedestal: with the
// default 14 px radius it can "arrive" 14 px short and never come within
// the 44 px pickup range.
//
// Two pilots: bold walks straight through and takes the alarm (it must
// never drop smoke, or the chase breaks and the meter drains); cautious
// sneaks, waits when the next step would be seen (up to 2.5 s, then
// sidesteps), and drops a smoke pellet when a guard closes in on a chase.

import { STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_LEVEL } from './world.js';

const SHOT_SECS = {
  start: 5,
  play: 3.25,
};

const PLAY_LOOP = [
  [300, 600], [300, 470], [470, 360], [640, 370], [900, 370],
  [1080, 420], [1080, 560], [900, 560], [640, 560], [470, 470],
];

const WIN_ROUTE = [
  [300, 600], [300, 470], [470, 360], [500, 300], [500, 230],
  [538, 210], [538, 150], [640, 150], [640, 129, 4],
  [740, 150], [740, 300], [900, 500], [1100, 560], [1160, 660],
];

export function createPilot(waypoints, { cautious = false } = {}) {
  let i = 0;
  let wait = 0;
  let sideTime = 0;
  let sideDir = null;
  let smokedThisChase = false;

  function nextIntent(world, dt) {
    const p = world.player;
    if (i >= waypoints.length) return { dx: 0, dy: 0, sneak: false };

    // Smoke: once per chase, when a guard closes within 200 px.
    let smoke = false;
    const chaser = world.guards.find(
      (g) => g.state === 'chase' && Math.hypot(g.x - p.x, g.y - p.y) < 200,
    );
    if (cautious && chaser && world.smokeLeft > 0 && !smokedThisChase) {
      smoke = true;
      smokedThisChase = true;
    }
    if (!chaser) smokedThisChase = false;

    const wp = waypoints[i];
    const tx = wp[0];
    const ty = wp[1];
    const radius = wp[2] ?? 14;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= radius) {
      i += 1;
      wait = 0;
      return nextIntent(world, dt);
    }
    const dirX = dx / dist;
    const dirY = dy / dist;

    if (cautious) {
      if (sideTime > 0) {
        // Sidestepping around a cone that would not clear.
        sideTime -= dt;
        return { dx: sideDir.x, dy: sideDir.y, sneak: true, smoke };
      }
      // Probe one step ahead: would the next step be seen?
      const speed = 105; // sneak speed
      const probeX = p.x + dirX * speed * dt * 2;
      const probeY = p.y + dirY * speed * dt * 2;
      if (world.isSeenAt(probeX, probeY, true)) {
        wait += dt;
        if (wait > 2.5) {
          // Give up waiting: try a sidestep to the first side that is unseen.
          wait = 0;
          for (const sign of [1, -1]) {
            const sx = -dirY * sign;
            const sy = dirX * sign;
            if (!world.isSeenAt(p.x + sx * 50, p.y + sy * 50, true)) {
              sideDir = { x: sx, y: sy };
              sideTime = 0.6;
              return { dx: sx, dy: sy, sneak: true, smoke };
            }
          }
        }
        return { dx: 0, dy: 0, sneak: true, smoke };
      }
      wait = 0;
      return { dx: dirX, dy: dirY, sneak: true, smoke };
    }

    // Bold: walk straight at the waypoint and take whatever the alarm does.
    return { dx: dirX, dy: dirY, sneak: false };
  }

  return { intent: nextIntent };
}

function runSteps(world, pilot, seconds) {
  const steps = Math.round(seconds / STEP);
  let events = 0;
  for (let s = 0; s < steps; s++) {
    const intent = pilot ? pilot.intent(world, STEP) : {};
    events = world.step(STEP, intent);
    if (events & (EVENT_LEVEL | EVENT_CAUGHT)) break;
  }
  return events;
}

export function stageShot(name, world) {
  world.reset();
  if (name === 'start') {
    // The title panel over the room, guards on patrol.
    runSteps(world, null, SHOT_SECS.start);
    return { screen: 'title' };
  }
  if (name === 'play') {
    // The cover: mid-heist, alarm climbing, a guard in chase.
    const pilot = createPilot(PLAY_LOOP, { cautious: false });
    runSteps(world, pilot, SHOT_SECS.play);
    return { screen: 'play' };
  }
  if (name === 'alert') {
    // Straight at the sapphire until the alarm is high and a guard chases.
    const pilot = createPilot([[640, 92]], { cautious: false });
    const cap = Math.round(30 / STEP);
    for (let s = 0; s < cap; s++) {
      world.step(STEP, pilot.intent(world, STEP));
      const chasing = world.guards.some((g) => g.state === 'chase');
      if ((world.alarm >= 70 && chasing) || world.lives < 3 || world.gameOver) break;
    }
    return { screen: 'play' };
  }
  if (name === 'win') {
    // The cautious route: lift the sapphire unseen, slip out the service door.
    const pilot = createPilot(WIN_ROUTE, { cautious: true });
    const cap = Math.round(120 / STEP);
    for (let s = 0; s < cap; s++) {
      const events = world.step(STEP, pilot.intent(world, STEP));
      if (events & EVENT_LEVEL) break;
      if (events & EVENT_CAUGHT) break;
    }
    return { screen: 'level' };
  }
  return { screen: 'play' };
}
