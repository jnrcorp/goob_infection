// The autosave: the latest checkpoint, kept in the browser so "Continue"
// works after closing the tab.

const KEY = 'goob-infection.save';
// Bump when the world changes shape (rooms, cast, bins): older saves are
// ignored rather than restored into a building they don't match.
const VERSION = 2;

export function saveGame(checkpoint) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, savedAt: Date.now(), checkpoint }));
  } catch {
    // Storage unavailable or full: the checkpoint still works for this visit.
  }
}

// The saved checkpoint, or null if there isn't a usable one.
export function loadGame() {
  try {
    const save = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return save?.version === VERSION && save.checkpoint ? save.checkpoint : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
