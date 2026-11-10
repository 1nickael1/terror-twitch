// Contas puras da view dos perigos: que índices de `fase.chefe.perigos` cada view desenha (casados com
// `world.perigos`), o estado visual de um perigo, o brilho das lâmpadas UV e da válvula do vapor (com e
// sem "reduzir flashes"), os bicos de vapor ao longo da área e o ritmo das partículas do jato.
import type { Area, PerigoDef } from '../../sim/fase';

/** Índices (em `fase.chefe.perigos`, igual a `world.perigos`) dos perigos de um tipo. */
export function indicesDoTipo(defs: readonly PerigoDef[], tipo: PerigoDef['tipo']): number[] {
  const saida: number[] = [];
  defs.forEach((d, i) => {
    if (d.tipo === tipo) saida.push(i);
  });
  return saida;
}

/** O que a view mostra: pronto (apagado), aviso (pisca/chia), ativo (aceso/jato) ou recarregando. */
export type EstadoVisualPerigo = 'pronto' | 'aviso' | 'ativo' | 'recarga';

export function estadoVisual(e: { ativo: number; aviso: number; recarga: number }): EstadoVisualPerigo {
  if (e.ativo > 0) return 'ativo';
  if (e.aviso > 0) return 'aviso';
  if (e.recarga > 0) return 'recarga';
  return 'pronto';
}

/** Fração do aviso já corrida (0 no acionamento, 1 quando liga). */
export function progressoAviso(aviso: number, avisoTotal: number): number {
  if (avisoTotal <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - aviso / avisoTotal));
}

/** brilho dos tubos apagados (ainda dá para ver que há lâmpadas) */
export const UV_APAGADA = 0.04;
/** s de cada degrau do pisca do reator: no máximo 3 acendimentos por segundo */
export const DEGRAU_PISCA = 1 / 6;

