// Validador de fases: estrutura, referências e alcance (busca em largura com portas, cartões e gatilhos). Lógica pura.
import { TIPOS } from '../sim/ai/tipos';
import type { Condicao, InimigoDef, LevelDef, Onde, PortaDef } from '../sim/fase';
import { celula, criarGrid, passavel, SALTO, type Coord, type Grid } from '../sim/grid';
import { resolverOnde } from '../sim/onde';

export interface OpcoesValidacao { minSegredos: number; minCartoes: number }

const PADRAO: OpcoesValidacao = { minSegredos: 2, minCartoes: 1 };
const VIZINHOS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const VAO_MINIMO = 1.8;

/** Tudo o que a busca de alcance precisa, já resolvido (símbolos inválidos viram `null`). */
interface Contexto {
  f: LevelDef; g: Grid; inicio: Coord;
  onde: (em: Onde) => Coord | null;
  portas: { def: PortaDef; coord: Coord | null }[];
  grupos: Set<string>;
}

/** Porta forçada na busca: sempre aberta ou sempre sólida, qualquer que seja o estado. */
interface Forcada { id: string; aberta: boolean }

/** Resultado da busca: `noAlcance` diz se a célula é alcançável. */
interface Alcance { noAlcance: (c: Coord) => boolean }

function andavel(g: Grid, c: Coord): boolean {
  const cel = celula(g, c[0], c[1]);
  return cel.tipo === 'piso' && cel.teto - cel.piso >= VAO_MINIMO;
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
function aoAlcanceDeUso(a: Alcance, c: Coord): boolean {
  return a.noAlcance(c) || VIZINHOS.some(([dc, dr]) => a.noAlcance([c[0] + dc, c[1] + dr]));
}

function condicaoAlcancavel(ctx: Contexto, a: Alcance, q: Condicao): boolean {
  switch (q.tipo) {
    case 'area':
      for (let row = q.area[1]; row < q.area[1] + q.area[3]; row++) {
        for (let col = q.area[0]; col < q.area[0] + q.area[2]; col++) if (a.noAlcance([col, row])) return true;
      }
      return false;
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
      return true;
  }
}

/**
 * Alcance com estado: começa sem cartões; portas destrancadas abertas; trancadas com `exige` abrem
 * quando um cartão suficiente é alcançado; qualquer trancada abre quando um gatilho alcançável a abre
 * ou destranca; teleportes de gatilhos alcançáveis viram novas origens. Repete até não mudar mais nada.
 */
function alcancar(ctx: Contexto, forcada?: Forcada): Alcance {
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

/** Ids repetidos de uma lista, cada um uma vez. */
function repetidos(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}

function inimigosDeSpawn(f: LevelDef): { gatilho: string; def: InimigoDef }[] {
  return f.gatilhos.flatMap((gat) => gat.faz.flatMap((a) => (a.acao === 'spawn' ? a.inimigos.map((def) => ({ gatilho: gat.id, def })) : [])));
}

/** Rampa precisa de piso comum (andável, sem rampa) dos dois lados do seu eixo. */
function errosDeRampa(g: Grid): string[] {
  const erros: string[] = [];
  const comum = (col: number, row: number) => {
    const c = celula(g, col, row);
    return c.tipo === 'piso' && c.rampa === null;
  };
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.cols; col++) {
      const r = celula(g, col, row).rampa;
      if (!r) continue;
      const ok = r === 'x' ? comum(col - 1, row) && comum(col + 1, row) : comum(col, row - 1) && comum(col, row + 1);
      if (!ok) erros.push(`Rampa em [${col}, ${row}] precisa ficar entre duas células de piso comuns`);
    }
  }
  return erros;
}

