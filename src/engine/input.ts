import type { MoveInput } from './player';

const MOUSE_SENS = 0.0022;
const ARROW_YAW = 2.2;
const ARROW_PITCH = 1.5;
const STYLE_KEYS: Record<string, string> = {
  Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
  Numpad1: '1', Numpad2: '2', Numpad3: '3', Numpad4: '4',
};
const BLOCK_DEFAULT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export class Input {
  locked = false;
  private readonly down = new Set<string>();
  private mouseDx = 0;
  private mouseDy = 0;
  private fire = false;
  private resetPressed = false;
  private styleKey: string | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onLockChange: (locked: boolean) => void,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    canvas.addEventListener('mousedown', this.onMouseDown);
  }

  moveInput(): MoveInput {
    const k = (c: string) => (this.down.has(c) ? 1 : 0);
    return {
      forward: k('KeyW') - k('KeyS'),
      strafe: k('KeyD') - k('KeyA'),
      run: this.down.has('ShiftLeft') || this.down.has('ShiftRight'),
    };
  }

  consumeLook(dt: number): { dYaw: number; dPitch: number } {
    const k = (c: string) => (this.down.has(c) ? 1 : 0);
    const dYaw = -this.mouseDx * MOUSE_SENS + (k('ArrowLeft') - k('ArrowRight')) * ARROW_YAW * dt;
    const dPitch = -this.mouseDy * MOUSE_SENS + (k('ArrowUp') - k('ArrowDown')) * ARROW_PITCH * dt;
    this.mouseDx = 0;
    this.mouseDy = 0;
    return { dYaw, dPitch };
  }

  consumeFire(): boolean {
    const f = this.fire;
    this.fire = false;
    return f;
  }

  consumeReset(): boolean {
    const r = this.resetPressed;
    this.resetPressed = false;
    return r;
  }

  consumeStyleKey(): string | null {
    const k = this.styleKey;
    this.styleKey = null;
    return k;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
    this.down.add(e.code);
    if (e.repeat) return;
    if (e.code in STYLE_KEYS) this.styleKey = STYLE_KEYS[e.code];
    else if (e.code === 'KeyR') this.resetPressed = true;
    else if (e.code === 'Space') this.fire = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };

  private onBlur = () => {
    this.down.clear();
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    this.mouseDx += e.movementX;
    this.mouseDy += e.movementY;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (!this.locked) {
      Promise.resolve(this.canvas.requestPointerLock()).catch(() => {
        /* negado (ex.: painel automatizado): setas continuam funcionando */
      });
      return;
    }
    this.fire = true;
  };

  private onPointerLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas;
    this.onLockChange(this.locked);
  };
}
