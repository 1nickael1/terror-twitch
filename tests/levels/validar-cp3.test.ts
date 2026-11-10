// Validador (C3.3): condição `tempo`, corpos, grupo só de corpos, perigos de área, chefe 049 e catálogo do CP3.
import { describe, expect, it } from 'vitest';
import { validarFase } from '../../src/levels/validar';
import type { ChefeDef, GatilhoDef, LevelDef, PerigoArea, PerigoDef } from '../../src/sim/fase';
import { faseComChefe049, faseMinima } from '../sim/ajuda';

const livre = { minSegredos: 0, minCartoes: 0 };

/* Corredor simples: P em [1, 1], saída em [8, 1]. */
const CORREDOR = '##########\n#P.......#\n##########';

function corredor(extra: Partial<LevelDef> = {}): LevelDef {
  return faseMinima(CORREDOR, { saida: [8, 1], ...extra });
}

describe('validarFase: condição tempo', () => {
  const inicio: GatilhoDef = { id: 'necroterio', quando: { tipo: 'area', area: [3, 1, 1, 1] }, faz: [{ acao: 'mensagem', texto: 'Elevador chamado.' }] };

  it('aceita tempo contado desde um gatilho que existe (inclusive encadeado)', () => {
    const gaveta: GatilhoDef = { id: 'gaveta', quando: { tipo: 'tempo', apos: 3, desde: 'necroterio' }, faz: [{ acao: 'som', id: 'gaveta' }] };
    const elevador: GatilhoDef = { id: 'elevador', quando: { tipo: 'tempo', apos: 40, desde: 'gaveta' }, faz: [{ acao: 'som', id: 'elevador' }] };
    expect(validarFase(corredor({ gatilhos: [inicio, gaveta, elevador] }), livre)).toEqual([]);
  });

  it('acusa `desde` inexistente', () => {
    const g: GatilhoDef = { id: 'elevador', quando: { tipo: 'tempo', apos: 3, desde: 'nada' }, faz: [] };
    expect(validarFase(corredor({ gatilhos: [inicio, g] }), livre)).toContain('Gatilho "elevador" conta o tempo desde o gatilho "nada", que não existe');
  });

  it('acusa `desde` igual ao próprio gatilho', () => {
    const g: GatilhoDef = { id: 'eco', quando: { tipo: 'tempo', apos: 3, desde: 'eco' }, faz: [] };
    expect(validarFase(corredor({ gatilhos: [g] }), livre)).toContain('Gatilho "eco" conta o tempo desde ele mesmo');
  });
});

describe('validarFase: corpos', () => {
  it('aceita corpo de tipo reanimável', () => {
    const f = corredor({ inimigos: [{ em: [4, 1], tipo: 'reanimado', corpo: true }] });
    expect(validarFase(f, livre)).toEqual([]);
  });

  it('acusa corpo de tipo não reanimável (fase e spawn)', () => {
    const f = corredor({
      inimigos: [{ em: [4, 1], tipo: 'funcionario', corpo: true }],
      gatilhos: [{ id: 'g', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [{ acao: 'spawn', inimigos: [{ em: [5, 1], tipo: 'enfermeiro', corpo: true }] }] }],
    });
    const erros = validarFase(f, livre);
    expect(erros).toContain('Inimigo #0 é corpo, mas o tipo "funcionario" não é reanimável');
    expect(erros).toContain('Gatilho "g" cria corpo de tipo não reanimável "enfermeiro"');
  });

  it('acusa grupo de grupo_morto formado só por corpos (dispara assim que existe)', () => {
    const espera: GatilhoDef = { id: 'limpo', quando: { tipo: 'grupo_morto', grupo: 'macas' }, faz: [{ acao: 'mensagem', texto: 'Limpo.' }] };
    const corpos = corredor({
      inimigos: [{ em: [4, 1], tipo: 'reanimado', corpo: true, grupo: 'macas' }, { em: [5, 1], tipo: 'reanimado', corpo: true, grupo: 'macas' }],
      gatilhos: [espera],
    });
    expect(validarFase(corpos, livre)).toContain('Gatilho "limpo" espera a morte do grupo "macas", que só tem corpos (dispara assim que o grupo existe)');
    const misto = corredor({
      inimigos: [{ em: [4, 1], tipo: 'reanimado', corpo: true, grupo: 'macas' }, { em: [5, 1], tipo: 'reanimado', grupo: 'macas' }],
      gatilhos: [espera],
    });
    expect(validarFase(misto, livre)).toEqual([]);
  });

  it('o grupo só de corpos criado por spawn também é acusado', () => {
    const f = corredor({
      gatilhos: [
        { id: 'gavetas', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [{ acao: 'spawn', inimigos: [{ em: [5, 1], tipo: 'reanimado', corpo: true, grupo: 'g' }] }] },
        { id: 'limpo', quando: { tipo: 'grupo_morto', grupo: 'g' }, faz: [] },
      ],
    });
    expect(validarFase(f, livre)).toContain('Gatilho "limpo" espera a morte do grupo "g", que só tem corpos (dispara assim que o grupo existe)');
  });
});

/*
 * Arena do 049 (b) nas colunas 2 a 4; P em [1, 1]; saída X em [6, 3]; à direita, cômodo isolado.
 */
