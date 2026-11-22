// audio.js — every sound is synthesised with WebAudio: no audio files, no
// network. The context is created lazily on the first gesture (browsers
// forbid sound before one), and every call is guarded so a sound failure
// can never stop the game.

export function createAudio() {
  let ctx = null;
  let master = null;
  let siren = null;
  let sirenGain = null;
  let pulse = null;
  let pulseGain = null;
  let muted = false;
  let pulseTimer = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      startAmbience();
      return true;
    } catch (e) {
      return false;
    }
  }

  // A low pulse that quickens as the alarm rises, and a siren whose gain
  // follows the meter. Both run quietly underneath the game.
  function startAmbience() {
    try {
      siren = ctx.createOscillator();
      siren.type = 'sawtooth';
      siren.frequency.value = 620;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      const sirenFilter = ctx.createBiquadFilter();
      sirenFilter.type = 'lowpass';
      sirenFilter.frequency.value = 900;
      siren.connect(sirenFilter);
      sirenFilter.connect(sirenGain);
      sirenGain.connect(master);
      siren.start();

      pulse = ctx.createOscillator();
      pulse.type = 'sine';
      pulse.frequency.value = 55;
      pulseGain = ctx.createGain();
      pulseGain.gain.value = 0;
      pulse.connect(pulseGain);
      pulseGain.connect(master);
      pulse.start();

      const tick = () => {
        if (!ctx || ctx.state !== 'running') return;
        const t = ctx.currentTime;
        pulseGain.gain.cancelScheduledValues(t);
        pulseGain.gain.setValueAtTime(0.12, t);
        pulseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      };
      const loop = () => {
        tick();
        pulseTimer = setTimeout(loop, 900);
      };
      loop();
    } catch (e) {
      // Ambience is garnish; the game plays on without it.
    }
  }

  // The alarm meter (0..100) drives the siren's loudness and the pulse rate.
  function setAlarm(level) {
    if (!ctx || !sirenGain) return;
    try {
      const t = ctx.currentTime;
      const g = level >= 55 ? 0.05 + (level - 55) / 45 * 0.06 : level > 0 ? 0.012 : 0;
      sirenGain.gain.setTargetAtTime(g, t, 0.1);
      if (pulseTimer) {
        clearTimeout(pulseTimer);
        pulseTimer = null;
      }
      const interval = Math.max(280, 950 - level * 7);
      const loop = () => {
        if (!ctx || ctx.state !== 'running') return;
        const now = ctx.currentTime;
        pulseGain.gain.cancelScheduledValues(now);
        pulseGain.gain.setValueAtTime(0.1 + level / 1000, now);
        pulseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        pulseTimer = setTimeout(loop, interval);
      };
      loop();
    } catch (e) {
      // Never let the ambience break the game.
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ensure()) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) {
      // A missed note is better than a crashed game.
    }
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!ensure()) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime + when;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = filterFreq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t);
    } catch (e) {
      // As above.
    }
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    setAlarm,
    loot() {
      tone(880, 0.14, 'sine', 0.25);
      tone(1318, 0.2, 'sine', 0.22, 0.09);
      tone(1760, 0.28, 'sine', 0.18, 0.18);
    },
    spotted() {
      tone(220, 0.35, 'sawtooth', 0.22, 0, 110);
      tone(233, 0.35, 'sawtooth', 0.18, 0.02, 116);
    },
    caught() {
      tone(98, 0.9, 'sawtooth', 0.3, 0, 49);
      tone(65, 1.1, 'triangle', 0.28, 0.1, 32);
      noise(0.7, 0.12, 300, 0);
    },
    levelClear() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, i * 0.11));
    },
    heistDone() {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.3, 'triangle', 0.22, i * 0.13));
      tone(2093, 0.6, 'sine', 0.15, 0.8);
    },
    smoke() {
      noise(0.5, 0.2, 1800, 0);
    },
    emp() {
      tone(1400, 0.3, 'square', 0.12, 0, 180);
      noise(0.25, 0.14, 3200, 0);
    },
    step(sneaking) {
      // Footsteps: soft ticks, quieter and slower while sneaking.
      noise(0.05, sneaking ? 0.03 : 0.06, sneaking ? 500 : 900, 0);
    },
    click() {
      tone(660, 0.06, 'sine', 0.12);
    },
  };
}
