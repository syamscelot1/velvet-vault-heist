// config.js — every tuning number and colour for Velvet Vault, in one place.
// The world, the renderer and the shot autopilot all read from here, so a balance
// change never means hunting the same number through three files.

export const FIELD_W = 1280;
export const FIELD_H = 720;
export const WALL = 24; // border thickness, px, on all four sides
export const STEP = 1 / 60; // fixed simulation step, seconds

// The thief.
export const PLAYER_R = 13;
export const WALK_SPEED = 235; // px/s
export const SNEAK_SPEED = 105; // px/s, hold Shift
export const SNEAK_RANGE = 0.62; // detectors see a sneaking thief at 0.62x range
export const SNEAK_ALARM = 0.5; // the alarm fills half as fast while sneaking
export const LIVES = 3; // lives for the whole heist, not per room

// The alarm meter, 0..100.
export const SPOT_GRACE = 0.7; // seconds of grace on the first sighting
export const ALARM_GUARD_RATE = 42; // per second, while a guard sees the thief
export const ALARM_CAMERA_RATE = 34; // per second, while only a camera sees them
export const ALARM_DECAY = 5; // per second, while nobody sees them
export const HUNT_ALARM = 55; // at this level every guard hunts the last seen spot
export const ALARM_MAX = 100; // at this level the room is lost

// Guards.
export const GUARD_PATROL_SPEED = 68; // default; each level sets its own
export const GUARD_CHASE_SPEED = 148;
export const GUARD_SEARCH_SPEED = 95;
export const GUARD_RETURN_SPEED = 85;
export const GUARD_RANGE = 265;
export const GUARD_FOV = 0.72; // radians, full cone width
export const CATCH_RADIUS = 26; // a guard this close catches the thief
export const SEARCH_TIME = 3.2; // seconds a guard stares at the last seen spot
export const TURN_SPEED = 3.4; // rad/s, how fast a guard turns its head

// Cameras.
export const CAMERA_RANGE = 310;
export const CAMERA_FOV = 0.62; // radians, full cone width
export const CAMERA_SWEEP_TIME = 3.4; // seconds for one full sweep cycle

// Tools, refilled every room.
export const SMOKE_COUNT = 2; // pellets per room
export const SMOKE_RADIUS = 95;
export const SMOKE_TIME = 4.5; // seconds a cloud lasts
export const EMP_COUNT = 1; // charges per room
export const EMP_TIME = 8; // seconds the cameras stay dark

// Loot and the exit.
export const LOOT_RADIUS = 44; // walk this close to lift a piece
export const SCORE_GHOST = 300; // clearing a room without ever being seen
export const SCORE_TIME_PER_SEC = 10; // per whole second left under the room's par
export const SCORE_LIFE = 150; // per life left when the heist ends

// Deterministic seed: every run of the same inputs plays out the same way.
export const SEED = 20261122;
export const BEST_KEY = 'velvet-vault.best'; // localStorage key for the best score

// The night-gallery palette: marble, crimson carpet, gold trim. Danger reads
// amber and red, cover reads shadow, loot reads gold.
export const COLORS = {
  floorA: '#2c2537',
  floorB: '#241f2f',
  carpet: '#7a1f2b',
  carpetEdge: '#c9a227',
  wall: '#171221',
  wallTrim: '#c9a227',
  paintingFrame: '#8a6d3b',
  caseGlass: '#a8d8e2',
  caseFrame: '#6b5636',
  sofa: '#6e1b26',
  planter: '#2e5d3a',
  planterPot: '#7a4a21',
  pedestal: '#cfc4ae',
  rope: '#a4123f',
  ropePost: '#d4af37',
  loot: '#ffd34d',
  lootGlow: 'rgba(255, 211, 77, 0.35)',
  thief: '#35a7ff',
  thiefRing: '#ffd34d',
  guard: '#3a3f4a',
  guardSuit: '#23262e',
  coneCalm: 'rgba(255, 176, 32, 0.20)',
  coneCalmEdge: 'rgba(255, 176, 32, 0.55)',
  coneAlert: 'rgba(255, 64, 48, 0.28)',
  coneAlertEdge: 'rgba(255, 64, 48, 0.75)',
  cameraCone: 'rgba(255, 220, 120, 0.16)',
  cameraConeEdge: 'rgba(255, 220, 120, 0.5)',
  camera: '#8f96a3',
  smoke: 'rgba(200, 200, 210, 0.45)',
  exitOpen: '#37d67a',
  exitShut: '#c0392b',
  hudBg: '#120d1a',
  hudText: '#f5e9c8',
  hudDim: '#b8a888',
  alarmLow: '#37d67a',
  alarmMid: '#ffb020',
  alarmHigh: '#ff4030',
};
