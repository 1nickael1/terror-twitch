// Teclado e mouse → InputFrame da simulação. Bordas (usar, lanterna, arma, roda) e o giro do
// mouse acumulam até a próxima leitura; `ler()` devolve e zera.
import type { ArmaId } from '../sim/fase';
import { ORDEM_ARMAS } from '../sim/balance';
import { INPUT_VAZIO, type InputFrame } from '../sim/world';

/** radianos por pixel de mouse com sensibilidade 1 */
const MOUSE_RAD = 0.0022;
/** radianos por segundo com as setas */
const SETA_YAW = 2.2;
const SETA_PITCH = 1.5;
/** a leitura das setas não integra mais que isto (aba oculta, pausa) */
const SETA_DT_MAX = 0.1;
const TECLAS_ARMA: Record<string, number> = {
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3,
};
const SEM_PADRAO = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
/** roda: soma de deltaY (px) que vale uma troca, e espera mínima entre trocas (trackpad) */
const RODA_LIMIAR = 50;
const RODA_ESPERA_MS = 120;
/** deltaMode 1 (linhas) e 2 (páginas) em pixels aproximados */
const RODA_PX_POR_MODO = [1, 33, 400];

/** Campo de texto ou controle de formulário: as teclas dele não são do jogo. */
function ehCampo(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false;
  return alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(alvo.tagName);
}

export class Input {
  sensibilidade = 1;
  inverterY = false;
  private travado = false;
  private readonly down = new Set<string>();
  private mouseDx = 0;
  private mouseDy = 0;
  private atirando = false;
  /** toques rápidos: apertou e soltou entre duas leituras; valem na leitura seguinte */
  private clicou = false;
  private pulou = false;
  private rodaAcum = 0;
  private rodaUltima = -Infinity;
  private usar = false;
  private lanterna = false;
  private arma: ArmaId | null = null;
  private roda: -1 | 0 | 1 = 0;
  private pausa = false;
  /** Esc com o ponteiro travado: a perda da trava que vem a seguir é a mesma pausa (não conta de novo) */
  private escSoltando = false;
  private ultimaLeitura = -1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onLockChange: (travado: boolean) => void,
    /** clique no canvas (gesto do usuário): onde o áudio pode nascer */
    private readonly onGesto?: () => void,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  get estaTravado(): boolean {
    return this.travado;
  }

  /** Devolve o quadro de input e zera as bordas e o acúmulo do mouse. */
  ler(): InputFrame {
    const agora = performance.now();
    const olhar = this.espiarOlhar(agora);
    this.ultimaLeitura = agora;
    const k = (c: string) => (this.down.has(c) ? 1 : 0);
    const f: InputFrame = {
      ...INPUT_VAZIO,
      frente: k('KeyW') - k('KeyS'),
      lado: k('KeyD') - k('KeyA'),
      dYaw: olhar.dYaw,
      dPitch: olhar.dPitch,
      devagar: this.down.has('ShiftLeft') || this.down.has('ShiftRight'),
      pular: this.down.has('Space') || this.pulou,
      atirar: this.atirando || this.clicou,
      usar: this.usar,
      lanterna: this.lanterna,
      arma: this.arma,
      roda: this.roda,
    };
    this.mouseDx = 0;
    this.mouseDy = 0;
    this.usar = false;
    this.lanterna = false;
    this.arma = null;
    this.roda = 0;
    this.clicou = false;
    this.pulou = false;
    return f;
  }

  /** O que está segurado agora (para os passos 2..5 do quadro, sem os toques já entregues). */
  seguradas(): { atirar: boolean; pular: boolean } {
    return { atirar: this.atirando, pular: this.down.has('Space') };
  }

  /** Giro pendente (mouse + setas) desde a última leitura, sem zerar: a câmera mostra antes do passo. */
  espiarOlhar(agora = performance.now()): { dYaw: number; dPitch: number } {
    const dtSetas = this.ultimaLeitura < 0 ? 0 : Math.min(SETA_DT_MAX, (agora - this.ultimaLeitura) / 1000);
    const k = (c: string) => (this.down.has(c) ? 1 : 0);
    const sens = MOUSE_RAD * this.sensibilidade;
    return {
      dYaw: -this.mouseDx * sens + (k('ArrowLeft') - k('ArrowRight')) * SETA_YAW * dtSetas,
      dPitch: (this.inverterY ? 1 : -1) * this.mouseDy * sens + (k('ArrowUp') - k('ArrowDown')) * SETA_PITCH * dtSetas,
    };
  }

  /** Esc ou a perda da trava do ponteiro desde a última consulta (Esc travado + perda = uma pausa só). */
  consumirPausa(): boolean {
    const p = this.pausa;
    this.pausa = false;
    return p;
  }

  /** Descarta bordas e giro acumulados (ex.: ao voltar da pausa). */
  limparBordas(): void {
    this.mouseDx = 0;
    this.mouseDy = 0;
    this.usar = false;
    this.lanterna = false;
    this.arma = null;
    this.roda = 0;
    this.clicou = false;
    this.pulou = false;
    this.rodaAcum = 0;
    this.ultimaLeitura = -1;
  }

  pedirTrava(): void {
    if (this.travado) return;
    try {
      Promise.resolve(this.canvas.requestPointerLock()).catch(() => {
        /* negado (ex.: painel automatizado) */
      });
    } catch {
      /* navegador sem pointer lock */
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('wheel', this.onWheel);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (ehCampo(e.target)) return;
    if (this.travado && SEM_PADRAO.has(e.code)) e.preventDefault();
    this.down.add(e.code);
    if (e.repeat) return;
    if (e.code === 'Space') this.pulou = true;
    else if (e.code === 'KeyE') this.usar = true;
    else if (e.code === 'KeyF') this.lanterna = true;
    else if (e.code === 'Escape') {
      this.pausa = true;
      if (this.travado) this.escSoltando = true;
    }
    else if (e.code in TECLAS_ARMA) this.arma = ORDEM_ARMAS[TECLAS_ARMA[e.code]];
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };

  private onBlur = () => {
    this.down.clear();
    this.atirando = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.travado) return;
    this.mouseDx += e.movementX;
    this.mouseDy += e.movementY;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    this.onGesto?.();
    if (!this.travado) {
      this.pedirTrava();
      return;
    }
    this.atirando = true;
    this.clicou = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.atirando = false;
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.travado || e.deltaY === 0) return;
    e.preventDefault();
    const agora = performance.now();
    // na espera entre trocas o deltaY é descartado (o trackpad continua mandando inércia)
    if (agora - this.rodaUltima < RODA_ESPERA_MS) {
      this.rodaAcum = 0;
      return;
    }
    const dy = e.deltaY * (RODA_PX_POR_MODO[e.deltaMode] ?? 1);
    if (Math.sign(dy) !== Math.sign(this.rodaAcum)) this.rodaAcum = 0; // mudou de sentido
    this.rodaAcum += dy;
    if (Math.abs(this.rodaAcum) < RODA_LIMIAR) return;
    this.roda = this.rodaAcum > 0 ? 1 : -1;
    this.rodaAcum = 0;
    this.rodaUltima = agora;
  };

  private onPointerLockChange = () => {
    const antes = this.travado;
    this.travado = document.pointerLockElement === this.canvas;
    if (antes && !this.travado) {
      if (!this.escSoltando) this.pausa = true;
      this.atirando = false;
    }
    if (antes !== this.travado) this.escSoltando = false;
    if (antes !== this.travado) this.onLockChange(this.travado);
  };
}
