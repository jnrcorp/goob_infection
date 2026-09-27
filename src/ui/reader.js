const CLOSE_KEYS = ['KeyE', 'Mouse0', 'Space', 'Enter'];

// A sheet of paper shown over the game while you read a file.
// open(file) resolves when it's closed.
export class Reader {
  constructor() {
    this.el = document.getElementById('paper');
    this.titleEl = document.getElementById('paper-title');
    this.bodyEl = document.getElementById('paper-body');
    this.active = false;
  }

  open(file) {
    this.titleEl.textContent = file.title;
    this.bodyEl.textContent = file.body;
    this.el.dataset.kind = file.kind;
    this.el.hidden = false;
    this.active = true;
    this.justOpened = true;
    return new Promise((resolve) => { this.resolve = resolve; });
  }

  close() {
    this.el.hidden = true;
    this.active = false;
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.();
  }

  update(input) {
    if (!this.active) return;
    // The key that opened it shouldn't also close it.
    if (this.justOpened) {
      this.justOpened = false;
      return;
    }
    if (CLOSE_KEYS.some((k) => input.wasPressed(k))) this.close();
  }
}
