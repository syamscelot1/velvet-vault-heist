[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/c/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/syamscelot1/velvet-vault-heist/rank.svg)](https://make.fun/c/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/syamscelot1/velvet-vault-heist/reward.svg)](https://make.fun/c/best-heist-game-20261122-0559)

# Velvet Vault — The Marlowe Sapphire Heist

A top-down 2D stealth heist for the desktop browser. Wren the thief crosses
the Marlowe Gallery at night, lifts the loot from each room, and slips out
before the alarm hits the roof. Three hand-laid-out rooms in one night:

1. **The Gallery** — the Star of Marlowe sapphire.
2. **The Vault Hall** — the Marlowe Portrait and the Gilded Mask.
3. **The Rooftop** — the Marlowe Crown, then the zip-line out.

Guards patrol with vision cones and hunt the last place they saw you; cameras
sweep the floor and go dark for 8 seconds under an EMP. The alarm meter
fills while you are seen and drains while you are not — at 55 every guard
leaves its patrol to hunt you, at 100 the room is lost. Smoke pellets hide
you, sneaking is slower and quieter, and a room cleared without ever being
seen pays a 300-point ghost bonus. Three lives for the whole heist.

## How to play

Serve the game and open it in desktop Chrome:

```
node serve.ts
```

then open http://localhost:8080.

- **WASD or arrow keys** — move. **Click the floor** to walk there.
- **Hold Shift** — sneak (slower, quieter, the alarm fills half as fast).
- **Q** — drop a smoke pellet (2 per room). **E** — fire the EMP (1 per room).
- **P** — pause. **M** — mute. **Space / Enter** — confirm.
- Lift every piece of loot in a room to open the exit, then reach the exit.

All sounds are synthesised with WebAudio — there are no audio files and no
network requests. The best score is kept in localStorage.

## File map

```
main.ts                  Node 22 hand-in: copies game/ + screenshots/ to
                         /output and writes /output/dossier.json
vendor/makefun-game.ts   the kit's dossier library, unchanged
serve.ts                 a tiny static server (node serve.ts, port 8080)
game/index.html          the canvas page; loads game/src/main.js
game/src/config.js       every tuning number and colour
game/src/random.js       seeded RNG (mulberry32)
game/src/vision.js       cones, lines of sight, smoke (Liang-Barsky)
game/src/levels.js       the three rooms, as data only
game/src/world.js        the pure rules: movement, guards, alarm, loot
game/src/audio.js        synthesised sounds and the alarm ambience
game/src/input.js        keyboard, click-to-move, one-shot presses
game/src/render.js       the night gallery, cones, HUD, banners, panels
game/src/shots.js        the autopilot that stages the four screenshots
game/src/main.js         boot, fixed-step loop, screens, ?shot= mode
tests/logic.test.js      Node tests for the rules (node --test)
screenshots/            four real renders of the game's own code
shots.json               the four staged shots and their URLs
```

## Screenshots

Four staged shots, all rendered by the game's own code through
`game/index.html?shot=`:

- `1-cover.jpg` — mid-heist in the Gallery: the thief, two guards with
  vision cones, both cameras, the sapphire and the alarm meter in one frame.
- `2-title.jpg` — the title panel over the room, guards on patrol.
- `3-alert.jpg` — the alarm high, a guard in chase, the thief pressed
  against the velvet rope.
- `4-clear.jpg` — the room cleared: loot lifted, ghost run, at the exit.

## Tests

```
node tests/logic.test.js
```

14 tests: RNG determinism, walk/sneak speeds, cover and wall collision,
alarm grace/rise/decay, smoke hiding, camera sight and EMP, guard
chase/search, loot → exit → next room, the ghost bonus, alarm-100 costing a
life, deterministic replay, fair level layouts, and the four shots staging.

## Build the dossier

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`out/` then holds `dossier.json`, `game/` and `screenshots/`, ready to enter
in the make.fun competition
[best-heist-game-20261122-0559](https://make.fun/c/best-heist-game-20261122-0559).
