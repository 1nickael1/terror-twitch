// Arsenal: troca de arma, disparo hitscan, projétil do lançador e nuvem. Lógica pura.
import { entrarLevantando, ferirJogador } from './ai/comum';
import { alturaCorpo, tipoDe, type TipoInimigo } from './ai/tipos';
import {
  ARMAS, CABECA, ESPALHAMENTO_POR_TIRO, ESPERA_TROCA, IA, JOGADOR, LANCADOR, LENTO_NUVEM, NUVEM, ORDEM_ARMAS,
  PISTOLA_RESERVA, TIRO_PENDENTE, type ArmaDef,
} from './balance';
import { solidoDe } from './doors';
import type { SimEvent } from './eventos';
import type { ArmaId } from './fase';
import { alcanceTiro, alturaPiso, type Vec2 } from './grid';
import { frente } from './player';
import { proximo } from './rng';
import type { InputFrame, Inimigo, Projetil, World } from './world';

/** Sorteia em [0, 1) com a semente do mundo e grava a próxima semente. */
function sortear(w: World): number {
  const r = proximo(w.semente);
  w.semente = r.semente;
  return r.valor;
}

function copia(p: Vec2): Vec2 {
  return { x: p.x, z: p.z };
}

/**
 * Põe `arma` na mão: zera rajada e tiro pendente e nunca encurta a espera (no mínimo `ESPERA_TROCA`).
 * A mesma arma da mão não faz nada.
 */
export function selecionar(w: World, arma: ArmaId): SimEvent[] {
  const j = w.jogador;
  if (arma === j.arma) return [];
  j.arma = arma;
  j.rajada = 0;
  j.tiroPendente = 0;
  // a troca nunca encurta a espera da arma que acabou de disparar
  j.espera = Math.max(j.espera, ESPERA_TROCA);
  return [{ tipo: 'arma_trocada', arma }];
}

/** Tecla seleciona arma que o jogador tem; a roda anda em `ORDEM_ARMAS` só entre as que ele tem. */
export function trocarArma(w: World, input: InputFrame): SimEvent[] {
  const j = w.jogador;
  if (input.arma) return j.armas.includes(input.arma) ? selecionar(w, input.arma) : [];
  if (input.roda === 0) return [];
  const tem = ORDEM_ARMAS.filter((a) => j.armas.includes(a));
  if (tem.length === 0) return [];
  const atual = tem.indexOf(j.arma);
  const i = atual < 0 ? 0 : (atual + input.roda + tem.length) % tem.length;
  return selecionar(w, tem[i]);
}

/** Abaixo do mínimo, a pistola ganha 1 bala a cada `intervalo` segundos. */
function recomporReserva(w: World, dt: number): void {
  const j = w.jogador;
  if (j.municao.balas >= PISTOLA_RESERVA.minimo) {
    j.reservaPistola = 0;
    return;
  }
  j.reservaPistola += dt;
  while (j.reservaPistola >= PISTOLA_RESERVA.intervalo && j.municao.balas < PISTOLA_RESERVA.minimo) {
    j.reservaPistola -= PISTOLA_RESERVA.intervalo;
    j.municao.balas++;
  }
}

/**
 * Dispara se puder e depois desconta `dt` da espera. Segurando o gatilho, a espera pode ficar
 * até `-dt` abaixo de zero (o atraso do passo vira crédito do próximo tiro, e a cadência média
 * fica exata); com o gatilho solto, ela para em zero.
 */
export function atirar(w: World, input: InputFrame, dt: number): SimEvent[] {
  const j = w.jogador;
  recomporReserva(w, dt);
  const eventos = disparar(w, input);
  j.espera = Math.max(input.atirar ? -dt : 0, j.espera - dt);
  j.tiroPendente = Math.max(0, j.tiroPendente - dt);
  return eventos;
}

function disparar(w: World, input: InputFrame): SimEvent[] {
  const j = w.jogador;
  const borda = input.atirar && !j.gatilho;
  j.gatilho = input.atirar;
  if (!input.atirar) j.rajada = 0;
  const def = ARMAS[j.arma];
  const quer = def.automatica ? input.atirar : borda || j.tiroPendente > 0;
  if (!quer) return [];
  if (j.municao[def.municao] < def.porTiro) {
    j.tiroPendente = 0;
    return borda ? [{ tipo: 'sem_municao' }] : [];
  }
  if (j.espera > 0) {
    // clique perdido durante a espera: guarda por um instante
    if (borda && !def.automatica) j.tiroPendente = TIRO_PENDENTE;
    return [];
  }

  j.tiroPendente = 0;
  j.municao[def.municao] -= def.porTiro;
  j.espera += def.cadencia;
  const eventos: SimEvent[] = [
    { tipo: 'tiro', arma: j.arma, pos: copia(j.pos) },
    { tipo: 'ruido', pos: copia(j.pos), raio: def.ruido },
  ];
  if (def.projetil) eventos.push(...lancar(w, def));
  else eventos.push(...hitscan(w, def));
  j.rajada++;
  return eventos;
}

