// Movimento dos inimigos: andar grudado no piso, linha reta quando dá, rota pela grade e portas. Lógica pura.
import { IA, PORTA } from '../balance';
import { comandarPorta, solidoDe } from '../doors';
import type { SimEvent } from '../eventos';
import {
  alturaPiso, caminho, centro, coordDe, DEGRAU, moverComColisao, passavel, SALTO, type Coord, type Grid, type Solido, type Vec2,
} from '../grid';
import { celulaFechada } from '../perigos';
import type { Inimigo, World } from '../world';
import { tipoDe } from './tipos';

/** Yaw de quem olha na direção (dx, dz), com frente = (-sin yaw, -cos yaw). */
export function yawPara(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

/** Ângulo em (-π, π]. */
export function normalizar(a: number): number {
  const v = a % (2 * Math.PI);
  if (v > Math.PI) return v - 2 * Math.PI;
  if (v <= -Math.PI) return v + 2 * Math.PI;
  return v;
}

/** Vira o inimigo para o ponto (se não está em cima dele). */
export function encarar(i: Inimigo, p: Vec2): void {
  const dx = p.x - i.pos.x;
  const dz = p.z - i.pos.z;
  if (Math.hypot(dx, dz) > 1e-6) i.yaw = yawPara(dx, dz);
}

/**
 * Anda em linha reta até `destino`, no máximo `vel * dt`, colidindo com a grade e com portas
 * fechadas, e fica na altura do piso. Chegou se parou no destino, ou se um bloqueio o deixou
 * parado a menos de `IA.chegada` dele.
 */
export function andar(w: World, i: Inimigo, destino: Vec2, vel: number, dt: number): boolean {
  const dx = destino.x - i.pos.x;
  const dz = destino.z - i.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return true;
  const passo = Math.min(d, vel * dt);
  if (passo <= 0) return false;
  const antes = i.pos;
  i.pos = moverComColisao(w.grid, i.pos, i.y, (dx / d) * passo, (dz / d) * passo, tipoDe(i.tipo).raio, DEGRAU, solidoDe(w));
  i.y = alturaPiso(w.grid, i.pos);
  i.yaw = yawPara(dx, dz);
  const resta = Math.hypot(destino.x - i.pos.x, destino.z - i.pos.z);
  const andou = Math.hypot(i.pos.x - antes.x, i.pos.z - antes.z);
  return resta < 1e-6 || (andou < passo / 2 && resta < IA.chegada);
}

const PASSO_LINHA = 0.25;

/**
 * O segmento só atravessa células por onde se anda (sobe até `DEGRAU`, desce até `SALTO`); em
 * diagonal, as duas quinas também.
 */
function trechoAndavel(g: Grid, a: Vec2, b: Vec2, solido: Solido): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / PASSO_LINHA));
  const pode = (de: Coord, para: Coord) => passavel(g, de, para, DEGRAU, solido, SALTO);
  let antes = coordDe(a);
  for (let k = 1; k <= n; k++) {
    const agora = coordDe({ x: a.x + (dx * k) / n, z: a.z + (dz * k) / n });
    if (agora[0] === antes[0] && agora[1] === antes[1]) continue;
    if (agora[0] !== antes[0] && agora[1] !== antes[1]) {
      const m1: Coord = [agora[0], antes[1]];
      const m2: Coord = [antes[0], agora[1]];
      if (!pode(antes, m1) || !pode(m1, agora) || !pode(antes, m2) || !pode(m2, agora)) return false;
    } else if (!pode(antes, agora)) {
      return false;
    }
    antes = agora;
  }
  return true;
}

/**
 * Dá para ir em linha reta: o centro e as duas bordas do corpo (90% do raio, para não começar
 * dentro de uma parede encostada) passam só por piso andável, sem portas fechadas nem degraus altos.
 */
export function linhaAndavel(w: World, i: Inimigo, destino: Vec2): boolean {
  const dx = destino.x - i.pos.x;
  const dz = destino.z - i.pos.z;
  const d = Math.hypot(dx, dz);
  const solido = solidoDe(w);
  if (d < 1e-6) return true;
  const r = tipoDe(i.tipo).raio * 0.9;
  const nx = (-dz / d) * r;
  const nz = (dx / d) * r;
  return trechoAndavel(w.grid, i.pos, destino, solido)
    && trechoAndavel(w.grid, { x: i.pos.x + nx, z: i.pos.z + nz }, { x: destino.x + nx, z: destino.z + nz }, solido)
    && trechoAndavel(w.grid, { x: i.pos.x - nx, z: i.pos.z - nz }, { x: destino.x - nx, z: destino.z - nz }, solido);
}

/**
 * Para planejar a rota, só porta trancada é sólida (a fechada o inimigo abre), além das células
 * fechadas por perigo ativo.
 */
