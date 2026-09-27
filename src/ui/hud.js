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
      suitFill: document.getElementById('suit-fill'),
      suitText: document.getElementById('suit-text'),
      tankRow: document.getElementById('tank-row'),
      cleanedRow: document.getElementById('cleaned-row'),
      visor: document.getElementById('visor'),
      tankFill: document.getElementById('tank-fill'),
      tankText: document.getElementById('tank-text'),
      cleaned: document.getElementById('cleaned-text'),
      breakdown: document.getElementById('floor-breakdown'),
      breakdownTitle: document.getElementById('floor-breakdown-title'),
      breakdownRows: document.getElementById('floor-breakdown-rows'),
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

  // Suit integrity, plus vacuum tank and cleanup progress once you have the
  // vacuum (tank = null hides those). Pass null to hide the whole panel.
  setGoob(info) {
    const el = this.el;
    el.goob.hidden = !info;
    if (!info) return;
    const { suit, tank, capacity, cleaned, breakdown } = info;
    this.setBreakdown(breakdown);
    const suitText = `${Math.ceil(suit)}%`;
    if (this.cache.suit !== suitText) {
      this.cache.suit = suitText;
      el.suitText.textContent = suitText;
      el.suitFill.style.width = `${suit}%`;
      el.goob.classList.toggle('suit-low', suit <= 35);
      el.visor.classList.toggle('cracked', suit <= 60);
      el.visor.classList.toggle('shattered', suit <= 30);
    }
    el.tankRow.hidden = el.cleanedRow.hidden = tank === null;
    if (tank === null) return;
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

  // Where what's left is, by floor: { title, rows: [{ area, percent }] } or null.
  setBreakdown(breakdown) {
    const el = this.el;
    const key = breakdown ? `${breakdown.title}|${breakdown.rows.map((r) => Math.round(r.percent)).join(',')}` : '';
    if (this.cache.breakdown === key) return;
    this.cache.breakdown = key;
    el.breakdown.hidden = !breakdown;
    if (!breakdown) return;
    el.breakdownTitle.textContent = breakdown.title;
    el.breakdownRows.replaceChildren(...breakdown.rows.map(({ area, percent }) => {
      const row = document.createElement('div');
      row.className = 'breakdown-row';
      row.classList.toggle('clear', percent < 0.5);
      const name = document.createElement('span');
      name.textContent = area;
      const bar = document.createElement('div');
      bar.className = 'breakdown-bar';
      const fill = document.createElement('i');
      fill.style.width = `${percent}%`;
      bar.append(fill);
      const value = document.createElement('span');
      value.className = 'breakdown-value';
      value.textContent = `${Math.round(percent)}%`;
      row.append(name, bar, value);
      return row;
    }));
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
