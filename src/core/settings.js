// Player settings, remembered in the browser between visits.

// Listed in the order the title-screen button cycles through them.
export const DIFFICULTIES = {
  easy: {
    label: 'Easy',
    description: "Infected coworkers follow you around, but they never attack. The HUD shows how much is left on each floor.",
    infectedOpenDoors: false,
    infectedAttack: false,
    floorBreakdown: true, // HUD shows where the goob / infected are, by floor
  },
  normal: {
    label: 'Normal',
    description: "Infected coworkers attack, but can't open doors. The HUD shows how much is left on each floor.",
    infectedOpenDoors: false,
    infectedAttack: true,
    floorBreakdown: true,
  },
  hard: {
    label: 'Hard',
    description: "Infected coworkers attack and shove doors open, and the HUD won't tell you where they are.",
    infectedOpenDoors: true,
    infectedAttack: true,
    floorBreakdown: false,
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
