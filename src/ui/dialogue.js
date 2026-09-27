const CHARS_PER_SECOND = 45;
const ADVANCE_KEYS = ['KeyE', 'Mouse0', 'Space', 'Enter'];
const CHOICE_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];

// Bottom-of-screen dialogue box with typewriter text.
// play([{ speaker, text }]) resolves when the last line is dismissed.
// play(lines, choices) shows the choices after the last line and resolves
// with the index of the one picked (number keys 1–4).
export class Dialogue {
  constructor() {
    this.box = document.getElementById('dialogue');
    this.speaker = document.getElementById('dialogue-speaker');
    this.text = document.getElementById('dialogue-text');
    this.choicesEl = document.getElementById('dialogue-choices');
    this.moreEl = this.box.querySelector('.more');
    this.lines = [];
    this.choices = null;
    this.active = false;
    this.resolve = null;
  }

  play(lines, choices = null) {
    this.close();
    this.lines = lines;
    this.choices = choices;
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
    this.choicesEl.hidden = true;
    this.moreEl.hidden = false;
  }

  get onLastLine() {
    return this.index === this.lines.length - 1;
  }

  // Hide without resolving (used when restarting).
  close() {
    this.active = false;
    this.box.hidden = true;
    this.choicesEl.hidden = true;
    this.resolve = null;
  }

  finish(result) {
    const resolve = this.resolve;
    this.close();
    resolve?.(result);
  }

  update(dt, input) {
    if (!this.active) return;
    if (this.shown < this.full.length) {
      this.shown = Math.min(this.full.length, this.shown + dt * CHARS_PER_SECOND);
      this.text.textContent = this.full.slice(0, Math.floor(this.shown));
    }
    const lineDone = this.shown >= this.full.length;

    // Last line fully shown and there's a decision to make: show the options.
    if (this.choices && this.onLastLine && lineDone && this.choicesEl.hidden) {
      this.choicesEl.textContent = this.choices.map((c, i) => `[${i + 1}] ${c}`).join('     ');
      this.choicesEl.hidden = false;
      this.moreEl.hidden = true;
    }

    // The key that opened the dialogue shouldn't also skip the first line.
    if (this.justOpened) {
      this.justOpened = false;
      return;
    }

    if (!this.choicesEl.hidden) {
      const picked = CHOICE_KEYS.findIndex((k, i) => i < this.choices.length && input.wasPressed(k));
      if (picked >= 0) this.finish(picked);
      return;
    }

    if (!ADVANCE_KEYS.some((k) => input.wasPressed(k))) return;
    if (!lineDone) {
      this.shown = this.full.length;
      this.text.textContent = this.full;
    } else if (++this.index < this.lines.length) {
      this.showLine();
    } else if (!this.choices) {
      this.finish();
    }
  }
}
