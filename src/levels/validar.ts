// Validador de fases: estrutura, referências e alcance (busca em largura com portas, cartões e gatilhos). Lógica pura.
// A busca fica em `alcance.ts`; chefe e perigos em `validarChefe.ts`; props e sons em `validarCatalogo.ts`.
import { TIPOS } from '../sim/ai/tipos';
import type { InimigoDef, LevelDef, Onde } from '../sim/fase';
import { celula, criarGrid, type Coord, type Grid } from '../sim/grid';
import { resolverOnde } from '../sim/onde';
import { alcancar, andavel, aoAlcanceDeUso, condicaoAlcancavel, type Contexto } from './alcance';
import { errosDeCatalogo } from './validarCatalogo';
import { errosDeChefe } from './validarChefe';

export interface OpcoesValidacao { minSegredos: number; minCartoes: number }

const PADRAO: OpcoesValidacao = { minSegredos: 2, minCartoes: 1 };

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
  for (const lista of [f.portas, f.gatilhos, f.segredos, f.documentos, f.terminais, f.chefe?.perigos ?? []]) {
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
  // corpo (`corpo: true`) só em tipo que o chefe 049 levanta; tipo desconhecido já tem erro próprio
  const corpoInvalido = (d: InimigoDef) => d.corpo === true && tipoValido(d.tipo) && !TIPOS[d.tipo].reanimavel;
  f.inimigos.forEach((ini, i) => {
    if (corpoInvalido(ini)) erro(`Inimigo #${i} é corpo, mas o tipo "${ini.tipo}" não é reanimável`);
  });
  for (const s of spawns) if (corpoInvalido(s.def)) erro(`Gatilho "${s.gatilho}" cria corpo de tipo não reanimável "${s.def.tipo}"`);

  const todos = [...f.inimigos, ...spawns.map((s) => s.def)];
  const grupos = new Set(todos.flatMap((d) => (d.grupo ? [d.grupo] : [])));
  // grupo feito só de corpos já nasce "morto": o `grupo_morto` dele dispara assim que o grupo existe
  const soCorpos = (grupo: string) => todos.filter((d) => d.grupo === grupo).every((d) => d.corpo === true);
  // o grupo de luz `alarme` é sempre válido: a engine o acende com `world.alarme`
  const gruposDeLuz = new Set(['alarme', ...f.luzes.flatMap((l) => (l.grupo ? [l.grupo] : []))]);
  for (const gat of f.gatilhos) {
    const q = gat.quando;
    if (q.tipo === 'terminal' && !f.terminais.some((t) => t.id === q.id)) erro(`Gatilho "${gat.id}" referencia terminal "${q.id}" inexistente`);
    if (q.tipo === 'grupo_morto' && !grupos.has(q.grupo)) erro(`Gatilho "${gat.id}" referencia grupo "${q.grupo}" inexistente`);
    if (q.tipo === 'grupo_morto' && grupos.has(q.grupo) && soCorpos(q.grupo)) {
      erro(`Gatilho "${gat.id}" espera a morte do grupo "${q.grupo}", que só tem corpos (dispara assim que o grupo existe)`);
    }
    if (q.tipo === 'tempo' && q.desde === gat.id) erro(`Gatilho "${gat.id}" conta o tempo desde ele mesmo`);
    else if (q.tipo === 'tempo' && !f.gatilhos.some((x) => x.id === q.desde)) {
      erro(`Gatilho "${gat.id}" conta o tempo desde o gatilho "${q.desde}", que não existe`);
    }
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
  errosDeCatalogo(f, g).forEach(erro);

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
  const patrulhaRuim = (ponto: Coord) => !andavel(g, ponto) || !a.noAlcance(ponto);
  f.inimigos.forEach((ini, i) => {
    const c = onde(ini.em);
    if (c && !a.noAlcance(c)) erro(`Inimigo #${i} inalcançável`);
    if (ini.patrulha?.some(patrulhaRuim)) erro(`Inimigo #${i} tem ponto de patrulha inalcançável`);
  });
  for (const s of spawns) {
    if (s.def.patrulha?.some(patrulhaRuim)) erro(`Inimigo criado pelo gatilho "${s.gatilho}" tem ponto de patrulha inalcançável`);
  }
  errosDeChefe(ctx, a).forEach(erro);
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
