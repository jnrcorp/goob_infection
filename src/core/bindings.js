import { settings, saveSettings } from './settings.js';

// Rebindable controls. The game reads keys by their default codes ('KeyE',
// 'Mouse0'...); Input translates whatever you've bound an action to into
// that action's default code, so nothing else needs to know about bindings.
export const ACTIONS = [
  { id: 'forward', label: 'Move forward (car: gas)', code: 'KeyW' },
  { id: 'back', label: 'Move back (car: brake / reverse)', code: 'KeyS' },
  { id: 'left', label: 'Move left (car: steer left)', code: 'KeyA' },
  { id: 'right', label: 'Move right (car: steer right)', code: 'KeyD' },
  { id: 'run', label: 'Run', code: 'ShiftLeft', also: ['ShiftRight'] },
  { id: 'jump', label: 'Jump (car: handbrake)', code: 'Space' },
  { id: 'crouch', label: 'Crouch (sneak past guards and cameras)', code: 'KeyC' },
  { id: 'interact', label: 'Interact / talk / get in and out of the car', code: 'KeyE' },
  { id: 'vacuum', label: 'Vacuum: suck up goob (hold)', code: 'Mouse0' },
  { id: 'blast', label: 'Vacuum: air blast (stuns infected, knocks out guards)', code: 'Mouse2' },
  { id: 'antidote', label: 'Spray the antidote (hold)', code: 'KeyF' },
  { id: 'letGo', label: 'Let go of a bin', code: 'KeyQ' },
  { id: 'files', label: 'Files', code: 'KeyJ' },
];
// Keys that can't be bound (menus and debugging use them).
export const RESERVED = new Set(['Escape', 'Backquote']);

const byId = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

export function bindingOf(id) {
  return settings.bindings?.[id] ?? byId[id].code;
}

let reverse = new Map(); // bound code -> default code
let unbound = new Set(); // default codes whose action moved to another key

function rebuild() {
  reverse = new Map();
  unbound = new Set();
  for (const a of ACTIONS) {
    const bound = bindingOf(a.id);
    reverse.set(bound, a.code);
    if (bound !== a.code) for (const c of [a.code, ...(a.also ?? [])]) unbound.add(c);
    else for (const c of a.also ?? []) reverse.set(c, a.code);
  }
}
rebuild();

// The code the game should see for a physical key or button (or null: it
// does nothing now).
export function translate(code) {
  if (reverse.has(code)) return reverse.get(code);
  if (unbound.has(code)) return null;
  return code;
}

// Bind an action to a code. Whatever had that code takes this action's old one.
export function bind(id, code) {
  const old = bindingOf(id);
  const other = ACTIONS.find((a) => a.id !== id && bindingOf(a.id) === code);
  settings.bindings = { ...settings.bindings, [id]: code };
  if (other) settings.bindings[other.id] = old;
  // Keep only the ones that differ from the defaults.
  for (const a of ACTIONS) if (settings.bindings[a.id] === a.code) delete settings.bindings[a.id];
  saveSettings();
  rebuild();
  return other;
}

export function resetBindings() {
  settings.bindings = {};
  saveSettings();
  rebuild();
}

// How a code reads on screen: 'E', 'Left mouse', 'Shift'...
export function keyName(code) {
  const names = {
    Mouse0: 'Left mouse', Mouse1: 'Middle mouse', Mouse2: 'Right mouse', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5',
    ShiftLeft: 'Shift', ShiftRight: 'Right Shift', ControlLeft: 'Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Alt', AltRight: 'Right Alt',
    Space: 'Space', Enter: 'Enter', Tab: 'Tab', CapsLock: 'Caps Lock', Backspace: 'Backspace',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  };
  if (names[code]) return names[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

export function keyOf(id) {
  return keyName(bindingOf(id));
}

// Story text names the default keys ("C to crouch", "(F)", "[E]"...): swap in
// your keys where you've changed them.
export function withKeys(text) {
  if (!text || !settings.bindings || !Object.keys(settings.bindings).length) return text;
  const k = (id) => keyOf(id);
  const lower = (id) => (bindingOf(id).startsWith('Mouse') ? k(id).toLowerCase() : k(id));
  const swaps = [
    [/\[E\]/g, () => `[${k('interact')}]`],
    [/\bE: get out\b/g, () => `${k('interact')}: get out`],
    [/\(E\)/g, () => `(${k('interact')})`],
    [/\bC to crouch\b/g, () => `${k('crouch')} to crouch`],
    [/\(F\)/g, () => `(${k('antidote')})`],
    [/\bhold F\b/gi, () => `hold ${k('antidote')}`],
    [/\bright mouse\b/gi, () => lower('blast')],
    [/\bleft mouse\b/gi, () => lower('vacuum')],
    [/\bShift to run\b/g, () => `${k('run')} to run`],
    [/\bW\/S: gas and brake\b/g, () => `${k('forward')}/${k('back')}: gas and brake`],
    [/\bA\/D: steer\b/g, () => `${k('left')}/${k('right')}: steer`],
    [/\bSpace: handbrake\b/g, () => `${k('jump')}: handbrake`],
    [/\bQ lets go\b/g, () => `${k('letGo')} lets go`],
  ];
  // Two steps, so one swap's result is never swapped again (left and right
  // mouse traded places, say).
  const found = [];
  let out = text;
  for (const [re, value] of swaps) {
    out = out.replace(re, () => {
      found.push(value());
      return `\u0000${found.length - 1}\u0000`;
    });
  }
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => found[Number(i)]);
}
