// Robô de teste: joga a fase na simulação, seguindo rotas até cartões, gatilhos que abrem portas e a saída. Lógica pura.
import { PORTA } from '../sim/balance';
import { solidoDe } from '../sim/doors';
import type { LevelDef } from '../sim/fase';
import { caminho, centro, coordDe, DEGRAU, passavel, SALTO, visivel, type Coord, type Solido, type Vec2 } from '../sim/grid';
import { resolverOnde } from '../sim/onde';
import { celulaFechada } from '../sim/perigos';
import { PASSO, step } from '../sim/step';
import { criarWorld, INPUT_VAZIO, type Inimigo, type InputFrame, type Jogador, type Porta, type World } from '../sim/world';
import { celulasDe } from './alcance';

export interface ResultadoRobo { concluiu: boolean; passos: number; motivo: string }
export interface OpcoesRobo { semInimigos?: boolean }

/** Segundos entre dois cálculos de objetivo e rota. */
const RECALCULO = 0.25;
/** Segundos seguidos sem objetivo alcançável até desistir. */
const SEM_CAMINHO_MAX = 5;
/** Preso: menos de `DESLOCAMENTO_MIN` m em `JANELA_PRESO` s; aí anda de lado por `DESVIO` s. */
const JANELA_PRESO = 2;
const DESLOCAMENTO_MIN = 0.2;
const DESVIO = 0.3;
/** A esta distância (m) de um ponto da rota, passa ao próximo. */
const CHEGADA = 0.5;
/** A esta distância (m) do centro de uma porta fechada da rota, aperta usar. */
const ENCOSTADO = 1.9;
/** Folga (m) dentro do alcance de uso para apertar usar num terminal. */
const FOLGA_USO = 0.1;
/** Inimigo visível até esta distância (m) é alvo. */
const ALCANCE_MIRA = 20;
/** Perto (m) de um objetivo que continua pendente por `DESISTIR` s seguidos: desiste dele. */
const PERTO_OBJETIVO = 1;
const DESISTIR = 5;
const CELULA_E_VIZINHOS: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Rota até o objetivo (centros de célula; o último é o alvo), o terminal a usar ao chegar (se houver) e a
 * chave que identifica o objetivo (`cartao:i`, `gatilho:id` ou `saida`).
 */
interface Objetivo { rota: Vec2[]; usarEm: Vec2 | null; chave: string }

/** Estado do robô entre passos. */
export interface Robo {
  objetivo: Objetivo | null;
  recalculaEm: number;    // s até recalcular objetivo e rota
  semCaminho: number;     // s seguidos sem objetivo alcançável
  usou: boolean;          // `usar` apertado no passo anterior (o robô solta e aperta)
  ancora: Vec2;           // posição no começo da janela de detecção de preso
  ancoraT: number;        // s desde o começo da janela
  desvio: number;         // s restantes do desvio lateral
  lado: 1 | -1;           // sentido do próximo desvio (alterna)
  pendente: number;       // s seguidos perto do objetivo atual sem resolvê-lo
  descartados: Set<string>;   // chaves de objetivos abandonados (não são escolhidos de novo)
}

export function novoRobo(): Robo {
  return { objetivo: null, recalculaEm: 0, semCaminho: 0, usou: false, ancora: { x: NaN, z: NaN }, ancoraT: 0, desvio: 0, lado: 1, pendente: 0, descartados: new Set() };
}

const distancia = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const mesma = (a: Coord, b: Coord) => a[0] === b[0] && a[1] === b[1];

