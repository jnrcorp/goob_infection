// DOM overlay: location, interaction prompt, toast messages and debug readout.
export class Hud {
  constructor() {
    this.el = {
      location: document.getElementById('location'),
      prompt: document.getElementById('prompt'),
      toast: document.getElementById('toast'),
      debug: document.getElementById('debug'),
    };
    this.cache = {};
    this.toastTime = 0;
  }

  setText(key, text) {
    if (this.cache[key] === text) return;
    this.cache[key] = text;
    const el = this.el[key];
    el.hidden = !text;
    el.textContent = text ?? '';
  }

  setLocation(text) { this.setText('location', text); }
  setPrompt(text) { this.setText('prompt', text); }
  setDebug(text) { this.setText('debug', text); }

  toast(text, seconds = 3) {
    this.cache.toast = null;
    this.setText('toast', text);
    this.toastTime = seconds;
  }

  update(dt) {
    if (this.toastTime <= 0) return;
    this.toastTime -= dt;
    if (this.toastTime <= 0) this.setText('toast', null);
  }
}