export function solidoRota(w: World): Solido {
  return (col, row) => w.portas.some((p) => p.coord[0] === col && p.coord[1] === row && p.estado === 'trancada')
    || celulaFechada(w, col, row);
}

const VIZINHOS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Busca em largura a partir da célula do inimigo pelas células que ele alcança andando (mesmas
 * regras da rota: `DEGRAU`, `SALTO` e `solido`) e devolve o centro da mais próxima de `alvo`
 * (em planta). Empate: a primeira achada na busca.
 */
export function celulaMaisProxima(w: World, i: Inimigo, alvo: Vec2, solido: Solido = solidoRota(w)): Vec2 {
  const g = w.grid;
  const inicio = coordDe(i.pos);
  const visto = new Uint8Array(g.cols * g.rows);
  const fila: Coord[] = [inicio];
  const dentro = (c: Coord) => c[0] >= 0 && c[1] >= 0 && c[0] < g.cols && c[1] < g.rows;
  if (dentro(inicio)) visto[inicio[1] * g.cols + inicio[0]] = 1;
  let melhor = centro(inicio);
  let melhorD = Math.hypot(melhor.x - alvo.x, melhor.z - alvo.z);
  for (let k = 0; k < fila.length; k++) {
    const c = fila[k];
    const p = centro(c);
    const d = Math.hypot(p.x - alvo.x, p.z - alvo.z);
    if (d < melhorD) {
      melhor = p;
      melhorD = d;
    }
    for (const [dc, dr] of VIZINHOS) {
      const v: Coord = [c[0] + dc, c[1] + dr];
      if (!dentro(v) || visto[v[1] * g.cols + v[0]] || !passavel(g, c, v, DEGRAU, solido, SALTO)) continue;
      visto[v[1] * g.cols + v[0]] = 1;
      fila.push(v);
    }
  }
  return melhor;
}

/**
 * `chegou`: parou a menos de `IA.chegada` do destino (ver `andar`). `inalcancavel`: neste passo o
 * cálculo de rota falhou pela segunda vez seguida (no máximo uma vez por `IA.intervaloRota`).
 */
export interface Ida { chegou: boolean; inalcancavel: boolean; eventos: SimEvent[] }

/**
 * Leva o inimigo até `destino`: em linha reta quando dá; senão pela rota, calculada no máximo
 * uma vez a cada `IA.intervaloRota` (`rotaEm` conta o tempo; só o cálculo o reinicia). Rota
 * vazia longe do destino (já consumida ou sem caminho): espera parado o próximo cálculo. Porta
 * fechada no próximo ponto da rota: manda abrir e espera ela liberar a passagem.
 */
export function irPara(w: World, i: Inimigo, destino: Vec2, vel: number, dt: number): Ida {
  // falha de rota só conta em sequência para o mesmo destino (mesma célula)
  const celula = coordDe(destino);
  if (!i.destinoRota || i.destinoRota[0] !== celula[0] || i.destinoRota[1] !== celula[1]) {
    i.destinoRota = [celula[0], celula[1]];
    i.semRota = false;
  }
  if (linhaAndavel(w, i, destino)) {
    i.rota = [];
    return { chegou: andar(w, i, destino, vel, dt), inalcancavel: false, eventos: [] };
  }
  let inalcancavel = false;
  if (i.rotaEm <= 0) {
    const rota = caminho(w.grid, i.pos, destino, DEGRAU, solidoRota(w), SALTO);
    i.rotasCalculadas++;
    i.rotaEm = IA.intervaloRota;
    inalcancavel = rota === null && i.semRota;
    i.semRota = rota === null;
    // mesma célula: `caminho` devolve [] e o destino é o único ponto (andar reto, colidindo)
    i.rota = rota === null ? [] : rota.length > 0 ? rota : [{ x: destino.x, z: destino.z }];
  }
  const prox = i.rota[0];
  if (!prox) return { chegou: false, inalcancavel, eventos: [] };
  const [col, row] = coordDe(prox);
  const porta = w.portas.find((p) => p.coord[0] === col && p.coord[1] === row);
  if (porta && porta.abertura < PORTA.livreEm) {
    encarar(i, prox);
    return { chegou: false, inalcancavel, eventos: porta.estado === 'fechada' ? comandarPorta(w, porta.id, 'abrir') : [] };
  }
  if (andar(w, i, prox, vel, dt)) i.rota.shift();
  const chegou = i.rota.length === 0 && Math.hypot(destino.x - i.pos.x, destino.z - i.pos.z) < IA.chegada;
  return { chegou, inalcancavel, eventos: [] };
}

/** Afasta-se do ponto `de` andando para trás (de frente para ele). */
export function recuar(w: World, i: Inimigo, de: Vec2, vel: number, dt: number): void {
  const dx = i.pos.x - de.x;
  const dz = i.pos.z - de.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return;
  andar(w, i, { x: i.pos.x + dx / d, z: i.pos.z + dz / d }, vel, dt);
  encarar(i, de);
}
