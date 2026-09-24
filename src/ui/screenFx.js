// Full-screen effects: fade to/from black and the hazard suit visor frame.
// Fades advance in update(), so they follow game time.
export class ScreenFx {
  constructor() {
    this.fadeEl = document.getElementById('fade');
    this.visorEl = document.getElementById('visor');
    this.opacity = 0;
    this.fading = null;
  }

  // Fade to opacity (0 = clear, 1 = black) over the given seconds.
  fade(opacity, seconds = 0.6) {
    this.fading?.resolve();
    if (seconds <= 0) {
      this.fading = null;
      this.setOpacity(opacity);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.fading = { from: this.opacity, to: opacity, duration: seconds, t: 0, resolve };
    });
  }

  update(dt) {
    const f = this.fading;
    if (!f) return;
    f.t = Math.min(f.duration, f.t + dt);
    this.setOpacity(f.from + (f.to - f.from) * (f.t / f.duration));
    if (f.t >= f.duration) {
      this.fading = null;
      f.resolve();
    }
  }

  setOpacity(value) {
    this.opacity = value;
    this.fadeEl.style.opacity = String(value);
  }

  setVisor(on) {
    this.visorEl.hidden = !on;
  }
}
