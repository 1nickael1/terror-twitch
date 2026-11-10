// Só em desenvolvimento: `window.__scp` para inspeção pelo console e playtest automatizado.
import type { World } from '../sim/world';

interface Acesso {
  world: () => World | null;
  lerSemTrava: () => boolean;
  definirSemTrava: (v: boolean) => void;
  /** mixer de áudio (`__scp.mixer`: `ctx.state`, `vozesAtivas`) */
  mixer?: () => object | null;
}

/** Expõe `__scp = { engine, world, jogarSemTrava, mixer }`; devolve a função que remove (se ainda for o dono). */
export function exporDepuracao(engine: object, a: Acesso): () => void {
  const scp = { engine };
  Object.defineProperty(scp, 'world', { get: a.world, enumerable: true });
  // roda a simulação sem o ponteiro travado (setas para olhar)
  Object.defineProperty(scp, 'jogarSemTrava', {
    get: a.lerSemTrava,
    set: (v: unknown) => a.definirSemTrava(!!v),
    enumerable: true,
  });
  if (a.mixer) Object.defineProperty(scp, 'mixer', { get: a.mixer, enumerable: true });
  const w = window as unknown as { __scp?: { engine?: unknown } };
  w.__scp = scp;
  return () => {
    if (w.__scp?.engine === engine) delete w.__scp;
  };
}

/** quadros mais longos que isto (aba oculta, travada) não entram na média de ms por quadro */
const MS_FRAME_DT_MAX = 0.25;

/** Média móvel de ms por quadro e draw calls do último quadro (`engine.estatisticasDeRender()`). */
export class MedidorDeQuadro {
  msFrame = 0;
  drawCalls = 0;
  /** a aba acabou de voltar: o próximo intervalo não conta na média */
  private descartarProximo = true;

  descartar(): void {
    this.descartarProximo = true;
  }

  registrar(dtReal: number): void {
    if (this.descartarProximo) this.descartarProximo = false;
    else if (dtReal <= MS_FRAME_DT_MAX) this.msFrame = this.msFrame === 0 ? dtReal * 1000 : this.msFrame * 0.95 + dtReal * 50;
  }
}
