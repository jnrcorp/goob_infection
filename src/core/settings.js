// Player settings, remembered in the browser between visits.

export const DIFFICULTIES = {
  normal: {
    label: 'Normal',
    description: "Infected coworkers can't open doors.",
    infectedOpenDoors: false,
  },
  hard: {
    label: 'Hard',
    description: 'Infected coworkers shove doors open to get to you.',
    infectedOpenDoors: true,
  },
};

const KEY = 'goob-infection.settings';

export const settings = load();

function load() {
  const defaults = { difficulty: 'normal' };
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
