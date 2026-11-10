// Grade 2.5D da simulação: células com piso, teto e rampas. Lógica pura (sem three, DOM ou áudio).

export const CELL = 2;
export const DEGRAU = 0.5;   // sobe andando
export const SALTO = 1.1;    // sobe pulando

export interface Vec2 { x: number; z: number }
export type Coord = readonly [col: number, row: number];
export type TipoCelula = 'piso' | 'parede' | 'janela' | 'grade' | 'tubo';
export interface CelulaDef { tipo?: TipoCelula; piso?: number; teto?: number; rampa?: 'x' | 'z' }
export interface Celula { tipo: TipoCelula; piso: number; teto: number; rampa: 'x' | 'z' | null }
export interface Grid { cols: number; rows: number; celulas: Celula[]; marcas: Map<string, Coord[]> }
/** true = célula ocupada por algo dinâmico (porta fechada) */
export type Solido = (col: number, row: number) => boolean;

/** Pé-direito padrão: o teto fica 3 m acima do piso quando a legenda não diz outro valor. */
const PE_DIREITO = 3;
const VAO_MINIMO = 1.8;

const FORA: Celula = Object.freeze({ tipo: 'parede', piso: 0, teto: PE_DIREITO, rampa: null });

function novaCelula(def: CelulaDef): Celula {
  const piso = def.piso ?? 0;
  return { tipo: def.tipo ?? 'piso', piso, teto: def.teto ?? piso + PE_DIREITO, rampa: def.rampa ?? null };
}

export function criarGrid(planta: string, legenda: Record<string, CelulaDef> = {}): Grid {
  const brutas = planta.replace(/\r/g, '').split('\n').filter((l) => l.trim().length > 0);
  const recuo = Math.min(...brutas.map((l) => l.length - l.trimStart().length));
  const semRecuo = brutas.map((l) => l.slice(recuo).trimEnd());
  const cols = Math.max(0, ...semRecuo.map((l) => l.length));
  const linhas = semRecuo.map((l) => l.padEnd(cols, ' '));

  const celulas: Celula[] = [];
  const tetoDado: boolean[] = [];
  const marcas = new Map<string, Coord[]>();
  const marcar = (ch: string, col: number, row: number) => {
    const lista = marcas.get(ch) ?? [];
    lista.push([col, row]);
    marcas.set(ch, lista);
  };

  linhas.forEach((linha, row) => {
    for (let col = 0; col < cols; col++) {
      const ch = linha[col];
      if (ch === '#' || ch === ' ') {
        celulas.push(novaCelula({ tipo: 'parede' }));
      } else if (ch === '.') {
        celulas.push(novaCelula({}));
      } else if (Object.prototype.hasOwnProperty.call(legenda, ch)) {
        celulas.push(novaCelula(legenda[ch]));
        tetoDado[celulas.length - 1] = legenda[ch].teto !== undefined;
        marcar(ch, col, row);
      } else if (/^[A-Za-z]$/.test(ch)) {
        celulas.push(novaCelula({}));
        marcar(ch, col, row);
      } else {
        throw new Error(`Símbolo desconhecido na planta: "${ch}"`);
      }
    }
  });

  if ((marcas.get('P') ?? []).length !== 1) throw new Error('Planta precisa de exatamente um P');
  const g: Grid = { cols, rows: linhas.length, celulas, marcas };
  ajustarRampas(g, tetoDado);
  return g;
}

/**
 * Rampa: `piso` = menor piso das vizinhas do eixo; sem `teto` na legenda, `teto` = maior piso + 3.
 * Calcula tudo antes de aplicar, para não depender da ordem entre rampas vizinhas.
 */
