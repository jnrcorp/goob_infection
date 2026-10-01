// All game audio, synthesized with WebAudio (no sound files).
// Loops (hum, vacuum, spray, breathing) are faded in and out each frame by
// setLoops(); one-shots are played with sfx.name(position?).
// Sounds with a position are quieter and panned by distance and direction
// from the listener.

let ctx = null;
let master = null;
let noiseBuffer = null;
const loops = {};
const listener = { x: 0, y: 0, z: 0, yaw: 0 };
let volume = 0.7;

// Browsers only allow audio after a click or key press, so this is called
// from the title screen buttons.
export function startAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return; // no audio support
  }
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < data.length; i++) {
    // Mostly white noise with a little low rumble mixed in.
    brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = (Math.random() * 2 - 1) * 0.7 + brown * 3;
  }
  buildLoops();
}

export function setVolume(v) {
  volume = v;
  if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

// Pause the whole mix (menus).
export function setMuted(muted) {
  if (!ctx) return;
  if (muted && ctx.state === 'running') ctx.suspend();
  if (!muted && ctx.state === 'suspended') ctx.resume();
}

export function setListener(x, y, z, yaw) {
  Object.assign(listener, { x, y, z, yaw });
}

// ---------- Building blocks ----------

function noiseSource() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  return src;
}

function filter(type, frequency, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

// Output node for a sound: plain, or quieter and panned by position.
function output(pos, gain = 1, range = 18) {
  const g = ctx.createGain();
  if (!pos) {
    g.gain.value = gain;
    g.connect(master);
    return g;
  }
  const dx = pos.x - listener.x;
  const dz = pos.z - listener.z;
  const dy = (pos.y ?? listener.y) - listener.y;
  const dist = Math.hypot(dx, dz, dy * 1.5); // other floors sound further away
  if (dist > range) return null;
  g.gain.value = gain * Math.min(1, 1.5 / (1 + dist * 0.35)) * (1 - dist / range);
  const panner = ctx.createStereoPanner();
  // Listener faces -z at yaw 0; right is +x.
  const right = dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw);
  panner.pan.value = Math.max(-0.9, Math.min(0.9, right / Math.max(dist, 1)));
  g.connect(panner).connect(master);
  return g;
}

// Envelope: attack to peak, then decay to silence.
function envelope(param, peak, attack, decay, at = ctx.currentTime) {
  param.setValueAtTime(0.0001, at);
  param.exponentialRampToValueAtTime(peak, at + attack);
  param.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

function tone({ type = 'sine', freq, to = null, dur, gain = 0.2, attack = 0.005, pos = null, delay = 0, range }) {
  if (!ctx) return;
  const out = output(pos, 1, range);
  if (!out) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  envelope(g.gain, gain, attack, dur, t);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + attack + dur + 0.05);
}

function burst({ type = 'bandpass', freq, to = null, q = 1, dur, gain = 0.3, attack = 0.005, pos = null, delay = 0, range }) {
  if (!ctx) return;
  const out = output(pos, 1, range);
  if (!out) return;
  const t = ctx.currentTime + delay;
  const src = noiseSource();
  const f = filter(type, freq, q);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  envelope(g.gain, gain, attack, dur, t);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random());
  src.stop(t + attack + dur + 0.05);
}

// ---------- Loops ----------

function loop(name, build) {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(master);
  build(gain);
  loops[name] = gain;
}

function buildLoops() {
  // Office: fluorescent 60 Hz hum and a soft air-handling rumble.
  loop('hum', (out) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = 60;
    const og = ctx.createGain();
    og.gain.value = 0.25;
    osc.connect(og).connect(out);
    osc.start();
    const air = noiseSource();
    air.connect(filter('lowpass', 260)).connect(out);
    air.start();
  });
  // Vacuum: whining motor plus rushing air.
  loop('vacuum', (out) => {
    const motor = ctx.createOscillator();
    motor.type = 'sawtooth';
    motor.frequency.value = 180;
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 7;
    const wg = ctx.createGain();
    wg.gain.value = 6;
    wobble.connect(wg).connect(motor.frequency);
    const mg = ctx.createGain();
    mg.gain.value = 0.12;
    motor.connect(filter('lowpass', 1400)).connect(mg).connect(out);
    motor.start();
    wobble.start();
    const air = noiseSource();
    air.connect(filter('bandpass', 1800, 0.7)).connect(out);
    air.start();
  });
  // Car engine: a low growl whose pitch follows the revs (see setEngine).
  loop('engine', (out) => {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 38;
    const sub = ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 19;
    engineSub = sub;
    const eg = ctx.createGain();
    eg.gain.value = 0.5;
    const sg = ctx.createGain();
    sg.gain.value = 0.25;
    engineOsc.connect(filter('lowpass', 420, 2)).connect(eg).connect(out);
    sub.connect(filter('lowpass', 160)).connect(sg).connect(out);
    engineOsc.start();
    sub.start();
  });
  // Antidote spray: steady hiss.
  loop('spray', (out) => {
    const hiss = noiseSource();
    hiss.connect(filter('highpass', 3500)).connect(out);
    hiss.start();
  });
  // Breathing inside the suit: slow in-and-out swells of muffled noise.
  loop('breath', (out) => {
    const air = noiseSource();
    const swell = ctx.createGain();
    swell.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.28; // about one breath every 3.5 s
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(swell.gain);
    air.connect(filter('bandpass', 700, 1.4)).connect(swell).connect(out);
    air.start();
    lfo.start();
  });
}