/** Lista de erros legíveis; vazia = fase válida. */
export function validarFase(f: LevelDef, o: Partial<OpcoesValidacao> = {}): string[] {
  const opcoes = { ...PADRAO, ...o };
  let g: Grid;
  try {
    g = criarGrid(f.planta, f.legenda);
  } catch (e) {
    return [e instanceof Error ? e.message : String(e)];
  }
  const erros: string[] = [];
  const erro = (texto: string) => {
    if (!erros.includes(texto)) erros.push(texto);
  };
  const onde = (em: Onde): Coord | null => {
    try {
      return resolverOnde(g, em);
    } catch (e) {
      erro(e instanceof Error ? e.message : String(e));
      return null;
    }
  };
  const spawns = inimigosDeSpawn(f);

  // estrutura, símbolos e referências
  for (const lista of [f.portas, f.gatilhos, f.segredos, f.documentos, f.terminais]) {
    for (const id of repetidos(lista.map((x) => x.id))) erro(`Id duplicado: "${id}"`);
  }
  errosDeRampa(g).forEach(erro);
  for (const def of [...f.portas, ...f.pickups, ...f.inimigos, ...f.terminais, ...f.documentos, ...spawns.map((s) => s.def)]) onde(def.em);
  f.pickups.forEach((p, i) => {
    const falta = (p.tipo === 'municao' && !p.municao) || (p.tipo === 'arma' && !p.arma) || (p.tipo === 'cartao' && !p.nivel);
    if (falta) erro(`Pickup #${i} mal definido (tipo "${p.tipo}")`);
  });
  const tipoValido = (t: string) => Object.prototype.hasOwnProperty.call(TIPOS, t);
  f.inimigos.forEach((ini, i) => {
    if (!tipoValido(ini.tipo)) erro(`Inimigo #${i} tem tipo desconhecido "${ini.tipo}"`);
  });
  for (const s of spawns) if (!tipoValido(s.def.tipo)) erro(`Gatilho "${s.gatilho}" cria inimigo de tipo desconhecido "${s.def.tipo}"`);

  const grupos = new Set([...f.inimigos, ...spawns.map((s) => s.def)].flatMap((d) => (d.grupo ? [d.grupo] : [])));
  // o grupo de luz `alarme` é sempre válido: a engine o acende com `world.alarme`
  const gruposDeLuz = new Set(['alarme', ...f.luzes.flatMap((l) => (l.grupo ? [l.grupo] : []))]);
  for (const gat of f.gatilhos) {
    const q = gat.quando;
    if (q.tipo === 'terminal' && !f.terminais.some((t) => t.id === q.id)) erro(`Gatilho "${gat.id}" referencia terminal "${q.id}" inexistente`);
    if (q.tipo === 'grupo_morto' && !grupos.has(q.grupo)) erro(`Gatilho "${gat.id}" referencia grupo "${q.grupo}" inexistente`);
    if (q.tipo === 'pickup' && !f.pickups[q.indice]) erro(`Gatilho "${gat.id}" referencia pickup #${q.indice} inexistente`);
    for (const a of gat.faz) {
      if (a.acao === 'porta' && !f.portas.some((p) => p.id === a.id)) erro(`Gatilho "${gat.id}" referencia porta "${a.id}" inexistente`);
      if (a.acao === 'teleporte' && !andavel(g, a.para)) erro(`Gatilho "${gat.id}" teleporta para célula não andável`);
      if (a.acao === 'luz' && !gruposDeLuz.has(a.grupo)) erro(`Gatilho "${gat.id}" referencia grupo de luz "${a.grupo}" inexistente`);
    }
  }
  for (const p of f.portas) {
    const temGatilho = f.gatilhos.some((gat) => gat.faz.some((a) => a.acao === 'porta' && a.id === p.id && (a.estado === 'abrir' || a.estado === 'destrancar')));
    if (p.trancada && p.exige === undefined && !temGatilho) erro(`Porta "${p.id}" nunca abre`);
    // sem `trancada`, a simulação abre a porta livre e o `exige` não vale nada
    if (p.exige !== undefined && !p.trancada) erro(`Porta "${p.id}" exige cartão mas não está trancada`);
  }

  // alcance
  const ctx: Contexto = { f, g, inicio: g.marcas.get('P')![0], onde, portas: f.portas.map((def) => ({ def, coord: onde(def.em) })), grupos };
  const a = alcancar(ctx);
  if (!a.noAlcance(f.saida)) erro('Saída inalcançável');
  for (const p of f.pickups) {
    const c = onde(p.em);
    // circular só quando o ponto fixo real não alcança o cartão; as buscas forçadas só dizem qual porta
    if (p.tipo !== 'cartao' || !p.nivel || !c || a.noAlcance(c)) continue;
    for (const porta of f.portas) {
      if (!porta.trancada || porta.exige === undefined || p.nivel < porta.exige) continue;
      if (alcancar(ctx, { id: porta.id, aberta: false }).noAlcance(c)) continue;
      if (alcancar(ctx, { id: porta.id, aberta: true }).noAlcance(c)) {
        erro(`Cartão nível ${p.nivel} só é alcançável passando pela porta "${porta.id}" que ele abre`);
      }
    }
  }
  f.pickups.forEach((p, i) => {
    const c = onde(p.em);
    if (c && !a.noAlcance(c)) erro(`Pickup #${i} inalcançável`);
  });
  f.inimigos.forEach((ini, i) => {
    const c = onde(ini.em);
    if (c && !a.noAlcance(c)) erro(`Inimigo #${i} inalcançável`);
    if (ini.patrulha?.some((ponto) => !andavel(g, ponto) || !a.noAlcance(ponto))) erro(`Inimigo #${i} tem ponto de patrulha inalcançável`);
  });
  for (const s of f.segredos) {
    if (!condicaoAlcancavel(ctx, a, { tipo: 'area', area: s.area })) erro(`Segredo "${s.id}" inalcançável`);
  }
  for (const d of f.documentos) {
    const c = onde(d.em);
    if (c && !aoAlcanceDeUso(a, c)) erro(`Documento "${d.id}" inalcançável`);
  }
  f.checkpoints.forEach((c, i) => {
    if (!a.noAlcance(c)) erro(`Checkpoint #${i} inalcançável`);
  });
  for (const t of f.terminais) {
    const c = onde(t.em);
    if (c && !aoAlcanceDeUso(a, c)) erro(`Terminal "${t.id}" inalcançável`);
  }

  // mínimos
  if (f.segredos.length < opcoes.minSegredos) erro(`Fase precisa de pelo menos ${opcoes.minSegredos} segredos (tem ${f.segredos.length})`);
  const cartoes = f.pickups.filter((p) => p.tipo === 'cartao').length;
  if (cartoes < opcoes.minCartoes) erro(`Fase precisa de pelo menos ${opcoes.minCartoes} cartões (tem ${cartoes})`);
  return erros;
}
