const CHARS_PER_SECOND = 45;
const ADVANCE_KEYS = ['KeyE', 'Mouse0', 'Space', 'Enter'];

// Bottom-of-screen dialogue box with typewriter text.
// play([{ speaker, text }]) resolves when the last line is dismissed.
export class Dialogue {
  constructor() {
    this.box = document.getElementById('dialogue');
    this.speaker = document.getElementById('dialogue-speaker');
    this.text = document.getElementById('dialogue-text');
    this.lines = [];
    this.active = false;
    this.resolve = null;
  }

  play(lines) {
    this.close();
    this.lines = lines;
    this.index = 0;
    this.active = true;
    this.justOpened = true;
    this.box.hidden = false;
    this.showLine();
    return new Promise((resolve) => { this.resolve = resolve; });
  }

  showLine() {
    const line = this.lines[this.index];
    this.speaker.textContent = line.speaker;
    this.shown = 0;
    this.full = line.text;
    this.text.textContent = '';
  }

  // Hide without resolving (used when restarting).
  close() {
    this.active = false;
    this.box.hidden = true;
    this.resolve = null;
  }

  update(dt, input) {
    if (!this.active) return;
    if (this.shown < this.full.length) {
      this.shown = Math.min(this.full.length, this.shown + dt * CHARS_PER_SECOND);
      this.text.textContent = this.full.slice(0, Math.floor(this.shown));
    }
    // The key that opened the dialogue shouldn't also skip the first line.
    if (this.justOpened) {
      this.justOpened = false;
      return;
    }
    if (!ADVANCE_KEYS.some((k) => input.wasPressed(k))) return;

    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.text.textContent = this.full;
    } else if (++this.index < this.lines.length) {
      this.showLine();
    } else {
      const resolve = this.resolve;
      this.close();
      resolve?.();
    }
  }
}
