// Player settings, remembered in the browser between visits.

// Listed in the order the title-screen button cycles through them.
export const DIFFICULTIES = {
  easy: {
    label: 'Easy',
    description: "Goob spreads very slowly. Infected coworkers follow you around, but never attack. The HUD shows what's left on each floor.",
    infectedOpenDoors: false,
    infectedAttack: false,
    floorBreakdown: true, // HUD shows where the goob / infected are, by floor
    goobSpread: 0.25,     // how fast goob grows and spreads (1 = full speed)
  },
  normal: {
    label: 'Normal',
    description: "Goob spreads slowly. Infected coworkers attack, but can't open doors. The HUD shows what's left on each floor.",
    infectedOpenDoors: false,
    infectedAttack: true,
    floorBreakdown: true,
    goobSpread: 0.6,
  },
  hard: {
    label: 'Hard',
    description: "Goob spreads fast. Infected coworkers attack and shove doors open, and the HUD won't tell you where anything is.",
    infectedOpenDoors: true,
    infectedAttack: true,
    floorBreakdown: false,
    goobSpread: 1,
  },
};

const KEY = 'goob-infection.settings';

export const settings = load();

export const VOLUMES = [0, 0.25, 0.5, 0.75, 1];

function load() {
  const defaults = { difficulty: 'normal', volume: 0.75 };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const merged = { ...defaults, ...saved };
    if (!DIFFICULTIES[merged.difficulty]) merged.difficulty = defaults.difficulty;
    return merged;
  } catch {
    return defaults;
  }
}

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private windows, blocked site data); the
    // setting still applies for this visit.
  }
}

export function difficulty() {
  return DIFFICULTIES[settings.difficulty];
}
