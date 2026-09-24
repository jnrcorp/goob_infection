// DOM overlay: location, interaction prompt, toast messages and debug readout.
export class Hud {
  constructor() {
    this.el = {
      location: document.getElementById('location'),
      prompt: document.getElementById('prompt'),
      toast: document.getElementById('toast'),
      debug: document.getElementById('debug'),
      objective: document.getElementById('objective'),
      goob: document.getElementById('goob-hud'),
      tankFill: document.getElementById('tank-fill'),
      tankText: document.getElementById('tank-text'),
      cleaned: document.getElementById('cleaned-text'),
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
  setObjective(text) { this.setText('objective', text); }

  // Vacuum tank and cleanup progress; pass null to hide.
  setGoob(info) {
    const el = this.el;
    el.goob.hidden = !info;
    if (!info) return;
    const { tank, capacity, cleaned } = info;
    const tankText = `${Math.floor(tank)} / ${capacity} L`;
    if (this.cache.tank !== tankText) {
      this.cache.tank = tankText;
      el.tankText.textContent = tankText;
      el.tankFill.style.width = `${(tank / capacity) * 100}%`;
      el.goob.classList.toggle('full', tank >= capacity - 1e-3);
    }
    const cleanedText = `${Math.floor(cleaned)}%`;
    if (this.cache.cleaned !== cleanedText) {
      this.cache.cleaned = cleanedText;
      el.cleaned.textContent = cleanedText;
    }
  }

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
