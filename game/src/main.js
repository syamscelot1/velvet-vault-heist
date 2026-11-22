// main.js — boot and the game loop.
// Fixed 60 Hz steps with a 0.1 s cap, so a slow frame never fast-forwards
// the heist. Screens: title / play / paused / caught / level / heist /
// gameover. A ?shot=start|play|alert|win run stages that scene, draws one
// frame and sets window.__shotReady for the screenshot harness.

import { BEST_KEY, FIELD_H, FIELD_W, STEP } from './config.js';
import { createWorld, EVENT_CAUGHT, EVENT_EMP, EVENT_LEVEL, EVENT_LOOT, EVENT_SMOKE, EVENT_SPOTTED } from './world.js';
import { createRenderer, EMP_BUTTON, SMOKE_BUTTON } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = FIELD_W;
canvas.height = FIELD_H;

const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();
const statusLine = document.getElementById('status');

function toField(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * FIELD_W,
    y: ((clientY - rect.top) / rect.height) * FIELD_H,
  };
}

const input = createInput(canvas, toField);
input.onGesture = () => audio.unlock();
input.hudHit = (x, y) => {
  if (x >= SMOKE_BUTTON.x && x <= SMOKE_BUTTON.x + SMOKE_BUTTON.w &&
      y >= SMOKE_BUTTON.y && y <= SMOKE_BUTTON.y + SMOKE_BUTTON.h) return 'smoke';
  if (x >= EMP_BUTTON.x && x <= EMP_BUTTON.x + EMP_BUTTON.w &&
      y >= EMP_BUTTON.y && y <= EMP_BUTTON.y + EMP_BUTTON.h) return 'emp';
  return null;
};

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch (e) {
    return 0;
  }
}

function saveBest(score) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch (e) {
    // Best score is a nicety; the heist plays on without it.
  }
}

const ui = {
  screen: 'title',
  banner: '',
  bannerT: 0,
  bannerColor: '',
  time: 0,
  best: loadBest(),
};

function setBanner(text, color, seconds = 1.4) {
  ui.banner = text;
  ui.bannerColor = color || '#f5e9c8';
  ui.bannerT = seconds;
}

function describeStatus() {
  // A visually-hidden line for screen readers, updated every frame.
  const w = world;
  statusLine.textContent =
    `Room ${w.levelIndex + 1} of 3, ${w.level.name}. Score ${w.score}. ` +
    `Loot ${w.lootTaken} of ${w.loot.length}. Alarm ${Math.floor(w.alarm)} percent. ` +
    `${w.lives} lives left. ${w.exitOpen ? 'The exit is open.' : 'Lift all the loot to open the exit.'}`;
}

// A debug handle for the play-test harness (and curious players): the live
// world and UI state, read-only by convention. The game never reads it.
window.__velvetVault = { world, ui };

// --- the ?shot= mode: one staged frame, then stop -----------------------
const shotName = new URLSearchParams(location.search).get('shot');
if (shotName) {
  const staged = stageShot(shotName, world);
  ui.screen = staged.screen;
  ui.time = world.elapsed;
  renderer.render(world, ui);
  describeStatus();
  window.__shotReady = true;
} else {
  // --- the live game ------------------------------------------------------
  let last = performance.now();
  let acc = 0;
  let stepDistance = 0;
  let lastX = world.player.x;
  let lastY = world.player.y;

  function confirm() {
    if (ui.screen === 'title') {
      world.reset();
      ui.screen = 'play';
      audio.unlock();
    } else if (ui.screen === 'caught') {
      ui.screen = 'play';
    } else if (ui.screen === 'level') {
      const next = world.advance();
      if (next === 'heist') {
        ui.screen = 'heist';
        audio.heistDone();
        if (world.score > ui.best) {
          ui.best = world.score;
          saveBest(world.score);
        }
      } else {
        ui.screen = 'play';
      }
    } else if (ui.screen === 'heist' || ui.screen === 'gameover') {
      world.reset();
      ui.screen = 'title';
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    ui.time += dt;
    if (ui.bannerT > 0) ui.bannerT -= dt;

    const pressed = input.takePressed();
    if (pressed.mute) {
      const muted = audio.toggleMute();
      setBanner(muted ? 'MUTED' : 'SOUND ON', '#f5e9c8', 0.8);
    }
    if (pressed.confirm) confirm();
    if (pressed.pause && (ui.screen === 'play' || ui.screen === 'paused')) {
      ui.screen = ui.screen === 'play' ? 'paused' : 'play';
    }
    if (input.takeClick() && ui.screen !== 'play' && ui.screen !== 'paused') {
      confirm();
    }

    if (ui.screen === 'play') {
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        const events = world.step(STEP, input.takeIntent());
        if (events & EVENT_LOOT) {
          audio.loot();
          setBanner('LOOT SECURED!', '#ffd34d');
        }
        if (events & EVENT_SPOTTED) {
          audio.spotted();
          setBanner('SPOTTED!', '#ff4030');
        }
        if (events & EVENT_SMOKE) audio.smoke();
        if (events & EVENT_EMP) {
          audio.emp();
          setBanner('CAMERAS DARK — 8s', '#9fd8ff');
        }
        if (events & EVENT_CAUGHT) {
          audio.caught();
          if (world.gameOver) {
            ui.screen = 'gameover';
            if (world.score > ui.best) {
              ui.best = world.score;
              saveBest(world.score);
            }
          } else {
            ui.screen = 'caught';
            setBanner('', '', 0);
          }
        }
        if (events & EVENT_LEVEL) {
          audio.levelClear();
          ui.screen = 'level';
        }
        // Footsteps: a soft tick every stretch of floor covered.
        stepDistance += Math.hypot(world.player.x - lastX, world.player.y - lastY);
        lastX = world.player.x;
        lastY = world.player.y;
        if (stepDistance > 30) {
          stepDistance = 0;
          audio.step(world.sneaking);
        }
      }
      audio.setAlarm(world.alarm);
    }

    renderer.render(world, ui);
    describeStatus();
  }

  requestAnimationFrame(frame);
}
