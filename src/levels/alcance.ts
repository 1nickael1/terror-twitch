// Busca de alcance do validador: largura com portas, cartões, gatilhos e teleportes. Lógica pura.
import type { Area, Condicao, LevelDef, Onde, PortaDef } from '../sim/fase';
import { celula, passavel, SALTO, type Coord, type Grid } from '../sim/grid';

const VIZINHOS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const VAO_MINIMO = 1.8;

/** Tudo o que a busca de alcance precisa, já resolvido (símbolos inválidos viram `null`). */
export interface Contexto {
  f: LevelDef; g: Grid; inicio: Coord;
  onde: (em: Onde) => Coord | null;
  portas: { def: PortaDef; coord: Coord | null }[];
  grupos: Set<string>;
  /** true: gatilhos de condição `chefe_*` não valem (alcance antes de o chefe morrer) */
  semChefe?: boolean;
}

/** Porta forçada na busca: sempre aberta ou sempre sólida, qualquer que seja o estado. */
export interface Forcada { id: string; aberta: boolean }

/** Resultado da busca: `noAlcance` diz se a célula é alcançável. */
export interface Alcance { noAlcance: (c: Coord) => boolean }

/** Piso com vão suficiente para o jogador. */
export function andavel(g: Grid, c: Coord): boolean {
  const cel = celula(g, c[0], c[1]);
  return cel.tipo === 'piso' && cel.teto - cel.piso >= VAO_MINIMO;
}

/** Células do retângulo [col, row, larg, alt]. */
export function celulasDe(a: Area): Coord[] {
  const cs: Coord[] = [];
  for (let row = a[1]; row < a[1] + a[3]; row++) {
    for (let col = a[0]; col < a[0] + a[2]; col++) cs.push([col, row]);
  }
  return cs;
}

/** Busca em largura em 4 direções a partir das origens, com `passavel(..., SALTO)`. */
function buscar(g: Grid, origens: readonly Coord[], fechada: (col: number, row: number) => boolean): boolean[] {
  const visto = new Array<boolean>(g.cols * g.rows).fill(false);
  const fila: Coord[] = [];
  for (const o of origens) {
    const i = o[1] * g.cols + o[0];
    if (!visto[i]) {
      visto[i] = true;
      fila.push(o);
    }
  }
  for (let k = 0; k < fila.length; k++) {
    const de = fila[k];
    for (const [dc, dr] of VIZINHOS) {
      const para: Coord = [de[0] + dc, de[1] + dr];
      const i = para[1] * g.cols + para[0];
      if (visto[i] || !passavel(g, de, para, SALTO, fechada)) continue;
      visto[i] = true;
      fila.push(para);
    }
  }
  return visto;
}

/** Célula alcançável ou vizinha (4 direções) de uma alcançável: terminais e documentos podem ficar em paredes. */
export function aoAlcanceDeUso(a: Alcance, c: Coord): boolean {
  return a.noAlcance(c) || VIZINHOS.some(([dc, dr]) => a.noAlcance([c[0] + dc, c[1] + dr]));
}

/** Alguma célula da área é alcançável. */
export function areaAlcancavel(a: Alcance, area: Area): boolean {
  return celulasDe(area).some((c) => a.noAlcance(c));
}

export function condicaoAlcancavel(ctx: Contexto, a: Alcance, q: Condicao): boolean {
  switch (q.tipo) {
    case 'area':
      return areaAlcancavel(a, q.area);
    case 'terminal': {
      const t = ctx.f.terminais.find((x) => x.id === q.id);
      const c = t ? ctx.onde(t.em) : null;
      return c !== null && aoAlcanceDeUso(a, c);
    }
    case 'pickup': {
      const p = ctx.f.pickups[q.indice];
      const c = p ? ctx.onde(p.em) : null;
      return c !== null && a.noAlcance(c);
    }
    case 'grupo_morto':
      return ctx.grupos.has(q.grupo);   // assume que o jogador mata o grupo
    case 'chefe_vida':
    case 'chefe_morto':
      return !ctx.semChefe;   // assume que o jogador mata o chefe (fase sem chefe é outro erro)
  }
}

/**
 * Alcance com estado: começa sem cartões; portas destrancadas abertas; trancadas com `exige` abrem
 * quando um cartão suficiente é alcançado; qualquer trancada abre quando um gatilho alcançável a abre
 * ou destranca; teleportes de gatilhos alcançáveis viram novas origens. Repete até não mudar mais nada.
 */
export function alcancar(ctx: Contexto, forcada?: Forcada): Alcance {
  const { f, g } = ctx;
  const abertas = new Set(f.portas.filter((p) => !p.trancada).map((p) => p.id));
  const origens: Coord[] = [ctx.inicio];
  const aberta = (id: string) => (forcada?.id === id ? forcada.aberta : abertas.has(id));
  let visto: boolean[] = [];
  const alcance: Alcance = {
    noAlcance: (c) => c[0] >= 0 && c[1] >= 0 && c[0] < g.cols && c[1] < g.rows && visto[c[1] * g.cols + c[0]],
  };
  for (;;) {
    const fechadas = ctx.portas.filter((p) => p.coord && !aberta(p.def.id)).map((p) => p.coord!);
    visto = buscar(g, origens, (col, row) => fechadas.some((c) => c[0] === col && c[1] === row));
    let mudou = false;
    const abrir = (id: string) => {
      if (abertas.has(id)) return;
      abertas.add(id);
      mudou = true;
    };
    let nivel = 0;
    for (const p of f.pickups) {
      const c = ctx.onde(p.em);
      if (p.tipo === 'cartao' && p.nivel && c && alcance.noAlcance(c)) nivel = Math.max(nivel, p.nivel);
    }
    for (const p of f.portas) if (p.exige !== undefined && p.exige <= nivel) abrir(p.id);
    for (const gat of f.gatilhos) {
      if (!condicaoAlcancavel(ctx, alcance, gat.quando)) continue;
      for (const acao of gat.faz) {
        if (acao.acao === 'porta' && (acao.estado === 'abrir' || acao.estado === 'destrancar')) abrir(acao.id);
        if (acao.acao === 'teleporte' && andavel(g, acao.para) && !alcance.noAlcance(acao.para)) {
          origens.push(acao.para);
          mudou = true;
        }
      }
    }
    if (!mudou) return alcance;
  }
}
