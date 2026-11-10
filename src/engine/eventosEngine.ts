// Eventos que o Engine emite para quem escuta (a ponte React) e o erro de WebGL2 ausente.
import type { SimEvent } from '../sim/eventos';

export type EngineEvent =
  | { type: 'travado'; travado: boolean }
  | { type: 'filtro'; id: string }
  | { type: 'fase'; id: string | null }
  | { type: 'pausa' }
  /** eventos de todos os passos de simulação deste quadro (só quando houve algum) */
  | { type: 'eventos'; eventos: readonly SimEvent[] }
  /** depois de cada quadro desenhado */
  | { type: 'quadro' };

export class WebGL2IndisponivelError extends Error {
  constructor() {
    super('Seu navegador não tem WebGL2 disponível. Tente o Chrome, o Edge ou o Firefox atualizados.');
  }
}
