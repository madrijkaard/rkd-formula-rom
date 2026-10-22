// Keyboard control source. Uses event.code so the layout / locale does not matter.
const HANDLED = new Set(['ShiftLeft', 'ControlLeft', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export class KeyboardSource {
  constructor(target = window) {
    this.down = new Set();
    this.onKeyDown = (e) => {
      if (HANDLED.has(e.code)) {
        this.down.add(e.code);
        e.preventDefault();
      }
    };
    this.onKeyUp = (e) => {
      if (HANDLED.has(e.code)) {
        this.down.delete(e.code);
        e.preventDefault();
      }
    };
    this.onBlur = () => this.down.clear();
    target.addEventListener('keydown', this.onKeyDown, { passive: false });
    target.addEventListener('keyup', this.onKeyUp, { passive: false });
    window.addEventListener('blur', this.onBlur);
    this.target = target;
  }

  // Returns the normalised control state of this source.
  read() {
    const d = this.down;
    return {
      steer: (d.has('ArrowRight') ? 1 : 0) - (d.has('ArrowLeft') ? 1 : 0),
      throttle: d.has('ShiftLeft') ? 1 : 0,
      brake: d.has('ControlLeft') ? 1 : 0,
    };
  }

  dispose() {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
