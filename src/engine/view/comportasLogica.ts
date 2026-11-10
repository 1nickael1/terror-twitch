// Contas puras da view das comportas: quanto o painel desceu, o brilho da luz de aviso e a luz do terminal.

/** s para o painel descer do teto até o chão */
export const DESCIDA = 0.15;
/** s para subir de volta */
export const SUBIDA = 0.6;
/** Hz do pisca da luz de aviso (lento: não é estrobo) */
const PISCA_HZ = 0.8;

/** Fração fechada (0 = escondida no teto, 1 = no chão) depois de `dt` s. */
export function avancarFechamento(f: number, fechada: boolean, dt: number): number {
  if (fechada) return Math.min(1, f + dt / DESCIDA);
  return Math.max(0, f - dt / SUBIDA);
}

/**
 * Brilho (0..1) da luz âmbar enquanto a recarga corre. Normal: pisca lento, ligada/desligada.
 * Com "reduzir flashes": pulsa suave, sem degrau e sem apagar.
 */
export function brilhoAviso(t: number, recarga: number, reduzirFlashes: boolean): number {
  if (recarga <= 0) return 0;
  const s = Math.sin(t * 2 * Math.PI * PISCA_HZ);
  if (reduzirFlashes) return 0.6 + 0.25 * s;
  return s > 0 ? 1 : 0.12;
}

/** Luz do terminal que aciona a comporta: branco-azulado pronta (contrasta com a tela verde), âmbar enquanto recarrega (fixa, nunca pisca). */
export type EstadoIndicador = 'pronta' | 'recarregando';

export const COR_INDICADOR: Readonly<Record<EstadoIndicador, number>> = { pronta: 0xd6ecff, recarregando: 0xffa224 };

export function estadoIndicador(recarga: number): EstadoIndicador {
  return recarga > 0 ? 'recarregando' : 'pronta';
}