function ajustarRampas(g: Grid, tetoDado: boolean[]): void {
  const ajustes: { i: number; piso: number; teto: number }[] = [];
  g.celulas.forEach((c, i) => {
    if (!c.rampa) return;
    const col = i % g.cols;
    const row = Math.floor(i / g.cols);
    const [a, b] = c.rampa === 'x'
      ? [celula(g, col - 1, row).piso, celula(g, col + 1, row).piso]
      : [celula(g, col, row - 1).piso, celula(g, col, row + 1).piso];
    ajustes.push({ i, piso: Math.min(a, b), teto: tetoDado[i] ? c.teto : Math.max(a, b) + PE_DIREITO });
  });
  for (const { i, piso, teto } of ajustes) {
    g.celulas[i] = { ...g.celulas[i], piso, teto };
  }
}

/** Fora da grade é parede. */
export function celula(g: Grid, col: number, row: number): Celula {
  if (col < 0 || row < 0 || col >= g.cols || row >= g.rows) return FORA;
  return g.celulas[row * g.cols + col];
}

export function centro(c: Coord): Vec2 {
  return { x: c[0] * CELL + CELL / 2, z: c[1] * CELL + CELL / 2 };
}

export function coordDe(p: Vec2): Coord {
  return [Math.floor(p.x / CELL), Math.floor(p.z / CELL)];
}

/** Altura do piso da célula (col,row) no ponto (x,z); em rampa, interpola entre as vizinhas do eixo. */
function alturaEm(g: Grid, col: number, row: number, x: number, z: number): number {
  const c = celula(g, col, row);
  if (c.rampa === 'x') {
    const t = Math.min(1, Math.max(0, x / CELL - col));
    const oeste = celula(g, col - 1, row).piso;
    return oeste + (celula(g, col + 1, row).piso - oeste) * t;
  }
  if (c.rampa === 'z') {
    const t = Math.min(1, Math.max(0, z / CELL - row));
    const norte = celula(g, col, row - 1).piso;
    return norte + (celula(g, col, row + 1).piso - norte) * t;
  }
  return c.piso;
}

export function alturaPiso(g: Grid, p: Vec2): number {
  const [col, row] = coordDe(p);
  return alturaEm(g, col, row, p.x, p.z);
}

/** Altura da célula `c` na borda que encosta na vizinha `outra` (que deve ser adjacente). */
function alturaBorda(g: Grid, c: Coord, outra: Coord): number {
  const [col, row] = c;
  const borda = {
    x: outra[0] > col ? (col + 1) * CELL : outra[0] < col ? col * CELL : col * CELL + CELL / 2,
    z: outra[1] > row ? (row + 1) * CELL : outra[1] < row ? row * CELL : row * CELL + CELL / 2,
  };
  return alturaEm(g, col, row, borda.x, borda.z);
}

function andavel(c: Celula): boolean {
  return c.tipo === 'piso';
}

/**
 * Dá para ir de `de` a `para` (vizinhas): piso andável, sem sólido, com vão livre, subindo até
 * `alcance` e descendo até `queda` (padrão: qualquer altura).
 */
export function passavel(g: Grid, de: Coord, para: Coord, alcance: number, solido?: Solido, queda = Infinity): boolean {
  const alvo = celula(g, para[0], para[1]);
  if (!andavel(alvo)) return false;
  if (solido?.(para[0], para[1])) return false;
  if (alvo.teto - alvo.piso < VAO_MINIMO) return false;
  const subida = alturaBorda(g, para, de) - alturaBorda(g, de, para);
  return subida <= alcance && -subida <= queda;
}

// ---------------------------------------------------------------------------------------------
// Parte 2: colisão, visão, tiro e caminho.

/** Quadrado da distância de (x,z) ao ponto mais próximo da célula (col,row). */
function distCelula2(col: number, row: number, x: number, z: number): number {
  const ddx = x - Math.max(col * CELL, Math.min(x, (col + 1) * CELL));
  const ddz = z - Math.max(row * CELL, Math.min(z, (row + 1) * CELL));
  return ddx * ddx + ddz * ddz;
}

/**
 * O círculo em (x,z) bate em alguma célula bloqueante? Uma célula que o círculo já sobrepunha
 * na `partida` não bloqueia se a candidata não afunda mais nela: quem está sobreposto
 * (porta que fechou em cima, borda alta que acabou de deixar) consegue sair, nunca entrar mais.
 */