/** Ruído determinístico 0..1 por degrau (o pisca não depende de `Math.random`). */
function sorteio(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Brilho (0..1) dos tubos UV. Ativo: aceso fixo. Aviso: o reator falha e pega — degraus de 1/6 s, cada
 * um aceso com chance que cresce com o progresso (sem passar de 3 acendimentos por segundo); com
 * "reduzir flashes", sobe suave do apagado até quase aceso, sem degrau. Pronto/recarga: apagado.
 */
export function brilhoUV(e: { ativo: number; aviso: number }, avisoTotal: number, t: number, reduzirFlashes: boolean): number {
  if (e.ativo > 0) return 1;
  if (e.aviso <= 0) return UV_APAGADA;
  const k = progressoAviso(e.aviso, avisoTotal);
  if (reduzirFlashes) return UV_APAGADA + (0.55 - UV_APAGADA) * k;
  const degrau = Math.floor(t / DEGRAU_PISCA);
  // cada degrau acende com chance 0,25 → 0,85 (no máximo uma troca a cada 1/6 s: até 3 acendimentos por segundo)
  return sorteio(degrau) < 0.25 + 0.6 * k ? 0.85 : UV_APAGADA;
}

/** Névoa do vapor no piso: começa nisto no acionamento e cresce até 1 no jato. */
export const NEVOA_INICIO = 0.3;
const NEVOA_FIM_AVISO = 0.7;

/**
 * Força (0..1) da marca no piso da área (lote final do CP3: com teto alto, a luz dos tubos não chega ao chão).
 * UV: segue o pisca dos tubos no aviso (suave com "reduzir flashes") e fica firme no ativo; apagada fora disso.
 * Vapor: névoa crescendo sem piscar no aviso (`NEVOA_INICIO` → 0,7) e densa (1) no jato.
 */
export function pisoPerigo(
  tipo: 'ultravioleta' | 'vapor', e: { ativo: number; aviso: number }, avisoTotal: number, t: number, reduzirFlashes: boolean,
): number {
  if (e.ativo > 0) return 1;
  if (e.aviso <= 0) return 0;
  if (tipo === 'ultravioleta') return brilhoUV(e, avisoTotal, t, reduzirFlashes);
  return NEVOA_INICIO + (NEVOA_FIM_AVISO - NEVOA_INICIO) * progressoAviso(e.aviso, avisoTotal);
}

/** Hz do pisca da lâmpada da válvula no aviso (lento: não é estrobo) */
const PISCA_VALVULA_HZ = 2;

/**
 * Brilho (0..1) da lâmpada vermelha da válvula de vapor: pisca no aviso (suave com "reduzir flashes"),
 * acesa fixa no jato, apagada fora disso.
 */
export function brilhoValvula(e: { ativo: number; aviso: number }, t: number, reduzirFlashes: boolean): number {
  if (e.ativo > 0) return 1;
  if (e.aviso <= 0) return 0;
  const s = Math.sin(t * 2 * Math.PI * PISCA_VALVULA_HZ);
  if (reduzirFlashes) return 0.55 + 0.3 * s;
  return s > 0 ? 1 : 0.1;
}

/** partículas por segundo em cada bico com o jato ligado */
export const TAXA_JATO = 38;
/** no aviso: fiapos que crescem até isto (o chiado subindo) */
export const TAXA_AVISO = 10;

/** Partículas por segundo por bico: jato no ativo, fiapos crescendo no aviso, nada fora disso. */
export function taxaVapor(e: { ativo: number; aviso: number }, avisoTotal: number): number {
  if (e.ativo > 0) return TAXA_JATO;
  if (e.aviso <= 0) return 0;
  return 1 + (TAXA_AVISO - 1) * progressoAviso(e.aviso, avisoTotal);
}

/**
 * Quantas partículas soltar neste quadro pela taxa. O resto fracionário fica em `acumulado[k]` para o
 * próximo quadro (array da view, reaproveitado: nada é alocado por quadro).
 */
export function emitirPorTaxa(acumulado: number[], k: number, taxa: number, dt: number): number {
  if (taxa <= 0) {
    acumulado[k] = 0;
    return 0;
  }
  if (dt <= 0) return 0;
  const total = acumulado[k] + taxa * dt;
  // folga de arredondamento: 60 × (38/60) não soma 38 exato
  const n = Math.floor(total + 1e-9);
  acumulado[k] = Math.max(0, total - n);
  return n;
}

/** bicos de vapor por linha (área comprida: espaçados ao longo dela) */
export const MAX_BICOS_LINHA = 4;
/** bicos de vapor na fase inteira: o jato não toma o pool de partículas (512) de faíscas e sangue */
export const MAX_BICOS_FASE = 8;

/**
 * Linha dos canos sobre a área: segue o eixo mais comprido, com um bico no centro de cada célula ao
 * longo dele (no meio do eixo curto), no máximo `max` (espaçados por igual quando a área é mais
 * comprida). `eixoX`: o cano corre ao longo de x.
 */
export function bicosDaArea(area: Area, cell: number, max: number = MAX_BICOS_LINHA): { eixoX: boolean; bicos: { x: number; z: number }[] } {
  const [c0, r0, larg, alt] = area;
  const eixoX = larg >= alt;
  const comp = eixoX ? larg : alt;
  const n = Math.max(0, Math.min(comp, Math.floor(max)));
  const bicos: { x: number; z: number }[] = [];
  for (let k = 0; k < n; k++) {
    // com menos bicos que células, distribui pelo comprimento (centros de faixas iguais)
    const s = n === comp ? k + 0.5 : ((k + 0.5) * comp) / n;
    bicos.push(eixoX ? { x: (c0 + s) * cell, z: (r0 + alt / 2) * cell } : { x: (c0 + larg / 2) * cell, z: (r0 + s) * cell });
  }
  return { eixoX, bicos };
}

/** Tubos UV sobre a área: um por célula do eixo comprido (como `bicosDaArea`), no máximo `max`. */
export function tubosDaArea(area: Area, cell: number, max = 8): { eixoX: boolean; tubos: { x: number; z: number }[] } {
  const { eixoX, bicos } = bicosDaArea(area, cell, max);
  // área larga: duas fileiras de tubos no eixo curto
  const [, , larg, alt] = area;
  const curto = eixoX ? alt : larg;
  const tubos: { x: number; z: number }[] = [];
  const fileiras = curto >= 2 ? [-0.25, 0.25] : [0];
  for (const f of fileiras) {
    for (const b of bicos) {
      tubos.push(eixoX ? { x: b.x, z: b.z + f * curto * cell } : { x: b.x + f * curto * cell, z: b.z });
    }
  }
  return { eixoX, tubos: tubos.slice(0, max) };
}