const PLANTA = [
  '###########',
  '#P....#...#',
  '#.....#...#',
  '#...b.X#..#',
  '###########',
].join('\n');

const uv: PerigoArea = { id: 'uv', tipo: 'ultravioleta', area: [2, 1, 3, 3], aviso: 1, duracao: 4, recarga: 8, danoChefePorSeg: 0.07, danoPorSeg: 10 };
const aciona: GatilhoDef = { id: 'botao', quando: { tipo: 'area', area: [1, 1, 1, 1] }, faz: [{ acao: 'perigo', id: 'uv' }], umaVez: false };

function arena(perigo: Partial<PerigoArea> = {}, chefe: Partial<ChefeDef> = {}, extra: Partial<LevelDef> = {}): LevelDef {
  const p: PerigoDef = { ...uv, ...perigo };
  return faseComChefe049(PLANTA, { em: 'b', arena: [2, 1, 3, 3], perigos: [p], ...chefe }, { saida: [6, 3], gatilhos: [aciona], ...extra });
}

describe('validarFase: perigos de área', () => {
  it('aceita perigo de área bem definido (UV e vapor)', () => {
    expect(validarFase(arena(), livre)).toEqual([]);
    expect(validarFase(arena({ tipo: 'vapor' }), livre)).toEqual([]);
  });

  it('acusa aviso menor que 0,4 s', () => {
    expect(validarFase(arena({ aviso: 0.3 }), livre)).toContain('Perigo "uv" tem aviso menor que 0,4 s');
    expect(validarFase(arena({ aviso: 0.4, recarga: 8 }), livre)).toEqual([]);
  });

  it('acusa números não positivos', () => {
    expect(validarFase(arena({ duracao: 0, danoChefePorSeg: 0.07 }), livre)).toContain('Perigo "uv" tem duracao não positivo');
    expect(validarFase(arena({ danoPorSeg: 0 }), livre)).toContain('Perigo "uv" tem danoPorSeg não positivo');
    expect(validarFase(arena({ danoChefePorSeg: -0.07 }), livre)).toContain('Perigo "uv" tem danoChefePorSeg não positivo');
    expect(validarFase(arena({ recarga: Number.NaN }), livre)).toContain('Perigo "uv" tem recarga não positivo');
  });

  it('acusa recarga menor que aviso + duração', () => {
    expect(validarFase(arena({ recarga: 4.9 }), livre)).toContain('Perigo "uv" tem recarga menor que aviso + duração');
    expect(validarFase(arena({ recarga: 5 }), livre)).toEqual([]);
  });

  it('acusa dano no chefe por acionamento fora de 0,2 a 0,35 da vida', () => {
    expect(validarFase(arena({ danoChefePorSeg: 0.1 }), livre)).toContain('Perigo "uv" tira 0,4 da vida do chefe por acionamento (precisa ficar entre 0,2 e 0,35)');
    expect(validarFase(arena({ danoChefePorSeg: 0.04 }), livre)).toContain('Perigo "uv" tira 0,16 da vida do chefe por acionamento (precisa ficar entre 0,2 e 0,35)');
    expect(validarFase(arena({ danoChefePorSeg: 0.05 }), livre)).toEqual([]);
    expect(validarFase(arena({ danoChefePorSeg: 0.35 / 4 }), livre)).toEqual([]);
  });

  it('acusa área fora de célula andável e perigo que nenhum gatilho aciona', () => {
    expect(validarFase(arena({ area: [5, 1, 2, 1] }), livre)).toContain('Perigo "uv" tem área fora de célula andável');
    expect(validarFase(arena({}, {}, { gatilhos: [] }), livre)).toContain('Perigo "uv" não é acionado por nenhum gatilho');
  });

  it('a comporta mantém a regra dela (recarga >= duração) e não passa pelas regras de área', () => {
    const comporta: PerigoDef = { id: 'c1', tipo: 'comporta', area: [5, 1, 1, 3], duracao: 3, recarga: 3, danoChefe: 0.5, danoComum: 20 };
    const f = faseComChefe049(PLANTA, { em: 'b', arena: [2, 1, 3, 3], perigos: [comporta] }, {
      saida: [6, 3], gatilhos: [{ ...aciona, faz: [{ acao: 'perigo', id: 'c1' }] }],
    });
    expect(validarFase(f, livre)).toEqual([]);
  });
});

describe('validarFase: chefe 049 e catálogo do CP3', () => {
  it('aceita o 049 e acusa tipo sem IA de chefe', () => {
    expect(validarFase(arena(), livre)).toEqual([]);
    expect(validarFase(arena({}, { tipo: 'reanimado' }), livre)).toContain('Chefe tem tipo desconhecido "reanimado"');
  });

  it('aceita os props, o som de fundo e os sons de gatilho novos', () => {
    const f = corredor({
      props: (['gavetas', 'cortina', 'autoclave', 'carrinho', 'lampada_uv'] as const).map((tipo, i) => ({ em: [i + 2, 1] as const, tipo })),
      ambiente: { nevoa: 0, corNevoa: 0, ambiente: 1, somDeFundo: 'hospital', musica: '' },
      gatilhos: [{ id: 'g', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [{ acao: 'som', id: 'gaveta' }, { acao: 'som', id: 'elevador' }] }],
    });
    expect(validarFase(f, livre)).toEqual([]);
  });
});