// Fade each loop toward a target level (0 = off).
export function setLoops({ hum = 0, vacuum = 0, spray = 0, breath = 0, engine = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const set = (name, v) => loops[name]?.gain.setTargetAtTime(v, t, 0.08);
  set('engine', engine * 0.22);
  set('hum', hum * 0.05);
  set('vacuum', vacuum * 0.35);
  set('spray', spray * 0.12);
  set('breath', breath * 0.1);
}

// Engine pitch: revs 0 (idle) to 1 (flat out).
let engineOsc = null;
let engineSub = null;
export function setEngine(revs) {
  if (!engineOsc) return;
  const t = ctx.currentTime;
  engineOsc.frequency.setTargetAtTime(38 + revs * 95, t, 0.1);
  engineSub.frequency.setTargetAtTime(19 + revs * 47, t, 0.1);
}

// ---------- One-shots ----------

export const sfx = {
  ui: () => tone({ type: 'square', freq: 880, to: 1320, dur: 0.06, gain: 0.05 }),
  step: (pos) => burst({ type: 'lowpass', freq: 500, dur: 0.07, gain: 0.07, pos, range: 10 }),
  door: (pos) => {
    tone({ type: 'sawtooth', freq: 140, to: 95, dur: 0.35, gain: 0.04, attack: 0.05, pos });
    burst({ type: 'lowpass', freq: 300, dur: 0.12, gain: 0.12, pos, delay: 0.3 });
  },
  pickup: () => {
    tone({ freq: 660, dur: 0.1, gain: 0.08 });
    tone({ freq: 990, dur: 0.15, gain: 0.08, delay: 0.08 });
  },
  squelch: (pos) => {
    tone({ freq: 320, to: 90, dur: 0.18, gain: 0.12, pos, range: 12 });
    burst({ freq: 900, to: 300, q: 2, dur: 0.15, gain: 0.12, pos, range: 12 });
  },
  blast: () => {
    burst({ type: 'lowpass', freq: 2500, to: 200, dur: 0.45, gain: 0.45, attack: 0.01 });
    tone({ type: 'sine', freq: 90, to: 40, dur: 0.3, gain: 0.25 });
  },
  hurt: () => {
    tone({ type: 'square', freq: 110, to: 55, dur: 0.25, gain: 0.15 });
    burst({ type: 'lowpass', freq: 800, dur: 0.2, gain: 0.3 });
  },
  moan: (pos, pitch = 1) => {
    if (!ctx) return;
    const out = output(pos, 0.9, 20);
    if (!out) return;
    const t = ctx.currentTime;
    const dur = 1.2 + Math.random() * 0.8;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const base = (95 + Math.random() * 40) * pitch;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * 0.8, t + dur);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5 + Math.random() * 2;
    const vg = ctx.createGain();
    vg.gain.value = base * 0.04;
    vib.connect(vg).connect(osc.frequency);
    const g = ctx.createGain();
    envelope(g.gain, 0.12, 0.25, dur, t);
    osc.connect(filter('lowpass', 700, 3)).connect(g).connect(out);
    osc.start(t);
    vib.start(t);
    osc.stop(t + dur + 0.4);
    vib.stop(t + dur + 0.4);
  },
  lunge: (pos) => burst({ freq: 400, to: 150, q: 3, dur: 0.3, gain: 0.25, pos }),
  bin: (pos) => {
    tone({ type: 'triangle', freq: 180, to: 120, dur: 0.25, gain: 0.2, pos });
    burst({ type: 'lowpass', freq: 600, dur: 0.15, gain: 0.25, pos });
  },
  pour: () => burst({ freq: 500, to: 150, q: 1.5, dur: 0.9, gain: 0.25, attack: 0.1 }),
  elevator: (pos) => {
    tone({ freq: 1046, dur: 0.5, gain: 0.12, pos });
    tone({ freq: 784, dur: 0.7, gain: 0.12, pos, delay: 0.25 });
  },
  cure: (pos) => {
    [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.3, gain: 0.1, delay: i * 0.07, pos }));
  },
  smash: () => {
    burst({ type: 'highpass', freq: 3000, dur: 0.6, gain: 0.5 });
    burst({ type: 'lowpass', freq: 600, to: 120, dur: 0.8, gain: 0.5 });
    tone({ freq: 220, to: 60, dur: 0.5, gain: 0.3 });
  },
  lock: () => {
    tone({ type: 'square', freq: 200, dur: 0.05, gain: 0.12 });
    tone({ type: 'square', freq: 140, dur: 0.12, gain: 0.15, delay: 0.1 });
    burst({ type: 'lowpass', freq: 400, dur: 0.3, gain: 0.35, delay: 0.1 });
  },
  breach: () => {
    burst({ freq: 700, to: 200, q: 1, dur: 1.4, gain: 0.4, attack: 0.05 });
    tone({ type: 'sawtooth', freq: 300, to: 60, dur: 1.4, gain: 0.12 });
  },
  // Morning at home.
  alarm: (pos) => {
    for (let i = 0; i < 4; i++) tone({ type: 'square', freq: 1760, dur: 0.07, gain: 0.07, delay: i * 0.12, pos, range: 30 });
  },
  water: () => burst({ type: 'bandpass', freq: 2400, q: 0.6, dur: 1.4, gain: 0.18, attack: 0.15 }),
  coffee: () => {
    burst({ freq: 700, to: 300, q: 2, dur: 1.2, gain: 0.18, attack: 0.1 });
    tone({ freq: 90, to: 70, dur: 0.8, gain: 0.08, delay: 0.2 });
  },
  ding: () => {
    burst({ type: 'lowpass', freq: 900, dur: 0.08, gain: 0.2 });
    tone({ freq: 2093, dur: 0.6, gain: 0.08, delay: 0.1 });
  },
  rustle: () => burst({ type: 'bandpass', freq: 1400, q: 0.8, dur: 0.7, gain: 0.14, attack: 0.1 }),
  keys: () => [2600, 3100, 2900].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.08, gain: 0.05, delay: i * 0.06 })),
  carDoor: () => {
    burst({ type: 'lowpass', freq: 500, dur: 0.18, gain: 0.35 });
    tone({ type: 'triangle', freq: 110, to: 70, dur: 0.15, gain: 0.15 });
  },
  crash: () => {
    burst({ type: 'lowpass', freq: 900, to: 150, dur: 0.35, gain: 0.45 });
    tone({ type: 'triangle', freq: 90, to: 50, dur: 0.3, gain: 0.25 });
  },
  gate: () => {
    tone({ type: 'sawtooth', freq: 90, to: 70, dur: 0.9, gain: 0.05, attack: 0.1 });
    burst({ type: 'lowpass', freq: 400, dur: 0.25, gain: 0.3, delay: 0.85 });
  },
  // Building lockdown: a two-tone klaxon (repeat it every couple of seconds).
  klaxon: () => {
    tone({ type: 'sawtooth', freq: 520, dur: 0.45, gain: 0.07, attack: 0.03 });
    tone({ type: 'sawtooth', freq: 390, dur: 0.45, gain: 0.07, attack: 0.03, delay: 0.5 });
  },
  // A police siren wailing up and down, from pos (repeat it).
  siren: (pos) => {
    tone({ type: 'triangle', freq: 650, to: 1300, dur: 0.9, gain: 0.08, attack: 0.1, pos, range: 60 });
    tone({ type: 'triangle', freq: 1300, to: 650, dur: 0.9, gain: 0.08, attack: 0.05, pos, range: 60, delay: 1.0 });
  },
  intercom: () => {
    tone({ type: 'square', freq: 1200, dur: 0.08, gain: 0.05 });
    burst({ type: 'bandpass', freq: 2000, q: 4, dur: 0.3, gain: 0.08, delay: 0.1 });
  },
};
