// levels.js — the three rooms of the Marlowe Gallery, as data only.
// Coordinates are field pixels: 0 is east, PI/2 is south (y grows downward).
// Walls are the 24 px border on every side, so no level lists them.
//
// Layout rules the levels were built to satisfy (and the tests re-check):
// every patrol leg stays clear of every blocker by at least the guard's
// 13 px radius, and every loot piece has a reachable stand within 44 px.
// The velvet ropes are placed with care: a rope across a patrol lane stalls
// that guard forever, and a rope closing both gaps around a loot pedestal
// makes the loot unreachable. The gaps beside the Gallery/Rooftop rope
// (x 516-560 and 720-764) are 44 px wide — the thief (26 px across) fits
// with 9 px to spare each side.

export const LEVELS = [
  {
    name: 'The Gallery',
    par: 75, // seconds; the time bonus counts whole seconds left under this
    start: { x: 120, y: 640 },
    exit: { x: 1140, y: 636, w: 92, h: 60, label: 'SERVICE DOOR' },
    loot: [{ name: 'Star of Marlowe', kind: 'sapphire', x: 640, y: 92, value: 500 }],
    cover: [
      { kind: 'case', x: 300, y: 280, w: 96, h: 64 },
      { kind: 'case', x: 592, y: 280, w: 96, h: 64 },
      { kind: 'case', x: 884, y: 280, w: 96, h: 64 },
      { kind: 'case', x: 420, y: 130, w: 96, h: 64 },
      { kind: 'case', x: 764, y: 130, w: 96, h: 64 },
      { kind: 'sofa', x: 150, y: 470, w: 130, h: 54 },
      { kind: 'sofa', x: 980, y: 470, w: 120, h: 54 },
      { kind: 'planter', x: 150, y: 130, w: 64, h: 64 },
      { kind: 'planter', x: 1050, y: 130, w: 60, h: 60 },
      { kind: 'pedestal', x: 600, y: 64, w: 80, h: 52 },
    ],
    ropes: [{ x: 560, y: 170, w: 160, h: 10 }],
    paintings: [
      { x: 180, y: 70, hue: 210 },
      { x: 460, y: 70, hue: 18 },
      { x: 740, y: 70, hue: 150 },
      { x: 1020, y: 70, hue: 340 },
    ],
    guards: [
      { name: 'Rook', waypoints: [[220, 420], [1060, 420]], speed: 68 },
      { name: 'Bishop', waypoints: [[1140, 140], [1140, 560]], speed: 60 },
    ],
    cameras: [
      { x: 90, y: 84, angle: 0.9, sweep: 0.55, range: 310 },
      { x: 1190, y: 84, angle: 2.24, sweep: 0.55, range: 310 },
    ],
    tools: { smoke: 2, emp: 1 },
  },
  {
    name: 'The Vault Hall',
    par: 100,
    start: { x: 120, y: 640 },
    exit: { x: 590, y: 636, w: 100, h: 60, label: 'SERVICE DOOR' },
    loot: [
      { name: 'Marlowe Portrait', kind: 'portrait', x: 180, y: 92, value: 400 },
      { name: 'Gilded Mask', kind: 'mask', x: 1100, y: 92, value: 400 },
    ],
    cover: [
      { kind: 'case', x: 300, y: 280, w: 96, h: 64 },
      { kind: 'case', x: 592, y: 280, w: 96, h: 64 },
      { kind: 'case', x: 884, y: 280, w: 96, h: 64 },
      { kind: 'case', x: 420, y: 130, w: 96, h: 64 },
      { kind: 'case', x: 764, y: 130, w: 96, h: 64 },
      { kind: 'case', x: 450, y: 480, w: 96, h: 64 },
      { kind: 'case', x: 734, y: 480, w: 96, h: 64 },
      { kind: 'sofa', x: 110, y: 480, w: 100, h: 54 },
      { kind: 'sofa', x: 1060, y: 480, w: 110, h: 54 },
      { kind: 'planter', x: 150, y: 130, w: 64, h: 64 },
      { kind: 'planter', x: 1066, y: 130, w: 64, h: 64 },
      { kind: 'pedestal', x: 140, y: 64, w: 80, h: 52 },
      { kind: 'pedestal', x: 1060, y: 64, w: 80, h: 52 },
    ],
    ropes: [
      { x: 100, y: 170, w: 120, h: 10 },
      { x: 1060, y: 170, w: 120, h: 10 },
    ],
    paintings: [
      { x: 180, y: 70, hue: 280 },
      { x: 460, y: 70, hue: 45 },
      { x: 740, y: 70, hue: 190 },
      { x: 1020, y: 70, hue: 320 },
    ],
    guards: [
      { name: 'Rook', waypoints: [[180, 400], [1100, 400]], speed: 72 },
      { name: 'Knight', waypoints: [[240, 120], [240, 560]], speed: 64 },
      { name: 'Bishop', waypoints: [[1040, 120], [1040, 560]], speed: 64 },
    ],
    cameras: [
      { x: 90, y: 84, angle: 0.9, sweep: 0.55, range: 310 },
      { x: 960, y: 84, angle: 1.57, sweep: 0.5, range: 300 },
      { x: 1190, y: 84, angle: 2.24, sweep: 0.55, range: 310 },
    ],
    tools: { smoke: 2, emp: 1 },
  },
  {
    name: 'The Rooftop',
    par: 110,
    start: { x: 120, y: 640 },
    exit: { x: 1150, y: 64, w: 90, h: 56, label: 'ZIP-LINE' },
    loot: [{ name: 'Marlowe Crown', kind: 'crown', x: 640, y: 92, value: 700 }],
    cover: [
      { kind: 'case', x: 300, y: 280, w: 96, h: 64 },
      { kind: 'case', x: 592, y: 280, w: 96, h: 64 },
      { kind: 'case', x: 884, y: 280, w: 96, h: 64 },
      { kind: 'case', x: 420, y: 130, w: 96, h: 64 },
      { kind: 'case', x: 764, y: 130, w: 96, h: 64 },
      { kind: 'sofa', x: 150, y: 470, w: 130, h: 54 },
      { kind: 'sofa', x: 1000, y: 470, w: 130, h: 54 },
      { kind: 'planter', x: 150, y: 130, w: 64, h: 64 },
      { kind: 'planter', x: 1066, y: 130, w: 64, h: 64 },
      { kind: 'pedestal', x: 600, y: 64, w: 80, h: 52 },
    ],
    ropes: [{ x: 560, y: 170, w: 160, h: 10 }],
    paintings: [
      { x: 180, y: 70, hue: 230 },
      { x: 460, y: 70, hue: 8 },
      { x: 740, y: 70, hue: 170 },
      { x: 1020, y: 70, hue: 350 },
    ],
    guards: [
      { name: 'Rook', waypoints: [[200, 380], [1080, 380]], speed: 86 },
      { name: 'Pawn', waypoints: [[200, 560], [1080, 560]], speed: 80 },
      { name: 'Knight', waypoints: [[540, 140], [540, 560]], speed: 76 },
      { name: 'Bishop', waypoints: [[740, 140], [740, 560]], speed: 76 },
    ],
    cameras: [
      { x: 90, y: 84, angle: 0.9, sweep: 0.55, range: 310 },
      { x: 1190, y: 84, angle: 2.24, sweep: 0.55, range: 310 },
      { x: 640, y: 680, angle: -1.57, sweep: 0.5, range: 300 },
    ],
    tools: { smoke: 2, emp: 1 },
  },
];