/** `d`: distância de entrada no cilindro; `h`: altura do raio no meio do trecho dentro dele. */
interface Cruzamento { inimigo: Inimigo; d: number; h: number }

/**
 * Inimigo vivo mais próximo cujo cilindro o raio cruza antes de `max`. O raio parte de `o`
 * na altura `y0`, segue a direção unitária `u` e sobe `inclinacao` por metro andado.
 */
function cruzarInimigo(w: World, o: Vec2, u: Vec2, y0: number, inclinacao: number, max: number): Cruzamento | null {
  let melhor: Cruzamento | null = null;
  for (const i of w.inimigos) {
    if (i.modo === 'morto') continue;
    const tipo = tipoDe(i.tipo);
    const fx = o.x - i.pos.x;
    const fz = o.z - i.pos.z;
    const b = fx * u.x + fz * u.z;
    const disc = b * b - (fx * fx + fz * fz - tipo.raio * tipo.raio);
    if (disc < 0) continue;
    const raiz = Math.sqrt(disc);
    // trecho do raio dentro do círculo em planta, limitado a [0, max]
    let ini = Math.max(0, -b - raiz);
    let fim = Math.min(max, -b + raiz);
    // e dentro da faixa de altura do cilindro (a altura do raio é linear na distância)
    const base = i.y - y0;
    const topo = i.y + alturaCorpo(i) - y0;   // deitado, o corpo é baixo
    if (inclinacao === 0) {
      if (base > 0 || topo < 0) continue;
    } else {
      const a = base / inclinacao;
      const c = topo / inclinacao;
      ini = Math.max(ini, Math.min(a, c));
      fim = Math.min(fim, Math.max(a, c));
    }
    if (ini > fim || (melhor && ini >= melhor.d)) continue;
    melhor = { inimigo: i, d: ini, h: y0 + inclinacao * ((ini + fim) / 2) };
  }
  return melhor;
}

function hitscan(w: World, def: ArmaDef): SimEvent[] {
  const j = w.jogador;
  const eventos: SimEvent[] = [];
  const e = Math.min(def.espalhamentoMax, def.espalhamento + j.rajada * ESPALHAMENTO_POR_TIRO);
  const y0 = j.y + JOGADOR.olhos;
  for (let f = 0; f < def.fragmentos; f++) {
    const u = frente(j.yaw + (sortear(w) * 2 - 1) * e);
    const inclinacao = Math.tan(j.pitch + (sortear(w) * 2 - 1) * e);
    const max = alcanceTiro(w.grid, j.pos, u, def.alcance, undefined, y0, inclinacao);
    const alvo = cruzarInimigo(w, j.pos, u, y0, inclinacao, max);
    if (alvo) {
      const cabeca = alvo.h >= alvo.inimigo.y + alturaCorpo(alvo.inimigo) * (1 - CABECA.fracao);
      const pos = { x: j.pos.x + u.x * alvo.d, z: j.pos.z + u.z * alvo.d };
      eventos.push({ tipo: 'impacto', pos, y: alvo.h, em: 'inimigo' });
      eventos.push(...ferirInimigo(w, alvo.inimigo, def.dano * (cabeca ? CABECA.multiplicador : 1)));
    } else if (max < def.alcance) {
      const pos = { x: j.pos.x + u.x * max, z: j.pos.z + u.z * max };
      eventos.push({ tipo: 'impacto', pos, y: y0 + inclinacao * max, em: 'parede' });
    }
  }
  return eventos;
}

function lancar(w: World, def: ArmaDef): SimEvent[] {
  const j = w.jogador;
  const u = frente(j.yaw);
  const id = w.proximoId++;
  w.projeteis.push({
    id, de: 'jogador', tipo: 'lancador', pos: copia(j.pos), y: j.y + JOGADOR.olhos - LANCADOR.abaixoDosOlhos,
    vel: { x: u.x * LANCADOR.velocidade, z: u.z * LANCADOR.velocidade },
    vy: LANCADOR.subida + Math.tan(j.pitch) * LANCADOR.velocidade,
    dano: def.dano, vida: LANCADOR.vida,
  });
  return [{ tipo: 'projetil', id }];
}