function circuloBate(
  g: Grid, partida: Vec2, x: number, z: number, y: number, raio: number, alcance: number, solido?: Solido,
): boolean {
  const r2 = raio * raio;
  const c0 = Math.floor((x - raio) / CELL);
  const c1 = Math.floor((x + raio) / CELL);
  const r0 = Math.floor((z - raio) / CELL);
  const r1 = Math.floor((z + raio) / CELL);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const d2 = distCelula2(col, row, x, z);
      if (d2 >= r2) continue;
      const nx = Math.max(col * CELL, Math.min(x, (col + 1) * CELL));
      const nz = Math.max(row * CELL, Math.min(z, (row + 1) * CELL));
      // em rampa vale a altura no ponto da célula mais próximo do círculo
      const bloqueia = !andavel(celula(g, col, row)) || !!solido?.(col, row)
        || alturaEm(g, col, row, nx, nz) > y + alcance;
      if (!bloqueia) continue;
      const d2Partida = distCelula2(col, row, partida.x, partida.z);
      if (d2Partida < r2 && d2 >= d2Partida) continue;
      return true;
    }
  }
  return false;
}

/** Move o círculo eixo a eixo (x, depois z), como no protótipo. `y` é a altura dos pés. */
export function moverComColisao(
  g: Grid, pos: Vec2, y: number, dx: number, dz: number, raio: number, alcance: number, solido?: Solido,
): Vec2 {
  let x = pos.x + dx;
  if (circuloBate(g, pos, x, pos.z, y, raio, alcance, solido)) x = pos.x;
  let z = pos.z + dz;
  if (circuloBate(g, { x, z: pos.z }, x, z, y, raio, alcance, solido)) z = pos.z;
  return { x, z };
}

function bloqueiaVisao(g: Grid, col: number, row: number, solido?: Solido): boolean {
  const t = celula(g, col, row).tipo;
  return t === 'parede' || t === 'tubo' || !!solido?.(col, row);
}

function bloqueiaTiro(g: Grid, col: number, row: number, solido?: Solido): boolean {
  return bloqueiaVisao(g, col, row, solido) || celula(g, col, row).tipo === 'janela';
}

const PASSO_VISAO = 0.25;
const PASSO_TIRO = 0.1;

/** Em célula andável, a altura `h` do raio no ponto (x,z) está abaixo do piso ou acima do teto. */
function foraDoVao(g: Grid, col: number, row: number, x: number, z: number, h: number): boolean {
  const c = celula(g, col, row);
  if (!andavel(c)) return false;
  return alturaEm(g, col, row, x, z) > h || c.teto < h;
}

/**
 * Passo diagonal entre amostras (muda coluna e linha juntas): fecha a quina quando as duas
 * células ortogonais da transição bloqueiam.
 */
function quinaFechada(antes: Coord, agora: Coord, bloqueia: (col: number, row: number) => boolean): boolean {
  if (antes[0] === agora[0] || antes[1] === agora[1]) return false;
  return bloqueia(agora[0], antes[1]) && bloqueia(antes[0], agora[1]);
}

/**
 * Linha de visão de `a` a `b`. Com `ya` e `yb` (alturas absolutas dos olhos), o raio também é
 * barrado por piso acima dele ou teto abaixo dele; sem eles, a checagem é só em planta.
 */
export function visivel(g: Grid, a: Vec2, b: Vec2, solido?: Solido, ya?: number, yb?: number): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / PASSO_VISAO));
  const bloqueia = (col: number, row: number) => bloqueiaVisao(g, col, row, solido);
  let antes = coordDe(a);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = a.x + dx * t;
    const z = a.z + dz * t;
    const agora = coordDe({ x, z });
    const [col, row] = agora;
    if (bloqueia(col, row) || quinaFechada(antes, agora, bloqueia)) return false;
    if (ya !== undefined && yb !== undefined && foraDoVao(g, col, row, x, z, ya + (yb - ya) * t)) return false;
    antes = agora;
  }
  return true;
}

