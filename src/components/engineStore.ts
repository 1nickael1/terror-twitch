import { Engine, type EngineEvent } from '../engine/Engine';
import type { VisualStyle } from '../looks/types';

export interface HudSnapshot {
  pronto: boolean;
  erro: string | null;
  estilo: string;
  travado: boolean;
  /** muda a cada "pegou" para reiniciar a animação de susto */
  pegouEm: number;
}

const INICIAL: HudSnapshot = { pronto: false, erro: null, estilo: '', travado: false, pegouEm: 0 };

/** Ponte entre o motor (imperativo) e o React (useSyncExternalStore). */
export class EngineStore {
  private engine: Engine | null = null;
  private off: (() => void) | null = null;
  private snap: HudSnapshot = INICIAL;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly styles: readonly VisualStyle[]) {}

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getSnapshot = (): HudSnapshot => this.snap;

  getServerSnapshot = (): HudSnapshot => INICIAL;

  attach(canvas: HTMLCanvasElement): void {
    this.detach();
    try {
      const e = new Engine(canvas, this.styles, this.styles[0].id);
      this.engine = e;
      this.off = e.on((ev) => this.onEvent(ev));
      e.start();
      this.set({ pronto: true, erro: null, estilo: e.styleId });
    } catch (err) {
      this.set({ erro: err instanceof Error ? err.message : String(err) });
    }
  }

  detach(): void {
    this.off?.();
    this.off = null;
    this.engine?.dispose();
    this.engine = null;
    if (this.snap.pronto) this.set({ pronto: false, travado: false });
  }

  setStyle(id: string): void {
    this.engine?.setStyle(id);
  }

  reset(): void {
    this.engine?.reset();
  }

  private onEvent(ev: EngineEvent): void {
    if (ev.type === 'estilo') this.set({ estilo: ev.id });
    else if (ev.type === 'travado') this.set({ travado: ev.travado });
    else if (ev.type === 'pegou') this.set({ pegouEm: performance.now() });
  }

  private set(p: Partial<HudSnapshot>): void {
    this.snap = { ...this.snap, ...p };
    for (const l of this.listeners) l();
  }
}
