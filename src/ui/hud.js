const FLY_SECONDS = 0.8; // a new objective sliding into place

// DOM overlay: location, interaction prompt, toast messages and debug readout.
export class Hud {
  constructor() {
    this.el = {
      location: document.getElementById('location'),
      prompt: document.getElementById('prompt'),
      toast: document.getElementById('toast'),
      debug: document.getElementById('debug'),
      objective: document.getElementById('objective'),
      objectiveFly: document.getElementById('objective-fly'),
      objectiveKicker: document.getElementById('objective-kicker'),
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
  setObjective(text) {
    // A different objective replaces one that's still being announced.
    if (this.announcing && text !== this.announcing.text) this.finishAnnouncement();
    this.setText('objective', text);
  }

  // Show a new objective big in the middle of the screen, then slide it into
  // its usual place. It's a copy of the objective line, laid out exactly
  // where the real one sits (so it wraps the same), then scaled up and moved
  // to the center; clearing the transform flies it home.
  announceObjective(text) {
    this.finishAnnouncement();
    this.setObjective(text);
    const el = this.el;
    const hud = el.objective.parentElement.getBoundingClientRect();
    const home = el.objective.getBoundingClientRect();
    el.objective.style.visibility = 'hidden';

    const fly = el.objectiveFly;
    fly.textContent = text;
    fly.hidden = false;
    fly.style.transition = 'none';
    fly.style.left = `${home.left - hud.left}px`;
    fly.style.top = `${home.top - hud.top}px`;
    fly.style.width = `${home.width}px`;
    const scale = Math.max(1, Math.min(1.7, (hud.width * 0.8) / home.width, (hud.height * 0.4) / home.height));
    const dx = hud.width / 2 - (home.left - hud.left + home.width / 2);
    const dy = hud.height * 0.52 - (home.top - hud.top + home.height / 2);
    fly.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    fly.classList.remove('pop');
    void fly.offsetWidth; // restart the fade-in
    fly.classList.add('pop');

    const kicker = el.objectiveKicker;
    kicker.hidden = false;
    kicker.classList.remove('gone');
    kicker.style.top = `${hud.height * 0.52 - (home.height * scale) / 2 - 12}px`;
    // Toasts that come with the new objective go just below it, not on top of it.
    el.toast.style.top = `${hud.height * 0.52 + (home.height * scale) / 2 + 16}px`;

    // Longer objectives stay up a little longer so there's time to read them.
    const hold = Math.min(4, 1.8 + text.length * 0.02);
    this.announcing = { text, hold, time: 0, flying: false };
  }

  finishAnnouncement() {
    if (!this.announcing) return;
    this.announcing = null;
    const el = this.el;
    el.objectiveFly.hidden = true;
    el.objectiveFly.classList.remove('pop');
    el.objectiveKicker.hidden = true;
    el.objective.style.visibility = '';
    el.toast.style.top = '';
  }

  updateAnnouncement(dt) {
    const a = this.announcing;
    if (!a) return;
    a.time += dt;
    const fly = this.el.objectiveFly;
    if (!a.flying && a.time >= a.hold) {
      a.flying = true;
      fly.style.transition = `transform ${FLY_SECONDS}s cubic-bezier(0.5, 0, 0.2, 1)`;
      fly.style.transform = 'none';
      this.el.objectiveKicker.classList.add('gone');
    }
    if (a.time >= a.hold + FLY_SECONDS) this.finishAnnouncement();
  }

  // Suit integrity, plus vacuum tank and cleanup progress once you have the
  // vacuum (tank = null hides those). Pass null to hide the whole panel.
  setGoob(info) {
    const el = this.el;
    el.goob.hidden = !info;
    if (!info) return;
    const { suit, tank, capacity, infinite, cleaned, breakdown } = info;
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
    const tankText = infinite ? '∞ L' : `${Math.floor(tank)} / ${capacity} L`;
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

  // Where what's left is, by floor:
  // { title, rows: [{ area, text, fill (0-1), clear }] } or null.
  setBreakdown(breakdown) {
    const el = this.el;
    const key = breakdown ? `${breakdown.title}|${breakdown.rows.map((r) => `${r.text}:${Math.round(r.fill * 100)}`).join(',')}` : '';
    if (this.cache.breakdown === key) return;
    this.cache.breakdown = key;
    el.breakdown.hidden = !breakdown;
    if (!breakdown) return;
    el.breakdownTitle.textContent = breakdown.title;
    el.breakdownRows.replaceChildren(...breakdown.rows.map(({ area, text, fill, clear }) => {
      const row = document.createElement('div');
      row.className = 'breakdown-row';
      row.classList.toggle('clear', clear);
      const name = document.createElement('span');
      name.textContent = area;
      const bar = document.createElement('div');
      bar.className = 'breakdown-bar';
      const fillEl = document.createElement('i');
      fillEl.style.width = `${Math.min(1, fill) * 100}%`;
      bar.append(fillEl);
      const value = document.createElement('span');
      value.className = 'breakdown-value';
      value.textContent = text;
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
    this.updateAnnouncement(dt);
    if (this.toastTime <= 0) return;
    this.toastTime -= dt;
    if (this.toastTime <= 0) this.setText('toast', null);
  }
}