/** `dYaw` que faz `frente(yaw)` apontar de `j.pos` para `alvo`, no intervalo (-π, π]. */
function giro(j: Jogador, alvo: Vec2): number {
  const desejado = Math.atan2(-(alvo.x - j.pos.x), -(alvo.z - j.pos.z));
  let d = (desejado - j.yaw) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

function podeAbrir(w: World, p: Porta): boolean {
  return p.exige !== null && w.jogador.cartoes.some((c) => c >= p.exige!);
}

/** Porta trancada que o jogador ainda não consegue abrir. */
function barreira(w: World, p: Porta): boolean {
  return p.estado === 'trancada' && !podeAbrir(w, p);
}

/**
 * Objetivo, em ordem: cartão que abre porta ainda barrada; pickup, terminal ou área de gatilho que
 * abre porta barrada; área de gatilho que cria (`spawn`) um grupo cuja morte (`grupo_morto`) abre
 * porta barrada (sala de combate); a saída. Só vale objetivo com rota (portas barradas são sólidas
 * no plano; comportas não entram no plano: o robô espera diante delas).
 */
function planejar(w: World, descartados: ReadonlySet<string>): Objetivo | null {
  const j = w.jogador;
  const solido: Solido = (col, row) => w.portas.some((p) => p.coord[0] === col && p.coord[1] === row && barreira(w, p));
  const rotaAte = (chave: string, alvos: readonly Vec2[], usarEm: Vec2 | null = null): Objetivo | null => {
    if (descartados.has(chave)) return null;
    let melhor: Objetivo | null = null;
    for (const a of alvos) {
      const rota = caminho(w.grid, j.pos, a, SALTO, solido);
      if (rota && (!melhor || rota.length < melhor.rota.length)) melhor = { rota, usarEm, chave };
    }
    return melhor;
  };
  const barradas = w.portas.filter((p) => barreira(w, p));

  for (const [i, p] of w.pickups.entries()) {
    const n = p.def.nivel;
    if (p.pego || p.def.tipo !== 'cartao' || !n || !barradas.some((b) => b.exige !== null && n >= b.exige)) continue;
    const o = rotaAte(`cartao:${i}`, [p.pos]);
    if (o) return o;
  }
  const uteis = w.fase.gatilhos.filter((g) => !w.gatilhosFeitos.has(g.id) && g.faz.some((a) =>
    a.acao === 'porta' && (a.estado === 'abrir' || a.estado === 'destrancar') && barradas.some((b) => b.id === a.id)));
  for (const { id, quando: q } of uteis) {
    const p = q.tipo === 'pickup' ? w.pickups[q.indice] : undefined;
    const o = p && !p.pego ? rotaAte(`gatilho:${id}`, [p.pos]) : null;
    if (o) return o;
  }
  for (const { id, quando: q } of uteis) {
    const t = q.tipo === 'terminal' ? w.fase.terminais.find((x) => x.id === q.id) : undefined;
    if (!t) continue;
    const c = resolverOnde(w.grid, t.em);
    const o = rotaAte(`gatilho:${id}`, CELULA_E_VIZINHOS.map(([dc, dr]) => centro([c[0] + dc, c[1] + dr])), centro(c));
    if (o) return o;
  }
  for (const { id, quando: q } of uteis) {
    if (q.tipo !== 'area') continue;
    const o = rotaAte(`gatilho:${id}`, celulasDe(q.area).map(centro));
    if (o) return o;
  }
  // sala de combate: os inimigos criados morrem no passo seguinte com `semInimigos`, e a cadeia dispara
  const gruposUteis = new Set(uteis.flatMap(({ quando: q }) => (q.tipo === 'grupo_morto' ? [q.grupo] : [])));
  for (const { id, quando: q, faz } of w.fase.gatilhos) {
    if (q.tipo !== 'area' || w.gatilhosFeitos.has(id)) continue;
    const criaGrupoUtil = faz.some((a) => a.acao === 'spawn' && a.inimigos.some((d) => d.grupo !== undefined && gruposUteis.has(d.grupo)));
    const o = criaGrupoUtil ? rotaAte(`gatilho:${id}`, celulasDe(q.area).map(centro)) : null;
    if (o) return o;
  }
  return rotaAte('saida', [centro(w.fase.saida)]);
}

function inimigoVisivel(w: World): Inimigo | null {
  const j = w.jogador;
  const solido = solidoDe(w);
  let melhor: Inimigo | null = null;
  for (const i of w.inimigos) {
    const d = distancia(i.pos, j.pos);
    if (i.modo === 'morto' || d > ALCANCE_MIRA || !visivel(w.grid, j.pos, i.pos, solido)) continue;
    if (!melhor || d < distancia(melhor.pos, j.pos)) melhor = i;
  }
  return melhor;
}

/** Tira da frente da rota os pontos já alcançados (o último, o alvo, fica). */
function avancarRota(o: Objetivo, pos: Vec2): void {
  const aqui = coordDe(pos);
  let corte = 0;
  o.rota.forEach((p, i) => {
    if (i < o.rota.length - 1 && mesma(coordDe(p), aqui)) corte = i + 1;
  });
  if (o.rota.length > 1 && distancia(pos, o.rota[0]) < CHEGADA) corte = Math.max(corte, 1);
  o.rota.splice(0, corte);
}

/** Porta fechada nos próximos pontos da rota, encostada no jogador, que ele consegue abrir. */
function portaParaAbrir(w: World, rota: readonly Vec2[]): Porta | null {
  for (const ponto of rota.slice(0, 2)) {
    const c = coordDe(ponto);
    const p = w.portas.find((q) => mesma(q.coord, c));
    if (!p || p.abertura >= PORTA.livreEm || distancia(w.jogador.pos, centro(p.coord)) > ENCOSTADO) continue;
    if (p.estado === 'fechada' || (p.estado === 'trancada' && podeAbrir(w, p))) return p;
  }
  return null;
}

/** Comporta fechada (perigo ativo) nos próximos pontos da rota. */
function comportaNaFrente(w: World, rota: readonly Vec2[]): boolean {
  return rota.slice(0, 2).some((p) => {
    const [col, row] = coordDe(p);
    return celulaFechada(w, col, row);
  });
}

/**
 * Perto de um objetivo (que não é a saída) que continua pendente por `DESISTIR` s seguidos: abandona-o e
 * força um novo plano. Devolve true quando acabou de desistir.
 */
function desistiu(r: Robo, o: Objetivo, pos: Vec2): boolean {
  const alvo = o.rota[o.rota.length - 1] ?? pos;
  if (o.chave === 'saida' || distancia(pos, alvo) >= PERTO_OBJETIVO) {
    r.pendente = 0;
    return false;
  }
  r.pendente += PASSO;
  if (r.pendente < DESISTIR) return false;
  r.descartados.add(o.chave);
  r.objetivo = null;
  r.pendente = 0;
  r.recalculaEm = 0;
  return true;
}

/** Detecta se está preso; se estiver, começa um desvio lateral. */
function vigiarPreso(r: Robo, pos: Vec2): void {
  r.ancoraT += PASSO;
  if (!(r.ancoraT >= JANELA_PRESO || Number.isNaN(r.ancora.x))) return;
  if (!Number.isNaN(r.ancora.x) && distancia(pos, r.ancora) < DESLOCAMENTO_MIN) {
    r.desvio = DESVIO;
    r.lado = r.lado === 1 ? -1 : 1;
  }
  r.ancora = { x: pos.x, z: pos.z };
  r.ancoraT = 0;
}

/** Input do robô para um passo de `PASSO` segundos; atualiza o estado `r`. */
export function decidir(w: World, r: Robo): InputFrame {
  const input: InputFrame = { ...INPUT_VAZIO };
  const j = w.jogador;
  const apertarUsar = (alvo: Vec2) => {
    input.dYaw = giro(j, alvo);
    input.usar = !r.usou;
  };
  const fim = () => {
    r.usou = input.usar;
    return input;
  };

  const inimigo = inimigoVisivel(w);
  if (inimigo) {
    input.dYaw = giro(j, inimigo.pos);
    input.atirar = !j.gatilho;
    return fim();
  }

  r.recalculaEm -= PASSO;
  if (r.recalculaEm <= 0) {
    const antes = r.objetivo?.chave;
    r.objetivo = planejar(w, r.descartados);
    r.recalculaEm = RECALCULO;
    if (r.objetivo?.chave !== antes) r.pendente = 0;
  }
  const o = r.objetivo;
  if (!o) {
    r.semCaminho += PASSO;
    return fim();
  }
  r.semCaminho = 0;
  if (desistiu(r, o, j.pos)) return fim();

  avancarRota(o, j.pos);
  if (comportaNaFrente(w, o.rota)) {
    // espera parado; a janela de "preso" recomeça para não virar desvio ao fim da espera
    r.ancora = { x: j.pos.x, z: j.pos.z };
    r.ancoraT = 0;
    return fim();
  }
  vigiarPreso(r, j.pos);
  if (r.desvio > 0) {
    r.desvio -= PASSO;
    input.lado = r.lado;
    if (r.desvio <= 0) r.recalculaEm = 0;
    return fim();
  }

  const chegou = o.rota.length === 0 || (o.rota.length === 1 && distancia(j.pos, o.rota[0]) < CHEGADA);
  if (o.usarEm && distancia(j.pos, o.usarEm) <= PORTA.alcanceUso - FOLGA_USO && chegou) {
    apertarUsar(o.usarEm);
    return fim();
  }
  const porta = portaParaAbrir(w, o.rota);
  if (porta) {
    apertarUsar(centro(porta.coord));
    input.frente = 1;
    return fim();
  }
  if (chegou && o.rota.length === 0) return fim();

  const alvo = o.rota[0];
  input.dYaw = giro(j, alvo);
  input.frente = 1;
  const aqui = coordDe(j.pos);
  const prox = coordDe(alvo);
  const vizinha = Math.abs(aqui[0] - prox[0]) + Math.abs(aqui[1] - prox[1]) === 1;
  if (vizinha && !passavel(w.grid, aqui, prox, DEGRAU) && passavel(w.grid, aqui, prox, SALTO)) input.pular = !j.puloApertado;
  return fim();
}

/** Joga a fase na simulação: segue o caminho até cartões, gatilhos e portas e depois até a saída. */
export function percorrer(f: LevelDef, limiteSegundos = 600, opcoes: OpcoesRobo = {}): ResultadoRobo {
  const semInimigos = opcoes.semInimigos ?? true;
  const w = criarWorld(f);
  // sem inimigos: todos contam como mortos (os iniciais, os de `spawn` e o chefe, que é um Inimigo em
  // `w.inimigos`: a IA dele passa à fase 'morto' no passo seguinte), e `grupo_morto` e `chefe_morto` disparam
  const matar = () => {
    if (semInimigos) for (const i of w.inimigos) i.modo = 'morto';
  };
  matar();
  const r = novoRobo();
  const total = Math.round(limiteSegundos / PASSO);
  for (let passos = 1; passos <= total; passos++) {
    step(w, decidir(w, r), PASSO);
    matar();
    if (w.estado === 'concluida') return { concluiu: true, passos, motivo: 'saída' };
    if (w.estado === 'morto') return { concluiu: false, passos, motivo: 'morte' };
    if (r.semCaminho >= SEM_CAMINHO_MAX) return { concluiu: false, passos, motivo: 'sem caminho' };
  }
  return { concluiu: false, passos: total, motivo: 'tempo' };
}
