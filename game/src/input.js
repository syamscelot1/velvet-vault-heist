// input.js — keyboard and mouse for the heist.
// Held keys steer the thief; one-shot presses (confirm, pause, smoke, EMP,
// mute) are queued as flags and taken once by takeIntent; a click on the
// floor sets a walk target that the keys cancel. Browser defaults on game
// keys (arrow scrolling, Space scrolling) are prevented.

const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'Space', 'Enter', 'KeyQ', 'KeyE', 'KeyP', 'KeyM',
  'ShiftLeft', 'ShiftRight',
]);

export function createInput(canvas, toField) {
  const held = new Set();
  const input = {
    moveTarget: null,
    // Assigned by main.js: (x, y) in field coords -> 'smoke' | 'emp' | null.
    // A hit on a HUD tool button fires that tool instead of walking there.
    hudHit: null,
    // Assigned by main.js: called on the first gesture, to unlock audio.
    onGesture: null,

    _smoke: false,
    _emp: false,
    _confirm: false,
    _pause: false,
    _mute: false,
    _clicked: false,

    // Did the player click the canvas since the last take? Menus treat a
    // click as a confirm; in play the click already set a walk target.
    takeClick() {
      const c = this._clicked;
      this._clicked = false;
      return c;
    },

    // Build this frame's intent and consume the one-shot presses.
    takeIntent() {
      let dx = 0;
      let dy = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) dx -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) dx += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) dy -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) dy += 1;
      if (dx !== 0 || dy !== 0) this.moveTarget = null; // keys cancel a click walk
      const intent = {
        dx,
        dy,
        sneak: held.has('ShiftLeft') || held.has('ShiftRight'),
        smoke: this._smoke,
        emp: this._emp,
        moveTarget: this.moveTarget,
      };
      this._smoke = false;
      this._emp = false;
      return intent;
    },

    // One-shot presses since the last take, for menus and pause.
    takePressed() {
      const p = {
        confirm: this._confirm,
        pause: this._pause,
        mute: this._mute,
      };
      this._confirm = false;
      this._pause = false;
      this._mute = false;
      return p;
    },

    clearMoveTarget() {
      this.moveTarget = null;
    },

    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousedown', onMouseDown);
    },
  };

  function onKeyDown(e) {
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (e.repeat) return;
    held.add(e.code);
    if (e.code === 'Space' || e.code === 'Enter') input._confirm = true;
    if (e.code === 'KeyP') input._pause = true;
    if (e.code === 'KeyQ') input._smoke = true;
    if (e.code === 'KeyE') input._emp = true;
    if (e.code === 'KeyM') input._mute = true;
    if (input.onGesture) input.onGesture();
  }

  function onKeyUp(e) {
    held.delete(e.code);
  }

  function onMouseDown(e) {
    if (input.onGesture) input.onGesture();
    input._clicked = true;
    const p = toField(e.clientX, e.clientY);
    if (input.hudHit) {
      const hit = input.hudHit(p.x, p.y);
      if (hit === 'smoke') {
        input._smoke = true;
        return;
      }
      if (hit === 'emp') {
        input._emp = true;
        return;
      }
    }
    input.moveTarget = { x: p.x, y: p.y };
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  return input;
}