/**
 * Um passo do projétil de inimigo: reto, com `vy` constante, parando no que bloqueia tiro
 * (inclusive porta fechada). Fere o jogador se passa a menos de `raio do projétil + JOGADOR.raio`
 * dele em planta, na altura do corpo. Devolve `null` se ele segue voando, ou os eventos do fim.
 */
function voarProjetilInimigo(w: World, p: Projetil, dt: number): SimEvent[] | null {
  const vh = Math.hypot(p.vel.x, p.vel.z);
  const passo = vh * dt;
  const u = vh > 0 ? { x: p.vel.x / vh, z: p.vel.z / vh } : { x: 1, z: 0 };
  const inclinacao = vh > 0 ? p.vy / vh : 0;
  const max = alcanceTiro(w.grid, p.pos, u, passo, solidoDe(w), p.y, inclinacao);
  // ponto do trecho [0, max] mais perto do jogador em planta
  const j = w.jogador;
  const s = Math.max(0, Math.min(max, (j.pos.x - p.pos.x) * u.x + (j.pos.z - p.pos.z) * u.z));
  const h = p.y + inclinacao * s;
  const raio = (tipoDe(p.tipo).projetil?.raio ?? 0) + JOGADOR.raio;
  const perto = Math.hypot(p.pos.x + u.x * s - j.pos.x, p.pos.z + u.z * s - j.pos.z) < raio;
  if (perto && h >= j.y && h <= j.y + IA.alturaJogador) return ferirJogador(w, p.dano, p.pos);
  p.pos = { x: p.pos.x + u.x * max, z: p.pos.z + u.z * max };
  p.y += inclinacao * max;
  p.vida -= dt;
  return max < passo || p.vida <= 0 ? [] : null;
}

type Arco = NonNullable<NonNullable<TipoInimigo['projetil']>['arco']>;

/**
 * Um passo do frasco (projétil com `arco`): parábola com a gravidade do arco, sem colidir com corpos.
 * Ao tocar piso, parede ou teto (ou porta fechada), quebra: `frasco_quebra` e, com o jogador a até
 * `respingo` (do ponto ao corpo dele), o dano uma vez por `ferirJogador`. Não fere inimigos. Ao fim da
 * vida, some sem quebrar. Devolve `null` se segue voando.
 */
function voarFrasco(w: World, p: Projetil, arco: Arco, dt: number): SimEvent[] | null {
  const vh = Math.hypot(p.vel.x, p.vel.z);
  if (vh <= 0) return quebrarFrasco(w, p, arco);
  const passo = vh * dt;
  const u = { x: p.vel.x / vh, z: p.vel.z / vh };
  // inclinação pela vy média do passo: o trecho reto segue a corda da parábola
  const inclinacao = (p.vy - (arco.gravidade * dt) / 2) / vh;
  const max = alcanceTiro(w.grid, p.pos, u, passo, solidoDe(w), p.y, inclinacao);
  p.pos = { x: p.pos.x + u.x * max, z: p.pos.z + u.z * max };
  p.y += inclinacao * max;
  p.vy -= arco.gravidade * dt;
  p.vida -= dt;
  if (max < passo) return quebrarFrasco(w, p, arco);
  return p.vida <= 0 ? [] : null;
}

/** Quebra o frasco onde ele está: `frasco_quebra` e o respingo (exportada para os testes de borda). */
export function quebrarFrasco(w: World, p: Projetil, arco: Arco): SimEvent[] {
  const j = w.jogador;
  const y = Math.max(p.y, alturaPiso(w.grid, p.pos));   // a amostra pode passar um fio do piso
  const eventos: SimEvent[] = [{ tipo: 'frasco_quebra', pos: copia(p.pos), y }];
  const emPlanta = Math.hypot(j.pos.x - p.pos.x, j.pos.z - p.pos.z);
  const topo = j.y + IA.alturaJogador;
  const vertical = y < j.y ? j.y - y : y > topo ? y - topo : 0;
  if (Math.hypot(emPlanta, vertical) <= arco.respingo) eventos.push(...ferirJogador(w, p.dano, p.pos));
  return eventos;
}

/**
 * Projéteis do jogador: caem com a gravidade e explodem ao tocar parede, piso, teto ou inimigo
 * vivo, ou ao fim da vida. Projéteis de inimigo: ver `voarProjetilInimigo` (retos) e `voarFrasco` (arco).
 */
