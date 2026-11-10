// Perigos de cenário do chefe (comportas): acionar, contar o tempo e fechar células. Lógica pura.
import { confirmarMorteChefe } from './ai/chefe096';
import { ferirJogador } from './ai/comum';
import { tipoDe } from './ai/tipos';
import type { SimEvent } from './eventos';
import type { PerigoDef } from './fase';
import { centro, coordDe, type Vec2 } from './grid';
import { ferirInimigo } from './weapons';
import type { EstadoPerigo, World } from './world';

/** A célula do centro está na área (o raio não conta). */
function noVao(p: Vec2, d: PerigoDef): boolean {
  const [col, row] = coordDe(p);
  const [c0, r0, larg, alt] = d.area;
  return col >= c0 && col < c0 + larg && row >= r0 && row < r0 + alt;
}

function defDe(w: World, id: string): PerigoDef {
  const d = w.fase.chefe?.perigos.find((p) => p.id === id);
  if (!d) throw new Error(`Perigo "${id}" não existe na fase`);
  return d;
}

function estadoDe(w: World, id: string): EstadoPerigo {
  const e = w.perigos.find((p) => p.id === id);
  if (!e) throw new Error(`Perigo "${id}" não existe no mundo`);
  return e;
}

/**
 * Ação `perigo`: em recarga, só avisa; senão fecha (`ativo = duracao`, `recarga = recarga`) e,
 * uma vez, fere quem está no vão: o chefe perde `danoChefe × vidaMax`, inimigos comuns vivos e o
 * jogador levam `danoComum`.
 */
export function acionarPerigo(w: World, id: string): SimEvent[] {
  const d = defDe(w, id);
  const e = estadoDe(w, id);
  if (e.recarga > 0) {
    return [{ tipo: 'perigo', id, estado: 'recarregando' }, { tipo: 'mensagem', texto: 'Comporta recarregando.' }];
  }
  e.ativo = d.duracao;
  e.recarga = d.recarga;
  const eventos: SimEvent[] = [{ tipo: 'perigo', id, estado: 'fecha' }];
  for (const i of w.inimigos) {
    if (i.modo === 'morto' || !noVao(i.pos, d)) continue;
    const chefe = w.chefe?.inimigoId === i.id;
    eventos.push(...ferirInimigo(w, i, chefe ? d.danoChefe * tipoDe(i.tipo).vida : d.danoComum));
  }
  eventos.push(...confirmarMorteChefe(w));   // morto pela comporta: fase `morto` já neste passo
  if (noVao(w.jogador.pos, d)) {
    const [c0, r0, larg, alt] = d.area;
    const meio = centro([c0 + (larg - 1) / 2, r0 + (alt - 1) / 2]);
    eventos.push(...ferirJogador(w, d.danoComum, meio));
  }
  return eventos;
}

/** Conta `ativo` e `recarga`; ao fim do `ativo`, a comporta abre (evento `perigo` `abre`). */
export function avancarPerigos(w: World, dt: number): SimEvent[] {
  const eventos: SimEvent[] = [];
  for (const e of w.perigos) {
    e.recarga = Math.max(0, e.recarga - dt);
    if (e.ativo <= 0) continue;
    e.ativo = Math.max(0, e.ativo - dt);
    if (e.ativo === 0) eventos.push({ tipo: 'perigo', id: e.id, estado: 'abre' });
  }
  return eventos;
}

/** A célula está fechada por um perigo ativo. */
export function celulaFechada(w: World, col: number, row: number): boolean {
  for (const e of w.perigos) {
    if (e.ativo <= 0) continue;
    const [c0, r0, larg, alt] = defDe(w, e.id).area;
    if (col >= c0 && col < c0 + larg && row >= r0 && row < r0 + alt) return true;
  }
  return false;
}
