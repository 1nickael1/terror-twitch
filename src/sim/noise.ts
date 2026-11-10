// Audição dos inimigos. Lógica pura.
import { tipoDe } from './ai/tipos';
import type { Vec2 } from './grid';
import type { Inimigo, World } from './world';

/** O ruído chega ao inimigo: distância em planta até ele `<= raio * audicao`. Morto não ouve. */
export function ouve(w: World, i: Inimigo, ruido: { pos: Vec2; raio: number }): boolean {
  if (i.modo === 'morto') return false;
  return Math.hypot(ruido.pos.x - i.pos.x, ruido.pos.z - i.pos.z) <= ruido.raio * tipoDe(i.tipo).audicao;
}
