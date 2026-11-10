// Visão dos inimigos: alcance, cone, linha de visão com alturas e a regra do emboscador. Lógica pura.
import { IA, JOGADOR } from '../balance';
import { solidoDe } from '../doors';
import { alcanceTiro, visivel } from '../grid';
import { frente } from '../player';
import type { Inimigo, World } from '../world';
import { alturaCorpo, tipoDe, type TipoInimigo } from './tipos';

/** Distância em planta do inimigo ao jogador. */
export function distanciaJogador(w: World, i: Inimigo): number {
  return Math.hypot(w.jogador.pos.x - i.pos.x, w.jogador.pos.z - i.pos.z);
}

/** O jogador está ao alcance `alcance` em planta e na mesma faixa de altura do tipo (golpes dos chefes). */
export function aoAlcance(w: World, i: Inimigo, t: TipoInimigo, alcance: number): boolean {
  return distanciaJogador(w, i) <= alcance && Math.abs(w.jogador.y - i.y) <= t.altura / 2;
}

/** Até onde o inimigo enxerga: menos com a lanterna do jogador apagada. */
export function alcanceVisao(w: World, i: Inimigo): number {
  const t = tipoDe(i.tipo);
  return w.jogador.lanterna ? t.visao : t.visaoEscuro;
}

/** Nada entre os olhos do inimigo e os do jogador: paredes, portas fechadas, pisos altos e tetos baixos. */
export function linhaDeVisao(w: World, i: Inimigo): boolean {
  const j = w.jogador;
  const ya = i.y + alturaCorpo(i) * IA.olhos;   // deitado, olhos baixos
  return visivel(w.grid, i.pos, j.pos, solidoDe(w), ya, j.y + JOGADOR.olhos);
}

/**
 * O tiro sai livre: do ponto de nascimento do projétil (`i.y + altura * IA.disparo`) até o peito
 * do jogador nada bloqueia tiro (paredes, portas fechadas, janelas, pisos e tetos).
 */
export function tiroLivre(w: World, i: Inimigo): boolean {
  const j = w.jogador;
  const d = distanciaJogador(w, i);
  if (d < 1e-6) return true;
  const y0 = i.y + alturaCorpo(i) * IA.disparo;
  const inclinacao = (j.y + IA.peitoJogador - y0) / d;
  const dir = { x: j.pos.x - i.pos.x, z: j.pos.z - i.pos.z };
  return alcanceTiro(w.grid, i.pos, dir, d, solidoDe(w), y0, inclinacao) >= d;
}

/** Emboscador: só a até `emboscadaPerto`, ou a até `emboscadaCostas` se o jogador está de costas para ele. */
function emboscadorPercebe(w: World, i: Inimigo, d: number): boolean {
  if (d <= IA.emboscadaPerto) return true;
  if (d > IA.emboscadaCostas) return false;
  const j = w.jogador;
  const f = frente(j.yaw);
  return f.x * (i.pos.x - j.pos.x) + f.z * (i.pos.z - j.pos.z) < 0;
}

/** O inimigo vê o jogador: dentro do alcance, dentro do cone à frente e com linha de visão. */
export function ve(w: World, i: Inimigo): boolean {
  if (i.modo === 'morto') return false;
  const t = tipoDe(i.tipo);
  const d = distanciaJogador(w, i);
  if (d > alcanceVisao(w, i)) return false;
  if (t.arquetipo === 'emboscador' && !emboscadorPercebe(w, i, d)) return false;
  if (d > 1e-6) {
    const f = frente(i.yaw);
    const cos = (f.x * (w.jogador.pos.x - i.pos.x) + f.z * (w.jogador.pos.z - i.pos.z)) / d;
    if (cos < Math.cos(t.cone / 2)) return false;
  }
  return linhaDeVisao(w, i);
}