export function avancarProjeteis(w: World, dt: number): SimEvent[] {
  const eventos: SimEvent[] = [];
  const restam: typeof w.projeteis = [];
  for (const p of w.projeteis) {
    if (p.de === 'inimigo') {
      const arco = tipoDe(p.tipo).projetil?.arco;
      const fim = arco ? voarFrasco(w, p, arco, dt) : voarProjetilInimigo(w, p, dt);
      if (fim) eventos.push(...fim);
      else restam.push(p);
      continue;
    }
    const vh = Math.hypot(p.vel.x, p.vel.z);
    const passo = vh * dt;
    const u = vh > 0 ? { x: p.vel.x / vh, z: p.vel.z / vh } : { x: 1, z: 0 };
    const inclinacao = vh > 0 ? p.vy / vh : 0;
    const max = alcanceTiro(w.grid, p.pos, u, passo, undefined, p.y, inclinacao);
    const alvo = cruzarInimigo(w, p.pos, u, p.y, inclinacao, max);
    const d = alvo ? alvo.d : max;
    p.pos = { x: p.pos.x + u.x * d, z: p.pos.z + u.z * d };
    p.y += inclinacao * d;
    p.vy -= LANCADOR.gravidade * dt;
    p.vida -= dt;
    if (alvo || d < passo || p.vida <= 0) eventos.push(...explodir(w, p.pos, p.dano));
    else restam.push(p);
  }
  w.projeteis = restam;
  return eventos;
}

function noRaio(i: Inimigo, pos: Vec2, raio: number): boolean {
  return i.modo !== 'morto' && Math.hypot(i.pos.x - pos.x, i.pos.z - pos.z) <= raio;
}

function explodir(w: World, pos: Vec2, dano: number): SimEvent[] {
  const eventos: SimEvent[] = [{ tipo: 'explosao', pos: copia(pos) }];
  for (const i of w.inimigos) {
    if (noRaio(i, pos, NUVEM.raio)) eventos.push(...ferirInimigo(w, i, dano));
  }
  w.nuvens.push({ pos: copia(pos), raio: NUVEM.raio, resta: NUVEM.duracao });
  return eventos;
}

/** Inimigos na nuvem perdem vida (sem entrar em dor a cada passo) e ficam lentos. */
export function avancarNuvens(w: World, dt: number): SimEvent[] {
  const eventos: SimEvent[] = [];
  for (const n of w.nuvens) {
    for (const i of w.inimigos) {
      if (!noRaio(i, n.pos, n.raio)) continue;
      i.lento = LENTO_NUVEM;
      eventos.push(...desgastarInimigo(w, i, NUVEM.danoPorSegundo * dt));
    }
    n.resta -= dt;
  }
  w.nuvens = w.nuvens.filter((n) => n.resta > 0);
  return eventos;
}

/** Morte: `stats.mortos` só na primeira de cada inimigo (`jaMorreu`; um reanimado morre de novo sem contar). */
function matar(w: World, i: Inimigo): SimEvent[] {
  i.vida = 0;
  i.modo = 'morto';
  if (!i.jaMorreu) {
    i.jaMorreu = true;
    w.stats.mortos++;
  }
  return [{ tipo: 'inimigo_morto', id: i.id }];
}

/**
 * Dano contínuo (nuvem, perigo de área): sem entrar em dor a cada passo. Quem dorme acorda como
 * num golpe (`ferirInimigo`); morto, nada.
 */
export function desgastarInimigo(w: World, i: Inimigo, dano: number): SimEvent[] {
  if (i.modo === 'morto') return [];
  if (i.modo === 'dormindo') return ferirInimigo(w, i, dano);
  i.vida -= dano;
  return i.vida <= 0 ? matar(w, i) : [];
}

/**
 * Aplica dano a um inimigo, com 'inimigo_dor' ou 'inimigo_morto'. Quem está `levantando` não é
 * interrompido (só perde vida); o deitado dormindo levanta em vez de entrar em dor (C3.2).
 */
export function ferirInimigo(w: World, i: Inimigo, dano: number): SimEvent[] {
  if (i.modo === 'morto') return [];
  i.vida -= dano;
  if (i.vida <= 0) return matar(w, i);
  const dor: SimEvent = { tipo: 'inimigo_dor', id: i.id };
  if (i.modo === 'levantando') return [dor];
  if (i.modo === 'dormindo' && tipoDe(i.tipo).deitado) return [dor, ...entrarLevantando(i, IA.levantar)];
  i.modo = 'dor';
  i.timer = tipoDe(i.tipo).dor;
  return [dor];
}
