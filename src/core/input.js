// Keyboard + pointer-lock mouse input, polled once per frame.
const BLOCKED_WHILE_LOCKED = new Set(['Space', 'Tab', 'Backquote']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      if (this.locked && BLOCKED_WHILE_LOCKED.has(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    // Mouse buttons are reported as 'Mouse0' (left), 'Mouse2' (right), etc.
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      const code = `Mouse${e.button}`;
      this.pressed.add(code);
      this.keys.add(code);
    });
    document.addEventListener('mouseup', (e) => this.keys.delete(`Mouse${e.button}`));
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.keys.clear();
      this.onLockChange?.(this.locked);
    });
    // The browser can refuse to capture the mouse, e.g. for about a second
    // after the player pressed Esc to release it.
    document.addEventListener('pointerlockerror', () => this.onLockError?.());
  }

  lock() {
    try {
      const result = this.canvas.requestPointerLock();
      if (result?.catch) result.catch(() => this.onLockError?.());
    } catch {
      this.onLockError?.();
    }
  }

  down(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