/**
 * distância até o primeiro bloqueio de tiro na direção dada, limitada a `max`.
 * Com `y0` (altura absoluta do cano), a amostra à distância `d` fica em `y0 + inclinacao * d`
 * e para também no chão, no teto e em degraus altos.
 */
export function alcanceTiro(
  g: Grid, origem: Vec2, dir: Vec2, max: number, solido?: Solido, y0?: number, inclinacao = 0,
): number {
  const len = Math.hypot(dir.x, dir.z);
  if (len === 0 || max <= 0) return 0;
  const ux = dir.x / len;
  const uz = dir.z / len;
  const bloqueia = (col: number, row: number) => bloqueiaTiro(g, col, row, solido);
  let antes = coordDe(origem);
  for (let i = 1; i * PASSO_TIRO < max; i++) {
    const d = i * PASSO_TIRO;
    const x = origem.x + ux * d;
    const z = origem.z + uz * d;
    const agora = coordDe({ x, z });
    const [col, row] = agora;
    if (bloqueia(col, row) || quinaFechada(antes, agora, bloqueia)) return d;
    if (y0 !== undefined && foraDoVao(g, col, row, x, z, y0 + inclinacao * d)) return d;
    antes = agora;
  }
  return max;
}

const VIZINHOS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const CUSTO_SUBIDA = 0.5;

/**
 * A* em 4 direções. Devolve os centros das células (sem a origem), terminando em `para`.
 * `queda`: maior descida aceita numa aresta (padrão: qualquer altura; os inimigos usam `SALTO`).
 */
export function caminho(g: Grid, de: Vec2, para: Vec2, alcance: number, solido?: Solido, queda = Infinity): Vec2[] | null {
  const [c0, r0] = coordDe(de);
  const [c1, r1] = coordDe(para);
  if (c0 === c1 && r0 === r1) return [];
  const dentro = (col: number, row: number) => col >= 0 && row >= 0 && col < g.cols && row < g.rows;
  if (!dentro(c0, r0) || !dentro(c1, r1)) return null;

  const idx = (col: number, row: number) => row * g.cols + col;
  const inicio = idx(c0, r0);
  const destino = idx(c1, r1);
  const custo = new Float64Array(g.cols * g.rows).fill(Infinity);
  const anterior = new Int32Array(g.cols * g.rows).fill(-1);
  // fila em ordem decrescente de f: o menor sai com pop()
  const fila: { i: number; f: number; custo: number }[] = [];
  const enfileirar = (i: number, f: number, c: number) => {
    let k = fila.length;
    while (k > 0 && fila[k - 1].f < f) k--;
    fila.splice(k, 0, { i, f, custo: c });
  };
  const h = (col: number, row: number) => Math.abs(col - c1) + Math.abs(row - r1);

  custo[inicio] = 0;
  enfileirar(inicio, h(c0, r0), 0);

  while (fila.length > 0) {
    const atual = fila.pop()!;
    if (atual.custo > custo[atual.i]) continue;
    if (atual.i === destino) break;
    const col = atual.i % g.cols;
    const row = Math.floor(atual.i / g.cols);
    for (const [dc, dr] of VIZINHOS) {
      const nc = col + dc;
      const nr = row + dr;
      if (!passavel(g, [col, row], [nc, nr], alcance, solido, queda)) continue;
      const sobe = alturaBorda(g, [nc, nr], [col, row]) > alturaBorda(g, [col, row], [nc, nr]);
      const novo = atual.custo + 1 + (sobe ? CUSTO_SUBIDA : 0);
      const ni = idx(nc, nr);
      if (novo >= custo[ni]) continue;
      custo[ni] = novo;
      anterior[ni] = atual.i;
      enfileirar(ni, novo + h(nc, nr), novo);
    }
  }

  if (anterior[destino] === -1) return null;
  const rota: Vec2[] = [];
  for (let i = destino; i !== inicio; i = anterior[i]) {
    rota.push(centro([i % g.cols, Math.floor(i / g.cols)]));
  }
  rota.reverse();
  rota[rota.length - 1] = { x: para.x, z: para.z };
  return rota;
}
